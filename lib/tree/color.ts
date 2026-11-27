// Colours (contract B5): hex conversions, WCAG contrast, Color.offsetHSL of three r147 and the
// single recolouring pass of the point cloud. Colours stay in encoded sRGB, without linearisation,
// as three r147 did in legacy mode (proto:499-503).
import type { Palette } from '../../content/palettes.ts';
import type { Cloud } from './cloud.ts';
import { POINT_ROLE } from './cloud.ts';
import type { Skeleton } from './skeleton.ts';

export type RGB = readonly [number, number, number]; // encoded sRGB, in [0,1]

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function hexToRgb(hex: string): RGB {
  if (typeof hex !== 'string' || !HEX.test(hex)) throw new Error(`hexToRgb: expected #RRGGBB, got ${JSON.stringify(hex)}`);
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}

export function rgbToHex(c: RGB): string {
  const byte = (v: number): string => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${byte(c[0])}${byte(c[1])}${byte(c[2])}`;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Color.getHSL / setHSL of three r147.
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function offsetHSL(c: RGB, dh: number, ds: number, dl: number): RGB {
  const [r, g, b] = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const light = (min + max) / 2;
  if (min !== max) {
    const delta = max - min;
    sat = light <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  const h = (((hue + dh) % 1) + 1) % 1;
  const s = clamp01(sat + ds);
  const l = clamp01(light + dl);
  if (s === 0) return [l, l, l];
  const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const q = 2 * l - p;
  return [hue2rgb(q, p, h + 1 / 3), hue2rgb(q, p, h), hue2rgb(q, p, h - 1 / 3)];
}

const toRgb = (c: RGB | string): RGB => (typeof c === 'string' ? hexToRgb(c) : c);
const linear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// WCAG 2.x relative luminance.
export function relativeLuminance(c: RGB | string): number {
  const [r, g, b] = toRgb(c);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: RGB | string, b: RGB | string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Palette converted once to RGB for the hot loop.
interface PointPalette {
  bark0: RGB;
  bark1: RGB;
  barkAcc: RGB;
  root0: RGB;
  root1: RGB;
  leaf0: RGB;
  leaf1: RGB;
  leafAcc: RGB;
}
function prepare(p: Palette): PointPalette {
  return {
    bark0: hexToRgb(p.bark[0]), bark1: hexToRgb(p.bark[1]), barkAcc: hexToRgb(p.barkAcc),
    root0: hexToRgb(p.root[0]), root1: hexToRgb(p.root[1]),
    leaf0: hexToRgb(p.leaf[0]), leaf1: hexToRgb(p.leaf[1]), leafAcc: hexToRgb(p.leafAcc),
  };
}

// proto:499-503. h is the normalised height of the point in the widened box.
function colorOf(role: number, rand: number, h: number, P: PointPalette): RGB {
  let c: RGB;
  if (role === POINT_ROLE.LEAF) {
    c = rand < 0.07 ? P.leafAcc : mix(P.leaf0, P.leaf1, clamp01((h - 0.35) * 1.4 + (rand - 0.5) * 0.7));
  } else if (role === POINT_ROLE.ROOT) {
    c = mix(P.root1, P.root0, rand);
  } else {
    c = rand < 0.1 ? P.barkAcc : mix(P.bark1, P.bark0, (rand - 0.1) / 0.9);
  }
  return offsetHSL(c, (((rand * 3.7) % 1) - 0.5) * 0.03, 0.08, (((rand * 7.31) % 1) - 0.5) * 0.08);
}

export function pointColor(role: number, rand: number, h: number, p: Palette): RGB {
  return colorOf(role, rand, h, prepare(p));
}

function overlaps(x: ArrayBufferView, y: ArrayBufferView): boolean {
  if (x.buffer !== y.buffer) return false;
  return x.byteOffset < y.byteOffset + y.byteLength && y.byteOffset < x.byteOffset + x.byteLength;
}

// The only function of lib/tree that writes point colours. Every entry of `out` is rewritten,
// so applying palette A then B gives exactly B. The cloud itself is never modified.
export function applyPalette(
  cloud: Pick<Cloud, 'count' | 'role' | 'rand' | 'positions'>,
  bounds: Skeleton['bounds'],
  p: Palette,
  out?: Float32Array,
): Float32Array {
  const n = cloud.count;
  const res = out ?? new Float32Array(3 * n);
  if (res.length !== 3 * n) throw new Error(`applyPalette: out has length ${res.length}, expected ${3 * n}`);
  // out must be a dedicated colour buffer: writing into the cloud's own memory would destroy it.
  for (const [name, view] of [['positions', cloud.positions], ['role', cloud.role], ['rand', cloud.rand]] as const) {
    if (overlaps(res, view)) throw new Error(`applyPalette: out shares memory with cloud.${name}`);
  }
  const P = prepare(p);
  // Box widened by 0.6 on every side (proto:498, 511).
  const y0 = bounds.min[1] - 0.6;
  const yH = Math.max(1, bounds.max[1] - bounds.min[1] + 1.2);
  for (let k = 0; k < n; k++) {
    const c = colorOf(cloud.role[k], cloud.rand[k], (cloud.positions[3 * k + 1] - y0) / yH, P);
    res[3 * k] = c[0];
    res[3 * k + 1] = c[1];
    res[3 * k + 2] = c[2];
  }
  return res;
}

// CSS custom properties of a palette (names of proto:773, plus --bg2).
export function cssVariables(p: Palette): Record<string, string> {
  return { '--night': p.bg, '--bg2': p.bg2, '--ink': p.ink, '--muted': p.muted, '--accent': p.lit, '--warm': p.lit };
}

const CONTRAST_PAIRS = [
  ['ink', 'bg'], ['muted', 'bg'], ['lit', 'bg'], ['ink', 'bg2'], ['muted', 'bg2'], ['lit', 'bg2'],
] as const;

export function paletteContrasts(p: Palette): { pair: string; ratio: number }[] {
  return CONTRAST_PAIRS.map(([fg, bg]) => ({ pair: `${fg}/${bg}`, ratio: contrastRatio(p[fg], p[bg]) }));
}
