// Page colours of a palette (lot 2a E10, E11, audit): CSS custom properties and backdrop gradient of the tree
// block, painted on the home page. The two formulas are those of cssVariables (color.ts, B5) and backdropCss
// (backdrop.ts, D16), repeated here so that the client island can paint the palette of the preview URL before it
// tests WebGL without bundling the engine; tests/e10 and the scene keep them equal (the scene paints with these).
import type { Palette } from '../../content/palettes.ts';
import type { DeviceProfile } from './cloud.ts';

export type BackdropCssKind = 'halo' | 'foret' | 'ciel';

// CSS custom properties of a palette (names of proto:773, plus --bg2).
export function cssVariables(p: Palette): Record<string, string> {
  return { '--night': p.bg, '--bg2': p.bg2, '--ink': p.ink, '--muted': p.muted, '--accent': p.lit, '--warm': p.lit };
}

// CSS background of the block behind the canvas (proto:761-765). The Night backdrop is not ported.
export function backdropCss(kind: BackdropCssKind, p: Palette, profile: DeviceProfile): string {
  const halo = `radial-gradient(ellipse 70% 60% at 50% ${profile === 'phone' ? 42 : 56}%, ${p.bg2} 0%, ${p.bg} 72%)`;
  if (kind === 'foret') return `linear-gradient(to bottom, transparent 55%, ${p.bg2}AA 72%, transparent 92%), ${halo}`;
  if (kind === 'ciel') return `radial-gradient(circle at 80% 13%, ${p.ink}2E 0, ${p.ink}0A 4%, transparent 16%), linear-gradient(to bottom, ${p.bg2} 0%, ${p.bg} 62%)`;
  return halo;
}

// Paints a palette on the home page: tokens on [data-home] and on the tree block, which always stay equal
// (E10.1), the background of <html> and <body> (E10.3) and the backdrop of the block.
export function paintPage(block: HTMLElement, p: Palette, backdrop: BackdropCssKind, profile: DeviceProfile): void {
  const page = block.closest<HTMLElement>('[data-home]');
  for (const [k, v] of Object.entries(cssVariables(p))) {
    block.style.setProperty(k, v);
    page?.style.setProperty(k, v);
  }
  if (page) document.documentElement.style.setProperty('--home-bg', p.bg);
  block.style.background = backdropCss(backdrop, p, profile);
}
