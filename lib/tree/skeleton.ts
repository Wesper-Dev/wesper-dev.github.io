// Oak skeleton (contract B2): segment generation, validation and skill anchoring.
// Port of proto:270-460 (grow, roots, line, colonize, SPECIES.chene) without global state:
// the generator and the segment list live in a per-call context.
import { deriveSeed, mulberry32, STREAMS } from './rng.ts';
import type { Rng } from './rng.ts';

export type Vec3 = readonly [number, number, number];

export const SEGMENT_KIND = Object.freeze({ TRUNK: 0, BRANCH: 1, ROOT: 2 } as const);
export type SegmentKind = (typeof SEGMENT_KIND)[keyof typeof SEGMENT_KIND];
export type GrowthMode = 'simple' | 'natural';
export type SpeciesId = 'chene';
export type Layer = 'root' | 'trunk' | 'canopy';

export const DEFAULT_SEED = 7; // proto:509 (7 + 0 x 101 for the oak)
export const MAX_SEGMENTS = 65535; // segment index fits in a Uint16Array
export const TRUNK_TARGETS: readonly number[] = Object.freeze([0.28, 0.5, 0.72, 0.94]); // proto:572

export interface Skeleton {
  readonly species: SpeciesId;
  readonly mode: GrowthMode;
  readonly seed: number;
  readonly count: number;
  readonly a: Float32Array; // 3 x count, start of each segment
  readonly b: Float32Array; // 3 x count, end of each segment
  readonly radius: Float32Array;
  readonly parent: Int32Array; // parent[0] = -1
  readonly attach: Float32Array; // t in [0,1]: point of the parent where the segment starts
  readonly kind: Uint8Array;
  readonly depth: Uint8Array;
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 }; // raw extent of all a and b
}

export interface SegmentInput {
  a: Vec3;
  b: Vec3;
  radius: number;
  parent: number;
  kind: SegmentKind;
  depth: number;
}

export interface SkillAnchor {
  id: string;
  layer: Layer;
  segment: number;
  t: number;
  position: Vec3;
  side: 'left' | 'right' | null;
}

// ---------------------------------------------------------------------------------------------
// Minimal mutable vectors. Each helper reproduces the arithmetic order of THREE.Vector3 (r147)
// so that the float64 results match the prototype exactly.
type V = [number, number, number];
const V3 = (x = 0, y = 0, z = 0): V => [x, y, z];
const clone = (v: Readonly<V>): V => [v[0], v[1], v[2]];
function addV(v: V, w: Readonly<V>): V {
  v[0] += w[0];
  v[1] += w[1];
  v[2] += w[2];
  return v;
}
function subV(v: V, w: Readonly<V>): V {
  v[0] -= w[0];
  v[1] -= w[1];
  v[2] -= w[2];
  return v;
}
function scaleV(v: V, s: number): V {
  v[0] *= s;
  v[1] *= s;
  v[2] *= s;
  return v;
}
function addScaled(v: V, w: Readonly<V>, s: number): V {
  v[0] += w[0] * s;
  v[1] += w[1] * s;
  v[2] += w[2] * s;
  return v;
}
const lengthSq = (v: Readonly<V>): number => v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
function normalize(v: V): V {
  return scaleV(v, 1 / (Math.sqrt(lengthSq(v)) || 1));
}
function distSq(a: Readonly<V>, b: Readonly<V>): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

// ---------------------------------------------------------------------------------------------
// Growth context: replaces the prototype globals `seed` and `segs` (proto:270, 273).
type KindName = 'trunk' | 'branch' | 'root';
const KIND_CODE: Record<KindName, SegmentKind> = { trunk: SEGMENT_KIND.TRUNK, branch: SEGMENT_KIND.BRANCH, root: SEGMENT_KIND.ROOT };
interface RawSeg {
  a: V;
  b: V;
  r: number;
  parent: number;
  kind: KindName;
  depth: number;
}
interface Ctx {
  rnd: Rng;
  segs: RawSeg[];
}

function S(c: Ctx, a: V, b: V, r: number, parent: number, kind: KindName, depth: number): number {
  c.segs.push({ a: clone(a), b: clone(b), r, parent, kind, depth });
  return c.segs.length - 1;
}

