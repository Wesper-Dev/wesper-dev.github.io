// Lot 5, T3 et T4 (tmp/refonte-arbre/contrat-lot5.md) : « 639 tests existants verts (références de contenu mises à jour
// au plus juste, exceptions nommées) ». Les textes que le lot 5 change sur des pages figées par Q3 (pages intérieures)
// et Q2 (accueils) sont des exceptions « T3-… » de fixtures/exceptions-s.json, appliquées par helpers-4.ts.
// Ce fichier prouve qu'elles sont étroites et que le changement est fait :
// - « requis » est figé ici (fragments tirés de FAITS.md ou de la spec) ; aucune valeur nouvelle ne porte un interdit ;
// - chaque valeur nouvelle est présente sur chacune de ses routes, l'ancienne n'y est plus (ROUGE avant le code) ;
// - témoins : la valeur nouvelle posée sur l'export de départ passe Q3 et Q2 ; une troisième formulation, la valeur
//   nouvelle sur une autre route ou dans l'autre langue, un titre de groupe renommé à la place du libellé rougissent.
// Les valeurs « nouveau » marquées « proposition » ne sont pas fixées par FAITS ni la spec : le codeur peut les changer
// (elles seules), et chaque changement de texte figure dans la liste avant → après pour validation (contrat T3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ROUTES_4, contentDiffs, homeDigest, pageContent, readBaseline4, readNamedExceptions, readRoute, revertNamedExceptionsHtml } from './helpers-4.ts';
import type { NamedException } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf } from './helpers.ts';
import { withoutFaqSection } from './helpers-6.ts';

