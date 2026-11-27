// Tour Z, Z2 et Z3 (tmp/refonte-arbre/contrat-textes-z.md ; décisions d'Arnaud du 25/11/2026).
// Z2 : la réponse BPCE de la FAQ perd « Ce POC ne tournait pas en production. » / « The PoC did not run in production. »
// (FAQ rendue et JSON-LD), rien d'autre ne change dans cette réponse.
// Lecture retenue : la phrase reste sur la page BPCE (FAITS §2, « Page, sandbox » : texte et méta-description) et dans la
// ligne BPCE de llms.txt, qui reprend cette méta-description ; Z2 ne vise que la FAQ (contrat : « (FAQ, JSON-LD) »).
// Garde positive ici : la page BPCE la garde.
// Z3 : libellés des liens de la FAQ, BPCE « Lire le cas BPCE » / « Read the BPCE case », formation « Voir la formation » /
// « See the curriculum » ; adresses inchangées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageContent, readRoute } from './helpers-4.ts';
import type { Lang } from './helpers-4.ts';
import { assertDistExists, distDir } from './helpers.ts';
import { ldStrings, nodesOfType, readFaq, renderedFaq } from './helpers-6.ts';
import { Z2, Z2_REMOVED, Z3, hits, norm } from './helpers-z.ts';

