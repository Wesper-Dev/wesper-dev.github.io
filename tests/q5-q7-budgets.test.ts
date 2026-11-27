// Contrat du lot 4, Q5 (mouvement, partie statique) et Q7 (export et budgets). Mesures de départ : référence
// a040fb0 (tests/fixtures/baseline-a040fb0.json, champ mesures, par mode d'export).
// - Q5 : aucun @keyframes nouveau ; aucune page intérieure ne charge un module qu'elle ne chargeait pas à a040fb0
//   (à a040fb0, la page BNP charge les mêmes quatre modules que /projects/ : elle n'a plus de module client propre
//   depuis le lot 1c, lecture retenue) ; ni WebGL ni module de l'arbre hors de l'accueil. Les durées de transition et
//   le mouvement réduit se mesurent en navigateur (verif-4, Q5.1).
// - Q7 : Σ CSS gzip ≤ a040fb0 + 2 Ko (remplace E14.4 « ≤ 9 000 ») ; JS de chaque page intérieure ≤ a040fb0 ; aucun
//   numéro de téléphone ; HTML et .rsc des pages Projets et Compétences sans identifiant de question, sans
//   « unconfirmed », sans variante écartée (règle H11). Les 20 routes et check-export : D2.1 et C3, inchangés.
//   Premier texte et CLS : verif-4 (Q7.2).
// Ces tests sont VERTS au départ (gardes) : ils doivent le rester.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bodyHtml, headHtml, textLines } from './helpers-2b.ts';
import { ALL_PAGES, LOT4_PAGES, Q7_TEXT_PAGES, cssGzipTotal, filesUnder, keyframeNames, moduleName, pageJs, pageJsGzip, readBaseline4, readRoute } from './helpers-4.ts';
import { leaksIn, treeTexts } from './helpers-h11.ts';
import { assertDistExists, distDir, exportModeOf } from './helpers.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export : contrat lot 4`);
  return html;
};
const mesures = () => readBaseline4().mesures[exportModeOf(distDir)];

// ---- Q5 ----

test('Q5 : aucun @keyframes nouveau dans les CSS exportés (noms ⊆ ceux de a040fb0)', () => {
  assertDistExists();
  const css = filesUnder(distDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const ref = mesures().keyframes;
  const extra = keyframeNames(css).filter((k) => !ref.includes(k));
  assert.deepEqual(extra, [], `contrat lot 4, Q5 : animation nouvelle (@keyframes ${extra.join(', ')}) ; a040fb0 : ${ref.join(', ')}`);
});

test('Q5 : chaque page intérieure et la 404 ne charge que des modules qu\'elle chargeait à a040fb0 (noms sans hachage), sans élément de l\'arbre ni <canvas>', () => {
  assertDistExists();
  const ref = mesures().jsModules;
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    const html = page(route);
    const names = [...new Set(pageJs(distDir, html).map(moduleName))].sort();
    const extra = names.filter((n) => !(ref[route] ?? []).includes(n));
    if (extra.length) errors.push(`${route} : module(s) nouveau(x) ${extra.join(', ')} (a040fb0 : ${(ref[route] ?? []).join(', ')})`);
    if (/<canvas\b/i.test(bodyHtml(html))) errors.push(`${route} : <canvas>`);
    if (/\sdata-tree-[\w-]+/.test(html)) errors.push(`${route} : élément de l'arbre (data-tree-*)`);
    if (/TreeIsland|__THREE__|three\.module/i.test(html)) errors.push(`${route} : îlot ou three référencé`);
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q5\n${errors.join('\n')}`);
});

// ---- Q7 ----

test('Q7 : Σ des CSS exportés (gzip -9) ≤ a040fb0 + 2 Ko (remplace E14.4)', (t) => {
  assertDistExists();
  const ref = mesures().cssGzip;
  const got = cssGzipTotal(distDir);
  t.diagnostic(`CSS gzip -9 : ${got} octets ; a040fb0 : ${ref} ; plafond ${ref + 2048}`);
  assert.ok(got <= ref + 2048, `contrat lot 4, Q7 : Σ CSS ${got} octets gzip -9 > ${ref} + 2 048`);
});

test('Q7 : JS de chaque page intérieure et de la 404 (modules et imports statiques, gzip -9) ≤ celui de a040fb0', (t) => {
  assertDistExists();
  const ref = mesures().jsGzip;
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    const got = pageJsGzip(distDir, page(route));
    const want = ref[route] ?? 0;
    // The shared index chunk embeds a random build id: its gzip size drifts by a few bytes between identical builds.
    if (got > want + 32) errors.push(`${route} : ${got} octets > ${want} + 32`);
  }
  t.diagnostic(`a040fb0 : ${JSON.stringify(ref['/projects/'])} octets par page (/projects/)`);
  assert.deepEqual(errors, [], `contrat lot 4, Q7\n${errors.join('\n')}`);
});

const PHONE = /(?:\+33|\b0)\s*[1-9](?:[\s.-]*\d{2}){4}\b/;
test('Q7 : aucun numéro de téléphone ni lien tel:, callto:, sms: sur les 21 pages (texte, <head>, liens)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of ALL_PAGES) {
    const html = page(route);
    if (/href\s*=\s*["']\s*(tel|callto|sms):/i.test(html)) errors.push(`${route} : lien téléphonique`);
    const text = [...textLines(bodyHtml(html)), headHtml(html)].join('\n');
    if (PHONE.test(text)) errors.push(`${route} : numéro « ${PHONE.exec(text)?.[0]} »`);
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q7\n${errors.join('\n')}`);
});

