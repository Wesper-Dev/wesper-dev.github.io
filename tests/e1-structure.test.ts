// Contrat E1 et E2.1–E2.2 (lot 2a) : structure HTML de l'accueil, ordre de lecture, titres, repères, contenu sans JS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportPages } from './helpers-scene.ts';
import {
  HOME_ROUTES,
  type HNode,
  ancestors,
  bodyOf,
  byAttr,
  byTag,
  contains,
  docOrder,
  elChildren,
  has,
  homeDoc,
  homeRoot,
  localeOf,
  one,
} from './helpers-home.ts';

const before = (doc: HNode, a: HNode, b: HNode): boolean => {
  const order = docOrder(doc);
  return order.indexOf(a) < order.indexOf(b);
};
const classes = (n: HNode): string[] => (n.attrs.class ?? '').split(/\s+/).filter(Boolean);

test('E1.1 : un seul [data-home] par accueil, enfant de <body>, lang = langue de la page', () => {
  // E1.1 : racine de l'accueil.
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const home = homeRoot(route);
    assert.equal(home.tag, 'div', `${route} : [data-home] doit être un <div>`);
    assert.equal(home.parent, bodyOf(doc), `${route} : [data-home] doit être enfant direct de <body>`);
    assert.equal(home.attrs.lang, localeOf(route), `${route} : lang="${localeOf(route)}" attendu sur [data-home]`);
  }
});

test('E1.1 : aucune page secondaire (18 routes et la 404, lot 2b) ne contient data-home', () => {
  // E1.1 : mutation « data-home posé aussi sur /fr/projects/ ».
  const others = exportPages().filter((p) => !HOME_ROUTES.includes(p.route));
  assert.equal(others.length, 19, '18 routes et la 404 attendues (lot 2b)');
  const bad = others.filter((p) => /<[a-z][^>]*\sdata-home(?=[\s=/>])/i.test(p.html)).map((p) => p.route);
  assert.deepEqual(bad, [], `pages secondaires avec data-home : ${bad.join(', ')}`);
  homeRoot('/');
});

test('E1.2 : ordre lien d\'évitement → <header data-site-header> → <main id="main"> → <footer data-site-footer>, enfants de [data-home]', () => {
  // E1.2 : ordre des régions.
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const home = homeRoot(route);
    const kids = elChildren(home);
    const skip = kids.findIndex((k) => k.tag === 'a' && k.attrs.href === '#main');
    const header = kids.findIndex((k) => k.tag === 'header' && has(k, 'data-site-header'));
    const main = kids.findIndex((k) => k.tag === 'main' && k.attrs.id === 'main');
    const footer = kids.findIndex((k) => k.tag === 'footer' && has(k, 'data-site-footer'));
    assert.ok(skip >= 0 && header >= 0 && main >= 0 && footer >= 0, `${route} : enfants de [data-home] attendus (a#main, header, main, footer), reçu ${kids.map((k) => k.tag).join(', ')}`);
    assert.ok(skip < header && header < main && main < footer, `${route} : ordre attendu évitement < en-tête < main < pied, reçu ${[skip, header, main, footer]}`);
    // Lien d'évitement : premier <a> ou <button> de la page.
    const firstFocus = docOrder(bodyOf(doc)).find((n) => n.tag === 'a' || n.tag === 'button');
    assert.equal(firstFocus, kids[skip], `${route} : le lien d'évitement doit être le premier <a>/<button> de <body>`);
    assert.equal(byTag(doc, 'main').length, 1, `${route} : un seul <main>`);
  }
});

test('E1.2 : <main> commence par [data-tree-hero], suivi des sections projects, hackathons, about, contact, faq (FAQ : lot 6a)', () => {
  // E1.2 : ordre de Q-R4 ; mutation « section contact avant à propos ».
  for (const route of HOME_ROUTES) {
    const main = one(homeDoc(route), 'id', route, 'main');
    const kids = elChildren(main);
    assert.ok(kids[0] && has(kids[0], 'data-tree-hero'), `${route} : premier enfant de <main> = [data-tree-hero], reçu <${kids[0]?.tag}>`);
    const sections = byAttr(main, 'data-home-section');
    assert.deepEqual(sections.map((s) => s.attrs['data-home-section']), ['projects', 'hackathons', 'about', 'contact', 'faq'], `${route} : sections de l'accueil`);
    for (const s of sections) assert.equal(s.tag, 'section', `${route} : [data-home-section] doit être un <section>`);
    const order = docOrder(main);
    for (const s of sections) assert.ok(order.indexOf(s) > order.indexOf(kids[0] as HNode), `${route} : la section ${s.attrs['data-home-section']} doit suivre le bloc`);
  }
});

