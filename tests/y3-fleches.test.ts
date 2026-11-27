// Tour Y, Y3 (constat 6 de la recette visuelle) : « → » pour tout lien interne qui porte une flèche, « ↗ » seulement
// pour une sortie du site, sur les 21 pages ; aucun lien ne gagne ni ne perd de flèche.
// Une flèche compte si elle est dans le texte du lien (span aria-hidden compris) ou dessinée par un ::before / ::after
// de la feuille exportée sur le lien ou l'un de ses descendants ([data-home-more]::after des fiches de l'accueil).
// Sortie du site : http(s) vers une autre origine, ou mailto: ; le reste (chemins du site, ancres, PDF du CV, image du
// récit) est interne. Exceptions nommées : « ← » du lien de retour (.back-link) et « ↑ » de « En haut » (#main), flèches
// de direction que Y3 ne vise pas.
import assert from 'node:assert/strict';
import test from 'node:test';
import { exportCss, parseHtml } from './helpers-home.ts';
import { pageHtml } from './helpers-scene.ts';
import { directionalOk, linkArrows, pages21, pseudoArrows, readDepartY } from './helpers-y.ts';
import type { LinkArrow } from './helpers-y.ts';
import { distDir } from './helpers.ts';

function arrowRuleErrors(links: LinkArrow[]): string[] {
  const out: string[] = [];
  for (const l of links) for (const g of l.glyphs) {
    if (l.exit && g !== '↗') out.push(`${l.route} : sortie ${l.key} « ${l.text} » porte « ${g} » (↗ attendu)`);
    if (!l.exit && g !== '→' && !directionalOk(l, g)) out.push(`${l.route} : lien interne ${l.key} « ${l.text} » porte « ${g} » (→ attendu)`);
  }
  return out;
}
function censusErrors(route: string, links: LinkArrow[], depart: [string, number][]): string[] {
  const now = links.map((l): [string, number] => [l.key, l.glyphs.length]);
  const tally = (xs: [string, number][]): Map<string, number> => { const m = new Map<string, number>(); for (const [k, n] of xs) { const id = `${k} ${n ? 'avec' : 'sans'} flèche`; m.set(id, (m.get(id) ?? 0) + 1); } return m; };
  const a = tally(depart), b = tally(now);
  const out: string[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) if ((a.get(id) ?? 0) !== (b.get(id) ?? 0)) out.push(`${route} : ${id} : ${a.get(id) ?? 0} au départ, ${b.get(id) ?? 0} maintenant`);
  for (const l of links) if (l.glyphs.length > 1) out.push(`${route} : ${l.key} « ${l.text} » porte ${l.glyphs.length} flèches (${l.glyphs.join(' ')})`);
  return out;
}

test('Y3 : sur les 21 pages, ↗ seulement pour une sortie du site, → pour tout lien interne fléché (← retour et ↑ « En haut » exceptés)', () => {
  const pseudo = pseudoArrows(exportCss().rules);
  const errs = pages21().flatMap((r) => arrowRuleErrors(linkArrows(r, distDir, pseudo)));
  assert.deepEqual(errs, [], `contrat-recette-y.md, Y3 :\n${errs.join('\n')}`);
});

test('Y3 : aucun lien ne gagne ni ne perd de flèche (recensement de départ f43e1cf, liens comptés par adresse)', () => {
  const dep = readDepartY();
  const pseudo = pseudoArrows(exportCss().rules);
  assert.deepEqual(Object.keys(dep.fleches).sort(), pages21().sort(), 'référence de départ incomplète');
  const errs = pages21().flatMap((r) => censusErrors(r, linkArrows(r, distDir, pseudo), dep.fleches[r] ?? []));
  assert.deepEqual(errs, [], `contrat-recette-y.md, Y3 :\n${errs.join('\n')}`);
  const total = Object.values(dep.fleches).flat().filter(([, n]) => n > 0).length;
  assert.ok(total >= 150, `recensement de départ : ${total} liens fléchés seulement (vert à vide ?)`);
});

test('Y3 (témoins) : ↗ sur un lien interne, → sur une sortie, flèche ajoutée, retirée ou doublée, ::after en ↗ sont refusés ; ← et ↑ admis', () => {
  const pseudo = pseudoArrows(exportCss().rules);
  const route = '/fr/projects/diary/';
  const html = pageHtml(route);
  const run = (h: string, ps = pseudo): { rule: string[]; census: string[] } => {
    const links = linkArrows(route, distDir, ps, parseHtml(h));
    return { rule: arrowRuleErrors(links), census: censusErrors(route, links, readDepartY().fleches[route] ?? []) };
  };
  // Le témoin part de l'export du dépôt : il ne vaut que si ses liens internes sont déjà en « → » ; sinon (départ), on
  // remet d'abord la page conforme à la main.
  const conform = html.replace(/(<a [^>]*href="\/[^"]*"[^>]*>(?:(?!<\/a>)[\s\S])*?)↗/g, '$1→');
  const ok = run(conform);
  assert.deepEqual(ok.rule, [], `témoin à blanc : la page conforme doit passer (${ok.rule.join(' ; ')})`);
  const mutate = (from: RegExp, to: string): string => { const h = conform.replace(from, to); assert.notEqual(h, conform, `mutation sans effet : ${from}`); return h; };
  assert.ok(run(mutate(/(href="\/fr\/projects\/croix-rouge\/"[^>]*>(?:(?!<\/a>)[\s\S])*?)→/, '$1↗')).rule.some((e) => e.includes('→ attendu')), '↗ sur un lien interne accepté');
  assert.ok(run(mutate(/(href="https:\/\/github\.com\/Wesper-Dev\/Diary"[^>]*>(?:(?!<\/a>)[\s\S])*?)↗/, '$1→')).rule.some((e) => e.includes('↗ attendu')), '→ sur une sortie accepté');
  assert.ok(run(mutate(/(<a [^>]*class="back-link"[^>]*>)← /, '$1')).census.length > 0, 'flèche retirée acceptée');
  assert.ok(run(mutate(/(<a data-site-link="projects"[^>]*>[^<]*)/, '$1 →')).census.length > 0, 'flèche ajoutée acceptée');
  assert.ok(run(mutate(/(href="\/fr\/projects\/croix-rouge\/"[^>]*>(?:(?!<\/a>)[\s\S])*?)→/, '$1→→')).census.some((e) => e.includes('2 flèches')), 'flèche doublée acceptée');
  assert.deepEqual(run(conform).rule.filter((e) => /[←↑]/.test(e)), [], '← ou ↑ refusés à tort');
  const home = linkArrows('/fr/', distDir, [{ base: '[data-home-more]', glyphs: ['↗'], media: null, selector: '[data-home-more]::after' }]);
  assert.ok(arrowRuleErrors(home.filter((l) => /data-home-more/.test(pageHtml('/fr/')) && l.text.includes('Lire le récit'))).length > 0, '::after en ↗ sur « Lire le récit » accepté');
});
