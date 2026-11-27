// Tour Z, Z4 (tmp/refonte-arbre/contrat-textes-z.md ; décision d'Arnaud du 25/11/2026), page Compétences :
// - « Écrivez-moi et je vous envoie la version avec un téléphone. » / « Write to me and I will send the version with a
//   phone number. » est retirée partout ; la note garde la seule phrase de disponibilité (s1-note-cv.test.ts l'exige à
//   l'octet dans content/skills.ts) ;
// - introduction : « … pour qu'une personne comme une machine puisse les lire. » / « … so a person or a machine can read
//   them. », dans le texte, les méta-descriptions et la ligne de llms.txt qui la reprend ; l'ancienne forme nulle part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageContent, readRoute } from './helpers-4.ts';
import type { Lang } from './helpers-4.ts';
import { assertDistExists, distDir, siteDir } from './helpers.ts';
import { availability } from '../content/experiences.ts';
import { Z4, Z4_OLD_INTRO, Z4_REMOVED, hits, norm, publicCorpus, scan } from './helpers-z.ts';

const LANGS: Lang[] = ['fr', 'en'];
const SKILLS: Record<Lang, string> = { fr: '/fr/skills/', en: '/skills/' };
const n = (s: string): string => norm(s).trim();
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir})`);
  return html;
};
const metas = (html: string, k: string): string[] => [...html.matchAll(new RegExp(`<meta\\b[^>]*(?:name|property)="${k}"[^>]*content="([^"]*)"`, 'g'))].map((m) => n(m[1] as string));

export function skillsErrors(route: string, html: string, l: Lang): string[] {
  const out: string[] = [];
  const lines = pageContent(route, html).text.split('\n').map(n);
  if (!lines.includes(n(Z4.intro[l]))) out.push(`${route} : introduction « ${Z4.intro[l]} » absente (ligne seule)`);
  const note = n(`${availability[l]}.`);
  if (!lines.includes(note)) out.push(`${route} : note « ${note} » absente (ligne seule) ; rendue : « ${lines.find((x) => x.startsWith(note.slice(0, 20))) ?? '(aucune)'} »`);
  for (const k of ['description', 'og:description', 'twitter:description']) if (JSON.stringify(metas(html, k)) !== JSON.stringify([n(Z4.intro[l])])) out.push(`${route} : ${k} = ${JSON.stringify(metas(html, k))}`);
  for (const h of hits(html, [...Z4_REMOVED, ...Z4_OLD_INTRO])) out.push(`${route} : ${h}`);
  return out;
}

test('Z4 : Compétences : introduction « puisse les lire » / « can read them » (texte et méta-descriptions), note réduite à la disponibilité', () => {
  assertDistExists();
  const errors = LANGS.flatMap((l) => skillsErrors(SKILLS[l], page(SKILLS[l]), l));
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z4 : llms.txt reprend l\'introduction nouvelle, une fois par langue', () => {
  const t = n(readFileSync(join(siteDir, 'public', 'llms.txt'), 'utf8'));
  const errors = LANGS.filter((l) => t.split(n(Z4.intro[l])).length - 1 !== 1).map((l) => `llms.txt : introduction ${l} trouvée ${t.split(n(Z4.intro[l])).length - 1} fois (1 attendue)`);
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z4 : la phrase « Écrivez-moi… téléphone » / « Write to me… phone number » et l\'ancienne introduction n\'apparaissent nulle part (export, llms.txt, sources de contenu, CV publics, copies de contenus)', (t) => {
  assertDistExists();
  const { docs, missing } = publicCorpus();
  for (const m of missing) t.diagnostic(`absent ici (dépôt partiel ?) : ${m}`);
  const found = scan(docs, [...Z4_REMOVED, ...Z4_OLD_INTRO]);
  assert.deepEqual(found, [], found.join('\n'));
});

test('Z4 (témoins) : phrase retirée remise, ancienne introduction, note changée, méta-description ancienne sont vues ; formes voisines permises', () => {
  assertDistExists();
  for (const l of LANGS) {
    const html = page(SKILLS[l]);
    assert.deepEqual(skillsErrors(SKILLS[l], html, l), [], `${SKILLS[l]} : départ du témoin non conforme à Z4`);
    const noteEnd = l === 'fr' ? 'open source.' : 'open-source projects.';
    const muts: [string, string][] = [
      ['phrase retirée remise', html.replace(new RegExp(`(${noteEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(<)`), `$1 ${Z4.removed[l]}$2`)],
      ['ancienne introduction dans le texte', html.replace(/<main\b[\s\S]*?<\/main>/, (m) => m.replace(l === 'fr' ? 'puisse les lire.' : 'can read them.', l === 'fr' ? 'puisse la lire.' : 'can read it.'))],
      ['ancienne méta-description', html.replace(/(<meta\b[^>]*name="description"[^>]*content="[^"]*?)(puisse les lire|can read them)/, (_m, a: string, b: string) => a + (b.startsWith('puisse') ? 'puisse la lire' : 'can read it'))],
    ];
    for (const [label, m] of muts) {
      assert.notEqual(m, html, `témoin « ${label} » (${l}) sans effet`);
      assert.ok(skillsErrors(SKILLS[l], m, l).length > 0, `« ${label} » (${l}) non vu`);
    }
  }
  for (const s of ['Écrivez-moi et je vous envoie la version avec un téléphone.', 'Ecrivez moi et je vous envoie la version avec un telephone', 'Write to me and I will send the version with a phone number.', 'une machine puisse la lire', 'so a person or a machine can read it.']) assert.ok(hits(s, [...Z4_REMOVED, ...Z4_OLD_INTRO]).length > 0, `« ${s} » non vu`);
  for (const s of [Z4.intro.fr, Z4.intro.en, 'C’est la version publique, sans mon numéro de téléphone.', 'This is the public copy, without my phone number.', 'Écrivez-moi']) assert.deepEqual(hits(s, [...Z4_REMOVED, ...Z4_OLD_INTRO]), [], `faux positif « ${s} »`);
});
