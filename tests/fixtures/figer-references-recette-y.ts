// Tour Y (tmp/refonte-arbre/contrat-recette-y.md) : recalcule, avec le repli symétrique foldRecetteYHtml
// (helpers-typo.ts), les seules empreintes de document des références a040fb0 (Q2 : homes) et 274537a (V7 : docs et
// homes), depuis les exports de CES commits (jamais depuis un export conforme). Avant d'écrire, le script vérifie que
// les mêmes exports, sans repli, redonnent exactement les empreintes enregistrées : la reconstruction est fidèle. Rien
// d'autre n'est touché dans les deux fichiers (pages Q3, mesures, budgets, fichiers).
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-references-recette-y.ts
//   --a040-preview <dist> --a040-public <dist> --b274-preview <dist> --b274-public <dist>
// Exports a040fb0 : tmp/refonte-arbre/verif-4/ref-a040fb0/dist-{preview,public} ; 274537a : commande du champ
// « commande » de baseline-274537a.json, reconstruits hors dépôt.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_4, HOME_ROUTES_4, LOT4_PAGES, homeDigest, readRoute } from '../helpers-4.ts';
import type { Baseline4, Mode } from '../helpers-4.ts';
import { BASELINE_6_FILE, HOMES, normalizedDocument6, sha256, withoutFaqSection } from '../helpers-6.ts';
import type { Baseline6 } from '../helpers-6.ts';
import { foldRecetteYHtml } from '../helpers-typo.ts';
import { siteDir } from '../helpers.ts';

const arg = (k: string): string => {
  const i = process.argv.indexOf(k);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || !existsSync(v)) {
    console.error(`${k} <export> requis et existant`);
    process.exit(2);
  }
  return v;
};
const MODES: Mode[] = ['preview', 'public'];
const read = (root: string, r: string): string => {
  const h = readRoute(root, r);
  if (h === null) throw new Error(`page absente : ${r} (${root})`);
  return h;
};
const errors: string[] = [];
const NOTE = ' Tour Y (25/11) : empreintes de document recalculées avec le repli symétrique foldRecetteYHtml (tests/helpers-typo.ts) sur les mêmes exports, après vérification que, sans repli, ils redonnent les empreintes précédentes (tests/fixtures/figer-references-recette-y.ts).';

const f4 = join(siteDir, 'tests', 'fixtures', BASELINE_4);
const b4 = JSON.parse(readFileSync(f4, 'utf8')) as Baseline4;
const b6 = JSON.parse(readFileSync(BASELINE_6_FILE, 'utf8')) as Baseline6;
let changed4 = 0;
let changed6 = 0;
for (const mode of MODES) {
  const a = arg(`--a040-${mode}`);
  for (const r of HOME_ROUTES_4) {
    const html = read(a, r);
    if (homeDigest(html, false) !== b4.homes[mode][r]) errors.push(`a040fb0 ${mode} ${r} : l'export ne redonne pas l'empreinte enregistrée (sans repli)`);
    const y = homeDigest(html, true);
    if (y !== b4.homes[mode][r]) changed4++;
    b4.homes[mode][r] = y;
  }
  const b = arg(`--b274-${mode}`);
  const snap = b6.modes[mode];
  for (const r of LOT4_PAGES) {
    const html = read(b, r);
    if (sha256(normalizedDocument6(html)) !== snap.docs[r]) errors.push(`274537a ${mode} ${r} : l'export ne redonne pas l'empreinte enregistrée (sans repli)`);
    const y = sha256(normalizedDocument6(foldRecetteYHtml(html)));
    if (y !== snap.docs[r]) changed6++;
    snap.docs[r] = y;
  }
  for (const r of HOMES) {
    const html = withoutFaqSection(read(b, r));
    if (sha256(normalizedDocument6(html)) !== snap.homes[r]) errors.push(`274537a ${mode} ${r} : l'accueil ne redonne pas l'empreinte enregistrée (sans repli)`);
    const y = sha256(normalizedDocument6(foldRecetteYHtml(html)));
    if (y !== snap.homes[r]) changed6++;
    snap.homes[r] = y;
  }
}
if (errors.length) {
  console.error(`reconstruction infidèle, rien n'est écrit :\n${errors.join('\n')}`);
  process.exit(1);
}
if (!b4.commande.includes('Tour Y')) b4.commande += NOTE;
if (!b6.commande.includes('Tour Y')) b6.commande += NOTE;
writeFileSync(f4, JSON.stringify(b4, null, 1) + '\n');
writeFileSync(BASELINE_6_FILE, JSON.stringify(b6, null, 1) + '\n');
console.log(`écrit : ${f4} (${changed4} empreintes changées) ; ${BASELINE_6_FILE} (${changed6} empreintes changées)`);
