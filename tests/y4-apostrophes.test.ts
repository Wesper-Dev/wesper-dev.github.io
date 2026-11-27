// Tour Y, Y4 (constat 7, mesures M2) : plus aucune apostrophe droite U+0027 entre deux lettres dans le texte rendu des 21
// pages, les titres, méta-données, attributs textuels (alt, aria-label, title), JSON-LD, étiquettes et infobulles de
// l'arbre et llms.txt : U+2019 partout. Changement typographique, pas de texte : le nombre d'apostrophes entre deux
// lettres (droites et courbes confondues) de chaque page et de llms.txt reste celui du départ f43e1cf (aucune supprimée).
// Hors champ : le code (<code>, <pre>) et FAITS.md, qui n'est pas modifié.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { CURLY_RE, STRAIGHT_RE, around, countRe, pageTextSites, pages21, readDepartY } from './helpers-y.ts';
import type { TextSite } from './helpers-y.ts';
import { distDir, siteDir } from './helpers.ts';

const straightIn = (sites: TextSite[], route: string): string[] => sites.flatMap((t) => [...t.text.matchAll(STRAIGHT_RE)].map((m) => `${route} ${t.where} : « …${around(t.text, m.index ?? 0)}… »`));

test('Y4 : aucune apostrophe droite entre deux lettres sur les 21 pages (texte, <title>, méta-données, alt, aria-label, title, JSON-LD)', () => {
  const errs = pages21().flatMap((r) => straightIn(pageTextSites(r), r));
  assert.deepEqual(errs, [], `contrat-recette-y.md, Y4 (U+2019 attendue) :\n${errs.slice(0, 40).join('\n')}${errs.length > 40 ? `\n… ${errs.length - 40} de plus` : ''}`);
});

// Tour W (contrat-relecture-w.md) : écarts nommés, un par mot retiré ou ajouté par le contrat, rien d'autre.
// C2 : « jusqu’en mai 2025 » retiré (rôle Croix-Rouge sur /fr/, /fr/projects/, /fr/projects/croix-rouge/ ; récit
// Croix-Rouge FR) ; B1 : « avant d’arriver sur main » retiré (/fr/skills/) ; A8 : « the team’s work » (récit
// droit-de-retard EN).
const W_APOSTROPHES: Readonly<Record<string, number>> = { '/fr/': -1, '/fr/projects/': -1, '/fr/projects/croix-rouge/': -2, '/fr/skills/': -1, '/projects/droit-de-retard/': 1 };

test('Y4 : chaque page garde le nombre d\'apostrophes entre deux lettres du départ (droites et courbes confondues : aucune supprimée)', () => {
  const dep = readDepartY();
  const errs: string[] = [];
  for (const r of pages21()) {
    const n = pageTextSites(r).reduce((k, t) => k + countRe(t.text, STRAIGHT_RE) + countRe(t.text, CURLY_RE), 0);
    const want = (dep.apostrophes[r] as number) + (W_APOSTROPHES[r] ?? 0);
    if (n !== want) errs.push(`${r} : ${n} apostrophes entre deux lettres, ${want} attendues (${dep.apostrophes[r]} au départ, écart W ${W_APOSTROPHES[r] ?? 0})`);
  }
  assert.deepEqual(errs, [], errs.join('\n'));
  assert.ok(Object.values(dep.apostrophes).reduce((a, b) => a + b, 0) >= 250, 'référence de départ trop maigre (vert à vide ?)');
});

test('Y4 : llms.txt (source et export) sans apostrophe droite entre deux lettres, même nombre d\'apostrophes qu\'au départ', () => {
  const dep = readDepartY();
  for (const f of [join(siteDir, 'public', 'llms.txt'), join(distDir, 'llms.txt')]) {
    const t = readFileSync(f, 'utf8');
    const bad = [...t.matchAll(STRAIGHT_RE)].map((m) => `« …${around(t, m.index ?? 0)}… »`);
    assert.deepEqual(bad, [], `${f} : apostrophe droite (Y4)`);
    assert.equal(countRe(t, CURLY_RE), dep.llmsApostrophes, `${f} : ${countRe(t, CURLY_RE)} apostrophes courbes entre deux lettres, ${dep.llmsApostrophes} au départ`);
  }
});

// Modules de contenu lus tels quels (import direct, sans les chargeurs untypo des anciens tests) : toutes les chaînes,
// y compris celles que la scène rend en JavaScript (étiquettes, infobulles et fiches des compétences de content/tree.ts).
const MODULES = ['content/tree.ts', 'content/tree-ui.ts', 'content/home-ui.ts', 'content/cards.ts', 'content/experiences.ts', 'content/home.ts', 'content/skills.ts'];
function strings(x: unknown, path: string, seen = new Set<unknown>()): [string, string][] {
  if (typeof x === 'string') return [[path, x]];
  if (typeof x === 'function') return [];
  if (!x || typeof x !== 'object' || seen.has(x)) return [];
  seen.add(x);
  return Object.entries(x as Record<string, unknown>).flatMap(([k, v]) => strings(v, `${path}.${k}`, seen));
}
test('Y4 : chaînes des modules de contenu (étiquettes et infobulles de l\'arbre comprises) sans apostrophe droite entre deux lettres', async () => {
  const errs: string[] = [];
  let curly = 0;
  for (const rel of MODULES) {
    const mod = await import(pathToFileURL(join(siteDir, rel)).href);
    for (const [p, s] of strings(mod, rel)) {
      for (const m of s.matchAll(STRAIGHT_RE)) errs.push(`${p} : « …${around(s, m.index ?? 0)}… »`);
      curly += countRe(s, CURLY_RE);
    }
  }
  assert.deepEqual(errs, [], `contrat-recette-y.md, Y4 :\n${errs.join('\n')}`);
  assert.ok(curly >= 20, `${curly} apostrophes courbes dans les modules de contenu (vert à vide ?)`);
});

test('Y4 (témoins) : une apostrophe droite dans le texte, un alt, une méta-donnée ou le JSON-LD est repérée ; la courbe passe', () => {
  const site = (text: string): TextSite[] => [{ where: 'témoin', text }];
  assert.equal(straightIn(site("j'ai développé"), 't').length, 1);
  assert.equal(straightIn(site('j’ai développé'), 't').length, 0);
  assert.equal(straightIn(site("tool's comments"), 't').length, 1);
  assert.equal(straightIn(site("'citation' et 1'2"), 't').length, 0, 'guillemet simple hors mot ou entre chiffres : hors Y4');
  const r = '/fr/experiences/bnp-paribas/';
  const sites = pageTextSites(r);
  assert.ok(sites.some((t) => t.where.startsWith('<meta description')), 'méta-description non lue');
  assert.ok(sites.some((t) => t.where === '<title>'), '<title> non lu');
  assert.ok(pageTextSites('/fr/projects/droit-de-retard/').some((t) => t.where.endsWith('[alt]')), 'alt non lu');
  assert.ok(pageTextSites('/fr/').some((t) => t.where === 'JSON-LD'), 'JSON-LD non lu');
  assert.ok(pageTextSites('/fr/').some((t) => t.where.endsWith('[aria-label]')), 'aria-label non lu');
});