const REQUIS: Record<string, string[]> = {
  'T3-python-en': ['more than 120 offline tests'],
  'T3-python-fr': ['plus de 120 tests hors ligne'],
  'T3-evals-nom-en': ['Offline evals'],
  'T3-evals-preuve-en': ['more than 120 offline tests'],
  'T3-evals-nom-fr': ['évaluations hors ligne'],
  'T3-k8s-en': ['BPCE: contributed'],
  'T3-cv-texte-en': ['without my phone number'],
  'T3-cv-texte-fr': ['sans mon numéro de téléphone'],
  'T3-cv-libelle-en': [],
  'T3-cv-libelle-fr': [],
  'T3-croix-rouge-en': ['the chatbot’s front end and co-built RAG'],
  'T3-croix-rouge-fr': ['front du chatbot et RAG co-construit'],
  'T3-description-en': ['Software Engineer'],
  'T3-description-fr': ['ingénieur logiciel'],
};
const INTERDITS = /d[ée]terminist|\b120\s*\+|\bcontributing\b|identical wording|mêmes formulations|applied ai engineer|16\s*(?:octobre|october)|^(?:applied ai|ia appliquée)$/i;
const T3 = (): NamedException[] => readNamedExceptions().filter((e) => e.id.startsWith('T3-'));
const ws = (s: string): string => s.replace(/\s+/g, ' ').trim();
// Même réduction que tmp/refonte-arbre/verif-4/verif.mjs (compact), qui ramène la valeur nouvelle à l'ancienne par un
// remplacement sur le texte compacté : la valeur nouvelle ne doit être ni dans l'ancienne ni déjà dans le texte a040fb0.
const compact = (t: string): string => t.toLowerCase().replace(/[\s\u200b]+/g, '');
const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const flexible = (t: string): RegExp => new RegExp(t.trim().split(/\s+/).map(esc).join('(?:\\s|&nbsp;|&#160;)+'), 'g');
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir})`);
  return html;
};
const ref = () => readBaseline4().pages[exportModeOf(distDir)];
const diffsOf = (route: string, html: string): string[] => contentDiffs(route, ref()[route]!, pageContent(route, html));
const occurrences = (text: string, s: string): number => ws(text).split(ws(s)).length - 1;
const metaDescriptions = (html: string): string[] => [...html.matchAll(/<meta\b[^>]*(?:name|property)="(?:description|og:description|twitter:description)"[^>]*content="([^"]*)"/g)].map((m) => m[1]!.replace(/&#x27;/g, "'").replace(/&amp;/g, '&'));

// Page « après le code » simulée sur l'export de départ : la valeur ancienne devient la nouvelle. Libellé du CV : la
// dernière occurrence rendue (« >Applied AI< » est d'abord un titre de groupe) ; accueils : tout le HTML (rendu et RSC).
function done(route: string, html: string, e: NamedException): boolean {
  if (HOME_ROUTES_4.includes(route) || e.champ === 'description') return !!html.match(flexible(e.nouveau)) && !html.includes(e.ancien);
  const text = pageContent(route, html).text;
  return occurrences(text, e.nouveau) > 0 && occurrences(text.split(ws(e.nouveau)).join(' | '), e.ancien) === occurrences(ref()[route]!.text, e.ancien) - 1;
}
function applyNew(route: string, html: string, e: NamedException): string {
  if (done(route, html, e)) return html; // après le code : déjà là
  if (e.id.startsWith('T3-cv-libelle')) {
    const tag = `>${e.ancien}<`;
    const at = html.lastIndexOf(tag, html.search(/<\/main>/i));
    return html.slice(0, at) + `>${e.nouveau}<` + html.slice(at + tag.length);
  }
  if (HOME_ROUTES_4.includes(route) || e.champ === 'description') return html.split(e.ancien).join(e.nouveau);
  return html.replace(/<main\b[\s\S]*?<\/main>/i, (m) => m.replace(e.ancien, e.nouveau));
}
const withAll = (route: string, html: string): string => T3().filter((e) => e.routes.includes(route)).reduce((h, e) => applyNew(route, h, e), html);

test('T0 (lot 5) : 14 exceptions T3 ; « requis » figé et contenu dans la valeur nouvelle ; aucune valeur nouvelle ne porte un interdit ni ne vaut l\'ancienne ; routes : pages figées par Q3 ou accueils', () => {
  const list = T3();
  assert.deepEqual(list.map((e) => e.id), Object.keys(REQUIS), 'ids T3 (figés)');
  const bad: string[] = [];
  const known = new Set([...Object.keys(readBaseline4().pages.preview), ...HOME_ROUTES_4]);
  for (const e of list) {
    if (JSON.stringify(e.requis ?? []) !== JSON.stringify(REQUIS[e.id])) bad.push(`${e.id} : « requis » modifié`);
    for (const r of REQUIS[e.id] ?? []) if (!e.nouveau.includes(r)) bad.push(`${e.id} : « ${r} » absent de la valeur nouvelle`);
    if (INTERDITS.test(e.nouveau)) bad.push(`${e.id} : interdit dans « ${e.nouveau} »`);
    if (ws(e.nouveau) === ws(e.ancien) || !e.nouveau.trim()) bad.push(`${e.id} : valeur nouvelle vide ou égale à l'ancienne`);
    for (const r of e.routes) if (!known.has(r)) bad.push(`${e.id} : route ${r} hors de Q3 et Q2`);
    if (e.champ === 'description' && !e.routes.every((r) => HOME_ROUTES_4.includes(r))) bad.push(`${e.id} : description hors des accueils`);
    if (e.champ !== 'texte') continue;
    if (compact(e.ancien).includes(compact(e.nouveau))) bad.push(`${e.id} : valeur nouvelle contenue dans l'ancienne (verif-4 Q3.1, R4.2, R6.1 doubleraient la fin)`);
    for (const r of e.routes.filter((x) => !HOME_ROUTES_4.includes(x))) for (const mode of ['preview', 'public'] as const) {
      if (compact(readBaseline4().pages[mode][r]!.text).includes(compact(e.nouveau))) bad.push(`${e.id} ${r} : valeur nouvelle déjà dans le texte a040fb0 (${mode}), retour ambigu`);
    }
  }
  assert.deepEqual(bad, []);
});