const LANGS: Lang[] = ['fr', 'en'];
const HOME: Record<Lang, string> = { fr: '/fr/', en: '/' };
const BPCE: Record<Lang, string> = { fr: '/fr/experiences/bpce/', en: '/experiences/bpce/' };
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir})`);
  return html;
};
const n = (s: string): string => norm(s).trim();
// Applique fn à la seule section FAQ de l'accueil (les mêmes libellés et adresses existent ailleurs sur la page).
const inFaq = (html: string, fn: (s: string) => string): string => {
  const a = html.indexOf('data-home-section="faq"');
  if (a < 0) throw new Error('section FAQ introuvable');
  const b = html.indexOf('</section>', a);
  return html.slice(0, a) + fn(html.slice(a, b)) + html.slice(b);
};

// Écarts Z2 d'une page d'accueil (FAQ rendue et FAQPage) : pur, pour les témoins.
export function z2Errors(route: string, html: string, l: Lang): string[] {
  const out: string[] = [];
  const faq = renderedFaq(html);
  const item = faq.items.find((i) => i.id === 'bpce');
  if (!item) out.push(`${route} : question « bpce » absente de la FAQ rendue`);
  else if (n(item.answer) !== n(Z2.answer[l])) out.push(`${route} : réponse BPCE rendue « ${item.answer} » ≠ « ${Z2.answer[l]} »`);
  if (faq.section) for (const h of hits(faq.items.map((i) => i.answer).join(' '), Z2_REMOVED)) out.push(`${route} : FAQ rendue : ${h}`);
  const ld = nodesOfType(html, 'FAQPage');
  if (!ld.length) out.push(`${route} : aucun FAQPage dans le JSON-LD`);
  for (const f of ld) {
    for (const h of hits(ldStrings(f).join(' '), Z2_REMOVED)) out.push(`${route} : FAQPage : ${h}`);
    const q = (f.mainEntity as { acceptedAnswer?: { text?: string } }[] | undefined)?.find((x) => n(x.acceptedAnswer?.text ?? '').startsWith(n(Z2.answer[l]).slice(0, 40)));
    if (!q || n(q.acceptedAnswer?.text ?? '') !== n(Z2.answer[l])) out.push(`${route} : réponse BPCE du FAQPage « ${q?.acceptedAnswer?.text ?? '(absente)'} »`);
  }
  return out;
}
// Écarts Z3 : libellés et adresses des liens des questions bpce et formation, et plus aucun lien nommé de l'ancien libellé.
export function z3Errors(route: string, html: string, l: Lang): string[] {
  const out: string[] = [];
  const faq = renderedFaq(html);
  for (const [id, want] of Object.entries(Z3[l])) {
    const item = faq.items.find((i) => i.id === id);
    if (!item) {
      out.push(`${route} : question « ${id} » absente`);
      continue;
    }
    const to = item.links.filter((k) => k.href === want.href);
    if (to.length !== 1 || n(to[0]!.text) !== n(want.text)) out.push(`${route} : lien de « ${id} » vers ${want.href} = ${JSON.stringify(to)}, « ${want.text} » attendu`);
  }
  const old = faq.items.flatMap((i) => i.links).filter((k) => ['BPCE', 'École 42 Paris'].includes(n(k.text)));
  if (old.length) out.push(`${route} : ancien libellé de lien encore là : ${JSON.stringify(old)}`);
  return out;
}

test('Z2 : la réponse BPCE de la FAQ (faq.json, FAQ rendue, FAQPage) est celle du contrat, sans « Ce POC ne tournait pas en production. »', () => {
  assertDistExists();
  const errors: string[] = [];
  const c = readFaq();
  for (const l of LANGS) {
    const it = c[l].items.find((i) => i.id === 'bpce');
    if (!it || JSON.stringify(it.answer.map(n)) !== JSON.stringify([n(Z2.answer[l])])) errors.push(`faq.json ${l} : réponse bpce ${JSON.stringify(it?.answer)}`);
    errors.push(...z2Errors(HOME[l], page(HOME[l]), l));
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z2 (reste) : la page BPCE garde la phrase (FAITS §2), dans son texte et sa méta-description', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const l of LANGS) {
    const html = page(BPCE[l]);
    const text = n(pageContent(BPCE[l], html).text);
    if (!text.includes(n(Z2.removed[l]))) errors.push(`${BPCE[l]} : « ${Z2.removed[l]} » absent du texte (Z2 ne vise que la FAQ)`);
    const d = /<meta\b[^>]*name="description"[^>]*content="([^"]*)"/.exec(html)?.[1] ?? '';
    if (!n(d).endsWith(n(Z2.removed[l]))) errors.push(`${BPCE[l]} : méta-description sans « ${Z2.removed[l]} »`);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z3 : liens de la FAQ « Lire le cas BPCE » / « Read the BPCE case » et « Voir la formation » / « See the curriculum », adresses inchangées (faq.json et FAQ rendue)', () => {
  assertDistExists();
  const errors: string[] = [];
  const c = readFaq();
  for (const l of LANGS) {
    for (const [id, want] of Object.entries(Z3[l])) {
      const link = c[l].items.find((i) => i.id === id)?.link;
      if (!link || link.text !== want.text || link.href !== want.href) errors.push(`faq.json ${l} : lien de « ${id} » ${JSON.stringify(link)}`);
    }
    errors.push(...z3Errors(HOME[l], page(HOME[l]), l));
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z2, Z3 (témoins) : phrase BPCE remise dans la FAQ rendue ou dans le JSON-LD, ancien libellé, libellé changé ou lien retiré sont vus', () => {
  assertDistExists();
  for (const l of LANGS) {
    const html = page(HOME[l]);
    assert.deepEqual(z2Errors(HOME[l], html, l), [], `${HOME[l]} : départ du témoin non conforme à Z2`);
    assert.deepEqual(z3Errors(HOME[l], html, l), [], `${HOME[l]} : départ du témoin non conforme à Z3`);
    const rendu = inFaq(html, (s) => s.replace(/(data-faq-item="bpce"[\s\S]*?Kubernetes[^<]*?)(<\/p>)/, `$1 ${Z2.removed[l]}$2`));
    assert.notEqual(rendu, html, 'témoin rendu sans effet');
    assert.ok(z2Errors(HOME[l], rendu, l).length > 0, `${l} : phrase remise dans la FAQ rendue non vue`);
    const ld = html.replace(/("acceptedAnswer":\{[^}]*?"text":"[^"]*?)(Kubernetes[^"]*?)(")/, (_m, a: string, b: string, c: string) => `${a}${b} ${Z2.removed[l]}${c}`);
    assert.notEqual(ld, html, 'témoin JSON-LD sans effet');
    assert.ok(z2Errors(HOME[l], ld, l).length > 0, `${l} : phrase remise dans le JSON-LD non vue`);
    for (const [label, from, to] of [
      ['ancien libellé BPCE', `>${Z3[l].bpce.text}<`, '>BPCE<'],
      ['ancien libellé formation', `>${Z3[l].formation.text}<`, '>École 42 Paris<'],
      ['libellé changé', `>${Z3[l].formation.text}<`, `>${Z3[l].formation.text} !<`],
      ['lien retiré', `href="${Z3[l].bpce.href}"`, 'href="/autre/"'],
    ] as const) {
      const m = inFaq(html, (s) => s.replace(from, to));
      assert.notEqual(m, html, `témoin « ${label} » sans effet`);
      assert.ok(z3Errors(HOME[l], m, l).length > 0, `${l} : « ${label} » non vu`);
    }
  }
});
