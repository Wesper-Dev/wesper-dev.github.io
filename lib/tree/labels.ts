// Label layout (contract B6, pure part): projection to screen, side flip, framing inside the
// viewport, overlap removal by priority, tooltip placement and a size cache. Replaces
// proto:1063-1080, which read offsetWidth on every frame, let hidden labels push the others and
// never clamped labels vertically.
import type { Vec3 } from './skeleton.ts';

export const LABEL_MARGIN = 8;
export const LABEL_GAP = 6;
export const LABEL_OVERLAP_TOLERANCE = 2; // proto:1067-1070, 1079

export interface Viewport {
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}

export interface LabelInput {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  side: 'left' | 'right';
  width: number;
  height: number;
  priority?: number;
}

export interface LabelPlacement {
  id: string;
  left: number;
  top: number;
  side: 'left' | 'right';
  visible: boolean;
}

// NDC to pixels (proto:1064-1065); a point is visible when -1 <= z < 1 (proto:1071).
export function projectToScreen(ndc: Vec3, vp: Viewport): { x: number; y: number; visible: boolean } {
  return {
    x: (ndc[0] * 0.5 + 0.5) * vp.width,
    y: (-ndc[1] * 0.5 + 0.5) * vp.height,
    visible: Number.isFinite(ndc[0]) && Number.isFinite(ndc[1]) && ndc[2] >= -1 && ndc[2] < 1,
  };
}

const EPS = 1e-9;

// Labels are placed one by one, highest priority first (ties broken by id). Each one takes the
// free vertical position closest to its anchor: the feasible set is the frame minus the bands
// forbidden by the labels already placed that overlap it horizontally, so the optimum is either
// the anchor height itself or the edge of one of those bands. When no such position exists, the
// placed labels and the newcomer are compacted vertically (see compact); only if that also fails
// is the newcomer hidden. Higher-priority labels are never hidden by a lower-priority one.
export function layoutLabels(
  items: readonly LabelInput[],
  vp: Viewport,
  o?: { margin?: number; gap?: number; tolerance?: number },
): LabelPlacement[] {
  const margin = o?.margin ?? LABEL_MARGIN;
  const gap = o?.gap ?? LABEL_GAP;
  const tol = o?.tolerance ?? LABEL_OVERLAP_TOLERANCE;
  const W = vp.width;
  const H = vp.height;

  const finite = (it: LabelInput): boolean =>
    Number.isFinite(it.x) && Number.isFinite(it.y) && Number.isFinite(it.width) && Number.isFinite(it.height);

  const out: LabelPlacement[] = items.map((it) => {
    let side = it.side;
    const w = it.width;
    if (side === 'right' && it.x + gap + w > W - margin) side = 'left';
    else if (side === 'left' && it.x + gap - w < margin) side = 'right';
    const raw = side === 'left' ? it.x + gap - w : it.x + gap;
    const left = Math.max(margin, Math.min(W - margin - w, raw));
    return { id: it.id, left, top: it.y - it.height / 2, side, visible: it.visible && finite(it) };
  });

  const order = items
    .map((it, i) => i)
    .filter((i) => out[i].visible)
    .sort((i, j) => {
      const pi = items[i].priority ?? 0;
      const pj = items[j].priority ?? 0;
      if (pi !== pj) return pj - pi;
      const a = items[i].id;
      const b = items[j].id;
      return a < b ? -1 : a > b ? 1 : 0;
    });

  const lo = margin;
  const placed: Box[] = [];
  for (const i of order) {
    const it = items[i];
    const pl = out[i];
    const w = it.width;
    const h = it.height;
    const hi = H - margin - h;
    if (!(w <= W - 2 * margin + EPS && hi >= lo - EPS)) {
      pl.visible = false;
      continue;
    }
    const clampY = (y: number): number => Math.max(lo, Math.min(hi, y));
    const box: Box = { idx: i, left: pl.left, top: 0, w, h, want: clampY(pl.top), rank: placed.length };
    const blockers = placed.filter((q) => overlapX(box, q));
    const free = (y: number): boolean =>
      blockers.every((q) => Math.min(y + h, q.top + q.h) - Math.max(y, q.top) <= tol + EPS);
    let best = Number.NaN;
    if (free(box.want)) best = box.want;
    else {
      const candidates: number[] = [];
      for (const q of blockers) candidates.push(clampY(q.top + q.h - tol), clampY(q.top - h + tol));
      for (const y of candidates) {
        if (!free(y)) continue;
        const d = Math.abs(y - box.want);
        const bd = Math.abs(best - box.want);
        // Closest free position; on a tie, below (the prototype pushed labels down).
        if (Number.isNaN(best) || d < bd - EPS || (Math.abs(d - bd) <= EPS && y > best)) best = y;
      }
    }
    if (!Number.isNaN(best)) {
      box.top = best;
      placed.push(box);
      continue;
    }
    if (compact([...placed, box], lo, H - margin, tol)) {
      placed.push(box);
      continue;
    }
    pl.visible = false;
  }
  for (const q of placed) out[q.idx].top = q.top;
  return out;
}

