// Backdrop around the tree (contract D16.1, proto:720-766): ground, distant forest with its
// fireflies, and starry sky, as separate point sets; their colours; and the CSS gradient painted
// behind the transparent canvas. Halo is the default backdrop: only the ground exists then.
import type { Palette } from '../../content/palettes.ts';
import { SCENE_STREAMS } from './build.ts';
import type { DeviceProfile } from './cloud.ts';
import { hexToRgb, mix } from './color.ts';
import type { RGB } from './color.ts';
import { deriveSeed, mulberry32 } from './rng.ts';
import type { Rng } from './rng.ts';

export type BackdropPart = 'ground' | 'forest' | 'sky';
export type BackdropCssKind = 'halo' | 'foret' | 'ciel';

export interface BackdropData {
  count: number;
  positions: Float32Array; // 3N
  rand: Float32Array; // N, in [0, 1)
  type: Float32Array; // N: 0 ground, 1 forest tree, 2 star, 3 forest firefly (proto:740)
}

// Largest Float32 strictly below 1: rand stays in [0, 1) once stored.
const BELOW_ONE = 1 - 2 ** -24;
const scale = (profile: DeviceProfile): number => (profile === 'phone' ? 0.5 : 1);

// One generator per part, all drawn from SCENE_STREAMS.backdrop, so that each part is independent
// of the others (the forest built on demand is the same as the one built first).
const streamOf = (seed: number, part: BackdropPart): Rng => mulberry32(deriveSeed(deriveSeed(seed, SCENE_STREAMS.backdrop), part));

function alloc(n: number): BackdropData {
  return { count: n, positions: new Float32Array(3 * n), rand: new Float32Array(n), type: new Float32Array(n) };
}

function writer(d: BackdropData, rnd: Rng): (x: number, y: number, z: number, t: number) => void {
  let i = 0;
  return (x, y, z, t) => {
    d.positions[3 * i] = x;
    d.positions[3 * i + 1] = y;
    d.positions[3 * i + 2] = z;
    d.type[i] = t;
    d.rand[i] = Math.min(rnd(), BELOW_ONE);
    i++;
  };
}

// Ground disc (proto:724).
export function buildGround(profile: DeviceProfile, seed: number): BackdropData {
  const n = Math.round(14000 * scale(profile));
  const d = alloc(n);
  const rnd = streamOf(seed, 'ground');
  const put = writer(d, rnd);
  for (let j = 0; j < n; j++) {
    const a = rnd() * 6.283;
    const r = 16 * Math.pow(rnd(), 0.7);
    put(Math.cos(a) * r, -0.05 + rnd() * 0.08, Math.sin(a) * r, 0);
  }
  return d;
}

// Ring of distant trees behind the main tree, cones or round crowns, and slow fireflies (proto:725-733).
export function buildForest(profile: DeviceProfile, seed: number): BackdropData {
  const k = scale(profile);
  const nT = profile === 'phone' ? 20 : 40;
  const perT = Math.round(1700 * k);
  const nF = profile === 'phone' ? 50 : 110;
  const d = alloc(nT * perT + nF);
  const rnd = streamOf(seed, 'forest');
  const put = writer(d, rnd);
  for (let t = 0; t < nT; t++) {
    const a = Math.PI * (0.96 + (1.08 * t) / nT) + rnd() * 0.05;
    const rr = 15 + rnd() * 20;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const h = 7 + rnd() * 8;
    const w = 2 + rnd() * 2.4;
    const cone = rnd() < 0.55; // firs as cones, broad-leaved trees round: readable from afar
    for (let j = 0; j < perT; j++) {
      if (j < perT * 0.12) put(x + (rnd() - 0.5) * 0.35, rnd() * h * (cone ? 0.3 : 0.5), z + (rnd() - 0.5) * 0.35, 1);
      else if (cone) {
        const fy = Math.pow(rnd(), 0.8);
        const y = h * 0.18 + fy * h * 0.82;
        const rad = (1 - fy) * w * 0.75 * Math.sqrt(rnd());
        const u = rnd() * 6.283;
        put(x + Math.cos(u) * rad, y, z + Math.sin(u) * rad, 1);
      } else {
        const u = rnd() * 6.283;
        const v = Math.acos(2 * rnd() - 1);
        const s = Math.pow(rnd(), 0.25);
        put(x + Math.sin(v) * Math.cos(u) * w * s, h * 0.62 + Math.cos(v) * h * 0.36 * s, z + Math.sin(v) * Math.sin(u) * w * s, 1);
      }
    }
  }
  for (let j = 0; j < nF; j++) {
    const a = rnd() * 6.283;
    const r = 4 + rnd() * 12;
    put(Math.cos(a) * r, 0.5 + rnd() * 10, Math.sin(a) * r, 3);
  }
  return d;
}

// Stars on a sphere of radius 95 raised by 4 (proto:732).
export function buildSky(profile: DeviceProfile, seed: number): BackdropData {
  const n = Math.round(5200 * scale(profile));
  const d = alloc(n);
  const rnd = streamOf(seed, 'sky');
  const put = writer(d, rnd);
  for (let j = 0; j < n; j++) {
    const u = rnd() * 6.283;
    const v = Math.acos(rnd() * 1.1 - 0.1);
    put(Math.sin(v) * Math.cos(u) * 95, Math.cos(v) * 95 + 4, Math.sin(v) * Math.sin(u) * 95, 2);
  }
  return d;
}

const times = (c: RGB, s: number): RGB => [c[0] * s, c[1] * s, c[2] * s];

// Point colours of a backdrop part (proto:750-756), in encoded sRGB like the tree.
export function paintBackdrop(kind: BackdropPart, data: BackdropData, p: Palette, out: Float32Array): Float32Array {
  if (out.length !== 3 * data.count) throw new Error(`paintBackdrop: out has length ${out.length}, expected ${3 * data.count}`);
  const leaf0 = hexToRgb(p.leaf[0]);
  const leaf1 = hexToRgb(p.leaf[1]);
  const bark1 = hexToRgb(p.bark[1]);
  const bg2 = hexToRgb(p.bg2);
  const ink = hexToRgb(p.ink);
  const sap0 = hexToRgb(p.sap[0]);
  for (let i = 0; i < data.count; i++) {
    const r = data.rand[i];
    let c: RGB;
    if (kind === 'ground') c = times(mix(bark1, leaf0, r * 0.5), 0.7);
    else if (kind === 'sky') c = times(ink, 0.5 + 0.5 * r);
    else if (data.type[i] === 3) c = sap0;
    else c = times(mix(mix(leaf0, leaf1, r * 0.4), bg2, 0.15), 0.75);
    out[3 * i] = c[0];
    out[3 * i + 1] = c[1];
    out[3 * i + 2] = c[2];
  }
  return out;
}

// CSS background of the block behind the canvas (proto:761-765). The Night backdrop is not ported.
export function backdropCss(kind: BackdropCssKind, p: Palette, profile: DeviceProfile): string {
  const halo = `radial-gradient(ellipse 70% 60% at 50% ${profile === 'phone' ? 42 : 56}%, ${p.bg2} 0%, ${p.bg} 72%)`;
  if (kind === 'foret') return `linear-gradient(to bottom, transparent 55%, ${p.bg2}AA 72%, transparent 92%), ${halo}`;
  if (kind === 'ciel') return `radial-gradient(circle at 80% 13%, ${p.ink}2E 0, ${p.ink}0A 4%, transparent 16%), linear-gradient(to bottom, ${p.bg2} 0%, ${p.bg} 62%)`;
  return halo;
}