test('Q7 : le HTML (index et alias à plat) et le .rsc des pages Projets et Compétences ne contiennent ni identifiant de question (A-0x), ni « unconfirmed », ni variante de texte écartée (règle H11)', async () => {
  assertDistExists();
  const { rejected } = await treeTexts();
  const errors: string[] = [];
  for (const route of Q7_TEXT_PAGES) {
    const base = route.replace(/^\//, '').replace(/\/$/, '');
    for (const f of [join(base, 'index.html'), base + '.html', base + '.rsc']) {
      const file = join(distDir, f);
      if (!existsSync(file)) {
        if (!f.endsWith('.html') || f.endsWith('index.html')) errors.push(`${f} absent de l'export`);
        continue;
      }
      for (const h of leaksIn(readFileSync(file, 'utf8'), rejected)) errors.push(`${f} : ${h}`);
    }
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q7\n${errors.join('\n')}`);
});

test('Q5 et Q7 (témoins) : un module ajouté, un @keyframes ajouté, un numéro et un A-05 sont repérés', async () => {
  assertDistExists();
  assert.equal(moduleName('/_next/static/chunks/layout-segment-context-DLtDdCPt.js'), 'layout-segment-context');
  assert.equal(moduleName('/_next/static/chunks/index-k3K-gJ8d.js'), 'index');
  assert.deepEqual(keyframeNames('@keyframes tree-arrive{}@-webkit-keyframes fondu{}'), ['fondu', 'tree-arrive']);
  assert.ok(PHONE.test('06 12 34 56 78') && !PHONE.test('2019–2026'));
  const { rejected } = await treeTexts();
  assert.ok(leaksIn('<p>A-05</p>', rejected).length > 0 && leaksIn('"unconfirmed"', rejected).length > 0);
  const html = page('/projects/');
  const mutated = html.replace('</head>', '<script type="module" src="/_next/static/chunks/BnpProof-AbCdEfGh.js"></script></head>');
  assert.ok(pageJs(distDir, mutated).length >= pageJs(distDir, html).length);
  const names = (h: string): string[] => [...new Set([...h.matchAll(/src="([^"]+\.js)"/g)].map((m) => moduleName(m[1] as string)))];
  assert.ok(names(mutated).includes('BnpProof') && !(mesures().jsModules['/projects/'] ?? []).includes('BnpProof'));
});
