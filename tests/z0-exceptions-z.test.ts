// Tour Z (tmp/refonte-arbre/contrat-textes-z.md) : « tout le reste identique (empreintes de contenu : exceptions
// nommées, au plus juste) ». Les textes que Z1 et Z4 changent sur des pages figées par Q3 et Q2 (a040fb0) et V7 (274537a)
// sont des exceptions « Z… » de fixtures/exceptions-s.json (helpers-4.ts, v7-rien-d-autre.test.ts, verif-4). Ce fichier
// prouve qu'elles sont étroites et que le changement est fait :
// - ids figés, « nouveau » porte le fragment du contrat, ne vaut pas « ancien », n'y est pas contenu et n'est pas déjà
//   dans le texte a040fb0 (la sonde verif-4 remplace sur le texte compacté) ;
// - chaque valeur nouvelle est présente sur chacune de ses routes et l'ancienne n'y est plus (ROUGE avant le code) ;
// - témoins : la page « après Z » passe Q3 ; une troisième formulation, la valeur nouvelle sur une autre route ou dans
//   l'autre langue rougissent.
// Z2 et Z3 ne touchent que la FAQ, hors de ces empreintes (section FAQ et JSON-LD exclus) : pas d'exception.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ROUTES_4, contentDiffs, pageContent, readBaseline4, readNamedExceptions, readRoute } from './helpers-4.ts';
import type { NamedException } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf } from './helpers.ts';
import { norm } from './helpers-z.ts';

