// Contrat du lot 2b, P4 : sur les deux accueils, les fiches BPCE et École 42 et leurs entrées du repli
// (.tree-fallback) mènent à leur page par un lien natif, comme BNP. Le libellé du lien de fiche n'est pas donné par
// FAITS (point signalé dans le rapport) : le test exige un libellé non vide et sans « BNP », et ne fige pas sa valeur.
// Le reste de l'accueil est figé par P5 (référence 6d9e441).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDistExists } from './helpers.ts';
import { anchorsOf, elementsWithAttr, pageHtml } from './helpers-scene.ts';
import { HOME_ROUTES, byAttr, homeDoc, one, textOf } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';
import { bpceReference, ecole42Reference } from './helpers-faits.ts';
import type { Lang } from './helpers-2b.ts';

const langOf = (route: string): Lang => (route.startsWith('/fr/') ? 'fr' : 'en');
const pre = (l: Lang): string => (l === 'fr' ? '/fr/' : '/');
// Cibles écrites en dur (contrat P1, P4) : elles ne se déduisent pas de routes.json.
const TARGETS: Record<'bpce' | 'ecole-42', string> = { bpce: 'experiences/bpce/', 'ecole-42': 'experiences/ecole-42/' };

for (const route of HOME_ROUTES) {
  const l = langOf(route);
  test(`P4 (${l}) : ${route} : les fiches BPCE et École 42 portent un lien natif a[data-card-link] vers ${pre(l)}experiences/<slug>/, sans target, au libellé non vide et sans « BNP »`, () => {
    assertDistExists();
    const problems: string[] = [];
    for (const [id, path] of Object.entries(TARGETS)) {
      const card = one(homeDoc(route), 'data-card', route, id);
      const links = byAttr(card, 'data-card-link');
      if (links.length !== 1) {
        problems.push(`${id} : un a[data-card-link] attendu dans article[data-card="${id}"], reçu ${links.length}`);
        continue;
      }
      const a = links[0] as HNode;
      if (a.tag !== 'a') problems.push(`${id} : <a> attendu, reçu <${a.tag}>`);
      if (a.attrs.href !== pre(l) + path) problems.push(`${id} : cible ${JSON.stringify(a.attrs.href)}, attendu ${pre(l) + path}`);
      if (a.attrs.target !== undefined) problems.push(`${id} : target="${a.attrs.target}" (lien ordinaire attendu)`);
      for (const k of Object.keys(a.attrs)) if (/^on/i.test(k)) problems.push(`${id} : gestionnaire ${k} sur le lien`);
      const label = textOf(a);
      if (!label) problems.push(`${id} : libellé vide`);
      if (/BNP/.test(label)) problems.push(`${id} : libellé « ${label} » repris du cas BNP sans adaptation`);
    }
    assert.deepEqual(problems, []);
  });

  test(`P4 (${l}) : ${route} : le repli a exactement cinq liens, dans l'ordre, dont BPCE et École 42 vers leur page, au texte de leur nom`, () => {
    assertDistExists();
    const fb = elementsWithAttr(pageHtml(route), 'data-tree-fallback');
    assert.equal(fb.length, 1, `${route} : un [data-tree-fallback] attendu`);
    const links = anchorsOf(fb[0]?.inner ?? '');
    const p = pre(l);
    assert.deepEqual(
      links.map((a) => a.href),
      [p + 'experiences/bnp-paribas/', p + 'experiences/bpce/', p + 'projects/croix-rouge/', p + 'experiences/ecole-42/', p + 'projects/droit-de-retard/'],
      `${route} : liens du repli`,
    );
    assert.equal(links[1]?.text, bpceReference().name, `${route} : texte du lien BPCE du repli`);
    assert.equal(links[3]?.text, ecole42Reference().name, `${route} : texte du lien École 42 du repli`);
    // Liens natifs : ni target ni gestionnaire on* (neutralizeHome efface ces éléments, P5 ne les voit donc pas).
    for (const tag of (fb[0]?.inner ?? '').match(/<a\b[^>]*>/gi) ?? []) {
      if (!/experiences\/(bpce|ecole-42)\//.test(tag)) continue;
      assert.ok(!/\starget\s*=/i.test(tag), `${route} : lien du repli avec target : ${tag}`);
      assert.ok(!/\son[a-z]+\s*=/i.test(tag), `${route} : lien du repli avec gestionnaire : ${tag}`);
    }
  });
}
