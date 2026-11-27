// Contrat E10.1, E10.2, E10.3 [T], E10.4 et E10.5 (lot 2a) : jetons de couleur posés sur [data-home], aucune couleur
// littérale dans la portée de l'accueil, contrastes chiffrés des palettes. Aucun test ne suppose la valeur de DEFAULT_PALETTE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hex3, wcagContrast } from './helpers-tree.ts';
import { HOME_ROUTES, exportCss, homeMods, homeRoot, inHomeScope, pageHtml } from './helpers-home.ts';

const CANDIDATES = ['sous-bois', 'ardoise', 'foret'];

function styleDecls(style: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of style.split(';')) {
    const i = d.indexOf(':');
    if (i > 0) out.set(d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim());
  }
  return out;
}

test('E10.5 : DEFAULT_PALETTE est l\'une des trois palettes en lice (sous-bois, ardoise, foret)', async () => {
  // E10.5 : mutation « DEFAULT_PALETTE = 'givre' ».
  const { DEFAULT_PALETTE, PALETTES } = await homeMods.palettes();
  assert.ok(CANDIDATES.includes(DEFAULT_PALETTE), `DEFAULT_PALETTE = ${DEFAULT_PALETTE}`);
  assert.ok(PALETTES[DEFAULT_PALETTE], 'palette par défaut absente de PALETTES');
});

test('E10.1 : le style en ligne de [data-home] porte exactement les variables de cssVariables(PALETTES[DEFAULT_PALETTE])', async () => {
  // E10.1 : mutation « variables posées sur le seul bloc ». La palette attendue est lue, jamais codée en dur.
  const { cssVariables } = await homeMods.color();
  const { PALETTES, DEFAULT_PALETTE } = await homeMods.palettes();
  const vars = cssVariables(PALETTES[DEFAULT_PALETTE]) as Record<string, string>;
  assert.ok(Object.keys(vars).length >= 6, 'cssVariables doit donner au moins six variables (B5)');
  for (const route of HOME_ROUTES) {
    const decl = styleDecls(homeRoot(route).attrs.style ?? '');
    for (const [k, v] of Object.entries(vars)) assert.equal(decl.get(k)?.toLowerCase(), v.toLowerCase(), `${route} : ${k}:${v} attendu sur [data-home], reçu ${decl.get(k)}`);
  }
});

test('E10.1 : si [data-tree-hero] porte aussi des variables de palette, elles sont égales à celles de [data-home]', () => {
  // E10.1 : à tout instant, variables du bloc = variables de [data-home] (export).
  for (const route of HOME_ROUTES) {
    const home = styleDecls(homeRoot(route).attrs.style ?? '');
    const m = /<[a-z]+\b[^>]*\sdata-tree-hero(?=[\s=/>])[^>]*>/i.exec(pageHtml(route));
    assert.ok(m, `${route} : [data-tree-hero] absent`);
    const style = /\sstyle="([^"]*)"/i.exec(m[0])?.[1] ?? '';
    for (const [k, v] of styleDecls(style)) if (k.startsWith('--') && home.has(k)) assert.equal(v.toLowerCase(), home.get(k)?.toLowerCase(), `${route} : ${k} du bloc ≠ ${k} de [data-home]`);
    assert.ok([...home.keys()].some((k) => k.startsWith('--')), `${route} : aucune variable sur [data-home]`);
  }
});

const NAMED = ['white', 'black', 'red', 'gray', 'grey', 'orange', 'green', 'blue', 'yellow', 'purple', 'pink', 'brown', 'silver', 'gold', 'navy', 'teal', 'maroon', 'olive', 'lime', 'aqua', 'fuchsia', 'cyan', 'magenta', 'ivory', 'beige', 'tan', 'khaki', 'coral', 'salmon', 'crimson', 'indigo', 'violet', 'darkgray', 'lightgray', 'whitesmoke', 'gainsboro', 'snow'];
const SKIP_PROPS = /^(font|font-family|content|grid-template-areas|grid-area|animation|animation-name|transition|transition-property|will-change|counter-reset|counter-increment|list-style|list-style-type|quotes|src|font-feature-settings)$/;

