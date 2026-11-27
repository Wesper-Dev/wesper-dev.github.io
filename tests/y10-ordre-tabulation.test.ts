// Tour Y, Y10 (constat 11) : sur l'accueil, l'ordre de tabulation suit l'ordre visuel : les entrées de gauche (liste
// des expériences de l'arbre, ou liste dessinée de secours tant que la scène n'est pas prête), puis le texte BNP et son
// lien « Lire le cas BNP Paribas ». Statique : dans l'accueil exporté (FR et EN), sans tabindex positif, le lien
// [data-tree-case] vient après chaque bouton [data-experience] et chaque lien de la liste de secours. Le parcours réel au
// clavier (1440, 1280, 1024 souris, sans JavaScript) et la clause du canevas (arrêt de tabulation seulement s'il a une
// action clavier) : verif-7, Y10.
import assert from 'node:assert/strict';
import test from 'node:test';
import { byAttr, docOrder, parseHtml } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';
import { pageHtml } from './helpers-scene.ts';
import { HOMES_Y, bodyY, docY } from './helpers-y.ts';

function orderErrors(route: string, doc: HNode): string[] {
  const hero = byAttr(bodyY(doc), 'data-tree-hero')[0];
  if (!hero) return [`${route} : pas de [data-tree-hero]`];
  const order = docOrder(hero);
  const at = (n: HNode): number => order.indexOf(n);
  const cases = order.filter((n) => n.attrs['data-tree-case'] !== undefined);
  const entries = order.filter((n) => n.attrs['data-experience'] !== undefined || (n.tag === 'a' && /\btree-fallback-name\b/.test(n.attrs.class ?? '')));
  const errs: string[] = [];
  if (cases.length !== 1) errs.push(`${route} : ${cases.length} lien(s) [data-tree-case]`);
  if (entries.filter((n) => n.attrs['data-experience'] !== undefined).length < 5) errs.push(`${route} : moins de 5 entrées [data-experience] (vert à vide ?)`);
  if (entries.filter((n) => n.tag === 'a').length < 3) errs.push(`${route} : moins de 3 liens dans la liste de secours (vert à vide ?)`);
  for (const c of cases) for (const e of entries) if (at(e) > at(c)) errs.push(`${route} : « ${e.attrs['data-experience'] ?? e.attrs.href} » vient après le lien du cas BNP dans l'ordre du document`);
  for (const n of docOrder(bodyY(doc))) if (Number(n.attrs.tabindex) > 0) errs.push(`${route} : tabindex="${n.attrs.tabindex}" sur <${n.tag}> (ordre de tabulation forcé)`);
  return errs;
}

test('Y10 : dans l\'accueil exporté, les entrées de gauche viennent avant le texte BNP et son lien, sans tabindex positif', () => {
  const errs = HOMES_Y.flatMap((r) => orderErrors(r, docY(r)));
  assert.deepEqual(errs, [], `contrat-recette-y.md, Y10 :\n${errs.join('\n')}`);
});

test('Y10 (témoins) : bloc BNP avant la scène refusé, après accepté, tabindex positif refusé', () => {
  const html = pageHtml('/fr/');
  const copy = /<div[^>]*data-tree-copy[^>]*>[\s\S]*?<\/div>/.exec(html)?.[0];
  assert.ok(copy, 'bloc [data-tree-copy] introuvable dans l\'accueil exporté');
  const without = html.replace(copy, '');
  const stageEnd = without.indexOf('</section>', without.indexOf('data-tree-hero'));
  const after = without.slice(0, stageEnd) + copy + without.slice(stageEnd);
  const before = without.replace(/(<section[^>]*data-tree-hero[^>]*>)/, `$1${copy}`);
  assert.deepEqual(orderErrors('témoin après', parseHtml(after)), [], 'bloc BNP en fin de section refusé à tort');
  assert.ok(orderErrors('témoin avant', parseHtml(before)).some((e) => e.includes('vient après')), 'bloc BNP avant la scène accepté');
  assert.ok(orderErrors('témoin tabindex', parseHtml(after.replace(/<a([^>]*data-tree-case)/, '<a tabindex="1"$1'))).some((e) => e.includes('tabindex')), 'tabindex positif accepté');
});