test('E1.3 (tour Y, Y10 : avant ou après la scène) : dans le bloc, [data-tree-copy] (phrase BNP puis lien) et [data-tree-stage] (repli puis îlot), et l\'îlot rend liste puis fiche', () => {
  // E1.3 : mutation « [data-tree-copy] après la scène ».
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const hero = one(doc, 'data-tree-hero', route);
    const kids = elChildren(hero);
    // Tour Y (contrat-recette-y.md, Y10) : le bloc BNP peut passer APRÈS la scène, dernier enfant élément (ordre de
    // tabulation = ordre visuel) ; y10-ordre-tabulation.test.ts exige cet ordre. Avant ou après, il reste un enfant
    // direct du bloc, à une extrémité.
    const ends = [kids[0], kids[kids.length - 1]].filter((k): k is HNode => !!k && has(k, 'data-tree-copy'));
    assert.ok(ends.length === 1, `${route} : [data-tree-copy] doit être le premier ou le dernier enfant élément de [data-tree-hero]`);
    const copy = ends[0] as HNode;
    const stage = one(hero, 'data-tree-stage', route);
    assert.ok(kids.includes(stage), `${route} : [data-tree-stage] enfant direct de [data-tree-hero]`);
    const bnp = one(copy, 'data-tree-bnp', route);
    const link = one(copy, 'data-tree-case', route);
    assert.equal(bnp.tag, 'p');
    assert.equal(bnp.attrs.elementtiming, 'bnp-sentence');
    assert.equal(link.tag, 'a');
    assert.ok(before(doc, bnp, link), `${route} : phrase BNP avant le lien du cas`);
    const fb = one(stage, 'data-tree-fallback', route);
    const island = one(stage, 'data-tree-island', route);
    assert.ok(before(doc, fb, island), `${route} : [data-tree-fallback] avant [data-tree-island]`);
    const ui = one(island, 'data-tree-ui', route);
    const list = one(ui, 'data-tree-experiences', route);
    const card = one(ui, 'data-tree-card', route);
    assert.ok(before(doc, list, card), `${route} : liste des expériences avant la fiche`);
    // Dans le HTML : phrase et lien précèdent le repli et tout <a>/<button> du bloc ; tour Y (Y10) : ou, bloc BNP en
    // dernier, les suivent tous (jamais entre deux contrôles du bloc).
    const last = copy === kids[kids.length - 1] && copy !== kids[0];
    const controls = [...byTag(hero, 'a'), ...byTag(hero, 'button')].filter((n) => n !== link);
    for (const c of controls) assert.ok(last ? before(doc, c, link) : before(doc, link, c), `${route} : <${c.tag}> ${JSON.stringify(c.attrs).slice(0, 80)} ${last ? 'suit' : 'précède'} le lien du cas BNP`);
    assert.ok(last ? before(doc, fb, link) : before(doc, link, fb), `${route} : lien du cas ${last ? 'après' : 'avant'} le repli`);
  }
});

test('E1.4 : un seul <h1>, dans [data-site-header], contenant [data-site-name] et [data-site-title] ; aucun <h1> dans le bloc', () => {
  // E1.4 : mutations « <h1> déplacé dans le bloc ou dupliqué ».
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const h1 = byTag(doc, 'h1');
    assert.equal(h1.length, 1, `${route} : exactement un <h1>, reçu ${h1.length}`);
    const header = one(doc, 'data-site-header', route);
    assert.ok(contains(header, h1[0] as HNode), `${route} : le <h1> doit être dans [data-site-header]`);
    assert.equal(byAttr(h1[0] as HNode, 'data-site-name').length, 1, `${route} : [data-site-name] dans le <h1>`);
    assert.equal(byAttr(h1[0] as HNode, 'data-site-title').length, 1, `${route} : [data-site-title] dans le <h1>`);
    assert.equal(byTag(one(doc, 'data-tree-hero', route), 'h1').length, 0, `${route} : aucun <h1> dans [data-tree-hero]`);
  }
});

