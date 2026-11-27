// Durcissement après l'audit Opus en navigateur du lot 2a (audit-lot2a-opus.md, arbitrage-audit-lot2a-opus.md, point 5) :
// les intervalles chiffrés « 3–5 » et « 1–3 » ne doivent jamais être coupés en fin de ligne (phrase BNP, fiches, repli,
// FR et EN), alors que le texte visible reste identique à FAITS. Le moyen est libre : le test vérifie le résultat dans
// le HTML et le CSS exportés (aucune occasion de coupure à l'intérieur de l'intervalle), pas une classe ni une balise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E31_CARDS, HOME_ROUTES, type HNode, ancestors, byAttr, exportCss, homeDoc, localeOf, one, textOf, walk } from './helpers-home.ts';
import { DESKTOP, type Env, PHONE, cascade, inherited } from './helpers-cascade.ts';
import { faitsCommons } from './helpers-faits.ts';

const RANGES = ['3–5', '1–3'];
// Caractères qui modifieraient le texte visible (le moyen « caractère invisible » est exclu par E3.1).
const INVISIBLE = /[­​-‍⁠﻿]/;

interface Hit { range: string; nodes: HNode[]; lca: HNode }

// Occurrences de chaque intervalle dans le texte d'un conteneur, avec les nœuds de texte qui les portent.
function rangesIn(container: HNode): Hit[] {
  const texts: HNode[] = [];
  walk(container, (n) => {
    if (n.tag === '#text') texts.push(n);
  });
  let flat = '';
  const owner: HNode[] = [];
  for (const t of texts) for (const ch of t.text) { flat += ch; owner.push(t); }
  const hits: Hit[] = [];
  for (const r of RANGES) {
    for (let at = flat.indexOf(r); at >= 0; at = flat.indexOf(r, at + 1)) {
      const nodes = [...new Set(owner.slice(at, at + r.length))];
      // Plus proche ancêtre commun des nœuds de texte.
      const chains = nodes.map((n) => ancestors(n));
      const lca = chains[0]?.find((a) => chains.every((c) => c.includes(a))) ?? container;
      hits.push({ range: r, nodes, lca });
    }
  }
  return hits;
}

// Vrai si aucune coupure de ligne n'est possible à l'intérieur de l'intervalle, d'après la cascade du test :
// white-space (ou text-wrap-mode) sans retour à la ligne sur l'ancêtre commun, ou boîte atomique en ligne
// (inline-block, inline-flex, inline-grid, inline-table) contenant tout l'intervalle.
function unbreakable(hit: Hit, rules = exportCss().rules, env: Env): { ok: boolean; why: string } {
  const c = cascade(rules, { states: new Map(), env });
  const ws = inherited(c, hit.lca, 'white-space')?.value ?? 'normal';
  if (/^(nowrap|pre)\b/.test(ws)) return { ok: true, why: `white-space: ${ws}` };
  const mode = inherited(c, hit.lca, 'text-wrap-mode')?.value ?? inherited(c, hit.lca, 'text-wrap')?.value ?? '';
  if (/^nowrap\b/.test(mode)) return { ok: true, why: `text-wrap: ${mode}` };
  for (const a of [hit.lca, ...ancestors(hit.lca)]) {
    if (a.tag === '#root') break;
    const d = c.get(a, 'display') ?? '';
    if (/^inline-(block|flex|grid|table)\b/.test(d)) return { ok: true, why: `display: ${d}` };
    if (/^(block|flex|grid|list-item|table)\b/.test(d) || ['p', 'div', 'li', 'article', 'section', 'ul'].includes(a.tag)) break;
  }
  return { ok: false, why: `white-space: ${ws}${mode ? `, text-wrap: ${mode}` : ''}, ancêtre commun <${hit.lca.tag}>` };
}

// Conteneurs exigés par l'arbitrage : phrase BNP, fiche BNP (résultat), repli (résultat BNP).
function containers(route: string): [string, HNode][] {
  const doc = homeDoc(route);
  return [
    ['phrase BNP', one(doc, 'data-tree-bnp', route)],
    ['fiche BNP', one(doc, 'data-card', route, 'bnp-paribas')],
    ['repli', one(doc, 'data-tree-fallback', route)],
  ];
}

