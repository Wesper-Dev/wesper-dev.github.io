// Pure camera helpers of the tree scene (contract D9): framing, orientation toward a selection,
// gesture lock, frame-rate independent smoothing and idle rotation.
import type { DeviceProfile } from './cloud.ts';
import type { Skeleton, Vec3 } from './skeleton.ts';

export const CAMERA = Object.freeze({
  rotStart: 0.6, // proto:783
  drag: 0.006, // rad per pixel (proto:787)
  arrow: 0.35, // rad per key press (proto:793)
  idleDelay: 2.5, // s (proto:1093)
  idleSpeed: 0.06, // rad/s (proto:1093)
  idleStop: 20, // s of idle rotation before the tree stops by itself
  tauRot: 0.2, // s: per-frame factor 0.08 at 60 Hz (proto:1094)
  tauHi: 0.2, // s (proto:1095)
  tauCam: 0.325, // s: per-frame factor 0.05 at 60 Hz (proto:1100)
  near: 0.1,
  far: 200,
} as const);

// proto:808
export function fovFor(aspect: number): number {
  return aspect < 0.8 ? 58 : 40;
}

// proto:796-803, on the skeleton bounds widened by 0.6 on every side.
export function frameCamera(bounds: Skeleton['bounds'], aspect: number, profile: DeviceProfile): { fov: number; r: number; y: number; look: number } {
  const fov = fovFor(aspect);
  const minY = bounds.min[1] - 0.6;
  const maxY = bounds.max[1] + 0.6;
  const H = maxY - minY;
  const W = Math.max(bounds.max[0] - bounds.min[0] + 1.2, bounds.max[2] - bounds.min[2] + 1.2);
  const vf = (fov * Math.PI) / 180 / 2;
  const hf = Math.atan(Math.tan(vf) * aspect);
  const [uH, uW] = profile === 'phone' ? [0.6, 0.95] : [0.82, 0.42];
  const r = Math.max(H / 2 / Math.tan(vf) / uH, W / 2 / Math.tan(hf) / uW) + 0.3 * W;
  const mid = (maxY + minY) / 2;
  const look = profile === 'phone' ? mid - 0.16 * H : mid;
  return { fov, r, y: look + 1.2, look };
}

// proto:853-855: face the selection, unless its anchors are centred on the axis.
export function orientToward(points: readonly Vec3[], current: number): number | null {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p[0];
    z += p[2];
  }
  if (Math.hypot(x, z) <= 0.3) return null;
  let a = -Math.atan2(x, z) + 0.25;
  while (a - current > Math.PI) a -= Math.PI * 2;
  while (current - a > Math.PI) a += Math.PI * 2;
  return a;
}

// Direction lock of a pointer gesture: a horizontal drag rotates the tree, a vertical one scrolls the page.
export function gestureLock(dx: number, dy: number): 'pending' | 'rotate' | 'scroll' {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > ay && ax > 6) return 'rotate';
  if (ay >= ax && ay > 6) return 'scroll';
  return 'pending';
}

// Exponential smoothing factor for a step dt: applying it twice over dt/2 equals once over dt.
export function smoothing(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / tau);
}

// Slow rotation after idleDelay seconds without interaction (proto:1093), stopping by itself idleStop seconds later,
// never in reduced motion. The step only rotates over its overlap with [idleDelay, idleDelay + idleStop], so a rest
// never turns by more than idleStop * idleSpeed, whatever the frame steps.
export function idleStep(o: { idle: number; dt: number; active: boolean; reducedMotion: boolean }): { idle: number; dRot: number } {
  if (o.active) return { idle: 0, dRot: 0 };
  const idle = o.idle + o.dt;
  if (o.reducedMotion) return { idle, dRot: 0 };
  const turning = Math.min(idle, CAMERA.idleDelay + CAMERA.idleStop) - Math.max(o.idle, CAMERA.idleDelay);
  return { idle, dRot: turning > 0 ? turning * CAMERA.idleSpeed : 0 };
}
