// Scene data of the tree (contract D5): skeleton, anchors, point cloud, colours, sap distances and
// the current sap mask, built from the 1b engine. Pure and free of three, so that it can run on the
// main thread or in a module Worker and hand its typed arrays over with `transferables`.
import type { Palette } from '../../content/palettes.ts';
import { SKILL_LAYOUT } from '../../content/tree-layout.ts';
import type { SkillId } from '../../content/tree.ts';
import { POINT_ROLE, PROFILES, sampleCloud } from './cloud.ts';
import type { Cloud, DeviceProfile } from './cloud.ts';
import { applyPalette } from './color.ts';
import { pointMask, sapPath, segmentDistances, segmentMask } from './sap.ts';
import type { SapPath, SegmentDistances } from './sap.ts';
import { anchorSkills, DEFAULT_SEED, growSkeleton } from './skeleton.ts';
import type { GrowthMode, Skeleton, SkillAnchor } from './skeleton.ts';

// Random streams added by the scene (D0). STREAMS of rng.ts stays unchanged: each label below is
// drawn with mulberry32(deriveSeed(seed, label)).
export const SCENE_STREAMS = Object.freeze({ backdrop: 'backdrop', leaves: 'leaves', fireflies: 'fireflies' } as const);

export interface TreeTimings {
  skeleton: number;
  anchors: number;
  cloud: number;
  colors: number;
  sapD: number;
}

export interface TreeData {
  profile: DeviceProfile;
  mode: GrowthMode;
  seed: number;
  skeleton: Skeleton;
  anchors: SkillAnchor[];
  distances: SegmentDistances;
  cloud: Cloud;
  colors: Float32Array; // 3N, written by applyPalette only
  sapD: Float32Array; // N: real distance from the base of each point's projection on its segment
  hi: Uint8Array; // N: current sap mask (0 at start)
  timings: TreeTimings;
}

// Distance from the base of each point (D5.3): LEAF points sit at the tip of their segment; bark and
// root points are projected on the segment axis, clamped to [0, 1].
function sapDistances(sk: Skeleton, cloud: Cloud, d: SegmentDistances): Float32Array {
  const n = cloud.count;
  const out = new Float32Array(n);
  const P = cloud.positions;
  for (let k = 0; k < n; k++) {
    const seg = cloud.segment[k];
    const start = d.start[seg];
    const end = d.end[seg];
    if (cloud.role[k] === POINT_ROLE.LEAF) {
      out[k] = end;
      continue;
    }
    const ax = sk.a[3 * seg];
    const ay = sk.a[3 * seg + 1];
    const az = sk.a[3 * seg + 2];
    const dx = sk.b[3 * seg] - ax;
    const dy = sk.b[3 * seg + 1] - ay;
    const dz = sk.b[3 * seg + 2] - az;
    const l2 = dx * dx + dy * dy + dz * dz;
    const t = l2 === 0 ? 1 : Math.min(1, Math.max(0, ((P[3 * k] - ax) * dx + (P[3 * k + 1] - ay) * dy + (P[3 * k + 2] - az) * dz) / l2));
    out[k] = start + t * (end - start);
  }
  return out;
}

export function buildTreeData(o: { profile: DeviceProfile; mode?: GrowthMode; seed?: number; palette: Palette; now?: () => number }): TreeData {
  const now = o.now ?? ((): number => 0);
  const profile = o.profile;
  const mode = o.mode ?? PROFILES[profile].mode;
  const seed = o.seed ?? DEFAULT_SEED;
  const t0 = now();
  const skeleton = growSkeleton({ mode, seed });
  const t1 = now();
  const anchors = anchorSkills(skeleton, SKILL_LAYOUT);
  const t2 = now();
  const cloud = sampleCloud(skeleton, { points: PROFILES[profile].points });
  const t3 = now();
  const colors = applyPalette(cloud, skeleton.bounds, o.palette);
  const t4 = now();
  const distances = segmentDistances(skeleton);
  const sapD = sapDistances(skeleton, cloud, distances);
  const t5 = now();
  return {
    profile, mode, seed, skeleton, anchors, distances, cloud, colors, sapD,
    hi: new Uint8Array(cloud.count),
    timings: { skeleton: t1 - t0, anchors: t2 - t1, cloud: t3 - t2, colors: t4 - t3, sapD: t5 - t4 },
  };
}

// Every distinct ArrayBuffer behind the typed arrays of the data, for postMessage(data, transfer).
export function transferables(d: TreeData): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>();
  const seen = new Set<unknown>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (ArrayBuffer.isView(v)) {
      if (v.buffer instanceof ArrayBuffer) out.add(v.buffer);
      return;
    }
    for (const x of Object.values(v as Record<string, unknown>)) walk(x);
  };
  walk(d);
  return [...out];
}

// Sap paths of the selected skills and the per-point mask of the segments they cross (0 or 1).
export function sapMask(d: TreeData, skills: readonly SkillId[]): { paths: SapPath[]; hi: Uint8Array } {
  const paths = skills.map((id) => {
    const anchor = d.anchors.find((a) => a.id === id);
    if (!anchor) throw new Error(`sapMask: no anchor for skill ${id}`);
    return sapPath(d.skeleton, anchor, d.distances);
  });
  return { paths, hi: pointMask(d.cloud.segment, segmentMask(d.skeleton, paths)) };
}
