// Lot 4, décision S3 du propriétaire (tmp/refonte-arbre/contrat-lot4-s.md) : texte alternatif de l'image de partage
// par défaut (og:image:alt) : FR « Arnaud Durand, ingénieur logiciel » ; EN « Arnaud Durand, Software Engineer ».
// L'alt de la carte droit-de-retard ne change pas ; la 404 reste sans métadonnée de partage.
// Lecture retenue : les littéraux du contrat, à l'octet après réduction des blancs (en français, « ingénieur » en
// minuscule : ce n'est PAS jobTitle.fr « Ingénieur logiciel »). Une seule balise og:image:alt par page. Le contrat ne
// demande pas de twitter:image:alt ; Q3 refuserait une métadonnée twitter:* nouvelle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headMeta } from './helpers-2b.ts';
import { ALL_PAGES, NOT_FOUND, OWN_SHARE_IMAGE, langOf, readRoute } from './helpers-4.ts';
import type { Lang } from './helpers-4.ts';
import { assertDistExists, distDir } from './helpers.ts';

export const S3_ALT: Record<Lang, string> = { fr: 'Arnaud Durand, ingénieur logiciel', en: 'Arnaud Durand, Software Engineer' };
// Tour W (contrat-relecture-w.md, W2) : graphie « droit-de-retard » dans l'alt de la carte du récit (exceptions
// W2-ddr-og-alt-en et W2-ddr-og-alt-fr) ; le reste de l'alt est inchangé.
const OWN_ALT: Record<Lang, string> = { en: 'droit-de-retard: prototype preview', fr: 'droit-de-retard : aperçu du prototype' };
const ws = (s: string): string => s.replace(/\s+/g, ' ').trim();

function altErrors(route: string, html: string): string[] {
  const alts = headMeta(html).metas.get('og:image:alt') ?? [];
  if (route === NOT_FOUND) return alts.length ? [`${route} : og:image:alt ${JSON.stringify(alts)} (aucune métadonnée de partage sur la 404, Q3)`] : [];
  const want = OWN_SHARE_IMAGE.includes(route) ? OWN_ALT[langOf(route)] : S3_ALT[langOf(route)];
  if (alts.length !== 1 || ws(alts[0] as string) !== want) return [`${route} : og:image:alt ${JSON.stringify(alts)} ; « ${want} » attendu${OWN_SHARE_IMAGE.includes(route) ? ' (carte du récit inchangée)' : ' (S3)'}`];
  return [];
}

test('S3 : og:image:alt = « Arnaud Durand, ingénieur logiciel » sur les 9 pages FR et « Arnaud Durand, Software Engineer » sur les 9 pages EN à image par défaut ; droit-de-retard inchangé ; 404 sans alt', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of ALL_PAGES) {
    const html = readRoute(distDir, route);
    if (!html) errors.push(`${route} absente de l'export`);
    else errors.push(...altErrors(route, html));
  }
  assert.deepEqual(errors, [], `lot 4, S3\n${errors.join('\n')}`);
});

test('S3 (témoins) : alt conforme accepté ; ancien alt, majuscule de jobTitle, alt de l\'autre langue, deux balises, alt nouveau sur droit-de-retard ou sur la 404 rougissent', () => {
  const meta = (v: string): string => `<meta property="og:image:alt" content="${v}"/>`;
  const tag = (v: string): string => `<head>${meta(v)}</head>`;
  assert.deepEqual(altErrors('/fr/projects/', tag(S3_ALT.fr)), []);
  assert.deepEqual(altErrors('/', tag(S3_ALT.en)), []);
  assert.deepEqual(altErrors('/projects/droit-de-retard/', tag(OWN_ALT.en)), []);
  assert.deepEqual(altErrors(NOT_FOUND, '<head></head>'), []);
  const muts: [string, string, string][] = [
    ['ancien alt FR', '/fr/skills/', tag('Arnaud Durand | IA, systèmes, projets')],
    ['ancien alt EN', '/', tag('Arnaud Durand | AI, Systems, Projects')],
    ['« Ingénieur » avec majuscule (jobTitle.fr)', '/fr/', tag('Arnaud Durand, Ingénieur logiciel')],
    ['alt EN sur une page FR', '/fr/hackathons/', tag(S3_ALT.en)],
    ['alt FR sur une page EN', '/hackathons/', tag(S3_ALT.fr)],
    ['deux balises', '/projects/', `<head>${meta(S3_ALT.en)}${meta(S3_ALT.en)}</head>`],
    ['alt nouveau sur droit-de-retard', '/fr/projects/droit-de-retard/', tag(S3_ALT.fr)],
    ['alt sur la 404', NOT_FOUND, tag(S3_ALT.en)],
  ];
  for (const [label, route, html] of muts) assert.ok(altErrors(route, html).length > 0, `« ${label} » non détecté`);
});
