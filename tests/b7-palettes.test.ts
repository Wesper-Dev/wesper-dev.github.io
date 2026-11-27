// Contrat B7 : content/palettes.ts (quatre palettes, ordre, palette par défaut, source unique des couleurs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { colorMod, palettesMod, siteDir } from './helpers-tree.ts';

// Valeurs exactes du contrat B7 (copiées de proto:471–476 et proto:489).
const WANT: Record<string, Record<string, string | string[]>> = {
  'sous-bois': {
    bg: '#050A08', bg2: '#0D1712', ink: '#EAF0EC', muted: '#8FA69B', bark: ['#A89882', '#4F463B'], barkAcc: '#6E8F5E',
    root: ['#B87B42', '#59381C'], leaf: ['#0D5C38', '#62B836'], leafAcc: '#D4C25B', lit: '#FFB84D', sap: ['#F59223', '#FFF6DC'],
  },
  ardoise: {
    bg: '#080E16', bg2: '#171F2B', ink: '#EAEFF3', muted: '#A9B7C1', bark: ['#9F8B76', '#54483F'], barkAcc: '#737669',
    root: ['#9D6243', '#573628'], leaf: ['#12604F', '#388D6B'], leafAcc: '#4B806A', lit: '#EBC46F', sap: ['#E9A13C', '#FFF3D7'],
  },
  foret: {
    bg: '#040C0A', bg2: '#051912', ink: '#EAF0EA', muted: '#8FA39A', bark: ['#B8A58C', '#5E5244'], barkAcc: '#7FA36A',
    root: ['#C08A4A', '#6B4A2A'], leaf: ['#0F7A4C', '#8FD84A'], leafAcc: '#F2DB7A', lit: '#FFD27A', sap: ['#FFB347', '#FFFBEA'],
  },
  givre: {
    bg: '#060A11', bg2: '#131F2B', ink: '#E9ECF1', muted: '#8E98A8', bark: ['#6FB7E9', '#3E6FA8'], barkAcc: '#E58A3C',
    root: ['#6FB7E9', '#3E6FA8'], leaf: ['#6FB7E9', '#CFE3F2'], leafAcc: '#E58A3C', lit: '#FFC861', sap: ['#FFA838', '#FFF8E5'],
  },
};
const COLOR_KEYS = ['bg', 'bg2', 'ink', 'muted', 'bark', 'barkAcc', 'root', 'leaf', 'leafAcc', 'lit', 'sap'];
const low = (v: unknown): unknown => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : String(v).toLowerCase());

test('B7 (réécrit après l\'audit du 2a) : PALETTE_ORDER et DEFAULT_PALETTE parmi les trois candidates', async () => {
  // B7 signature : ['sous-bois', 'ardoise', 'foret', 'givre'] ; défaut choisi par Arnaud parmi les trois palettes en lice
  // (contrat lot 2a, E10.5 et E17.3 ; arbitrage de l'audit du 2a). Givre reste la référence, jamais le défaut.
  const { PALETTE_ORDER, DEFAULT_PALETTE, PALETTES } = await palettesMod();
  assert.deepEqual([...PALETTE_ORDER], ['sous-bois', 'ardoise', 'foret', 'givre'], `PALETTE_ORDER ${JSON.stringify(PALETTE_ORDER)}`);
  assert.ok(['sous-bois', 'ardoise', 'foret'].includes(DEFAULT_PALETTE), `DEFAULT_PALETTE ${DEFAULT_PALETTE} hors des trois candidates`);
  assert.deepEqual(Object.keys(PALETTES).sort(), ['ardoise', 'foret', 'givre', 'sous-bois'], `clés de PALETTES ${Object.keys(PALETTES)}`);
});

test('B7 : valeurs exactes des quatre palettes (insensible à la casse)', async () => {
  // B7 « Valeurs exactes » ; sous-bois = agy-sous-bois et non opencode-sous-bois.
  const { PALETTES } = await palettesMod();
  for (const [id, want] of Object.entries(WANT)) {
    const p = PALETTES[id];
    assert.ok(p, `palette ${id} absente`);
    for (const k of COLOR_KEYS) assert.deepEqual(low(p[k]), low(want[k]), `${id}.${k} = ${JSON.stringify(p[k])}, attendu ${JSON.stringify(want[k])}`);
  }
});