// Curved line made of `steps` segments (proto:276-284).
function line(
  c: Ctx, p0: V, dir: V, len: number, r0: number, r1: number, parent: number, kind: KindName, depth: number,
  steps: number, wobble: number, gravity: number,
): { last: number; end: V; dir: V; ids: number[] } {
  const p = clone(p0);
  const d = normalize(clone(dir));
  const ids: number[] = [];
  let last = parent;
  let cur = p;
  for (let k = 0; k < steps; k++) {
    const jx = (c.rnd() - 0.5) * wobble;
    const jz = (c.rnd() - 0.5) * wobble;
    normalize(addV(d, V3(jx, gravity, jz)));
    const q = addScaled(clone(cur), d, len / steps);
    last = S(c, cur, q, r0 + ((r1 - r0) * k) / steps, last, kind, depth);
    ids.push(last);
    cur = q;
  }
  return { last, end: cur, dir: d, ids };
}

interface GrowOptions {
  decay?: number;
  first?: number;
  spread0?: number;
  spread?: number;
  up0?: number;
  up?: number;
}

// Recursive growth used by the oak crown and the roots (proto:286-303).
function grow(
  c: Ctx, start: V, dir: V, len: number, r: number, depth: number, parent: number, kind: KindName,
  maxDepth: number, o: GrowOptions = {},
): void {
  const rnd = c.rnd;
  let p = clone(start);
  const d = clone(dir);
  let last = parent;
  for (let k = 0; k < 3; k++) {
    const jx = (rnd() - 0.5) * 0.35;
    const jy = (kind === 'root' ? -0.08 : 0.06) + (rnd() - 0.5) * 0.2;
    const jz = (rnd() - 0.5) * 0.35;
    normalize(addV(d, V3(jx, jy, jz)));
    // Roots always go down (proto:290).
    if (kind === 'root' && d[1] > -0.05) {
      d[1] = -0.05 - rnd() * 0.1;
      normalize(d);
    }
    const q = addScaled(clone(p), d, len / 3);
    last = S(c, p, q, r * (1 - k * 0.1), last, kind === 'branch' && depth === 0 ? 'trunk' : kind, depth);
    p = q;
  }
  if (depth >= maxDepth) return;
  const n = depth === 0 ? o.first || 3 : rnd() < 0.35 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd() * 1.2;
    const spread = kind === 'root' ? 0.9 : depth < 2 ? (o.spread0 || 0.9) + rnd() * 0.4 : (o.spread || 0.6) + rnd() * 0.4;
    const up = kind === 'root' ? -0.15 : depth < 2 ? (o.up0 ?? 0.05) : (o.up ?? 0.2);
    const nd = normalize(addV(scaleV(clone(d), kind === 'root' ? 0.6 : 1), V3(Math.cos(ang) * spread, up, Math.sin(ang) * spread)));
    grow(c, p, nd, len * (kind === 'root' ? 0.7 : o.decay || 0.74), r * 0.62, depth + 1, last, kind, maxDepth, o);
  }
}

// Six roots starting slightly above the base of the trunk (proto:304-309).
function roots(c: Ctx, trunkBase: number, scale = 1): void {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + c.rnd() * 0.5;
    grow(c, V3(0, 0.25, 0), normalize(V3(Math.cos(a), -0.35, Math.sin(a))), 2.4 * scale, 0.3 * scale, 1, trunkBase, 'root', 4);
  }
}

interface ColonizeOptions {
  seeds: number[];
  n: number;
  dI: number;
  dK: number;
  D: number;
  trop: V;
  flat: number;
  inertia: number;
  iters: number;
  maxNodes: number;
  baseR: number;
  tipR: number;
  attract: () => V;
}

