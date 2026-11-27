// Reasons of a fallback to the HTML content of the tree block (contract D10.1), shared by the
// client island and the scene.
export const FALLBACK = Object.freeze({
  noWebgl2: 'no-webgl2',
  import: 'import',
  contextLost: 'context-lost',
  fps: 'fps',
  error: 'error',
} as const);
export type FallbackReason = (typeof FALLBACK)[keyof typeof FALLBACK];