test('T0 (lot 5) : chaque valeur nouvelle T3 est sur chacune de ses routes et l\'ancienne n\'y est plus (texte du <main>, liens, descriptions ; accueils : HTML)', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const e of T3()) {
    for (const r of e.routes) {
      const html = page(r);
      if (e.champ === 'description') {
        const v = metaDescriptions(html);
        if (v.length !== 3 || !v.every((x) => ws(x) === ws(e.nouveau))) bad.push(`${e.id} ${r} : descriptions ${JSON.stringify(v)}`);
        continue;
      }
      const got = pageContent(r, html);
      if (!occurrences(got.text, e.nouveau)) bad.push(`${e.id} ${r} : « ${e.nouveau} » absent du <main>`);
      const before = HOME_ROUTES_4.includes(r) ? 1 : occurrences(ref()[r]!.text, e.ancien);
      if (occurrences(got.text.split(ws(e.nouveau)).join(' | '), e.ancien) !== before - 1) bad.push(`${e.id} ${r} : « ${e.ancien} » encore présent`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('T0 (lot 5, témoins Q3) : toutes les valeurs T3 posées sur l\'export de départ passent Q3 ; troisième formulation, valeur sur une autre route ou dans l\'autre langue, titre de groupe renommé à la place du libellé rougissent', () => {
  assertDistExists();
  const routes = [...new Set(T3().flatMap((e) => e.routes))].filter((r) => !HOME_ROUTES_4.includes(r));
  for (const r of routes) assert.deepEqual(diffsOf(r, withAll(r, page(r))), [], `${r} : valeurs T3 refusées par Q3`);
  const by = (id: string): NamedException => T3().find((e) => e.id === id)!;
  const skills = withAll('/skills/', page('/skills/'));
  const frSkills = withAll('/fr/skills/', page('/fr/skills/'));
  const python = by('T3-python-en');
  const reds: [string, string, string][] = [
    ['troisième formulation (preuve Python)', '/skills/', skills.replace(python.nouveau, python.nouveau.replace('more than 120', 'over 120'))],
    ['valeur nouvelle et ancienne ensemble', '/skills/', skills.replace('</main>', `<p>${python.ancien}</p></main>`)],
    ['rôle Croix-Rouge nouveau sur Hackathons', '/hackathons/', page('/hackathons/').replace('</main>', `<p>${by('T3-croix-rouge-en').nouveau}</p></main>`)],
    ['preuve EN sur la page FR', '/fr/skills/', frSkills.replace(by('T3-python-fr').nouveau, python.nouveau)],
    ['titre de groupe renommé au lieu du libellé', '/skills/', page('/skills/').replace('>Applied AI<', `>${by('T3-cv-libelle-en').nouveau}<`)],
    ['texte du CV : troisième formulation', '/fr/skills/', frSkills.replace(by('T3-cv-texte-fr').nouveau, 'Mon CV porte cette liste. C’est une copie.')],
  ];
  for (const [label, r, html] of reds) assert.ok(diffsOf(r, html).length > 0, `« ${label} » (${r}) non détecté par Q3`);
});

test('T0 (lot 5, témoins Q2) : sur les accueils, rôle Croix-Rouge et description nouveaux redonnent l\'empreinte a040fb0 ; une troisième formulation ou la description de l\'autre langue la changent', () => {
  assertDistExists();
  const homes = readBaseline4().homes[exportModeOf(distDir)];
  for (const r of HOME_ROUTES_4) {
    const mine = T3().filter((e) => e.routes.includes(r));
    assert.equal(mine.length, 2, `${r} : deux exceptions T3 attendues (rôle Croix-Rouge, description)`);
    const base = revertNamedExceptionsHtml(r, withoutFaqSection(page(r))); // lot 6a (V1) : section FAQ retirée d'abord, comme q2-coquille
    assert.equal(homeDigest(base), homes[r], `${r} : la page ramenée à a040fb0 doit redonner l'empreinte de référence`);
    const after = mine.reduce((h, e) => applyNew(r, h, e), base);
    assert.notEqual(after, base, `${r} : témoin sans effet`);
    assert.equal(homeDigest(revertNamedExceptionsHtml(r, after)), homes[r], `${r} : valeurs T3 prises pour un changement`);
    const desc = mine.find((e) => e.champ === 'description')!;
    const other = T3().find((e) => e.champ === 'description' && e.id !== desc.id)!;
    assert.notEqual(homeDigest(revertNamedExceptionsHtml(r, after.split(desc.nouveau).join(desc.nouveau.replace(/based in Paris|à Paris/, 'in Paris, France')))), homes[r], `${r} : troisième description non détectée`);
    assert.notEqual(homeDigest(revertNamedExceptionsHtml(r, after.split(desc.nouveau).join(other.nouveau))), homes[r], `${r} : description de l'autre langue non détectée`);
  }
});
