// Tour Y, Y6 (constats 3 et 10, volet lien courant) : sur les six récits de projets, « Projets » de l'en-tête est marqué
// aria-current="true", avec le même style que la page courante (aria-current="page" sur /projects/) ; le menu du
// téléphone est le même panneau ([data-site-panel]) : même lien, même style au téléphone. Les pages d'expérience n'ont
// pas de rubrique parente : aucun lien de l'en-tête n'y est marqué. Les rubriques gardent aria-current="page".
import assert from 'node:assert/strict';
import test from 'node:test';
import { DESKTOP, PHONE, cascade } from './helpers-cascade.ts';
import { byAttr, exportCss } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';
import { EXPERIENCES_Y, STORIES_Y, docY } from './helpers-y.ts';

const navLinks = (route: string): HNode[] => byAttr(docY(route), 'data-site-link');
const projectsLink = (route: string): HNode => {
  const l = navLinks(route).filter((a) => a.attrs['data-site-link'] === 'projects');
  assert.equal(l.length, 1, `${route} : ${l.length} lien(s) [data-site-link=projects] dans l'en-tête`);
  return l[0] as HNode;
};
const listOf = (route: string): string => (route.startsWith('/fr/') ? '/fr/projects/' : '/projects/');

test('Y6 : sur les six récits, « Projets » porte aria-current="true" et c\'est le seul lien marqué de l\'en-tête', () => {
  for (const r of STORIES_Y) {
    const p = projectsLink(r);
    assert.equal(p.attrs['aria-current'], 'true', `${r} : « Projets » aria-current=${JSON.stringify(p.attrs['aria-current'])} (« true » attendu, Y6)`);
    assert.equal(p.attrs.href, listOf(r), `${r} : « Projets » mène à ${p.attrs.href}`);
    const others = navLinks(r).filter((a) => a !== p && a.attrs['aria-current'] !== undefined);
    assert.deepEqual(others.map((a) => a.attrs['data-site-link']), [], `${r} : autre lien marqué`);
    assert.equal(byAttr(docY(r), 'aria-current', 'page').length, 0, `${r} : aria-current="page" sur un récit (la page courante n'est pas dans l'en-tête)`);
  }
});

test('Y6 : les pages d\'expérience n\'ont aucun lien de l\'en-tête marqué ; Projets, Hackathons et Compétences gardent aria-current="page" sur leur lien', () => {
  for (const r of EXPERIENCES_Y) assert.deepEqual(navLinks(r).filter((a) => a.attrs['aria-current'] !== undefined).map((a) => a.attrs['data-site-link']), [], `${r} : lien marqué sur une page d'expérience`);
  for (const [path, id] of [['projects/', 'projects'], ['hackathons/', 'hackathons'], ['skills/', 'skills']] as const) for (const pre of ['/', '/fr/']) {
    const r = pre + path;
    const marked = navLinks(r).filter((a) => a.attrs['aria-current'] !== undefined);
    assert.deepEqual(marked.map((a) => [a.attrs['data-site-link'], a.attrs['aria-current']]), [[id, 'page']], `${r} : liens marqués`);
  }
});

test('Y6 : « Projets » d\'un récit a le style de la page courante (cascade exportée, bureau et téléphone), distinct d\'un lien non marqué', () => {
  const css = exportCss();
  for (const env of [DESKTOP, PHONE]) {
    const c = cascade(css.rules, { states: new Map(), env });
    const decl = (n: HNode): Record<string, string> => Object.fromEntries([...c.props(n)].map(([k, d]) => [k, d.value]).sort());
    for (const r of STORIES_Y) {
      const story = decl(projectsLink(r));
      const list = decl(projectsLink(listOf(r)));
      const plain = decl(navLinks(r).find((a) => a.attrs['data-site-link'] === 'hackathons') as HNode);
      assert.deepEqual(story, list, `${r} ${env.width}px : style de « Projets » ≠ celui de la page courante sur ${listOf(r)} (Y6)`);
      assert.notDeepEqual(list, plain, `${listOf(r)} ${env.width}px : la page courante n'a pas de style propre (témoin)`);
    }
  }
});
