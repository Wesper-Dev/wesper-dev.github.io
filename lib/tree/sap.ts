// Sap paths (contract B3): real distances along the skeleton, a front moving at constant speed,
// particles along each path and segment masks. Replaces proto:684-713, which normalised every
// path to [0,1], built the polyline from segment ends only and relied on a fixed 1750 ms timer.
import { deriveSeed, mulberry32, STREAMS } from './rng.ts';
import type { Skeleton, SkillAnchor } from './skeleton.ts';

export const SAP_SPEED = 10; // scene units per second
export const SAP_JITTER = 0.025; // proto:702: (random - 0.5) x 0.05

export interface SegmentDistances {
  start: Float64Array;
  end: Float64Array;
}

export interface SapPath {
  id: string;
  segments: Int32Array;
  points: Float32Array;
  distances: Float32Array;
  length: number;
}

export interface SapParticles {
  count: number;
  positions: Float32Array;
  distance: Float32Array;
  rand: Float32Array;
}

function segLength(sk: Skeleton, i: number): number {
  const dx = sk.b[3 * i] - sk.a[3 * i];
  const dy = sk.b[3 * i + 1] - sk.a[3 * i + 1];
  const dz = sk.b[3 * i + 2] - sk.a[3 * i + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// P_p(t) = a_p + t (b_p - a_p)
function pointOn(sk: Skeleton, p: number, t: number): [number, number, number] {
  return [
    sk.a[3 * p] + t * (sk.b[3 * p] - sk.a[3 * p]),
    sk.a[3 * p + 1] + t * (sk.b[3 * p + 1] - sk.a[3 * p + 1]),
    sk.a[3 * p + 2] + t * (sk.b[3 * p + 2] - sk.a[3 * p + 2]),
  ];
}

function distTo(sk: Skeleton, i: number, q: readonly number[]): number {
  return Math.hypot(sk.a[3 * i] - q[0], sk.a[3 * i + 1] - q[1], sk.a[3 * i + 2] - q[2]);
}

// start[i] = start[p] + attach_i L(p) + |a_i - P_p(attach_i)| ; end[i] = start[i] + L(i).
// Parents always come first (parent[i] < i), so a single forward pass suffices.
export function segmentDistances(sk: Skeleton): SegmentDistances {
  const n = sk.count;
  const start = new Float64Array(n);
  const end = new Float64Array(n);
  end[0] = segLength(sk, 0);
  for (let i = 1; i < n; i++) {
    const p = sk.parent[i];
    const t = sk.attach[i];
    start[i] = start[p] + t * segLength(sk, p) + distTo(sk, i, pointOn(sk, p, t));
    end[i] = start[i] + segLength(sk, i);
  }
  return { start, end };
}

// Chain of segments from the base (segment 0) to `segment`.
export function chainToBase(sk: Skeleton, segment: number): Int32Array {
  if (!(Number.isInteger(segment) && segment >= 0 && segment < sk.count)) throw new Error(`chainToBase: invalid segment ${segment}`);
  const out: number[] = [];
  for (let i = segment; i >= 0; i = sk.parent[i]) {
    out.push(i);
    if (out.length > sk.count) throw new Error('chainToBase: cycle in parent array');
  }
  return Int32Array.from(out.reverse());
}

// Real polyline from the base to the anchor: a_0, then at each junction P_p(attach) followed by
// a_i when it differs, then the anchor position.
export function sapPath(sk: Skeleton, anchor: SkillAnchor, d?: SegmentDistances): SapPath {
  const segments = chainToBase(sk, anchor.segment);
  const pts: number[] = [sk.a[0], sk.a[1], sk.a[2]];
  for (let j = 1; j < segments.length; j++) {
    const i = segments[j];
    const q = pointOn(sk, segments[j - 1], sk.attach[i]);
    pts.push(q[0], q[1], q[2]);
    if (distTo(sk, i, q) > 1e-6) pts.push(sk.a[3 * i], sk.a[3 * i + 1], sk.a[3 * i + 2]);
  }
  pts.push(anchor.position[0], anchor.position[1], anchor.position[2]);
  const m = pts.length / 3;
  const distances = new Float32Array(m);
  let acc = 0;
  for (let k = 1; k < m; k++) {
    acc += Math.hypot(pts[3 * k] - pts[3 * k - 3], pts[3 * k + 1] - pts[3 * k - 2], pts[3 * k + 2] - pts[3 * k - 1]);
    distances[k] = acc;
  }
  // Same recurrence as segmentDistances, evaluated along the chain only (identical floats).
  let start = 0;
  if (d) start = d.start[anchor.segment];
  else {
    for (let j = 1; j < segments.length; j++) {
      const i = segments[j];
      const p = segments[j - 1];
      const t = sk.attach[i];
      start = start + t * segLength(sk, p) + distTo(sk, i, pointOn(sk, p, t));
    }
  }
  return {
    id: anchor.id,
    segments,
    points: Float32Array.from(pts),
    distances,
    length: start + anchor.t * segLength(sk, anchor.segment),
  };
}

// Largest Float32 strictly below 1: random attributes stay in [0, 1) once stored.
const BELOW_ONE = 1 - 2 ** -24;

function checkSpeed(speed: number): void {
  if (!(Number.isFinite(speed) && speed > 0)) throw new Error(`sap: speed must be finite and > 0, got ${speed}`);
}

export function frontDistance(time: number, speed: number = SAP_SPEED): number {
  checkSpeed(speed);
  return Math.max(0, time) * speed;
}

export function arrivalTime(distance: number, speed: number = SAP_SPEED): number {
  checkSpeed(speed);
  return distance / speed;
}

// A skill is lit as soon as time >= arrivalTime(path.length, speed). Arrival and end
// (sapDuration) use the same division, so litAt(paths, sapDuration(paths)) lights every path
// to the last ULP. Pure function of time: reduced motion passes Infinity.
export function litAt(paths: readonly SapPath[], time: number, speed: number = SAP_SPEED): Set<string> {
  checkSpeed(speed);
  const out = new Set<string>();
  for (const p of paths) if (time >= p.length / speed) out.add(p.id);
  return out;
}

// Allocation-free variant of litAt for the animation loop: out[k] = 1 when paths[k] is lit,
// 0 otherwise. Returns the number of lit paths. Same convention as litAt.
export function litInto(paths: readonly SapPath[], time: number, out: Uint8Array, speed: number = SAP_SPEED): number {
  checkSpeed(speed);
  if (out.length < paths.length) throw new Error(`litInto: out has length ${out.length}, expected at least ${paths.length}`);
  let n = 0;
  for (let k = 0; k < paths.length; k++) {
    const lit = time >= paths[k].length / speed;
    out[k] = lit ? 1 : 0;
    if (lit) n++;
  }
  return n;
}

export function sapDuration(paths: readonly SapPath[], speed: number = SAP_SPEED): number {
  checkSpeed(speed);
  let max = 0;
  for (const p of paths) max = Math.max(max, p.length);
  return paths.length ? max / speed : 0;
}

// Particles spread evenly along the path (proto:693-705), with real distances and a seeded
// stream. The path id is mixed into the seed so that two paths do not share the same jitter.
export function sapParticles(path: SapPath, density: number, seed: number): SapParticles {
  if (!(Number.isFinite(density) && density >= 0)) throw new Error(`sapParticles: density must be finite and >= 0, got ${density}`);
  if (!Number.isFinite(path.length)) throw new Error(`sapParticles: non-finite path length ${path.length}`);
  const rnd = mulberry32(deriveSeed(deriveSeed(seed, STREAMS.sap), path.id));
  const total = path.length;
  const count = Math.max(40, Math.round(total * density));
  const positions = new Float32Array(3 * count);
  const distance = new Float32Array(count);
  const rand = new Float32Array(count);
  const P = path.points;
  const D = path.distances;
  const m = D.length;
  let seg = 1;
  for (let k = 0; k < count; k++) {
    const dist = count > 1 ? (k / (count - 1)) * total : 0;
    while (seg < m - 1 && D[seg] < dist) seg++;
    const f = Math.min(1, Math.max(0, (dist - D[seg - 1]) / Math.max(1e-6, D[seg] - D[seg - 1])));
    for (let c = 0; c < 3; c++) {
      const v = P[3 * (seg - 1) + c] + (P[3 * seg + c] - P[3 * (seg - 1) + c]) * f;
      positions[3 * k + c] = v + (rnd() - 0.5) * 2 * SAP_JITTER;
    }
    distance[k] = dist;
    rand[k] = Math.min(rnd(), BELOW_ONE);
  }
  return { count, positions, distance, rand };
}

// 1 for every segment lying on at least one path.
export function segmentMask(sk: Skeleton, paths: readonly SapPath[]): Uint8Array {
  const mask = new Uint8Array(sk.count);
  for (const p of paths) for (const i of p.segments) mask[i] = 1;
  return mask;
}

// Per-point copy of the segment mask (proto:849-850).
export function pointMask(pointSegment: Uint16Array, mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(pointSegment.length);
  for (let k = 0; k < pointSegment.length; k++) out[k] = mask[pointSegment[k]];
  return out;
}