// Space colonisation (Runions et al.) with pipe-model radii (proto:338-381).
function colonize(c: Ctx, o: ColonizeOptions): void {
  const rnd = c.rnd;
  const segs = c.segs;
  const nodes: { p: V; d: V; seg: number }[] = [];
  const cell = o.dI;
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number): number => ((x + 256) * 512 + (y + 256)) * 512 + (z + 256);
  const add = (p: V, d: V, seg: number): void => {
    const i = nodes.length;
    nodes.push({ p, d, seg });
    const k = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell), Math.floor(p[2] / cell));
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(i);
  };
  for (const si of o.seeds) {
    const sg = segs[si];
    add(clone(sg.b), normalize(subV(clone(sg.b), sg.a)), si);
  }
  const A: V[] = [];
  for (let i = 0; i < o.n; i++) A.push(o.attract());
  let top = nodes.length - 1;
  let lead = 0;
  const alive = new Uint8Array(A.length).fill(1);
  const dI2 = o.dI * o.dI;
  const dK2 = o.dK * o.dK;
  const lim = (o.D * 0.55) ** 2;
  for (let it = 0; it < o.iters && nodes.length < o.maxNodes; it++) {
    // Insertion order of the map drives the growth order, as in the prototype.
    const acc = new Map<number, V>();
    for (let a = 0; a < A.length; a++) {
      if (!alive[a]) continue;
      const q = A[a];
      const cx = Math.floor(q[0] / cell);
      const cy = Math.floor(q[1] / cell);
      const cz = Math.floor(q[2] / cell);
      let best = -1;
      let bd = dI2;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const arr = grid.get(key(cx + dx, cy + dy, cz + dz));
        if (!arr) continue;
        for (let m = 0; m < arr.length; m++) {
          const dd = distSq(nodes[arr[m]].p, q);
          if (dd < bd) {
            bd = dd;
            best = arr[m];
          }
        }
      }
      if (best < 0) continue;
      if (bd < dK2) {
        alive[a] = 0;
        continue;
      }
      let v = acc.get(best);
      if (!v) acc.set(best, (v = V3()));
      addV(v, normalize(subV(clone(q), nodes[best].p)));
    }
    if (!acc.size) {
      // No bud reaches the crown: the leader keeps climbing.
      if (lead++ > 60) break;
      const nd = nodes[top];
      const p = addScaled(clone(nd.p), normalize(addScaled(V3(0, 1, 0), nd.d, 0.5)), o.D);
      top = nodes.length;
      add(p, clone(nd.d), S(c, nd.p, p, 0, nd.seg, 'trunk', 0));
      continue;
    }
    acc.forEach((v, j) => {
      const nd = nodes[j];
      if (lengthSq(v) < 1e-4) {
        const x = rnd() - 0.5;
        const y = rnd() - 0.5;
        const z = rnd() - 0.5;
        v[0] = x;
        v[1] = y;
        v[2] = z;
      }
      addV(addScaled(normalize(v), nd.d, o.inertia), o.trop);
      v[1] *= o.flat;
      normalize(v);
      const p = addScaled(clone(nd.p), v, o.D * (0.85 + rnd() * 0.3));
      // No new bud where one already exists.
      const cx = Math.floor(p[0] / cell);
      const cy = Math.floor(p[1] / cell);
      const cz = Math.floor(p[2] / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const arr = grid.get(key(cx + dx, cy + dy, cz + dz));
        if (arr) for (const m of arr) if (distSq(nodes[m].p, p) < lim) return;
      }
      add(p, clone(v), S(c, nd.p, p, 0, nd.seg, 'branch', 1));
    });
  }
  // Pipe model (da Vinci): r_parent^2.5 = sum of r_child^2.5. Float32 buffers as in the prototype.
  const n = segs.length;
  const sum = new Float32Array(n);
  const r = new Float32Array(n);
  const kids: number[][] = segs.map(() => []);
  for (let i = n - 1; i >= 0; i--) {
    const sg = segs[i];
    if (sg.kind === 'root') continue;
    r[i] = sum[i] > 0 ? Math.pow(sum[i], 1 / 2.5) : o.tipR;
    if (sg.parent >= 0) {
      sum[sg.parent] += Math.pow(r[i], 2.5);
      kids[sg.parent].push(i);
    }
  }
  const k = o.baseR / r[0];
  segs.forEach((sg, i) => {
    if (sg.kind === 'root') return;
    sg.r = Math.max(0.012, r[i] * k) * (sg.a[1] < 0.9 ? 1 + (0.9 - sg.a[1]) * 0.45 : 1);
  });
  // Branching order: the thickest child continues the branch, the others go up one order.
  segs.forEach((sg, i) => {
    if (sg.kind !== 'branch' && sg.kind !== 'trunk') return;
    let main = -1;
    let mr = -1;
    for (const ch of kids[i]) if (r[ch] > mr) {
      mr = r[ch];
      main = ch;
    }
    for (const ch of kids[i]) {
      const s = segs[ch];
      s.depth = sg.kind === 'trunk' && ch === main && s.kind === 'trunk' ? 0 : sg.depth + (ch === main ? 0 : 1);
      if (s.depth < 1 && s.kind === 'branch') s.depth = 1;
    }
  });
}

