// Tree palettes (contract B7). Single source of the colours used by the WebGL scene and the CSS.
// Values copied from the prototype: sous-bois = agy-sous-bois and ardoise = sol-ardoise (proto:489),
// foret (proto:474-476) and givre (proto:471-473). The unused `fog` field of the agent palettes
// is dropped (the prototype uses bg); bg2 of foret and givre is made explicit with the rule of
// proto:752, bg2 = mix(bg, leaf[0], 0.12).

export type PaletteId = 'sous-bois' | 'ardoise' | 'foret' | 'givre';

export interface Palette {
  id: PaletteId;
  name: string; // workshop name only (proto:474, 489), never shown on the public site
  bg: string;
  bg2: string;
  ink: string;
  muted: string;
  bark: readonly [string, string];
  barkAcc: string;
  root: readonly [string, string];
  leaf: readonly [string, string];
  leafAcc: string;
  lit: string;
  sap: readonly [string, string];
}

const freeze = (p: Palette): Palette =>
  Object.freeze({ ...p, bark: Object.freeze(p.bark), root: Object.freeze(p.root), leaf: Object.freeze(p.leaf), sap: Object.freeze(p.sap) });

export const PALETTES: Readonly<Record<PaletteId, Palette>> = Object.freeze({
  'sous-bois': freeze({
    id: 'sous-bois', name: 'Sous-bois & ambre',
    bg: '#050A08', bg2: '#0D1712', ink: '#EAF0EC', muted: '#8FA69B',
    bark: ['#A89882', '#4F463B'], barkAcc: '#6E8F5E', root: ['#B87B42', '#59381C'],
    leaf: ['#0D5C38', '#62B836'], leafAcc: '#D4C25B', lit: '#FFB84D', sap: ['#F59223', '#FFF6DC'],
  }),
  ardoise: freeze({
    id: 'ardoise', name: 'Ardoise & ambre',
    bg: '#080E16', bg2: '#171F2B', ink: '#EAEFF3', muted: '#A9B7C1',
    bark: ['#9F8B76', '#54483F'], barkAcc: '#737669', root: ['#9D6243', '#573628'],
    leaf: ['#12604F', '#388D6B'], leafAcc: '#4B806A', lit: '#EBC46F', sap: ['#E9A13C', '#FFF3D7'],
  }),
  foret: freeze({
    id: 'foret', name: 'Forêt de nuit',
    bg: '#040C0A', bg2: '#051912', ink: '#EAF0EA', muted: '#8FA39A',
    bark: ['#B8A58C', '#5E5244'], barkAcc: '#7FA36A', root: ['#C08A4A', '#6B4A2A'],
    leaf: ['#0F7A4C', '#8FD84A'], leafAcc: '#F2DB7A', lit: '#FFD27A', sap: ['#FFB347', '#FFFBEA'],
  }),
  givre: freeze({
    id: 'givre', name: 'Givre (actuelle)',
    bg: '#060A11', bg2: '#131F2B', ink: '#E9ECF1', muted: '#8E98A8',
    bark: ['#6FB7E9', '#3E6FA8'], barkAcc: '#E58A3C', root: ['#6FB7E9', '#3E6FA8'],
    leaf: ['#6FB7E9', '#CFE3F2'], leafAcc: '#E58A3C', lit: '#FFC861', sap: ['#FFA838', '#FFF8E5'],
  }),
});

export const PALETTE_ORDER: readonly PaletteId[] = Object.freeze(['sous-bois', 'ardoise', 'foret', 'givre'] as const);

// Owner's provisional favourite (contract lot 4, Q1). One line: every page, home and interior, follows it.
export const DEFAULT_PALETTE: PaletteId = 'foret';
