// Leaves falling from the canopy now and then (contract D16.2, proto:1017-1047). Every array is
// allocated once; `step` reports whether the GPU copy must be refreshed (a leaf is flying or has
// just landed), so nothing is uploaded while every leaf waits.
import type { Palette } from '../../content/palettes.ts';
import { SCENE_STREAMS } from './build.ts';
import type { Cloud, DeviceProfile } from './cloud.ts';
import { POINT_ROLE } from './cloud.ts';
import { hexToRgb } from './color.ts';
import type { RGB } from './color.ts';
import { deriveSeed, mulberry32 } from './rng.ts';

export interface LeavesOptions {
  profile: DeviceProfile;
  reducedMotion: boolean;
  seed: number;
  palette: Palette;
  cloud?: Pick<Cloud, 'count' | 'positions' | 'role'>;
  data?: { cloud: Pick<Cloud, 'count' | 'positions' | 'role'> };
}

export interface Leaves {
  readonly capacity: number;
  readonly live: number;
  // Render attributes (one entry per leaf).
  readonly position: Float32Array; // 3 x capacity
  readonly rotation: Float32Array;
  readonly alpha: Float32Array;
  readonly color: Float32Array; // 3 x capacity
  readonly size: Float32Array;
  step(dt: number): boolean;
  recolor(p: Palette): void;
}

const leafColors = (p: Palette): RGB[] => [hexToRgb(p.leaf[1]), hexToRgb(p.leafAcc), hexToRgb(p.root[0])];

export function createLeaves(o: LeavesOptions): Leaves {
  const cloud = o.cloud ?? o.data?.cloud;
  if (!cloud) throw new Error('createLeaves: a point cloud is required');
  const cap = o.reducedMotion ? 0 : o.profile === 'phone' ? 12 : 28;
  const deathWait = o.profile === 'phone' ? 14 : 9;
  const rnd = mulberry32(deriveSeed(o.seed, SCENE_STREAMS.leaves));
  let colors = leafColors(o.palette);

  const position = new Float32Array(3 * cap);
  const rotation = new Float32Array(cap);
  const alpha = new Float32Array(cap);
  const color = new Float32Array(3 * cap);
  const size = new Float32Array(cap);
  // Per-leaf state (proto:1034).
  const flying = new Uint8Array(cap);
  const wait = new Float32Array(cap);
  const x0 = new Float32Array(cap);
  const y = new Float32Array(cap);
  const z0 = new Float32Array(cap);
  const vy = new Float32Array(cap);
  const ph = new Float32Array(cap);
  const sw = new Float32Array(cap);
  const fr = new Float32Array(cap);
  const spin = new Float32Array(cap);
  const rot = new Float32Array(cap);
  const age = new Float32Array(cap);
  const tint = new Uint8Array(cap);
  let live = 0;

  for (let j = 0; j < cap; j++) wait[j] = 1 + rnd() * 12;

  // A leaf is born on a random LEAF point of the cloud (60 draws, proto:1032); none found: it waits.
  const spawn = (j: number): boolean => {
    let i = -1;
    for (let t = 0; t < 60 && cloud.count > 0; t++) {
      const c = Math.min(cloud.count - 1, Math.floor(rnd() * cloud.count));
      if (cloud.role[c] === POINT_ROLE.LEAF) {
        i = c;
        break;
      }
    }
    if (i < 0) return false;
    x0[j] = cloud.positions[3 * i];
    y[j] = cloud.positions[3 * i + 1];
    z0[j] = cloud.positions[3 * i + 2];
    tint[j] = Math.min(2, Math.floor(rnd() * 3));
    vy[j] = 0.45 + rnd() * 0.4;
    ph[j] = rnd() * 6.28;
    sw[j] = 0.5 + rnd() * 0.6;
    fr[j] = 0.9 + rnd() * 0.7;
    spin[j] = (rnd() - 0.5) * 3;
    rot[j] = rnd() * 6.28;
    size[j] = 2.6 + rnd() * 1.6;
    age[j] = 0;
    flying[j] = 1;
    return true;
  };

  return {
    capacity: cap,
    get live(): number {
      return live;
    },
    position,
    rotation,
    alpha,
    color,
    size,
    step(dt: number): boolean {
      let landed = false;
      for (let j = 0; j < cap; j++) {
        if (!flying[j]) {
          alpha[j] = 0;
          wait[j] -= dt;
          if (wait[j] <= 0 && spawn(j)) live++;
          continue;
        }
        age[j] += dt;
        y[j] -= vy[j] * dt;
        ph[j] += fr[j] * dt;
        rot[j] += spin[j] * dt;
        position[3 * j] = x0[j] + Math.sin(ph[j]) * sw[j] + age[j] * 0.12;
        position[3 * j + 1] = y[j];
        position[3 * j + 2] = z0[j] + Math.cos(ph[j] * 0.7) * sw[j] * 0.6;
        rotation[j] = rot[j] + Math.sin(ph[j]) * 0.6;
        const fadeIn = Math.min(1, age[j] / 0.6);
        const fadeOut = Math.min(1, Math.max(0, (y[j] - 0.05) / 1.2));
        alpha[j] = 0.9 * fadeIn * fadeOut;
        const c = colors[tint[j]];
        color[3 * j] = c[0];
        color[3 * j + 1] = c[1];
        color[3 * j + 2] = c[2];
        if (y[j] < 0.05) {
          flying[j] = 0;
          live--;
          landed = true;
          wait[j] = 2 + rnd() * deathWait;
        }
      }
      return live > 0 || landed;
    },
    recolor(p: Palette): void {
      colors = leafColors(p);
    },
  };
}