test('Opus 5 : « 3–5 » et « 1–3 » figurent dans la phrase BNP, la fiche BNP et le repli, sans caractère invisible ajouté (texte identique à FAITS)', async () => {
  // Arbitrage, point 5 : la chaîne de contenu reste identique à FAITS (correction au rendu seulement).
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    for (const [name, n] of containers(route)) {
      const text = textOf(n);
      assert.ok(!INVISIBLE.test(text), `${route} ${name} : caractère invisible dans le texte (${JSON.stringify(text.match(INVISIBLE)?.[0])})`);
      for (const r of RANGES) assert.ok(text.includes(r), `${route} ${name} : « ${r} » absent du texte`);
    }
    // F14 (audit Fable) : comparée à FAITS §7 (ou à sa copie versionnée), plus à la source qui la produit.
    assert.equal(textOf(one(homeDoc(route), 'data-tree-bnp', route)), faitsCommons().bnpSentence[l].replace(/\s+/g, ' ').trim(), `${route} : phrase BNP ≠ FAITS §7`);
    const result = byAttr(one(homeDoc(route), 'data-card', route, 'bnp-paribas'), 'data-card-result')[0];
    assert.equal(result ? textOf(result) : '', E31_CARDS['bnp-paribas']?.[l].result, `${route} : résultat de la fiche BNP ≠ FAITS`);
  }
});

test('Opus 5 : aucun « 3–5 » ni « 1–3 » ne peut être coupé en fin de ligne (phrase BNP, fiche BNP, repli ; FR et EN ; PC et téléphone)', () => {
  // Arbitrage, point 5 : coupure observée après le tiret à 390, 412 et 430 px (« passé de 3– » / « 5 à 1–3 minutes »).
  const problems: string[] = [];
  let seen = 0;
  for (const route of HOME_ROUTES) {
    for (const [name, n] of containers(route)) {
      const hits = rangesIn(n);
      for (const hit of hits) {
        seen++;
        for (const [env, en] of [[DESKTOP, 'PC'], [PHONE, 'téléphone']] as const) {
          const r = unbreakable(hit, exportCss().rules, env);
          if (!r.ok) problems.push(`${route} ${name} (${en}) : « ${hit.range} » sécable (${r.why})`);
        }
      }
    }
  }
  assert.ok(seen >= 12, `au moins douze occurrences attendues (2 intervalles × 3 conteneurs × 2 langues), reçu ${seen}`);
  assert.deepEqual([...new Set(problems)], [], [...new Set(problems)].join('\n'));
});

test('Opus 5 : le contrôle reconnaît un intervalle protégé par white-space: nowrap ou par une boîte inline-block, et refuse un intervalle nu (témoins)', async () => {
  // Témoins sur un DOM synthétique : sans eux, un test vert ne prouverait rien.
  const { parseHtml } = await import('./helpers-home.ts');
  const rule = (sel: string, decls: [string, string][]) => ({ selectors: [sel], selector: sel, decls: new Map(decls), declList: decls, media: null, file: 'témoin' });
  const doc = parseHtml('<body><p id="a">de 3–5 à 1–3 min</p><p id="b">de <span class="r">3–5</span> à <span style="white-space:nowrap">1–3</span></p><p id="c">de <span class="i">3–5</span></p></body>');
  const rules = [rule('.r', [['white-space', 'nowrap']]), rule('.i', [['display', 'inline-block']])];
  const get = (id: string): HNode => byAttr(doc, 'id', id)[0] as HNode;
  assert.deepEqual(rangesIn(get('a')).map((h) => unbreakable(h, rules, DESKTOP).ok), [false, false]);
  assert.deepEqual(rangesIn(get('b')).map((h) => unbreakable(h, rules, DESKTOP).ok), [true, true]);
  assert.deepEqual(rangesIn(get('c')).map((h) => unbreakable(h, rules, DESKTOP).ok), [true]);
});