// Uniform point in the unit ball (rejection sampling).
function inBall(rnd: Rng): V {
  for (;;) {
    const p = V3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (lengthSq(p) <= 1) return p;
  }
}

// SPECIES.chene.build (proto:395-397).
function buildSimpleOak(c: Ctx): void {
  grow(c, V3(0, 0, 0), V3(0, 1, 0), 5.2, 0.46, 0, -1, 'branch', 7, { decay: 0.72 });
  roots(c, 0);
}

// SPECIES.chene.nat (proto:387-394): lobed crown filled by space colonisation.
function buildNaturalOak(c: Ctx): void {
  const rnd = c.rnd;
  const t = line(c, V3(0, 0, 0), V3(0.04, 1, 0.02), 4.2, 0.5, 0.42, -1, 'trunk', 0, 9, 0.05, 0);
  const lobes: { c: V; s: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.5;
    const rr = i === 0 ? 0 : 3.4 + rnd() * 1.6;
    const cy = 6.6 + rnd() * 2.6 - (rr > 4.2 ? 1 : 0);
    const s = 2.4 + rnd() * 1.1;
    lobes.push({ c: V3(Math.cos(a) * rr, cy, Math.sin(a) * rr), s });
  }
  colonize(c, {
    seeds: t.ids.slice(5), n: 2600, dI: 2.3, dK: 0.4, D: 0.25, trop: V3(0, 0.05, 0), flat: 1, inertia: 0.4,
    iters: 140, maxNodes: 12000, baseR: 0.55, tipR: 0.01,
    attract: () => {
      for (;;) {
        const l = lobes[Math.floor(rnd() * lobes.length)];
        const p = addV(scaleV(inBall(rnd), l.s), l.c);
        p[1] = Math.max(p[1], 0);
        if (p[1] > 4.6) return p;
      }
    },
  });
  roots(c, 0);
}

// ---------------------------------------------------------------------------------------------
// Validation and packing into typed arrays (shared by growSkeleton and skeletonFromSegments).
interface Packed {
  a: Float32Array;
  b: Float32Array;
  radius: Float32Array;
  parent: Int32Array;
  kind: Uint8Array;
  depth: Uint8Array;
}

