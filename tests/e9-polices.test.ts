// Contrat E9.1–E9.5 et E9.7 (disque) du lot 2a : Inter Tight et IBM Plex Mono auto-hébergées, déclarations, couverture
// cmap, préchargements. Réseau, styles calculés et octets téléchargés : scénarios [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pageHtml, visibleText } from './helpers-scene.ts';
import {
  type CssRule,
  type FontFace,
  HOME_ROUTES,
  LOCALES,
  cmapCodepoints,
  distDir,
  exportCss,
  familyOf,
  homeMods,
  homeRoot,
  inRanges,
  listDir,
  parseUnicodeRange,
  siteDir,
  weightRange,
} from './helpers-home.ts';
import { requireDist } from './helpers-scene.ts';

const FONTS = 'public/fonts';
const NEW_FONT = /^(inter-tight|ibm-plex-mono)-.*\.woff2$/;
const OLD_FONTS = ['bricolage-grotesque-latin-ext.woff2', 'bricolage-grotesque-latin.woff2', 'public-sans-latin-ext.woff2', 'public-sans-latin.woff2', 'bricolagegrotesque-OFL.txt', 'publicsans-OFL.txt'];
const INTER = 'Inter Tight';
const PLEX = 'IBM Plex Mono';

const facesOf = (family: string): FontFace[] => exportCss().fontFaces.filter((f) => f.family === family);

// Propriétés personnalisées déclarées n'importe où dans le CSS (pour résoudre font-family: var(--x)).
function customProps(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of exportCss().rules) for (const [k, v] of r.declList) if (k.startsWith('--')) m.set(k, v);
  return m;
}
function resolveVar(v: string, props: Map<string, string>, depth = 0): string {
  if (depth > 10) return v;
  return v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_w, name: string, fb: string | undefined) => resolveVar(props.get(name) ?? fb ?? '', props, depth + 1));
}
function ruleFamily(r: CssRule, props: Map<string, string>): string | null {
  const ff = r.decls.get('font-family');
  if (ff) return familyOf(resolveVar(ff, props));
  const font = r.decls.get('font');
  if (font) {
    const v = resolveVar(font, props);
    for (const fam of [INTER, PLEX]) if (v.includes(fam)) return fam;
  }
  return null;
}

test('E9.1 (mis à jour au lot 4) : WOFF2 inter-tight-* et ibm-plex-mono-*, licences OFL 1.1, README complété ; Bricolage Grotesque et Public Sans retirées (sources et export, contrat lot 4 Q2)', () => {
  // E9.1 : mutation « licence manquante ». Lot 4 (Q2) : les anciennes polices quittent l'export, donc public/fonts.
  const files = listDir(FONTS);
  const inter = files.filter((f) => /^inter-tight-.*\.woff2$/.test(f));
  const plex = files.filter((f) => /^ibm-plex-mono-.*\.woff2$/.test(f));
  assert.ok(inter.length >= 1, `aucun inter-tight-*.woff2 dans ${FONTS} (${files.join(', ')})`);
  assert.ok(plex.length >= 1, `aucun ibm-plex-mono-*.woff2 dans ${FONTS}`);
  for (const lic of ['intertight-OFL.txt', 'ibmplexmono-OFL.txt']) {
    assert.ok(files.includes(lic), `licence ${lic} absente`);
    const t = readFileSync(join(siteDir, FONTS, lic), 'utf8');
    assert.ok(t.includes('SIL Open Font License') && t.includes('Version 1.1'), `${lic} : texte de la SIL Open Font License 1.1 attendu`);
  }
  const readme = readFileSync(join(siteDir, FONTS, 'README.md'), 'utf8');
  for (const f of [...inter, ...plex]) assert.ok(readme.includes(f), `README des polices : ${f} non cité`);
  requireDist();
  for (const f of [...inter, ...plex]) assert.ok(existsSync(join(distDir, 'fonts', f)), `fonts/${f} absent de l'export`);
  for (const f of OLD_FONTS) {
    assert.ok(!files.includes(f), `${FONTS}/${f} doit être retiré (contrat lot 4, Q2)`);
    assert.ok(!existsSync(join(distDir, 'fonts', f)), `fonts/${f} doit quitter l'export (contrat lot 4, Q2)`);
  }
});

