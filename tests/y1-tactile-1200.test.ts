// Tour Y, Y1 (constat 1 de la recette visuelle) : sous 1200 px, l'accueil prend la mise en page tactile de l'arbre
// (grand arbre sans étiquettes de texte au repos, entrées dans un bandeau), quel que soit le pointeur ; à 1200 px et plus
// avec un pointeur fin, rien ne change ; au toucher, rien ne change (390 et 1440 tactiles restent en profil tactile).
// Statique : (1) les règles CSS du profil tactile de l'arbre (bloc « (max-width:760px),(pointer:coarse) » au départ, 33
// règles) s'appliquent à 768, 1024, 1100 et 1199 px souris et pas à 1200, 1280, 1440 px souris ; (2) les requêtes
// matchMedia du même profil dans le code de la scène, des étiquettes et de l'îlot (sources et JS exporté) ont la même
// réponse que la feuille. Le rendu (étiquettes, bandeau, carte, clavier, redimensionnement) : verif-7, Y1.
// Hors Y1 : le profil de montage (chooseProfile, nombre de points) et le menu du téléphone (max-width: 760px seul).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { mediaMatches } from './helpers-cascade.ts';
import type { Env } from './helpers-cascade.ts';
import { exportCss } from './helpers-home.ts';
import { distDir, siteDir } from './helpers.ts';

const mouse = (width: number): Env => ({ width, hover: true, pointer: 'fine', reducedMotion: false });
const touch = (width: number): Env => ({ width, hover: false, pointer: 'coarse', reducedMotion: false });
const TACTILE: readonly Env[] = [mouse(768), mouse(1024), mouse(1100), mouse(1199), touch(390), touch(768), touch(1440)];
const BUREAU: readonly Env[] = [mouse(1200), mouse(1280), mouse(1440)];
const label = (e: Env): string => `${e.width} px ${e.pointer === 'fine' ? 'souris' : 'tactile'}`;
// Une requête est celle du profil tactile si elle unit une largeur maximale et le pointeur grossier, sans exiger le
// survol (le « (pointer: coarse) » seul du profil de montage, chooseProfile, n'en est pas une).
const isTouchProfile = (q: string): boolean => /max-width/.test(q) && /pointer\s*:\s*coarse/.test(q) && !/hover\s*:\s*hover/.test(q);
function profileErrors(q: string, where: string): string[] {
  const errs: string[] = [];
  const norm = q.replace(/\s+/g, '').replace(/,/g, ', ').replace(/\)and\(/g, ') and (');
  for (const e of TACTILE) if (!mediaMatches(norm, e)) errs.push(`${where} « ${q} » : fausse à ${label(e)} (mise en page tactile attendue)`);
  for (const e of BUREAU) if (mediaMatches(norm, e)) errs.push(`${where} « ${q} » : vraie à ${label(e)} (bureau inchangé attendu)`);
  return errs;
}

test('Y1 : les règles du profil tactile de l\'arbre s\'appliquent sous 1200 px quel que soit le pointeur, pas à 1200 px et plus à la souris', () => {
  const rules = exportCss().rules.filter((r) => r.media && isTouchProfile(r.media));
  assert.ok(rules.length >= 33, `${rules.length} règles du profil tactile dans la feuille exportée (33 au départ : bloc perdu ?)`);
  const sel = rules.flatMap((r) => r.selectors).join(' ');
  for (const s of ['.tree-experiences', '.tree-label-text', '.tree-copy', '.tree-card']) assert.ok(sel.includes(s), `profil tactile sans règle pour ${s}`);
  const errs = [...new Set(rules.map((r) => r.media as string))].flatMap((m) => profileErrors(m, '@media'));
  assert.deepEqual(errs, [], `contrat-recette-y.md, Y1 :\n${errs.join('\n')}`);
});

const walk = (dir: string, ext: RegExp): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name), ext) : ext.test(d.name) ? [join(dir, d.name)] : []));
const QUERY_RE = /matchMedia\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g;
function jsQueries(files: string[]): { file: string; q: string }[] {
  return files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(QUERY_RE)].map((m) => ({ file: f, q: m[1] as string })));
}

test('Y1 : les requêtes matchMedia du profil tactile (scène, étiquettes, îlot ; sources et JS exporté) disent la même chose que la feuille', () => {
  const src = jsQueries(['lib', 'components', 'app'].flatMap((d) => walk(join(siteDir, d), /\.(ts|tsx)$/))).filter((x) => isTouchProfile(x.q));
  const files = new Set(src.map((x) => x.file.slice(siteDir.length + 1)));
  for (const f of ['lib/tree/scene.ts', 'lib/tree/labels-dom.ts', 'components/tree/TreeIsland.tsx']) assert.ok(files.has(f), `${f} : plus de requête du profil tactile (mise en page de la scène, texte des étiquettes, bloc du bas)`);
  const dist = jsQueries(walk(join(distDir, '_next', 'static'), /\.js$/)).filter((x) => isTouchProfile(x.q));
  assert.ok(dist.length >= 3, `${dist.length} requête(s) du profil tactile dans le JS exporté (3 au départ)`);
  const errs = [...src, ...dist].flatMap((x) => profileErrors(x.q, x.file.startsWith(distDir) ? x.file.slice(distDir.length + 1) : x.file.slice(siteDir.length + 1)));
  assert.deepEqual([...new Set(errs)], [], `contrat-recette-y.md, Y1 :\n${[...new Set(errs)].join('\n')}`);
});

test('Y1 (témoins) : 760 ou pointeur grossier est refusé, 1199 ou pointeur grossier passe, une requête de survol n\'est pas le profil', () => {
  assert.ok(profileErrors('(max-width:760px),(pointer:coarse)', 't').length > 0);
  assert.deepEqual(profileErrors('(max-width: 1199px), (pointer: coarse)', 't'), []);
  assert.deepEqual(profileErrors('(max-width:1199.98px),(pointer:coarse)', 't'), []);
  assert.ok(profileErrors('(max-width:1200px),(pointer:coarse)', 't').length > 0, '1200 px souris doit rester au bureau');
  assert.ok(profileErrors('(max-width:1199px)', 't').length > 0, '1440 tactile doit rester tactile');
  assert.equal(isTouchProfile('(hover: hover) and (pointer: fine)'), false);
  assert.equal(isTouchProfile('(pointer: coarse)'), false, 'profil de montage pris pour le profil tactile');
  assert.equal(isTouchProfile('(max-width:760px),(pointer:coarse)'), true);
});
