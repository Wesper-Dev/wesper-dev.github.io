// Contrat E12.1, E12.2 et E12.10 (lot 2a) : langue, lien d'évitement, commandes nommées, aucun focalisable caché,
// survols réservés à la souris. Ordre clavier, focus, cibles et contrastes mesurés : scénarios [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_ROUTES,
  type HNode,
  ancestors,
  byTag,
  docOrder,
  exportCss,
  has,
  homeDoc,
  homeRoot,
  inHomeScope,
  localeOf,
  one,
  otherLocale,
  textOf,
} from './helpers-home.ts';

const FOCUSABLE = (n: HNode): boolean =>
  (n.tag === 'a' && has(n, 'href')) || n.tag === 'button' || n.tag === 'input' || n.tag === 'select' || n.tag === 'textarea' || n.tag === 'summary' || has(n, 'tabindex');

test('E12.1 : lang de [data-home] = langue de la page, lien de langue avec hreflang et lang de la cible, #main existe', () => {
  // E12.1 : structure.
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const doc = homeDoc(route);
    assert.equal(homeRoot(route).attrs.lang, l, `${route} : lang de [data-home]`);
    const lang = one(doc, 'data-site-link', route, 'lang');
    assert.equal(lang.attrs.hreflang, otherLocale(l));
    assert.equal(lang.attrs.lang, otherLocale(l));
    one(doc, 'id', route, 'main');
    const skips = byTag(doc, 'a').filter((a) => a.attrs.href === '#main');
    assert.ok(skips.length >= 1, `${route} : lien d'évitement vers #main absent`);
  }
});

test('E12.2 : chaque <button> a type="button" et un nom accessible ; chaque lien a un texte visible ; aucun tabindex positif', () => {
  // E12.2 : mutations « bouton sans type », « tabindex="1" sur le CV ».
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    homeRoot(route);
    const problems: string[] = [];
    for (const b of byTag(doc, 'button')) {
      if (b.attrs.type !== 'button') problems.push(`<button> sans type="button" : ${JSON.stringify(b.attrs)}`);
      const name = (b.attrs['aria-label'] ?? '').trim() || textOf(b);
      if (!name) problems.push(`<button> sans nom accessible : ${JSON.stringify(b.attrs)}`);
    }
    for (const a of byTag(doc, 'a').filter((x) => has(x, 'href'))) if (!textOf(a)) problems.push(`lien sans texte visible : ${a.attrs.href}`);
    for (const n of docOrder(doc)) if (has(n, 'tabindex') && Number(n.attrs.tabindex) > 0) problems.push(`tabindex positif sur <${n.tag}> : ${n.attrs.tabindex}`);
    assert.deepEqual(problems, [], `${route} :\n${problems.join('\n')}`);
  }
});

test('E12.2 : aucun élément focalisable n\'a d\'ancêtre hidden ou inert, hors de [data-tree-ui] et des fiches (masqués à dessein)', () => {
  // E12.2 : les deux seules zones masquées attendues du HTML exporté.
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    one(doc, 'data-tree-ui', route);
    const bad: string[] = [];
    for (const n of docOrder(doc).filter(FOCUSABLE)) {
      const hiders = [n, ...ancestors(n)].filter((a) => has(a, 'hidden') || has(a, 'inert'));
      const unexpected = hiders.filter((a) => !has(a, 'data-tree-ui') && !(a.tag === 'article' && has(a, 'data-card')));
      const covered = hiders.length > 0 && ancestors(n).some((a) => has(a, 'data-tree-ui'));
      if (unexpected.length > 0 && !covered) bad.push(`<${n.tag} ${JSON.stringify(n.attrs).slice(0, 80)}> sous ${unexpected.map((a) => `<${a.tag}${has(a, 'hidden') ? ' hidden' : ''}${has(a, 'inert') ? ' inert' : ''}>`).join(', ')}`);
    }
    assert.deepEqual(bad, [], `${route} :\n${bad.join('\n')}`);
  }
});

test('E12.10 : chaque sélecteur :hover de la portée de l\'accueil est dans un @media (hover: hover) and (pointer: fine)', () => {
  // E12.10 : mutation « :hover hors média ».
  homeRoot('/');
  const bad = exportCss().rules
    .filter(inHomeScope)
    .filter((r) => r.selectors.some((s) => s.includes(':hover')))
    .filter((r) => !(r.media && /hover\s*:\s*hover/.test(r.media) && /pointer\s*:\s*fine/.test(r.media)));
  assert.deepEqual(bad.map((r) => `${r.media ? `@media ${r.media} ` : ''}${r.selector}`), [], ':hover hors de @media (hover: hover) and (pointer: fine)');
});