test('B7.1 : toutes les couleurs au format #RRGGBB et PALETTES[k].id === k', async () => {
  // B7.1.
  const { PALETTES } = await palettesMod();
  for (const [k, p] of Object.entries(PALETTES as Record<string, Record<string, unknown>>)) {
    assert.equal(p.id, k, `PALETTES.${k}.id = ${p.id}`);
    for (const key of COLOR_KEYS) {
      const v = p[key];
      const list = Array.isArray(v) ? v : [v];
      if (Array.isArray(v)) assert.equal(v.length, 2, `${k}.${key} doit être une paire`);
      for (const c of list) assert.match(String(c), /^#[0-9A-Fa-f]{6}$/, `${k}.${key} : ${c}`);
    }
  }
});

test('B7.2 : pour foret et givre, bg2 = rgbToHex(mix(bg, leaf0, 0,12)) (proto:752)', async () => {
  // B7.2.
  const { PALETTES } = await palettesMod();
  const { rgbToHex, mix, hexToRgb } = await colorMod();
  for (const id of ['foret', 'givre']) {
    const p = PALETTES[id];
    const want = rgbToHex(mix(hexToRgb(p.bg), hexToRgb(p.leaf[0]), 0.12));
    assert.equal(p.bg2.toLowerCase(), want, `${id}.bg2 = ${p.bg2}, règle ${want}`);
  }
});

test('B7.3 : noms d\'atelier repris du prototype (proto:474, 489)', async () => {
  // B7.3 : le nom de givre n'est pas fixé par le contrat (proto:471 dit « Givre (actuelle) »).
  const { PALETTES } = await palettesMod();
  assert.equal(PALETTES['sous-bois'].name, 'Sous-bois & ambre');
  assert.equal(PALETTES.ardoise.name, 'Ardoise & ambre');
  assert.equal(PALETTES.foret.name, 'Forêt de nuit');
  assert.match(PALETTES.givre.name, /^Givre/, `nom de givre : ${PALETTES.givre.name}`);
});

test('B7.4 : aucune couleur hexadécimale de palette dans lib/tree/*.ts', () => {
  // B7.4 : content/palettes.ts est la seule source des couleurs.
  const dir = join(siteDir, 'lib', 'tree');
  assert.ok(existsSync(dir), 'site/lib/tree/ absent');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0, 'lib/tree/*.ts introuvable');
  const found: string[] = [];
  for (const f of files) {
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/#[0-9A-Fa-f]{6}(?![0-9A-Fa-f])/g)) found.push(`${f} : ${m[0]}`);
  }
  assert.deepEqual(found, [], `couleurs hexadécimales hors de content/palettes.ts : ${found.join(', ')}`);
});

test('B7 : PALETTES figé, y compris les paires imbriquées (écriture refusée ou sans effet)', async () => {
  // Audit « données publiques modifiables » : les couleurs ne changent pas après une tentative d'écriture.
  const { PALETTES } = await palettesMod();
  const { cssVariables } = await colorMod();
  const before = JSON.stringify(PALETTES);
  const css = JSON.stringify(cssVariables(PALETTES.foret));
  const attempts: [string, () => void][] = [
    ['PALETTES.foret.bg', () => { (PALETTES.foret as Record<string, unknown>).bg = '#FFFFFF'; }],
    ['PALETTES.foret.leaf[0]', () => { (PALETTES.foret.leaf as string[])[0] = '#FFFFFF'; }],
    ['PALETTES.givre (remplacement)', () => { (PALETTES as Record<string, unknown>).givre = { id: 'givre' }; }],
    ['PALETTES.ardoise.sap.push', () => { (PALETTES.ardoise.sap as string[]).push('#000000'); }],
  ];
  const changed: string[] = [];
  for (const [name, f] of attempts) {
    try { f(); } catch { /* écriture refusée : attendu */ }
    if (JSON.stringify(PALETTES) !== before) changed.push(name);
  }
  assert.deepEqual(changed, [], `écritures acceptées : ${changed.join(', ')}`);
  assert.equal(JSON.stringify(cssVariables(PALETTES.foret)), css, 'cssVariables a changé après les tentatives d\'écriture');
});
