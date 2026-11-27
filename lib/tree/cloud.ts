// Point cloud sampling (contract B4, pure part). Port of the sampling half of build()
// (proto:513-566) with three separate streams: geometry (cloud), entry animation (entry) and the
// per-point random value used for colour (color). The cloud holds no colour at all: colours are
// written once, by applyPalette in color.ts.
import { deriveSeed, mulberry32, STREAMS } from './rng.ts';
import type { Rng } from './rng.ts';
import { SEGMENT_KIND } from './skeleton.ts';
import type { GrowthMode, Skeleton } from './skeleton.ts';

export const POINT_ROLE = Object.freeze({ BARK: 0, ROOT: 1, LEAF: 2 } as const); // proto:543, 563
export type PointRole = (typeof POINT_ROLE)[keyof typeof POINT_ROLE];
export type DeviceProfile = 'phone' | 'desktop';

// proto:212, 215, 516, 695
export const PROFILES: Readonly<Record<DeviceProfile, { mode: GrowthMode; points: number; sapDensity: number; gain: number }>> =
  Object.freeze({
    phone: Object.freeze({ mode: 'simple', points: 45000, sapDensity: 28, gain: 1 }),
    desktop: Object.freeze({ mode: 'natural', points: 240000, sapDensity: 46, gain: 0.58 }),
  });

export const LEAF_SHARE: Readonly<Record<GrowthMode, number>> = Object.freeze({ simple: 0.34, natural: 0.42 }); // proto:518

// Tufts at branch tips (proto:552-559): size factor and radial exponent per mode.
const TUFT: Readonly<Record<GrowthMode, { factor: number; exponent: number }>> = {
  simple: { factor: 1, exponent: 0.45 },
  natural: { factor: 0.62, exponent: 0.34 },
};

// Largest Float32 strictly below 1: rand stays in [0, 1) once stored.
const BELOW_ONE = 1 - 2 ** -24;

export function segmentWeight(length: number, radius: number, mode: GrowthMode): number {
  return mode === 'natural' ? length * (0.25 + radius * 7.0) : length * (0.5 + radius * 3.0); // proto:515
}

export interface Cloud {
  count: number;
  positions: Float32Array;
  segment: Uint16Array;
  role: Uint8Array;
  size: Float32Array;
  rand: Float32Array;
  start: Float32Array;
  delay: Float32Array;
}

export function sampleCloud(sk: Skeleton, o: { points: number; seed?: number }): Cloud {
  const N = o.points;
  if (!(Number.isInteger(N) && N >= 0)) throw new Error(`sampleCloud: invalid point count ${N}`);
  const seed = o.seed ?? sk.seed;
  if (!Number.isFinite(seed)) throw new Error(`sampleCloud: non-finite seed ${seed}`);
  const mode = sk.mode;
  const n = sk.count;
  const geo = mulberry32(deriveSeed(seed, STREAMS.cloud));

  const positions = new Float32Array(3 * N);
  const segment = new Uint16Array(N);
  const role = new Uint8Array(N);
  const size = new Float32Array(N);

  const hasChild = new Uint8Array(n);
  for (let i = 1; i < n; i++) hasChild[sk.parent[i]] = 1;
  const tips: number[] = [];
  for (let i = 0; i < n; i++) if (sk.kind[i] === SEGMENT_KIND.BRANCH && !hasChild[i]) tips.push(i);

  const weights = new Float64Array(n);
  let totalW = 0;
  for (let i = 0; i < n; i++) {
    const len = Math.hypot(sk.b[3 * i] - sk.a[3 * i], sk.b[3 * i + 1] - sk.a[3 * i + 1], sk.b[3 * i + 2] - sk.a[3 * i + 2]);
    weights[i] = segmentWeight(len, sk.radius[i], mode);
    totalW += weights[i];
  }
  // Without any branch tip there is nowhere to put leaves: every point goes to the bark.
  const nBranch = tips.length ? Math.floor(N * (1 - LEAF_SHARE[mode])) : N;

  let k = 0;
  const putBark = (i: number): void => {
    barkPoint(sk, i, geo, positions, k);
    segment[k] = i;
    role[k] = sk.kind[i] === SEGMENT_KIND.ROOT ? POINT_ROLE.ROOT : POINT_ROLE.BARK;
    size[k] = (sk.radius[i] < 0.05 ? 0.45 : 0.6) + geo() * 0.8; // proto:544
    k++;
  };

  // Bark and roots: round(nBranch x w_i / sum w) points per segment, stopping at N (proto:533-546).
  if (totalW > 0) {
    for (let i = 0; i < n && k < N; i++) {
      const cnt = Math.round((nBranch * weights[i]) / totalW);
      for (let j = 0; j < cnt && k < N; j++) putBark(i);
    }
  }

  if (tips.length) {
    // Leaves complete up to N, in tufts at the tips, one uniform tip draw per leaf with weight 1
    // per tip (proto:548-565). When the budget covers every tip, each tip left empty by the
    // draws takes over a surplus leaf (a leaf whose tip holds two or more), scanning from the
    // last draw backwards, so that every tip carries foliage while the draws stay uniform.
    const tuft = TUFT[mode];
    const budget = N - k;
    const pickTip = new Int32Array(budget);
    const perTip = new Int32Array(tips.length);
    for (let j = 0; j < budget; j++) {
      const t = Math.min(tips.length - 1, Math.floor(geo() * tips.length));
      pickTip[j] = t;
      perTip[t]++;
    }
    if (budget >= tips.length) {
      let j = budget - 1;
      for (let t = 0; t < tips.length; t++) {
        if (perTip[t] > 0) continue;
        while (perTip[pickTip[j]] <= 1) j--; // exists: budget >= tips, so some tip holds two
        perTip[pickTip[j]]--;
        pickTip[j] = t;
        perTip[t] = 1;
        j--;
      }
    }
    for (let j = 0; j < budget; j++) {
      const i = tips[pickTip[j]];
      leafPoint(sk, i, geo, tuft, positions, k);
      segment[k] = i;
      role[k] = POINT_ROLE.LEAF;
      size[k] = 0.35 + geo() * 0.6;
      k++;
    }
  } else if (k < N) {
    // Rounding left a few bark points unassigned: draw their segment by weight.
    const cum = new Float64Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) cum[i] = acc += totalW > 0 ? weights[i] : 1;
    while (k < N) {
      const x = geo() * acc;
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m] <= x) lo = m + 1;
        else hi = m;
      }
      putBark(lo);
    }
  }

  // Entry animation, on its own stream: four draws per point in the order of proto:527-529.
  const entry = mulberry32(deriveSeed(seed, STREAMS.entry));
  const start = new Float32Array(3 * N);
  const delay = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const a = entry() * Math.PI * 2;
    const rad = 3 + Math.pow(entry(), 0.6) * 16;
    start[3 * p] = Math.cos(a) * rad;
    start[3 * p + 1] = -1.5 + entry() * 3.5;
    start[3 * p + 2] = Math.sin(a) * rad - 4;
    delay[p] = Math.min(0.55, Math.max(0, (positions[3 * p + 1] + 3) / 12) * 0.45 + entry() * 0.12);
  }

  // One draw of the color stream per point: the colour itself is computed by applyPalette.
  const color = mulberry32(deriveSeed(seed, STREAMS.color));
  const rand = new Float32Array(N);
  for (let p = 0; p < N; p++) rand[p] = Math.min(color(), BELOW_ONE);

  return { count: N, positions, segment, role, size, rand, start, delay };
}

