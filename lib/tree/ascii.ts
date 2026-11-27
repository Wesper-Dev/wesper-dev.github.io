// ASCII rendering of the tree (contract D16.4, proto:963-980): grid, character ramp, cell colour
// and the 20 frames-per-second cadence. The scene reads back a cols x rows render and draws the
// characters on a 2D canvas.
import type { DeviceProfile } from './cloud.ts';

export const RAMP = " .'`:-=+*o#%@";
export const ASCII_FPS = 20;
// Tolerance on the interval, so that rAF jitter does not drop to one frame in four at 60 Hz.
const SLACK_MS = 4;

export interface AsciiCell {
  idx: number;
  char: string;
  color: [number, number, number];
}

// Character and colour of a pixel (bytes); null when it is too dark to draw.
export function asciiCell(r: number, g: number, b: number): AsciiCell | null {
  const m = Math.max(r, g, b);
  if (m < 14) return null;
  const l = Math.pow(m / 255, 0.8);
  const idx = Math.min(RAMP.length - 1, 1 + Math.floor(l * (RAMP.length - 1)));
  const s = ((0.55 + 0.45 * l) * 255) / m;
  return { idx, char: RAMP[idx], color: [(r * s) | 0, (g * s) | 0, (b * s) | 0] };
}

// Cells of 6 x 10 px on phone and 7 x 12 px on desktop (proto:966-968).
export function asciiGrid(w: number, h: number, profile: DeviceProfile): { cols: number; rows: number; cw: number; ch: number } {
  const cw = profile === 'phone' ? 6 : 7;
  const ch = profile === 'phone' ? 10 : 12;
  return { cols: Math.max(1, Math.ceil(w / cw)), rows: Math.max(1, Math.ceil(h / ch)), cw, ch };
}

// True when an ASCII frame is due at `now` (ms), the previous one having been drawn at `last`.
export function due(now: number, last: number): boolean {
  return now - last >= 1000 / ASCII_FPS - SLACK_MS;
}
