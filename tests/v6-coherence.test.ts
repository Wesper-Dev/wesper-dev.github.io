// Contrat du lot 6a, V6 (tmp/refonte-arbre/contrat-lot6a.md), hors JSON-LD (v2-jsonld.test.ts) :
// - toute phrase de la FAQ marquée « reprise mot pour mot » dans le brouillon §4 est identique à sa source
//   (tests/fixtures/reprises-lot6.json : lien par le contenu ; blancs et apostrophes près, brouillon §Conventions) ;
// - sitemap.xml inchangé ; budgets : HTML des accueils + 6 Ko gzip au plus, CSS + 1 Ko au plus, JS inchangé à
//   32 octets près (référence 274537a figée dans tests/fixtures/baseline-274537a.json, par mode d'export).
// Les deux modes : `npm test` sur l'export d'aperçu du dépôt et sur un export public (SITE_TEST_DIST ou copie).
// Sources hors de site/ (FAITS.md, PLAN.md) : absentes en CI, le contrôle de ces sources y devient un diagnostic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_PAGES, cssGzipTotal, pageJsGzip, readRoute } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf, siteDir } from './helpers.ts';
import { FAQ_FILE, HOMES, REPRISES_FIXTURE, faqStrings, gz9, inlineParts, readBaseline6, readFaq, same, sha256 } from './helpers-6.ts';
import type { FaqContent, Lang } from './helpers-6.ts';

const repoDir = join(siteDir, '..');
interface Reprise { id: string; lang: Lang; texte: string; sources: string[]; pointAjoute?: boolean }
const reprises = (): Reprise[] => (JSON.parse(readFileSync(REPRISES_FIXTURE, 'utf8')) as { reprises: Reprise[] }).reprises;

// Texte d'une source : module TS (chaînes de toutes ses exportations), JSON (chaînes), Markdown (liens [t](u) → t,
// gras retiré). Normalisé par same() (blancs et apostrophes).
const deepStrings = (x: unknown): string[] => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(deepStrings) : x && typeof x === 'object' ? Object.values(x).flatMap(deepStrings) : []);
async function sourceText(file: string): Promise<string> {
  const ext = extname(file);
  if (ext === '.ts') return same(deepStrings(await import(pathToFileURL(file).href)).join('\n'));
  const raw = readFileSync(file, 'utf8');
  if (ext === '.json') return same(deepStrings(JSON.parse(raw)).join('\n'));
  return same(inlineParts(raw).text.replace(/\*\*/g, ''));
}
// Écarts d'une reprise (pur hors lecture des sources) : présente dans la FAQ de sa langue et dans chaque source lue.
export function repriseDiffs(r: Reprise, faq: FaqContent, sources: Record<string, string | null>): { errors: string[]; skipped: string[] } {
  const errors: string[] = [];
  const skipped: string[] = [];
  const want = same(r.texte);
  if (!faqStrings(faq, r.lang).map(same).some((s) => s.includes(want))) errors.push(`${r.id} (${r.lang}) : « ${r.texte.slice(0, 60)}… » absent de faq.json : phrase changée sans mise à jour de reprises-lot6.json`);
  const inSource = r.pointAjoute ? want.replace(/\.$/, '') : want;
  for (const s of r.sources) {
    const t = sources[s];
    if (t === null || t === undefined) skipped.push(`${r.id} : source ${s} absente`);
    else if (!t.includes(inSource)) errors.push(`${r.id} (${r.lang}) : « ${r.texte.slice(0, 60)}… » ≠ sa source ${s} (reprise mot pour mot, blancs et apostrophes près)`);
  }
  return { errors, skipped };
}