function finish(pk: Packed, meta: { species: SpeciesId; mode: GrowthMode; seed: number }): Skeleton {
  const n = pk.parent.length;
  const { a, b } = pk;
  const attach = new Float32Array(n);
  attach[0] = 1;
  for (let i = 1; i < n; i++) {
    const p = pk.parent[i];
    const ax = a[3 * p];
    const ay = a[3 * p + 1];
    const az = a[3 * p + 2];
    const dx = b[3 * p] - ax;
    const dy = b[3 * p + 1] - ay;
    const dz = b[3 * p + 2] - az;
    const l2 = dx * dx + dy * dy + dz * dz;
    const same = a[3 * i] === b[3 * p] && a[3 * i + 1] === b[3 * p + 1] && a[3 * i + 2] === b[3 * p + 2];
    if (same || l2 === 0) attach[i] = 1;
    else {
      const t = ((a[3 * i] - ax) * dx + (a[3 * i + 1] - ay) * dy + (a[3 * i + 2] - az) * dz) / l2;
      attach[i] = Math.min(1, Math.max(0, t));
    }
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const arr of [a, b]) {
    for (let i = 0; i < arr.length; i++) {
      const c = i % 3;
      const v = arr[i];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  return {
    species: meta.species, mode: meta.mode, seed: meta.seed, count: n,
    a, b, radius: pk.radius, parent: pk.parent, attach, kind: pk.kind, depth: pk.depth,
    bounds: { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] },
  };
}

function pack(
  n: number,
  get: (i: number) => { a: Readonly<V> | Vec3; b: Readonly<V> | Vec3; r: number; parent: number; kind: number; depth: number },
): Packed {
  if (n === 0) throw new Error('skeleton: empty segment list');
  if (n > MAX_SEGMENTS) throw new Error(`skeleton: ${n} segments exceed MAX_SEGMENTS (${MAX_SEGMENTS})`);
  const pk: Packed = {
    a: new Float32Array(3 * n), b: new Float32Array(3 * n), radius: new Float32Array(n),
    parent: new Int32Array(n), kind: new Uint8Array(n), depth: new Uint8Array(n),
  };
  for (let i = 0; i < n; i++) {
    const s = get(i);
    const want = i === 0 ? s.parent === -1 : Number.isInteger(s.parent) && s.parent >= 0 && s.parent < i;
    if (!want) throw new Error(`skeleton: invalid parent ${s.parent} for segment ${i}`);
    // Validated in their stored Float32 form: 1e100 would become Infinity, 1e-100 would become 0.
    const r32 = Math.fround(s.r);
    if (!(Number.isFinite(r32) && r32 > 0)) throw new Error(`skeleton: invalid radius ${s.r} for segment ${i}`);
    if (s.kind !== SEGMENT_KIND.TRUNK && s.kind !== SEGMENT_KIND.BRANCH && s.kind !== SEGMENT_KIND.ROOT) {
      throw new Error(`skeleton: invalid kind ${s.kind} for segment ${i}`);
    }
    if (!(Number.isInteger(s.depth) && s.depth >= 0 && s.depth <= 255)) throw new Error(`skeleton: invalid depth ${s.depth} for segment ${i}`);
    for (let c = 0; c < 3; c++) {
      if (!Number.isFinite(Math.fround(s.a[c])) || !Number.isFinite(Math.fround(s.b[c]))) {
        throw new Error(`skeleton: coordinate not representable as a finite Float32 in segment ${i}`);
      }
      pk.a[3 * i + c] = s.a[c];
      pk.b[3 * i + c] = s.b[c];
    }
    pk.radius[i] = s.r;
    pk.parent[i] = s.parent;
    pk.kind[i] = s.kind;
    pk.depth[i] = s.depth;
  }
  return pk;
}

export function growSkeleton(o: { mode: GrowthMode; seed?: number; species?: SpeciesId }): Skeleton {
  const seed = o.seed ?? DEFAULT_SEED;
  if (!Number.isFinite(seed)) throw new Error(`skeleton: non-finite seed ${seed}`);
  const species: SpeciesId = o.species ?? 'chene';
  if (species !== 'chene') throw new Error(`skeleton: unknown species ${String(species)}`);
  if (o.mode !== 'simple' && o.mode !== 'natural') throw new Error(`skeleton: unknown mode ${String(o.mode)}`);
  const c: Ctx = { rnd: mulberry32(seed), segs: [] };
  if (o.mode === 'natural') buildNaturalOak(c);
  else buildSimpleOak(c);
  const segs = c.segs;
  const pk = pack(segs.length, (i) => {
    const s = segs[i];
    return { a: s.a, b: s.b, r: s.r, parent: s.parent, kind: KIND_CODE[s.kind], depth: s.depth };
  });
  return finish(pk, { species, mode: o.mode, seed });
}

export function skeletonFromSegments(
  s: readonly SegmentInput[],
  meta?: Partial<{ species: SpeciesId; mode: GrowthMode; seed: number }>,
): Skeleton {
  if (meta?.seed !== undefined && !Number.isFinite(meta.seed)) throw new Error(`skeleton: non-finite seed ${meta.seed}`);
  const pk = pack(s.length, (i) => {
    const x = s[i];
    return { a: x.a, b: x.b, r: x.radius, parent: x.parent, kind: x.kind, depth: x.depth };
  });
  return finish(pk, { species: meta?.species ?? 'chene', mode: meta?.mode ?? 'simple', seed: meta?.seed ?? DEFAULT_SEED });
}

// ---------------------------------------------------------------------------------------------
// Skill anchors (proto:567-596), on their own stream so they never depend on the point cloud.
const vecAt = (arr: Float32Array, i: number): Vec3 => [arr[3 * i], arr[3 * i + 1], arr[3 * i + 2]];

export function anchorSkills(sk: Skeleton, skills: readonly { id: string; layer: Layer }[], seed?: number): SkillAnchor[] {
  const rnd = mulberry32(deriveSeed(seed ?? sk.seed, STREAMS.anchors));
  const n = sk.count;
  const Htop = sk.bounds.max[1];
  const by = (arr: Float32Array, i: number): number => arr[3 * i + 1];

  let trunkTop = -Infinity;
  for (let i = 0; i < n; i++) if (sk.kind[i] === SEGMENT_KIND.TRUNK) trunkTop = Math.max(trunkTop, by(sk.b, i));
  const tTop = Math.min(0.82 * trunkTop, 0.5 * Htop);
  const trunkCount = skills.filter((s) => s.layer === 'trunk').length;
  const fraction = (k: number): number =>
    trunkCount <= TRUNK_TARGETS.length ? TRUNK_TARGETS[k] : 0.28 + (k * (0.94 - 0.28)) / (trunkCount - 1);

  const filters: Record<'root' | 'canopy', (i: number) => boolean> = {
    root: (i) => sk.kind[i] === SEGMENT_KIND.ROOT && sk.depth[i] >= 3 && by(sk.b, i) < -0.6,
    canopy: (i) => sk.kind[i] === SEGMENT_KIND.BRANCH && sk.depth[i] >= 1 && by(sk.b, i) > 0.55 * Htop,
  };
  const used: number[] = [];
  const usedSet = new Set<number>();
  const pick = (layer: 'root' | 'canopy', id: string): number => {
    const cand: number[] = [];
    for (let i = 0; i < n; i++) if (filters[layer](i) && !usedSet.has(i)) cand.push(i);
    if (!cand.length) throw new Error(`anchorSkills: no ${layer} segment left for skill ${id}`);
    // 80 draws, keep the candidate farthest from the anchors already taken (proto:579-588).
    let best = -1;
    let bestScore = -1;
    for (let k = 0; k < 80; k++) {
      const o = cand[Math.floor(rnd() * cand.length)];
      let minD = Infinity; // the prototype capped this at 99 (proto:583)
      for (const j of used) {
        const dx = sk.b[3 * j] - sk.b[3 * o];
        const dy = sk.b[3 * j + 1] - sk.b[3 * o + 1];
        const dz = sk.b[3 * j + 2] - sk.b[3 * o + 2];
        minD = Math.min(minD, Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
      if (minD > bestScore) {
        bestScore = minD;
        best = o;
      }
    }
    used.push(best);
    usedSet.add(best);
    return best;
  };

  let k = 0;
  return skills.map((s): SkillAnchor => {
    if (s.layer === 'trunk') {
      const y = fraction(k) * tTop;
      const side = k % 2 === 0 ? 'left' : 'right';
      k++;
      let best = -1;
      for (let j = 0; j < n; j++) {
        if (sk.kind[j] === SEGMENT_KIND.TRUNK && by(sk.a, j) <= y && y <= by(sk.b, j)) best = j;
      }
      if (best < 0) throw new Error(`anchorSkills: no trunk segment spans height ${y} for skill ${s.id}`);
      const a = vecAt(sk.a, best);
      const b = vecAt(sk.b, best);
      const t = b[1] > a[1] ? (y - a[1]) / (b[1] - a[1]) : 0;
      const position: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      return { id: s.id, layer: s.layer, segment: best, t, position, side };
    }
    if (s.layer !== 'root' && s.layer !== 'canopy') throw new Error(`anchorSkills: unknown layer ${String(s.layer)}`);
    const seg = pick(s.layer, s.id);
    return { id: s.id, layer: s.layer, segment: seg, t: 1, position: vecAt(sk.b, seg), side: null };
  });
}