const REQUIS: Record<string, string> = {
  'Z4-note-en': 'Available now — permanent role; open to freelance and open-source projects.',
  'Z4-note-fr': 'Disponible immédiatement — CDI ; ouvert au freelance et aux projets open source.',
  'Z1-carte-en': 'tool approved for production by the steering committee',
  'Z1-carte-fr': 'outil validé pour la production par le comité de pilotage',
  'Z1-phrase-en': 'approved for production by the steering committee',
  'Z1-phrase-fr': 'validé pour la production par le comité de pilotage',
  'Z1-detail-en': 'The tool was approved for production by the steering committee',
  'Z1-detail-fr': 'a été validé pour la production par le comité de pilotage',
  'Z1-description-en': 'it was approved for production by the steering committee, and processing',
  'Z1-description-fr': 'validé pour la production par le comité de pilotage ;',
  'Z4-intro-en': 'can read them.',
  'Z4-intro-fr': 'puisse les lire.',
  'Z4-description-en': 'so a person or a machine can read them.',
  'Z4-description-fr': 'une machine puisse les lire.',
};
const Z = (): NamedException[] => readNamedExceptions().filter((e) => e.id.startsWith('Z'));
// Tour W (contrat-relecture-w.md, W4 A19, 26/11) : la phrase anglaise de l'introduction de Compétences est réécrite.
// Les exceptions Z4-intro-en et Z4-description-en restent dans le fichier, figées, mais leur valeur nouvelle n'est
// plus sur la page : l'exception W qui la remplace ramène directement la phrase de a040fb0. Elles sont retirées des
// deux contrôles « sur la page » ci-dessous, et leur remplaçante W doit exister (w0-exceptions-w.test.ts la contrôle).
const SUPERSEDED_BY_W: Readonly<Record<string, string>> = { 'Z4-intro-en': 'W4-A19-intro-en', 'Z4-description-en': 'W4-A19-description-en' };
const Zlive = (): NamedException[] => Z().filter((e) => {
  const w = SUPERSEDED_BY_W[e.id];
  if (!w) return true;
  assert.ok(readNamedExceptions().some((x) => x.id === w), `${e.id} : remplaçante ${w} absente de exceptions-s.json`);
  return false;
});
const n = (s: string): string => norm(s).trim();
const c = (s: string): string => n(s).toLowerCase().replace(/\s+/g, '');
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir})`);
  return html;
};
const ref = () => readBaseline4().pages[exportModeOf(distDir)];
const metaDescription = (html: string): string => n(/<meta\b[^>]*name="description"[^>]*content="([^"]*)"/.exec(html)?.[1] ?? '');
const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Motif souple : blancs (insécables, &nbsp;) et apostrophes (droite, U+2019, entités) quelconques.
const flex = (s: string): RegExp => new RegExp(s.trim().split(/\s+/).map((w) => esc(w).replace(/['’]/g, "(?:'|’|&#x27;|&#39;)")).join('(?:\\s|&nbsp;|&#160;)+'), 'g');
const old = (e: NamedException): string => e.ancienV7 ?? e.ancien;

function done(route: string, html: string, e: NamedException): boolean {
  if (e.champ === 'description') return metaDescription(html) === n(e.nouveau);
  const t = HOME_ROUTES_4.includes(route) ? n(html) : n(pageContent(route, html).text);
  return t.includes(n(e.nouveau)) && !t.includes(n(old(e)));
}
// Page « après Z » simulée sur l'export de départ : la valeur de 274537a devient la nouvelle (tout le HTML).
function afterZ(route: string, html: string): string {
  return Zlive().filter((e) => e.routes.includes(route)).reduce((h, e) => (done(route, h, e) ? h : h.replace(flex(old(e)), () => e.nouveau)), html);
}

test('Z0 : 14 exceptions Z (Z4-note-* en tête, avant S1-*) ; « nouveau » porte le fragment du contrat, ne vaut pas « ancien », n\'y est pas contenu, n\'est pas déjà dans a040fb0 ; routes : pages figées ou accueils', () => {
  const all = readNamedExceptions().map((e) => e.id);
  assert.deepEqual(all.slice(0, 2), ['Z4-note-en', 'Z4-note-fr'], 'Z4-note-* doivent précéder S1-* (ordre d\'application)');
  assert.ok(all.indexOf('S1-en') > 1 && all.indexOf('S1-fr') > 1);
  const list = Z();
  assert.deepEqual(list.map((e) => e.id).sort(), Object.keys(REQUIS).sort(), 'ids Z (figés)');
  const bad: string[] = [];
  const known = new Set([...Object.keys(ref()), ...HOME_ROUTES_4]);
  for (const e of list) {
    if (!n(e.nouveau).includes(n(REQUIS[e.id] as string))) bad.push(`${e.id} : « ${REQUIS[e.id]} » absent de la valeur nouvelle`);
    if (/note/.test(e.id) && n(e.nouveau) !== n(REQUIS[e.id] as string)) bad.push(`${e.id} : la note doit valoir la seule disponibilité`);
    if (c(e.nouveau) === c(e.ancien) || c(e.ancien).includes(c(e.nouveau)) || (e.ancienV7 !== undefined && c(e.ancienV7) === c(e.nouveau))) bad.push(`${e.id} : valeur nouvelle égale à l'ancienne ou contenue dedans`);
    for (const r of e.routes) {
      if (!known.has(r)) bad.push(`${e.id} : route ${r} hors des pages figées`);
      if (e.champ === 'texte' && !HOME_ROUTES_4.includes(r) && c(ref()[r]!.text).includes(c(e.nouveau))) bad.push(`${e.id} : valeur nouvelle déjà dans le texte a040fb0 de ${r}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('Z0 : chaque valeur nouvelle est sur chacune de ses routes et l\'ancienne n\'y est plus (ROUGE avant le code Z)', () => {
  assertDistExists();
  const missing = Zlive().flatMap((e) => e.routes.filter((r) => !done(r, page(r), e)).map((r) => `${e.id} : ${r} n'a pas « ${e.nouveau} » (ou garde « ${old(e)} »)`));
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('Z0 (témoins Q3) : la page après Z passe Q3 ; troisième formulation, valeur nouvelle sur une autre route ou dans l\'autre langue rougissent', () => {
  assertDistExists();
  const inner = [...new Set(Zlive().flatMap((e) => e.routes))].filter((r) => !HOME_ROUTES_4.includes(r));
  for (const r of inner) {
    const after = afterZ(r, page(r));
    for (const e of Zlive().filter((x) => x.routes.includes(r))) assert.ok(done(r, after, e), `${e.id} : simulation « après Z » impossible sur ${r}`);
    assert.deepEqual(contentDiffs(r, ref()[r]!, pageContent(r, after)), [], `${r} : la page après Z doit passer Q3`);
  }
  const other = (id: string): NamedException => Z().find((x) => x.id === id) as NamedException;
  for (const e of Zlive().filter((x) => x.champ === 'texte' && x.routes.some((r) => !HOME_ROUTES_4.includes(r)))) {
    const r = e.routes.find((x) => !HOME_ROUTES_4.includes(x)) as string;
    const after = afterZ(r, page(r));
    const third = after.replace(flex(e.nouveau), () => e.nouveau.replace(/\s(\S+)\s*$/, ' x$1'));
    assert.notEqual(third, after, `${e.id} : témoin « troisième formulation » sans effet`);
    assert.ok(contentDiffs(r, ref()[r]!, pageContent(r, third)).length > 0, `${e.id} : troisième formulation non vue sur ${r}`);
    const twin = other(e.id.endsWith('-en') ? e.id.replace(/-en$/, '-fr') : e.id.replace(/-fr$/, '-en'));
    const lang = after.replace(flex(e.nouveau), () => twin.nouveau);
    assert.ok(contentDiffs(r, ref()[r]!, pageContent(r, lang)).length > 0, `${e.id} : valeur de l'autre langue non vue sur ${r}`);
    const elsewhere = e.id.endsWith('-fr') ? '/fr/projects/' : '/projects/';
    const moved = page(elsewhere).replace('</main>', `<p>${e.nouveau}</p></main>`);
    assert.ok(contentDiffs(elsewhere, ref()[elsewhere]!, pageContent(elsewhere, moved)).length > 0, `${e.id} : valeur nouvelle sur ${elsewhere} non vue`);
  }
});
