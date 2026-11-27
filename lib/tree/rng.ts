// Seeded pseudo-random streams for the tree engine (contract B1).
// Every random draw of lib/tree goes through one of these generators: no global state.

export type Rng = () => number; // values in [0, 1)

// Exact port of the prototype generator (proto:271), with its state captured in the closure.
export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// murmur3 32-bit finaliser: a bijection that spreads every input bit over the whole word.
function fmix32(x: number): number {
  let h = x | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Derives an independent 32-bit seed for a named stream. The base seed (reduced modulo 2^32, as
// mulberry32 does) is avalanched first, then the label is folded in with FNV-1a, then the result
// is avalanched again. Every step is a bijection of the state for a fixed label, so two distinct
// 32-bit seeds always give two distinct derived seeds, whatever bits they differ by.
export function deriveSeed(seed: number, label: string): number {
  if (!Number.isFinite(seed)) throw new Error(`deriveSeed: non-finite seed ${seed}`);
  let h = fmix32((seed >>> 0) ^ 0x811c9dc5);
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}

// Named streams: geometry of the skeleton uses mulberry32(seed) directly, everything else
// draws from mulberry32(deriveSeed(seed, STREAMS.x)).
export const STREAMS = Object.freeze({
  anchors: 'anchors',
  cloud: 'cloud',
  entry: 'entry',
  color: 'color',
  sap: 'sap',
} as const);