test('E1.4 : chaque section commence par un <h2>, les titres de fiche sont des <h2>, aucun saut de niveau', () => {
  // E1.4 : hiérarchie des titres.
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    assert.equal(byAttr(doc, 'data-home-section').length, 5, `${route} : cinq sections attendues (FAQ : lot 6a)`);
    assert.equal(byAttr(doc, 'data-card-title').length, 5, `${route} : cinq titres de fiche attendus`);
    for (const s of byAttr(doc, 'data-home-section')) {
      const first = elChildren(s)[0];
      const firstHeading = docOrder(s).find((n) => /^h[1-6]$/.test(n.tag));
      assert.ok(firstHeading?.tag === 'h2', `${route} : la section ${s.attrs['data-home-section']} doit commencer par un <h2> (premier titre : ${firstHeading?.tag})`);
      assert.ok(first && (first.tag === 'h2' || contains(first, firstHeading as HNode)), `${route} : le <h2> doit ouvrir la section ${s.attrs['data-home-section']}`);
    }
    for (const t of byAttr(doc, 'data-card-title')) assert.equal(t.tag, 'h2', `${route} : [data-card-title] doit être un <h2>`);
    const levels = docOrder(bodyOf(doc)).filter((n) => /^h[1-6]$/.test(n.tag)).map((n) => Number(n.tag[1]));
    assert.equal(levels[0], 1, `${route} : le premier titre doit être le <h1>`);
    for (let i = 1; i < levels.length; i++) {
      assert.ok((levels[i] as number) <= (levels[i - 1] as number) + 1, `${route} : saut de niveau h${levels[i - 1]} → h${levels[i]}`);
    }
  }
});

test('E1.5 : plus aucun élément de classe hero, experience-row ni systems sur l\'accueil', () => {
  // E1.5 : mutation « section .hero remise ».
  for (const route of HOME_ROUTES) {
    const bad = docOrder(homeDoc(route)).filter((n) => classes(n).some((c) => ['hero', 'experience-row', 'systems'].includes(c)));
    assert.deepEqual(bad.map((n) => `<${n.tag} class="${n.attrs.class}">`), [], `${route} : ancienne DA encore présente`);
  }
  homeRoot('/');
});

test('E1.6 : un seul <header> et un seul <footer> de premier niveau, la liste des expériences est un role="group" étiqueté, pas un <nav>', () => {
  // E1.6 : repères.
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const top = (tag: string): HNode[] => byTag(doc, tag).filter((n) => !ancestors(n).some((a) => ['article', 'aside', 'main', 'nav', 'section'].includes(a.tag)));
    assert.equal(top('header').length, 1, `${route} : un seul <header> de premier niveau`);
    assert.equal(top('footer').length, 1, `${route} : un seul <footer> de premier niveau`);
    const list = one(doc, 'data-tree-experiences', route);
    assert.notEqual(list.tag, 'nav', `${route} : la liste des expériences ne doit pas être un <nav>`);
    assert.equal(list.attrs.role, 'group', `${route} : role="group" attendu`);
    assert.ok((list.attrs['aria-label'] ?? '').trim().length > 0, `${route} : aria-label attendu sur la liste`);
  }
});

test('E2.1 : sans JS, le HTML contient nom et titre dans le <h1>, CV, navigation, phrase et lien BNP, repli, sections, pied, et aucun <canvas>', () => {
  // E2.1 : contenu lisible sans script (le détail de chaque partie est vérifié en e3, e4, e5, e8).
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const h1 = byTag(doc, 'h1')[0];
    assert.ok(h1, `${route} : <h1> absent`);
    for (const a of ['data-site-name', 'data-site-title']) assert.equal(byAttr(h1, a).length, 1, `${route} : ${a} dans le <h1>`);
    assert.equal(byAttr(doc, 'data-site-cv').length, 1, `${route} : lien CV absent du HTML`);
    assert.equal(byAttr(doc, 'data-site-link').length, 5, `${route} : cinq liens de navigation attendus dans le HTML`);
    for (const a of ['data-tree-bnp', 'data-tree-case', 'data-tree-fallback', 'data-site-footer']) assert.equal(byAttr(doc, a).length, 1, `${route} : [${a}] absent`);
    assert.equal(byAttr(doc, 'data-home-section').length, 5, `${route} : cinq sections (FAQ : lot 6a)`);
    assert.equal(byTag(doc, 'canvas').length, 0, `${route} : aucun <canvas>`);
  }
});

test('E2.2 : [data-tree-ui] porte hidden et inert dans le HTML exporté', () => {
  // E2.2 : mutation « inert retiré ».
  for (const route of HOME_ROUTES) {
    const ui = one(homeDoc(route), 'data-tree-ui', route);
    assert.ok(has(ui, 'hidden'), `${route} : [data-tree-ui] sans hidden`);
    assert.ok(has(ui, 'inert'), `${route} : [data-tree-ui] sans inert`);
  }
});