test('E9.3 : chaque @font-face Inter Tight et IBM Plex Mono a un src local /fonts/….woff2 format woff2, un font-display swap|optional et un unicode-range', () => {
  // E9.3 : mutation « unicode-range absent ».
  for (const fam of [INTER, PLEX]) {
    const faces = facesOf(fam);
    assert.ok(faces.length >= 1, `aucune @font-face « ${fam} » dans le CSS exporté`);
    for (const f of faces) {
      assert.ok(f.urls.length >= 1 && f.urls.every((u) => /^\/fonts\/[\w.-]+\.woff2$/.test(u)), `${fam} : src local /fonts/….woff2 attendu, reçu ${f.src}`);
      assert.ok(f.formats.length === f.urls.length && f.formats.every((x) => x === 'woff2'), `${fam} : format('woff2') attendu, reçu ${f.src}`);
      assert.ok(['swap', 'optional'].includes(f.display), `${fam} : font-display ${f.display || '(absent)'}`);
      assert.ok(f.unicodeRange.length > 0, `${fam} : unicode-range absent (${f.urls.join(', ')})`);
      assert.doesNotThrow(() => parseUnicodeRange(f.unicodeRange), `${fam} : unicode-range illisible`);
    }
  }
});

test('E9.2 : Inter Tight couvre les graisses 300 à 500, IBM Plex Mono la graisse 400, et font-synthesis: none sur [data-home]', () => {
  // E9.2 : graisses (proto:6), pas de gras simulé.
  for (const [fam, ws] of [[INTER, [300, 400, 500]], [PLEX, [400]]] as [string, number[]][]) {
    const faces = facesOf(fam);
    assert.ok(faces.length >= 1, `aucune @font-face « ${fam} »`);
    for (const w of ws) assert.ok(faces.some((f) => { const [a, b] = weightRange(f.weight); return w >= a && w <= b; }), `${fam} : graisse ${w} non couverte (${faces.map((f) => f.weight).join(', ')})`);
  }
  const ok = exportCss().rules.some((r) => r.selectors.some((s) => s.includes('[data-home')) && /^none$/i.test(r.decls.get('font-synthesis') ?? ''));
  assert.ok(ok, 'font-synthesis: none attendu dans une règle de portée [data-home');
});