// One point on the bark (or root) surface of segment i (proto:534-542).
function barkPoint(sk: Skeleton, i: number, rnd: Rng, out: Float32Array, k: number): void {
  const ax = sk.a[3 * i];
  const ay = sk.a[3 * i + 1];
  const az = sk.a[3 * i + 2];
  const bx = sk.b[3 * i];
  const by = sk.b[3 * i + 1];
  const bz = sk.b[3 * i + 2];
  const r = sk.radius[i];
  // Orthonormal frame (d, u, w) around the segment axis.
  let dx = bx - ax;
  let dy = by - ay;
  let dz = bz - az;
  const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= l;
  dy /= l;
  dz /= l;
  if (dx === 0 && dy === 0 && dz === 0) dy = 1;
  const [ex, ey, ez] = Math.abs(dy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let ux = dy * ez - dz * ey;
  let uy = dz * ex - dx * ez;
  let uz = dx * ey - dy * ex;
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const wx = dy * uz - dz * uy;
  const wy = dz * ux - dx * uz;
  const wz = dx * uy - dy * ux;

  const t = rnd();
  let ang: number;
  let rr: number;
  if (r > 0.12) {
    // Bark ridges on thick segments.
    const ridges = Math.max(8, Math.round(r * 40));
    const ri = Math.floor(rnd() * ridges);
    ang = ((ri + (rnd() - 0.5) * 0.35) / ridges) * Math.PI * 2 + Math.sin((ay + (by - ay) * t) * 1.6) * 0.3;
    rr = r * (0.92 + rnd() * 0.12 + (ri % 2) * 0.06);
  } else {
    ang = rnd() * Math.PI * 2;
    rr = r * (0.75 + rnd() * 0.35);
  }
  const c = Math.cos(ang) * rr;
  const s = Math.sin(ang) * rr;
  out[3 * k] = ax + (bx - ax) * t + ux * c + wx * s;
  out[3 * k + 1] = ay + (by - ay) * t + uy * c + wy * s;
  out[3 * k + 2] = az + (bz - az) * t + uz * c + wz * s;
}

// One leaf point in a tuft around the tip b of segment i (proto:552-559, broad-leaved branch).
function leafPoint(
  sk: Skeleton, i: number, rnd: Rng, tuft: { factor: number; exponent: number }, out: Float32Array, k: number,
): void {
  const cl = Math.floor(rnd() * 4);
  const sub = cl ? 0.32 : 0;
  const tx = Math.sin(i * 1.7 + cl * 2.1) * sub;
  const ty = Math.cos(i * 2.3 + cl * 1.3) * 0.6 * sub;
  const tz = Math.sin(i * 0.9 + cl * 3.7) * sub;
  let ox = rnd() - 0.5;
  let oy = rnd() - 0.5;
  let oz = rnd() - 0.5;
  const ol = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
  const m = (Math.pow(rnd(), tuft.exponent) * (cl ? 0.3 : 0.5) * tuft.factor) / ol;
  ox = ox * m + tx * tuft.factor;
  oy = oy * m + ty * tuft.factor; // flat = 1 for the oak
  oz = oz * m + tz * tuft.factor;
  out[3 * k] = sk.b[3 * i] + ox;
  out[3 * k + 1] = sk.b[3 * i + 1] + oy + 0.12;
  out[3 * k + 2] = sk.b[3 * i + 2] + oz;
}