test('V6 : les phrases de la FAQ « reprises mot pour mot » (brouillon §4, tests/fixtures/reprises-lot6.json) sont dans faq.json et identiques à chacune de leurs sources (FAITS.md, PLAN.md, site/content)', async (t) => {
  assert.ok(existsSync(FAQ_FILE), 'site/content/faq.json absent (contrat lot 6a, V1)');
  const faq = readFaq();
  const files = [...new Set(reprises().flatMap((r) => r.sources))];
  const sources: Record<string, string | null> = {};
  // Sources under site/ are resolved from siteDir: in the published repository, site/ is the repository root.
  const pathOf = (f: string): string => (f.startsWith('site/') ? join(siteDir, f.slice('site/'.length)) : join(repoDir, f));
  for (const f of files) sources[f] = existsSync(pathOf(f)) ? await sourceText(pathOf(f)) : null;
  const errors: string[] = [];
  const skipped = new Set<string>();
  for (const r of reprises()) {
    const d = repriseDiffs(r, faq, sources);
    errors.push(...d.errors);
    d.skipped.forEach((s) => skipped.add(s.replace(/^[^:]+ : /, '')));
    if (r.sources.every((s) => sources[s] === null)) t.diagnostic(`${r.id} : aucune source lisible ici (CI ?) : seule la présence dans faq.json est contrôlée`);
  }
  for (const s of skipped) t.diagnostic(s);
  assert.ok(files.some((f) => f.startsWith('site/') && sources[f] !== null), 'aucune source de site/content lue');
  assert.deepEqual(errors, []);
});

test('V6 (témoins) : une reprise changée d\'un mot, ou disparue de faq.json, est vue ; des blancs insécables ou une apostrophe courbe ne le sont pas', () => {
  const faq = readFaq(join(siteDir, 'tests', 'fixtures', 'faq-lot6.json'));
  const r: Reprise = { id: 'X', lang: 'fr', texte: faq.fr.items[0]!.answer[0]!, sources: ['s'] };
  const src = (t: string): Record<string, string> => ({ s: same(`« ${t} »`) });
  assert.deepEqual(repriseDiffs(r, faq, src(r.texte.replace(/ /g, '  ').replace(/'/g, '’'))).errors, []);
  assert.ok(repriseDiffs(r, faq, src(r.texte.replace('binôme', 'équipe'))).errors.length > 0, 'mot changé dans la source non vu');
  assert.ok(repriseDiffs({ ...r, texte: r.texte.replace('binôme', 'équipe') }, faq, src(r.texte)).errors.length > 0, 'reprise absente de faq.json non vue');
  assert.ok(repriseDiffs({ ...r, pointAjoute: true }, faq, src(r.texte.replace(/\.$/, ''))).errors.length === 0, 'point final ajouté refusé');
});

test('V6 : sitemap.xml identique à 274537a (même mode d\'export)', () => {
  assertDistExists();
  const mode = exportModeOf(distDir);
  const ref = readBaseline6().modes[mode];
  assert.equal(sha256(readFileSync(join(distDir, 'sitemap.xml'))), ref.sitemap, `sitemap.xml (${mode}) différent de 274537a`);
});

test('V6 : budgets : HTML de chaque accueil ≤ 274537a + 6 Ko gzip -9 ; Σ CSS ≤ 274537a + 1 Ko gzip -9 ; JS de chaque page (21) = 274537a à 32 octets près', (t) => {
  assertDistExists();
  const mode = exportModeOf(distDir);
  const ref = readBaseline6().modes[mode];
  const errors: string[] = [];
  for (const r of HOMES) {
    const n = gz9(readRoute(distDir, r) ?? '');
    t.diagnostic(`${r} : HTML ${n} octets gzip (274537a : ${ref.homeGzip[r]}, + ${n - (ref.homeGzip[r] ?? 0)})`);
    if (n > (ref.homeGzip[r] ?? 0) + 6144) errors.push(`${r} : HTML ${n} octets gzip > 274537a ${ref.homeGzip[r]} + 6 144`);
  }
  const css = cssGzipTotal(distDir);
  t.diagnostic(`Σ CSS ${css} octets gzip (274537a : ${ref.cssGzip}, + ${css - ref.cssGzip})`);
  if (css > ref.cssGzip + 1024) errors.push(`Σ CSS ${css} octets gzip > 274537a ${ref.cssGzip} + 1 024`);
  for (const r of ALL_PAGES) {
    const n = pageJsGzip(distDir, readRoute(distDir, r) ?? '');
    const d = n - (ref.jsGzip[r] ?? 0);
    if (Math.abs(d) > 32) errors.push(`${r} : JS ${n} octets gzip, 274537a ${ref.jsGzip[r]} (écart ${d} > 32)`);
  }
  assert.deepEqual(errors, [], `(${mode})`);
});