function literalColors(value: string): string[] {
  const out: string[] = [];
  const v = value.replace(/url\([^)]*\)/g, ' ');
  for (const m of v.matchAll(/#[0-9a-f]{3,8}\b/gi)) out.push(m[0]);
  for (const m of v.matchAll(/\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/gi)) out.push(m[0]);
  for (const m of v.matchAll(/(?<![\w-])([a-z]+)(?![\w-(])/gi)) if (NAMED.includes((m[1] ?? '').toLowerCase())) out.push(m[1] ?? '');
  return out;
}

test('E10.2 : aucune couleur littérale (hexadécimal, rgb(), hsl(), oklch(), couleurs nommées) dans la portée de l\'accueil', () => {
  // E10.2 : mutation « #fff dans .tree-card ». transparent et currentColor permis.
  homeRoot('/');
  const bad: string[] = [];
  for (const r of exportCss().rules.filter(inHomeScope)) {
    for (const [k, v] of r.declList) {
      if (SKIP_PROPS.test(k)) continue;
      const found = literalColors(v);
      if (found.length) bad.push(`${r.media ? `@media ${r.media} ` : ''}${r.selector} { ${k}: ${v} } → ${found.join(', ')}`);
    }
  }
  assert.deepEqual(bad, [], `couleurs littérales dans la portée de l'accueil :\n${bad.join('\n')}`);
});

test('E10.2 : le détecteur de couleurs littérales reconnaît ses témoins', () => {
  // Témoins : sans eux, un E10.2 vert ne prouverait rien.
  assert.deepEqual(literalColors('#fff'), ['#fff']);
  assert.deepEqual(literalColors('0 0 0 2px rgba(0,0,0,.4)'), ['rgba(']);
  assert.deepEqual(literalColors('1px solid white'), ['white']);
  assert.deepEqual(literalColors('oklch(70% .1 120)'), ['oklch(']);
  assert.deepEqual(literalColors('color-mix(in oklab, var(--muted) 90%, var(--night))'), []);
  assert.deepEqual(literalColors('transparent'), []);
  assert.deepEqual(literalColors('currentColor'), []);
  assert.deepEqual(literalColors('var(--accent)'), []);
});

test('E10.3 [T] : aucun attribut style de <html> ou <body> ne porte color-scheme, et aucune meta color-scheme', () => {
  // E10.3 / D2.6 inchangé.
  for (const route of HOME_ROUTES) {
    const html = pageHtml(route);
    homeRoot(route);
    for (const tag of ['html', 'body']) {
      const open = new RegExp(`<${tag}\\b([^>]*)>`, 'i').exec(html)?.[1] ?? '';
      assert.doesNotMatch(open, /color-scheme/i, `${route} : color-scheme dans l'attribut de <${tag}>`);
    }
    assert.doesNotMatch(html, /<meta[^>]*name="color-scheme"/i, `${route} : meta color-scheme`);
  }
});

test('E10.4 : contrastes WCAG (formule du test) des palettes sous-bois, ardoise, foret et givre', async () => {
  // E10.4 : texte ≥ 4,5 ; bouton plein bg sur lit ≥ 4,5 ; anneau de focus lit ≥ 3.
  const { PALETTES } = await homeMods.palettes();
  const problems: string[] = [];
  for (const id of [...CANDIDATES, 'givre']) {
    const p = PALETTES[id];
    assert.ok(p, `palette ${id} absente`);
    const c = (k: string): number[] => hex3(p[k]);
    const pairs: [string, string, number][] = [
      ['ink', 'bg', 4.5], ['muted', 'bg', 4.5], ['ink', 'bg2', 4.5], ['muted', 'bg2', 4.5], ['lit', 'bg', 4.5], ['lit', 'bg2', 4.5],
      ['bg', 'lit', 4.5],
      ['lit', 'bg', 3], ['lit', 'bg2', 3],
    ];
    for (const [a, b, min] of pairs) {
      const r = wcagContrast(c(a), c(b));
      if (r < min) problems.push(`${id} ${a}/${b} = ${r.toFixed(2)} < ${min}`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
  // Témoins (valeurs du contrat, pour mémoire) : ink/bg de sous-bois 17,25, muted/bg d'ardoise 9,43.
  assert.ok(Math.abs(wcagContrast(hex3(PALETTES['sous-bois'].ink), hex3(PALETTES['sous-bois'].bg)) - 17.25) < 0.01);
  assert.ok(Math.abs(wcagContrast(hex3(PALETTES.ardoise.muted), hex3(PALETTES.ardoise.bg)) - 9.43) < 0.01);
});
