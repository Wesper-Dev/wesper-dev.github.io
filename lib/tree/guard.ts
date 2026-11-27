// Frame-rate guard, URL flags and device profile of the tree scene (contract D8).
import { PALETTE_ORDER, DEFAULT_PALETTE } from '../../content/palettes.ts';
import type { PaletteId } from '../../content/palettes.ts';
import type { DeviceProfile } from './cloud.ts';
import { DEFAULT_SEED } from './skeleton.ts';

export type GuardVerdict = 'pending' | 'ok' | 'fail';

export type BackdropKind = 'halo' | 'foret' | 'ciel';
export type GrowthFlag = 'simple' | 'natural';

export interface FpsGuard {
  push(timestampMs: number): GuardVerdict;
  reset(): void;
  readonly frames: number;
  readonly fps: number | null;
}

// Frame-rate guard (D8.1, amended after the audits). Frames are measured in consecutive windows of
// `frames` images sharing their boundary image, so every interval belongs to exactly one window. The rate of a
// window is measured on its intervals without the longest tenth: fps = 1000 / mean(shortest 90 % of the intervals),
// which equals (frames - 1) / ((t_last - t_first) / 1000) at a steady rate. A few long intervals (main-thread
// hitches, a tab switch the page missed: up to 4 of the 44 intervals of a default window) are left out and never make
// a window slow (audit Fable F4), whereas a continuous slowness, steady or jerky (one long frame in three), still
// lowers the rate. A slow window (fps < minFps) is only confirmed by the next one, so a continuous slowness
// fails at the second window at the latest. The guard keeps measuring after 'ok', so a late degradation is caught;
// 'fail' is final until reset().
export function createFpsGuard(o?: { frames?: number; minFps?: number }): FpsGuard {
  const size = o?.frames ?? 45;
  const minFps = o?.minFps ?? 28;
  let count = 0; // frames pushed since the last reset
  let inWindow = 0; // frames of the current window, its first one included
  let last = 0;
  const intervals: number[] = []; // intervals of the current window, in ms
  let fps: number | null = null;
  let slow = 0; // consecutive slow windows
  let verdict: GuardVerdict = 'pending';
  // Mean interval without the longest tenth of the window.
  const trimmedMean = (v: number[]): number => {
    const kept = [...v].sort((a, b) => a - b).slice(0, v.length - Math.floor(v.length / 10));
    return kept.reduce((a, b) => a + b, 0) / kept.length;
  };
  return {
    push(t: number): GuardVerdict {
      if (verdict === 'fail') return verdict;
      count++;
      if (inWindow > 0) intervals.push(t - last);
      last = t;
      inWindow++;
      if (inWindow === size) {
        const mean = trimmedMean(intervals);
        fps = mean > 0 ? 1000 / mean : Infinity;
        if (fps < minFps) {
          slow++;
          if (slow >= 2) verdict = 'fail';
        } else {
          slow = 0;
          verdict = 'ok';
        }
        // The last image of this window opens the next one.
        intervals.length = 0;
        inWindow = 1;
      }
      return verdict;
    },
    reset(): void {
      count = 0;
      inWindow = 0;
      intervals.length = 0;
      fps = null;
      slow = 0;
      verdict = 'pending';
    },
    get frames(): number {
      return count;
    },
    get fps(): number | null {
      return fps;
    },
  };
}

export interface Flags {
  ascii: boolean;
  atelier: boolean;
  palette: PaletteId;
  backdrop: BackdropKind;
  growth: GrowthFlag | null; // null: the growth of the profile
  seed: number;
}

const BACKDROPS: readonly BackdropKind[] = ['halo', 'foret', 'ciel'];
const GROWTH: Readonly<Record<string, GrowthFlag>> = { simple: 'simple', naturelle: 'natural' };

// URL flags (D3.4). `ascii` works in every build; the workshop keys only when atelierAllowed.
// Unknown or malformed values are ignored.
export function readFlags(search: string, atelierAllowed: boolean): Flags {
  const q = new URLSearchParams(search);
  const flags: Flags = { ascii: q.has('ascii'), atelier: false, palette: DEFAULT_PALETTE, backdrop: 'halo', growth: null, seed: DEFAULT_SEED };
  if (!atelierAllowed) return flags;
  flags.atelier = q.has('atelier');
  const palette = q.get('palette');
  const known = PALETTE_ORDER.find((id) => id === palette);
  if (known) flags.palette = known;
  const fond = BACKDROPS.find((b) => b === q.get('fond'));
  if (fond) flags.backdrop = fond;
  const growth = q.get('croissance');
  if (growth !== null && Object.hasOwn(GROWTH, growth)) flags.growth = GROWTH[growth];
  const seed = q.get('graine');
  if (seed !== null && /^\d+$/.test(seed)) {
    const n = Number(seed);
    if (n < 2 ** 32) flags.seed = n;
  }
  return flags;
}

// Mount profile (number of points, growth), proto:210: (max-width:760px), (pointer:coarse). The layout of the block
// (labels, row of experiences, framing) follows its own query, (max-width:1199px), (pointer:coarse) (recette Y1).
export function chooseProfile(m: { narrow: boolean; coarse: boolean }): DeviceProfile {
  return m.narrow || m.coarse ? 'phone' : 'desktop';
}