test('E9.3 : aucune url() externe dans les CSS exportés, et chaque url() locale existe dans l\'export', () => {
  // E9.3 : mutation « police chargée depuis fonts.gstatic.com ».
  const css = exportCss();
  const urls = [...css.raw.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => (m[1] ?? '').trim());
  const external = urls.filter((u) => /^(https?:)?\/\//i.test(u));
  assert.deepEqual(external, [], 'url() externes dans le CSS');
  const missing = urls.filter((u) => !u.startsWith('data:') && !u.startsWith('#') && !existsSync(join(distDir, u.replace(/^\//, '').split(/[?#]/)[0] ?? '')));
  assert.deepEqual(missing, [], 'url() locales absentes de l\'export');
  assert.ok(facesOf(INTER).length >= 1, 'Inter Tight non déclarée : ce contrôle doit porter sur le CSS du lot 2a');
});

test('E9.4 (mis à jour au lot 4) : le lecteur cmap du test retrouve A et é dans inter-tight-latin.woff2 (auto-test ; Public Sans retirée au lot 4)', () => {
  // contrat-lot2a-tests §4.3 : si ce contrôle échoue, le lecteur est faux, pas la police.
  const cps = cmapCodepoints(readFileSync(join(siteDir, FONTS, 'inter-tight-latin.woff2')));
  assert.ok(cps.has(0x41) && cps.has(0xe9), 'cmap de inter-tight-latin.woff2 sans A ou é : lecteur WOFF2 faux');
});

// Couverture : chaque caractère doit être dans une face de la famille dont l'unicode-range le couvre ET dont le cmap l'a.
function uncovered(family: string, chars: Set<string>): string[] {
  const faces = facesOf(family);
  if (faces.length === 0) return [`aucune @font-face « ${family} »`];
  const loaded = faces.map((f) => ({ ranges: parseUnicodeRange(f.unicodeRange || 'U+0-10FFFF'), cmap: new Set<number>(f.urls.flatMap((u) => [...cmapCodepoints(readFileSync(join(distDir, u.replace(/^\//, ''))))])) }));
  const out: string[] = [];
  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;
    if (!loaded.some((f) => inRanges(cp, f.ranges) && f.cmap.has(cp))) out.push(`${ch} (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`);
  }
  return out;
}
const charsOf = (s: string): Set<string> => new Set([...s].filter((c) => !/[\s\p{Cc}\p{Cf}]/u.test(c)));

test('E9.4 : chaque caractère des accueils (FR, EN) et des infobulles et libellés de compétences est couvert par Inter Tight (unicode-range et cmap)', async () => {
  // E9.4 : mutation « → hors couverture ».
  const { SKILLS, skillLabel, skillTooltip } = await homeMods.tree();
  let corpus = '';
  for (const route of HOME_ROUTES) {
    homeRoot(route);
    const html = pageHtml(route);
    corpus += visibleText(/<body\b[\s\S]*<\/body>/i.exec(html)?.[0] ?? html) + ' ';
  }
  for (const l of LOCALES) for (const s of SKILLS as { id: string }[]) corpus += `${skillLabel(s.id, l)} ${skillTooltip(s.id, l)} `;
  corpus += '→↗↑';
  const miss = uncovered(INTER, charsOf(corpus));
  assert.deepEqual(miss, [], `caractères non couverts par Inter Tight : ${miss.join(' ')}`);
});

test('E9.4 : chaque caractère des libellés de compétences (FR, EN) est couvert par IBM Plex Mono (unicode-range et cmap)', async () => {
  // E9.4 : étiquettes en IBM Plex Mono.
  const { SKILLS, skillLabel } = await homeMods.tree();
  let corpus = '';
  for (const l of LOCALES) for (const s of SKILLS as { id: string }[]) corpus += `${skillLabel(s.id, l)} `;
  const miss = uncovered(PLEX, charsOf(corpus));
  assert.deepEqual(miss, [], `caractères non couverts par IBM Plex Mono : ${miss.join(' ')}`);
});

// Règles qui s'appliquent au texte du premier écran en état html : en-tête, phrase BNP, repli (et la racine de l'accueil).
const FIRST = ['[data-home]', '[data-home ', '[data-home>', '[data-site-header', '[data-site-name', '[data-site-title', '[data-site-cv', '[data-site-nav', '[data-site-link', '[data-site-menu', '[data-tree-hero', '[data-tree-copy', '[data-tree-bnp', '[data-tree-case', '[data-tree-fallback', '[data-tree-stage'];
const NOT_FIRST = /card|tree-label|data-tree-tip|data-home-section|data-site-footer|atelier|data-experience|data-tree-ui|data-tree-island|:hover|:focus/;
const firstScreen = (r: CssRule): boolean => !r.media?.includes('hover') && r.selectors.some((s) => FIRST.some((p) => s.includes(p)) && !NOT_FIRST.test(s));

test('E9.5 : chaque accueil précharge au plus deux polices du premier écran (as=font, type=font/woff2, crossorigin), ni Bricolage ni Public Sans', () => {
  // E9.5 : mutation « préchargement de Bricolage gardé sur l'accueil ».
  const css = exportCss();
  const props = customProps();
  for (const route of HOME_ROUTES) {
    homeRoot(route);
    const head = /<head\b[\s\S]*?<\/head>/i.exec(pageHtml(route))?.[0] ?? '';
    const fonts = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /\srel=["']?preload/i.test(t) && /\sas=["']?font/i.test(t));
    assert.ok(fonts.length <= 2, `${route} : ${fonts.length} polices préchargées (au plus 2)`);
    for (const t of fonts) {
      const href = /\shref=["']([^"']+)/i.exec(t)?.[1] ?? '';
      assert.ok(!/bricolage|public-sans/i.test(href), `${route} : ${href} ne doit plus être préchargée`);
      assert.match(t, /\stype=["']font\/woff2["']/i, `${route} : type="font/woff2" attendu sur ${href}`);
      assert.match(t, /\scrossorigin(?=[\s=/>])/i, `${route} : crossorigin attendu sur ${href}`);
      const face = css.fontFaces.find((f) => f.urls.includes(href));
      assert.ok(face, `${route} : ${href} n'est référencé par aucune @font-face`);
      const users = css.rules.filter(firstScreen).filter((r) => ruleFamily(r, props) === face.family);
      assert.ok(users.length >= 1, `${route} : ${href} (${face.family}) n'est utilisée par aucune règle du premier écran (en-tête, [data-tree-copy], [data-tree-fallback])`);
      const [lo, hi] = weightRange(face.weight);
      if (lo === hi && lo !== 400) {
        const weights = css.rules.filter(firstScreen).map((r) => resolveVar(r.decls.get('font-weight') ?? '', props).trim()).filter(Boolean).map((w) => (w === 'bold' ? 700 : w === 'normal' ? 400 : Number(w)));
        assert.ok(weights.includes(lo), `${route} : ${href} (graisse ${lo}) préchargée sans être utilisée au premier écran`);
      }
    }
  }
});

// E9.5 « préchargements des pages secondaires = 4ed945b » (lot 2b) : remplacé au lot 4 par q2-coquille.test.ts
// (« chaque page intérieure et la 404 précharge au plus deux polices, prises parmi celles que précharge l'accueil »).

test('E9.7 : Σ des nouveaux WOFF2 (inter-tight-*, ibm-plex-mono-*) ≤ 160 000 octets', () => {
  // E9.7 (disque).
  const files = listDir(FONTS).filter((f) => NEW_FONT.test(f));
  assert.ok(files.length >= 2, `polices nouvelles absentes de ${FONTS}`);
  const total = files.reduce((s, f) => s + statSync(join(siteDir, FONTS, f)).size, 0);
  assert.ok(total <= 160000, `Σ ${total} octets > 160 000 (${files.join(', ')})`);
});