interface Box {
  idx: number; // index in the input
  left: number;
  top: number;
  w: number;
  h: number;
  want: number; // wished top, already clamped to the frame
  rank: number; // placement order (priority order)
}

const overlapX = (a: Box, b: Box): boolean => Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left) > EPS;

// One-dimensional compaction of a set of labels between top = lo and bottom = bottom. Labels
// are sorted by wished height (ties by priority order), pushed down below the earlier labels
// they overlap horizontally, then pushed back up from the bottom edge in reverse order. Each
// pass keeps every horizontally overlapping pair within `tol` of vertical overlap. On success
// the new tops are written into the boxes and true is returned; otherwise nothing changes.
function compact(boxes: Box[], lo: number, bottom: number, tol: number): boolean {
  const s = [...boxes].sort((a, b) => a.want - b.want || a.rank - b.rank);
  const top = s.map((b) => b.want);
  for (let k = 0; k < s.length; k++) {
    for (let j = 0; j < k; j++) if (overlapX(s[j], s[k])) top[k] = Math.max(top[k], top[j] + s[j].h - tol);
  }
  for (let k = s.length - 1; k >= 0; k--) {
    top[k] = Math.min(top[k], bottom - s[k].h);
    for (let j = k + 1; j < s.length; j++) if (overlapX(s[j], s[k])) top[k] = Math.min(top[k], top[j] - s[k].h + tol);
  }
  if (top.some((t) => t < lo - EPS)) return false;
  s.forEach((b, k) => {
    b.top = top[k];
  });
  return true;
}

// Tooltip next to its anchor, on the side with more room, kept inside the viewport (proto:942-945).
export function placeTooltip(
  anchor: { left: number; top: number; width: number; height: number },
  size: Size,
  vp: Viewport,
): { x: number; y: number; origin: 'left' | 'right' } {
  const right = anchor.left + anchor.width / 2 < vp.width / 2;
  const x0 = right ? anchor.left + anchor.width + 10 : anchor.left - size.width - 10;
  const x = Math.max(8, Math.min(vp.width - size.width - 8, x0));
  const y = Math.max(8, Math.min(vp.height - size.height - 8, anchor.top + anchor.height / 2 - size.height / 2));
  return { x, y, origin: right ? 'left' : 'right' };
}

// Measures each key once; layoutLabels then receives sizes as plain data.
export function createSizeCache<K>(
  measure: (key: K) => Size,
  keyOf: (key: K) => string,
): { get(key: K): Size; invalidate(): void; readonly measurements: number } {
  const cache = new Map<string, Size>();
  let count = 0;
  return {
    get(key: K): Size {
      const k = keyOf(key);
      let s = cache.get(k);
      if (!s) {
        s = measure(key);
        count++;
        cache.set(k, s);
      }
      return s;
    },
    invalidate(): void {
      cache.clear();
    },
    get measurements(): number {
      return count;
    },
  };
}
