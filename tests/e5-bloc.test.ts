// Contrat E5.4 (statique) et E5.5 (contenu du repli) du lot 2a. Géométrie, états et fondus : scénarios [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readManifest } from './helpers.ts';
import { filesUnder, readSrc } from './helpers-scene.ts';
import { HOME_ROUTES, byAttr, byTag, has, homeDoc, homeMods, localeOf, one, prefixOf, textOf } from './helpers-home.ts';

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SEP = '[\\s,;·•|/–—\\-]*';

test('E5.5 : le repli donne, pour chaque expérience dans l\'ordre, le nom, le résultat de sa fiche, puis les libellés de litSkills, et rien d\'autre', async () => {
  // E5.5 / D4.1 étendu : mutation « résultat absent du repli ».
  const { EXPERIENCES, litSkills, skillLabel } = await homeMods.tree();
  const { EXPERIENCE_CARDS } = await homeMods.cards();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const fb = one(homeDoc(route), 'data-tree-fallback', route);
    const text = textOf(fb);
    const pattern = '^' + SEP + (EXPERIENCES as { id: string; name: Record<string, string> }[]).map((e) =>
      escapeRe(e.name[l] ?? '') + SEP + escapeRe(EXPERIENCE_CARDS[e.id][l].result) + SEP + (litSkills(e.id) as string[]).map((s) => escapeRe(skillLabel(s, l) as string)).join(SEP) + SEP,
    ).join('') + '$';
    assert.match(text, new RegExp(pattern, 'u'), `${route} : repli attendu « nom, résultat, libellés » par expérience. Reçu : « ${text} »`);
  }
});

test('E5.5 / E7.1 : liens du repli = pagePath(l, href) des seules expériences publiées dans routes.json, sur leur nom', async () => {
  // E5.5 : mutation « lien BPCE ajouté ».
  const { EXPERIENCES } = await homeMods.tree();
  const paths = new Set(readManifest().paths);
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const fb = one(homeDoc(route), 'data-tree-fallback', route);
    const want = (EXPERIENCES as { href: string; name: Record<string, string> }[]).filter((e) => paths.has(e.href)).map((e) => ({ href: prefixOf(l) + e.href, text: e.name[l] }));
    const got = byTag(fb, 'a').map((a) => ({ href: a.attrs.href, text: textOf(a) }));
    assert.deepEqual(got, want, `${route} : liens du repli (nom de l'expérience, cible de la langue)`);
    for (const a of byTag(fb, 'a')) assert.equal(a.attrs.target, undefined, `${route} : lien du repli sans target`);
    assert.equal(byTag(fb, 'button').length, 0, `${route} : aucun bouton dans le repli`);
  }
});

test('E5.4 : dans le HTML exporté, [data-tree-ui] (liste et fiches) porte hidden et inert, et le repli est hors de [data-tree-ui]', () => {
  // E5.4 : état html.
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const ui = one(doc, 'data-tree-ui', route);
    assert.ok(has(ui, 'hidden') && has(ui, 'inert'), `${route} : [data-tree-ui] sans hidden ou inert`);
    assert.equal(byAttr(ui, 'data-tree-fallback').length, 0, `${route} : le repli ne doit pas être dans [data-tree-ui]`);
    assert.equal(byAttr(ui, 'data-tree-experiences').length, 1, `${route} : la liste des expériences est rendue côté serveur dans [data-tree-ui]`);
  }
});

test('E5.4 : la navigation provisoire du 1c a disparu (aucune occurrence de tree-nav dans lib/tree/*.ts ni dans components/tree/*.tsx)', () => {
  // E5.4 : mutation « navigation provisoire laissée dans labels-dom.ts ».
  const files = [...filesUnder('lib/tree', /\.ts$/), ...filesUnder('components/tree', /\.tsx$/)];
  assert.ok(files.includes('lib/tree/labels-dom.ts'), 'lib/tree/labels-dom.ts attendu');
  const bad = files.filter((f) => readSrc(f).includes('tree-nav'));
  assert.deepEqual(bad, [], `tree-nav encore présent dans : ${bad.join(', ')}`);
});
