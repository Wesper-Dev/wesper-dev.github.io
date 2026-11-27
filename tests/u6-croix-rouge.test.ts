// Lot 5, U6 (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit C6 ; FAITS §3) : la phrase de résumé du récit
// Croix-Rouge, FR et EN, dit le RAG co-construit, comme le rôle en tête de page ; exception Q3 nommée, seuls ces mots
// changent. Les exceptions U6-croix-rouge-{en,fr} de fixtures/exceptions-s.json sont figées ici (id, champ, route,
// ancien, requis) et dans s0 ; « nouveau » est une proposition des tests que le codeur peut changer, elle seule, à
// condition qu'elle contienne « requis » (liste avant → après). Q3 (q3-contenu) garantit que rien d'autre ne bouge.
// Rouge attendu avant le code : le récit dit encore « le front et le RAG du chatbot » / « front end and RAG ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertDistExists, distDir, exportModeOf, siteDir } from './helpers.ts';
import { contentDiffs, pageContent, readBaseline4, readNamedExceptions, readRoute, type NamedException, type PageContent } from './helpers-4.ts';

type L = 'fr' | 'en';
const ROUTE: Record<L, string> = { en: '/projects/croix-rouge/', fr: '/fr/projects/croix-rouge/' };
const FIXED: Record<L, { ancien: string; requis: string[] }> = {
  en: { ancien: 'My contribution: the chatbot’s front end and RAG at the hackathon', requis: ['co-built RAG'] },
  fr: { ancien: 'Ma contribution : le front et le RAG du chatbot au hackathon', requis: ['RAG co-construit'] },
};
// Anciennes formulations du résumé (sans « co- ») : aucune ne doit rester dans le récit ni sur la page.
const OLD: Record<L, RegExp> = { en: /front end and RAG at the hackathon/, fr: /le front et le RAG du chatbot/ };
const ws = (s: string): string => s.replace(/\s+/g, ' ').trim();
const byId = (id: string): NamedException => {
  const e = readNamedExceptions().find((x) => x.id === id);
  if (!e) throw new Error(`exception ${id} absente de fixtures/exceptions-s.json`);
  return e;
};
const page = (r: string): string => {
  const h = readRoute(distDir, r);
  if (!h) throw new Error(`${r} : page absente de l'export (${distDir})`);
  return h;
};
const mainText = (html: string): string => ws((/<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&'));

test('U6 : exceptions Q3 « U6-croix-rouge-en/fr » figées (champ texte, route du récit seule, ancien, requis) ; « nouveau » contient « requis », diffère de l\'ancien et ne garde pas l\'ancienne formulation', () => {
  for (const l of ['en', 'fr'] as const) {
    const e = byId(`U6-croix-rouge-${l}`);
    assert.equal(e.champ, 'texte');
    assert.deepEqual(e.routes, [ROUTE[l]]);
    assert.equal(e.ancien, FIXED[l].ancien);
    assert.deepEqual(e.requis, FIXED[l].requis);
    for (const r of FIXED[l].requis) assert.ok(ws(e.nouveau).includes(r), `nouveau ${l} sans « ${r} »`);
    assert.ok(!ws(e.ancien).includes(ws(e.nouveau)) && ws(e.nouveau) !== ws(e.ancien), `nouveau ${l} contenu dans l'ancien ou identique`);
    assert.ok(!OLD[l].test(e.nouveau), `nouveau ${l} garde l'ancienne formulation`);
    assert.ok(ws(e.nouveau).startsWith(l === 'fr' ? 'Ma contribution :' : 'My contribution:'), `nouveau ${l} : la phrase commence toujours par « Ma contribution : » / « My contribution: »`);
  }
});

test('U6 : le récit Croix-Rouge (content/stories/{fr,en}/croix-rouge.md) porte la valeur nouvelle de l\'exception et plus l\'ancienne formulation', () => {
  const bad: string[] = [];
  for (const l of ['en', 'fr'] as const) {
    const md = ws(readFileSync(join(siteDir, 'content', 'stories', l, 'croix-rouge.md'), 'utf8'));
    const e = byId(`U6-croix-rouge-${l}`);
    if (!md.includes(ws(e.nouveau))) bad.push(`stories/${l}/croix-rouge.md : « ${e.nouveau} » absent`);
    if (OLD[l].test(md)) bad.push(`stories/${l}/croix-rouge.md : ancienne formulation « ${OLD[l].source} »`);
  }
  assert.deepEqual(bad, []);
});

test('U6 : sur la page Croix-Rouge FR et EN de l\'export, le résumé dit le RAG co-construit (rôle et résumé : deux occurrences), plus aucune ancienne formulation', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const l of ['en', 'fr'] as const) {
    const text = mainText(page(ROUTE[l]));
    const e = byId(`U6-croix-rouge-${l}`);
    if (!text.includes(ws(e.nouveau))) bad.push(`${ROUTE[l]} : « ${e.nouveau} » absent`);
    if (OLD[l].test(text)) bad.push(`${ROUTE[l]} : ancienne formulation`);
    const n = text.split(FIXED[l].requis[0]!).length - 1;
    if (n < 2) bad.push(`${ROUTE[l]} : « ${FIXED[l].requis[0]} » trouvé ${n} fois (rôle et résumé attendus)`);
  }
  assert.deepEqual(bad, []);
});

// Témoins Q3 : la valeur nouvelle posée sur la page de départ passe Q3 ; une troisième formulation, la valeur de l'autre
// langue ou l'ancienne et la nouvelle ensemble rougissent. Les témoins partent de la page ramenée à a040fb0.
const lines = (c: PageContent): PageContent => ({ ...c, text: c.text.split('\n').map(ws).join('\n') });
const swap = (c: PageContent, from: string, to: string): PageContent => ({ ...c, text: c.text.replace(ws(from), ws(to)) });
test('U6 (témoins Q3) : la valeur nouvelle passe Q3 sur la page du récit ; troisième formulation, valeur de l\'autre langue, ancienne et nouvelle ensemble rougissent', () => {
  assertDistExists();
  const ref = readBaseline4().pages[exportModeOf(distDir)];
  for (const l of ['en', 'fr'] as const) {
    const r = ROUTE[l];
    const e = byId(`U6-croix-rouge-${l}`);
    const o = byId(`U6-croix-rouge-${l === 'fr' ? 'en' : 'fr'}`);
    let base = lines(pageContent(r, page(r)));
    if (base.text.includes(ws(e.nouveau))) base = swap(base, e.nouveau, e.ancien); // après le code : retour au départ
    // Les autres exceptions de la page (rôle T3) sont posées telles qu'elles sont servies ; seul U6 varie ici.
    const withNew = swap(base, e.ancien, e.nouveau);
    assert.deepEqual(contentDiffs(r, ref[r]!, withNew), [], `${r} : valeur nouvelle U6 refusée par Q3`);
    const third = swap(base, e.ancien, l === 'fr' ? 'Ma contribution : le front du chatbot et un RAG co-construit au hackathon' : 'My contribution: the chatbot’s front end and a co-built RAG at the hackathon');
    assert.ok(contentDiffs(r, ref[r]!, third).length > 0, `${r} : troisième formulation acceptée`);
    assert.ok(contentDiffs(r, ref[r]!, swap(base, e.ancien, o.nouveau)).length > 0, `${r} : valeur de l'autre langue acceptée`);
    assert.ok(contentDiffs(r, ref[r]!, { ...withNew, text: `${withNew.text}\n${ws(e.ancien)}` }).length > 0, `${r} : ancienne et nouvelle ensemble acceptées`);
  }
});
