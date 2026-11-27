// Firefly trail behind a fast mouse (contract D16.3, proto:993-1012), as a fixed pool of 260
// particles in float64 typed arrays (the plain numbers of the prototype). Integration is scaled to
// 60 frames per second, and drawing only blits sprites rendered once per palette: no gradient is
// created while animating.
import type { Palette } from '../../content/palettes.ts';
import { SCENE_STREAMS } from './build.ts';
import { deriveSeed, mulberry32 } from './rng.ts';

export const FIREFLY_CAPACITY = 260;

// Minimal 2D context and canvas surfaces used here (DOM canvas, OffscreenCanvas or a test double).
export interface SpriteContext {
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(offset: number, color: string): void };
  fillStyle: unknown;
  fillRect(x: number, y: number, w: number, h: number): void;
}
export interface SpriteCanvas {
  getContext(kind: '2d'): unknown;
}
export interface DrawContext {
  globalAlpha: number;
  globalCompositeOperation: string;
  drawImage(image: never, x: number, y: number, w: number, h: number): void;
}

const SPRITE = 64;

// One soft disc per colour: index 0 is sap[0], index 1 is leaf[1] (proto:1001, 1008-1009).
export function createSprites<C extends SpriteCanvas>(p: Palette, makeCanvas: (w: number, h: number) => C): C[] {
  return [p.sap[0], p.leaf[1]].map((hex) => {
    const canvas = makeCanvas(SPRITE, SPRITE);
    const ctx = canvas.getContext('2d') as SpriteContext | null;
    if (!ctx) throw new Error('createSprites: no 2d context');
    const h = SPRITE / 2;
    const g = ctx.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, hex);
    g.addColorStop(0.25, `${hex}AA`);
    g.addColorStop(1, `${hex}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SPRITE, SPRITE);
    return canvas;
  });
}

export interface PointerSample {
  x: number;
  y: number;
  t: number; // ms
  pointerType: string;
}

export interface Fireflies {
  readonly capacity: number;
  readonly live: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly life: Float64Array;
  readonly decay: Float64Array;
  readonly radius: Float64Array;
  readonly tint: Uint8Array;
  pointerMove(e: PointerSample): void;
  step(dt: number): void;
  draw(ctx: DrawContext, sprites: readonly unknown[]): void;
  clear(): void;
}

export function createFireflies(o: { reducedMotion: boolean; palette?: Palette; seed: number }): Fireflies {
  const cap = FIREFLY_CAPACITY;
  const rnd = mulberry32(deriveSeed(o.seed, SCENE_STREAMS.fireflies));
  const x = new Float64Array(cap);
  const y = new Float64Array(cap);
  const vx = new Float64Array(cap);
  const vy = new Float64Array(cap);
  const life = new Float64Array(cap);
  const decay = new Float64Array(cap);
  const radius = new Float64Array(cap);
  const tint = new Uint8Array(cap);
  let live = 0;
  let last: { x: number; y: number; t: number } | null = null;

  const remove = (j: number): void => {
    const k = --live;
    x[j] = x[k];
    y[j] = y[k];
    vx[j] = vx[k];
    vy[j] = vy[k];
    life[j] = life[k];
    decay[j] = decay[k];
    radius[j] = radius[k];
    tint[j] = tint[k];
  };

  return {
    capacity: cap,
    get live(): number {
      return live;
    },
    x, y, vx, vy, life, decay, radius, tint,
    pointerMove(e: PointerSample): void {
      if (o.reducedMotion || e.pointerType !== 'mouse') return;
      if (last) {
        const dx = e.x - last.x;
        const dy = e.y - last.y;
        const dt = Math.max(1, e.t - last.t);
        const v = Math.hypot(dx, dy) / dt;
        if (v > 1.4) {
          const n = Math.min(6, Math.floor((v - 1.2) * 2.5));
          for (let j = 0; j < n && live < cap; j++) {
            const k = live++;
            const f = rnd();
            x[k] = e.x - dx * f;
            y[k] = e.y - dy * f;
            vx[k] = (-dx / dt) * 0.08 + (rnd() - 0.5) * 0.6;
            vy[k] = (-dy / dt) * 0.08 + (rnd() - 0.5) * 0.6 - 0.25;
            life[k] = 1;
            decay[k] = 0.012 + rnd() * 0.02;
            radius[k] = 1 + rnd() * 2.2;
            tint[k] = rnd() < 0.7 ? 0 : 1;
          }
        }
      }
      last = { x: e.x, y: e.y, t: e.t };
    },
    // Position first, then velocity, with every per-frame factor of the prototype raised to dt x 60.
    step(dt: number): void {
      const k = dt * 60;
      const damp = Math.pow(0.96, k);
      for (let j = live - 1; j >= 0; j--) {
        x[j] += vx[j] * k;
        y[j] += vy[j] * k;
        vx[j] *= damp;
        vy[j] = vy[j] * damp - 0.01 * k;
        life[j] -= decay[j] * k;
        if (life[j] <= 0) remove(j);
      }
    },
    draw(ctx: DrawContext, sprites: readonly unknown[]): void {
      if (live === 0) return;
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < live; j++) {
        const r = radius[j] * 4;
        ctx.globalAlpha = life[j] * life[j];
        ctx.drawImage(sprites[tint[j]] as never, x[j] - r, y[j] - r, 2 * r, 2 * r);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
    clear(): void {
      live = 0;
      last = null;
    },
  };
}
