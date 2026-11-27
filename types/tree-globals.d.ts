// Compile-time constants of the tree scene, defined in vite.config.ts (contract D1.3).
// Both are false in the public export (SITE_PUBLIC=1), so the workshop and the diagnostic
// are removed by dead-code elimination.
declare const __TREE_ATELIER__: boolean;
declare const __TREE_DIAG__: boolean;

// Vite: URL of a bundled Worker module (import x from './w.ts?worker&url').
declare module '*?worker&url' {
  const url: string;
  export default url;
}
