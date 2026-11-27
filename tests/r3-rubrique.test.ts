// Lot 4, corrections d'audit, R3 (tmp/refonte-arbre/arbitrage-audit-lot4.md ; audit C3) : sur Projets, Hackathons et
// Compétences (FR et EN), le lien d'en-tête dont le href est la page elle-même porte aria-current="page" ; rien sur
// les récits, les expériences, la 404 ni l'accueil (Q2 inchangé : sur l'accueil, seul le nom le porte).
// Partie statique. La marque visible (soulignement d'accent, contraste ≥ 3:1) est mesurée dans
// tmp/refonte-arbre/verif-4/verif.mjs (R3.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ROUTES_4, LOT4_PAGES, readRoute } from './helpers-4.ts';
import { RUBRIC_ROUTES } from './helpers-r.ts';
import { assertDistExists, distDir } from './helpers.ts';
import { docOrder, parseHtml, textOf } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (R3)`);
  return html;
};
const describe = (n: HNode): string => `<${n.tag}${Object.keys(n.attrs).filter((a) => a.startsWith('data-site')).map((a) => ` ${a}${n.attrs[a] ? `="${n.attrs[a]}"` : ''}`).join('')} href="${n.attrs.href ?? ''}"> « ${textOf(n)} »`;

// Éléments de l'en-tête [data-site-header] qui portent aria-current (quelle que soit sa valeur).
function currentInHeader(html: string): HNode[] {
  const header = docOrder(parseHtml(html)).find((n) => Object.prototype.hasOwnProperty.call(n.attrs, 'data-site-header'));
  if (!header) return [];
  return docOrder(header).filter((n) => n !== header && n.attrs['aria-current'] !== undefined);
}

// Écarts à R3 pour une page.
function r3Errors(route: string, html: string): string[] {
  const cur = currentInHeader(html);
  const out: string[] = [];
  if (RUBRIC_ROUTES.includes(route)) {
    const ok = cur.length === 1 && cur[0]?.tag === 'a' && cur[0].attrs['data-site-link'] !== undefined && cur[0].attrs.href === route && cur[0].attrs['aria-current'] === 'page';
    if (!ok) out.push(`${route} : un seul lien [data-site-link] href="${route}" avec aria-current="page" attendu dans l'en-tête ; trouvé : ${cur.length ? cur.map(describe).join(' ; ') : 'aucun'}`);
  } else if (HOME_ROUTES_4.includes(route)) {
    const bad = cur.filter((n) => !(n.attrs['data-site-name'] !== undefined && n.attrs['aria-current'] === 'page'));
    if (bad.length || cur.length !== 1) out.push(`${route} : sur l'accueil, seul le nom porte aria-current="page" (Q2) ; trouvé : ${cur.map(describe).join(' ; ') || 'aucun'}`);
  } else if (/^(\/fr)?\/projects\/[^/]+\/$/.test(route)) {
    // Tour Y (contrat-recette-y.md, Y6) : sur un récit, la rubrique parente « Projets » porte aria-current="true" ; rien
    // d'autre (y6-rubrique-parente.test.ts l'exige).
    const parent = route.startsWith('/fr/') ? '/fr/projects/' : '/projects/';
    const ok = cur.every((n) => n.tag === 'a' && n.attrs['data-site-link'] === 'projects' && n.attrs.href === parent && n.attrs['aria-current'] === 'true');
    if (!ok || cur.length > 1) out.push(`${route} : dans l'en-tête, au plus « Projets » avec aria-current="true" (Y6) ; trouvé : ${cur.map(describe).join(' ; ')}`);
  } else if (cur.length) out.push(`${route} : aucun aria-current attendu dans l'en-tête (expérience ou 404) ; trouvé : ${cur.map(describe).join(' ; ')}`);
  return out;
}

test('R3 : Projets, Hackathons et Compétences (FR et EN) : le lien d\'en-tête vers la page elle-même porte aria-current="page", et lui seul', () => {
  assertDistExists();
  const errors = RUBRIC_ROUTES.flatMap((r) => r3Errors(r, page(r)));
  assert.deepEqual(errors, [], `lot 4, R3\n${errors.join('\n')}`);
});

test('R3 : rien sur les récits, les expériences et la 404 ; sur l\'accueil, seul le nom (Q2 inchangé)', () => {
  assertDistExists();
  const errors = [...HOME_ROUTES_4, ...LOT4_PAGES.filter((r) => !RUBRIC_ROUTES.includes(r))].flatMap((r) => r3Errors(r, page(r)));
  assert.deepEqual(errors, [], `lot 4, R3\n${errors.join('\n')}`);
});

test('R3 (témoins) : une page de rubrique conforme passe ; un mauvais lien marqué, deux liens marqués, une valeur autre que page, une marque sur un récit ou sur un lien de l\'accueil rougissent', () => {
  assertDistExists();
  const mark = (html: string, link: string, value = 'page'): string => html.replace(new RegExp(`(<a\\b[^>]*data-site-link="${link}")`), `$1 aria-current="${value}"`);
  const strip = (html: string): string => html.replace(/(<header\b[\s\S]*?<\/header>)/i, (h) => h.replace(/\saria-current="[^"]*"/g, ''));
  const skills = strip(page('/fr/skills/'));
  const good = mark(skills, 'skills');
  assert.deepEqual(r3Errors('/fr/skills/', good), [], 'page de rubrique conforme jugée fautive');
  const base = (route: string): string => (route === '/fr/skills/' ? good : page(route));
  const muts: [string, string, string][] = [
    ['aucune marque', '/fr/skills/', skills],
    ['mauvais lien marqué', '/fr/skills/', mark(skills, 'projects')],
    ['deux liens marqués', '/fr/skills/', mark(mark(skills, 'skills'), 'github')],
    ['aria-current="true"', '/fr/skills/', mark(skills, 'skills', 'true')],
    ['marque sur un récit', '/fr/projects/diary/', mark(strip(page('/fr/projects/diary/')), 'projects')],
    ['marque sur l\'accueil', '/fr/', mark(page('/fr/'), 'projects')],
  ];
  for (const [label, route, html] of muts) {
    assert.notEqual(html, base(route), `mutation « ${label} » sans effet`);
    assert.ok(r3Errors(route, html).length > 0, `« ${label} » non détecté`);
  }
});
