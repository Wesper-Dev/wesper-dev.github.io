// Contrat du lot 6a, V7 (tmp/refonte-arbre/contrat-lot6a.md) : rien d'autre ne bouge. Référence 274537a figée par mode
// (tests/fixtures/baseline-274537a.json, script fixtures/figer-reference-274537a.ts) :
// - les 18 pages intérieures et la 404 : document normalisé identique ; tour X (X3) : seuls le JSON-LD et la charge RSC
//   de vinext, reconnue à sa forme exacte, sont retirés (helpers-6, normalizedDocument6) ; tout autre script en ligne
//   compte (mutation A6 de l'audit) ;
// - les deux accueils : même document hors section FAQ (V1), hors JSON-LD (V2, V3) et hors charge RSC ;
// - chaque page à plat <route>.html est identique à <route>/index.html (les contrôles qui lisent index.html valent pour
//   tout l'export) ;
// - fichiers de l'export : les mêmes, hachages ramenés à *, plus /llms.txt (V5) ; site/public : idem plus llms.txt.
// Les tests existants (696 au départ) restent verts : références mises à jour au plus juste, exceptions nommées
// (rapport-tests-lot6a.md §5 : E8.1, E1.2, E1.4, E2.1, D2.1, Q2, S, T0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { LOT4_PAGES, readNamedExceptions, readRoute, revertNamedExceptionsHtml } from './helpers-4.ts';
import type { NamedException } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf, siteDir } from './helpers.ts';
import { foldRecetteYHtml } from './helpers-typo.ts';
import { HOMES, ROUTES_20, filesOf, normFileName, normalizedDocument6, readBaseline6, sha256, withoutFaqSection } from './helpers-6.ts';
import { existsSync, readFileSync } from 'node:fs';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export`);
  return html;
};
// Tour Y : changements imposés par la recette Y repliés des deux côtés (helpers-typo.ts, foldRecetteYHtml ; référence
// recalculée depuis les exports de 274537a avec ce repli : fixtures/figer-references-recette-y.ts).
// Tour Z (contrat-textes-z.md, Z1 et Z4) : les seules exceptions « Z… » de fixtures/exceptions-s.json (S, T3 et U6 sont
// déjà dans 274537a) ramènent, sur leurs routes, la valeur nouvelle exacte à sa valeur de 274537a (« ancienV7 », sinon
// « ancien »), avant le repli Y. U+00A0 et U+202F deviennent des espaces d'abord : l'empreinte les réduit de toute façon
// (normalizedDocument6), et la valeur ancienne écrite avec des espaces ordinaires est alors reconnue et protégée.
// Tour W (contrat-relecture-w.md, 26/11) : les exceptions « W… » s'appliquent de même (valeur de 274537a, « ancienV7 »
// quand elle diffère de celle de a040fb0).
export const zExceptionsV7 = (): NamedException[] => readNamedExceptions().filter((e) => e.id.startsWith('Z') || e.id.startsWith('W')).map((e) => ({ ...e, ancien: e.ancienV7 ?? e.ancien }));
export const revertZ = (route: string, html: string, list: NamedException[] = zExceptionsV7()): string => revertNamedExceptionsHtml(route, html.replace(/[\u00a0\u202f]/g, ' '), list);
const docDigest = (html: string, route = ''): string => sha256(normalizedDocument6(foldRecetteYHtml(revertZ(route, html))));
const homeDigest6 = (html: string, route = ''): string => sha256(normalizedDocument6(foldRecetteYHtml(withoutFaqSection(revertZ(route, html)))));

test('V7 : les 18 pages intérieures et la 404 = 274537a (document normalisé ; seuls le JSON-LD et la charge RSC peuvent changer, tout autre script compte)', () => {
  assertDistExists();
  const mode = exportModeOf(distDir);
  const ref = readBaseline6().modes[mode].docs;
  const diffs = LOT4_PAGES.filter((r) => docDigest(page(r), r) !== ref[r]).map((r) => `${r} : document différent de 274537a hors JSON-LD et charge RSC (contrat lot 6a, V7 ; tour X, X3)`);
  assert.deepEqual(diffs, [], `(${mode})`);
});

test('V7 : les deux accueils = 274537a hors section FAQ, JSON-LD et charge RSC (rien d\'autre ne bouge sur l\'accueil)', () => {
  assertDistExists();
  const mode = exportModeOf(distDir);
  const ref = readBaseline6().modes[mode].homes;
  const diffs = HOMES.filter((r) => homeDigest6(page(r), r) !== ref[r]).map((r) => `${r} : accueil différent de 274537a hors FAQ, JSON-LD et charge RSC (contrat lot 6a, V1 et V7)`);
  assert.deepEqual(diffs, [], `(${mode})`);
});

test('V7 (tour X) : chaque page à plat <route>.html de l\'export est identique à <route>/index.html, que lisent les tests', () => {
  assertDistExists();
  const diffs: string[] = [];
  for (const r of ROUTES_20().filter((x) => x !== '/')) {
    const flat = join(distDir, r.replace(/^\/|\/$/g, '') + '.html');
    if (existsSync(flat) && readFileSync(flat, 'utf8') !== page(r)) diffs.push(`${r} : ${flat.slice(distDir.length + 1)} ≠ ${r.replace(/^\//, '')}index.html`);
  }
  assert.deepEqual(diffs, []);
});

test('V7 : fichiers de l\'export = 274537a + llms.txt (+ au plus une image compressée de droit-de-retard, tour Y, Y11) (noms hachés et identifiant de build ramenés à *) ; site/public = 274537a + llms.txt, autres fichiers identiques à l\'octet hors les deux CV publics (tour Z, Z1)', () => {
  assertDistExists();
  const mode = exportModeOf(distDir);
  const ref = readBaseline6().modes[mode];
  const got = [...new Set(filesOf(distDir).map(normFileName))].sort();
  // Tour Y (contrat-recette-y.md, Y11) : exception nommée, au plus UNE version compressée de l'image du récit
  // droit-de-retard (images/droit-de-retard.webp, .avif ou .jpg), dans l'export comme dans site/public.
  const y11 = (fs: string[]): string[] => fs.filter((f) => /^images\/droit-de-retard\.(?:webp|avif|jpe?g)$/.test(f) && !ref.files.includes(f) && ref.publicFiles[f] === undefined);
  const want = [...new Set([...ref.files, 'llms.txt', ...y11(filesOf(distDir).map(normFileName)).slice(0, 1)])].sort();
  const errors = [...got.filter((f) => !want.includes(f)).map((f) => `export : ${f} en plus`), ...want.filter((f) => !got.includes(f)).map((f) => `export : ${f} manquant`)];
  const pub = join(siteDir, 'public');
  const files = filesOf(pub);
  const y11Public = y11(files).slice(0, 1);
  // Tour Z (contrat-textes-z.md, Z1) : exception nommée, les deux CV publics régénérés (résumé et puce BNP) ; leur texte
  // est figé par fixtures/cv-public-texte-{fr,en}.txt (u2-cv-texte-fige) et leurs octets égaux à deliverables/cv (T2).
  const z1Cv = ['cv/arnaud-durand-cv-platform-fr.pdf', 'cv/arnaud-durand-cv-platform-en.pdf'];
  for (const f of files) if (f !== 'llms.txt' && !y11Public.includes(f) && !(z1Cv.includes(f) && ref.publicFiles[f] !== undefined) && ref.publicFiles[f] !== sha256(readFileSync(join(pub, f)))) errors.push(`public/${f} : ${ref.publicFiles[f] ? 'modifié' : 'ajouté'}`);
  for (const f of Object.keys(ref.publicFiles)) if (!files.includes(f)) errors.push(`public/${f} : retiré`);
  if (!files.includes('llms.txt')) errors.push('public/llms.txt : absent (V5)');
  assert.deepEqual(errors, [], `(${mode})`);
});

test('V7 (témoins) : l\'empreinte ignore un JSON-LD ajouté et, sur l\'accueil, la section FAQ ; elle change pour un mot, un lien, une classe ou une section ajoutée ailleurs', () => {
  assertDistExists();
  const html = page('/fr/projects/diary/');
  const ld = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"CreativeWork"}</script>';
  assert.equal(docDigest(html.replace('</head>', ld + '</head>')), docDigest(html), 'JSON-LD ajouté pris pour un changement');
  assert.equal(docDigest(html.replace('</main>', ld + '</main>')), docDigest(html), 'JSON-LD dans <main> pris pour un changement');
  const h = withoutFaqSection(page('/fr/'));
  const faq = '<section data-home-section="faq"><h2>Q</h2><div data-faq-item="a"><h3 data-faq-question="">x ?</h3><div data-faq-answer=""><p>y</p></div></div></section>';
  assert.ok(h.includes('</main>'), 'accueil sans </main>');
  assert.equal(homeDigest6(h.replace('</main>', faq + '</main>')), homeDigest6(h), 'FAQ prise pour un changement');
  const muts: [string, string][] = [
    ['mot', html.replace(/(<main\b[\s\S]*?<p[^>]*>)([^<]{3})/, '$1x$2')],
    ['lien', html.replace('href="/fr/projects/"', 'href="/fr/hackathons/"')],
    ['classe', html.replace(/class="([^"]+)"/, 'class="$1 x"')],
  ];
  // Tour X (A6) : un script en ligne qui n'est ni JSON-LD ni charge RSC compte, même déguisé en charge RSC.
  const rsc = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[0]).find((s) => s.includes('.rsc.push('));
  assert.ok(rsc, 'charge RSC introuvable sur la page témoin');
  muts.push(['script en ligne (A6)', html.replace('</main>', '</main><script>fetch("https://example.invalid/t")</script>')]);
  muts.push(['charge RSC suivie de code', html.replace(rsc, rsc.replace(/\)<\/script>$/, ');fetch("https://example.invalid/t")</script>'))]);
  muts.push(['script module ajouté', html.replace('</main>', '</main><script type="module">import("/x.js")</script>')]);
  for (const [label, m] of muts) {
    assert.notEqual(m, html, `mutation « ${label} » sans effet`);
    assert.notEqual(docDigest(m), docDigest(html), `« ${label} » non vu`);
  }
  assert.equal(docDigest(html.replace(rsc, rsc.replace('.rsc.push("', '.rsc.push("x'))), docDigest(html), 'charge RSC changée prise pour un changement');
  const hm = h.replace('</main>', faq + '<section data-home-section="autre"><h2>z</h2></section></main>');
  assert.notEqual(homeDigest6(hm), homeDigest6(h), 'section ajoutée hors FAQ non vue');
  assert.notEqual(homeDigest6(h.replace('</main>', faq + faq + '</main>')), homeDigest6(h), 'seconde FAQ non vue');
  assert.equal(normFileName('_next/static/9418f3b6-8f7c-4324-9524-c23f62808f87/_ssgManifest.js'), '_next/static/<build>/_ssgManifest.js');
  assert.equal(normFileName('_next/static/chunks/index-Bj9Ytzv1.js'), '_next/static/chunks/index-*.js');
  assert.equal(normFileName('_next/static/css/index.BTenvT0J.css'), '_next/static/css/index.*.css');
});
