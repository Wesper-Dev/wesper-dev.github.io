// Contrat E6.1, E6.2, E6.3 (statique), E7.1 et E7.2 (lot 2a) : liste des expériences, fiches rendues côté serveur, liens.
// Sélection, focus, sève, fiche de compétence et infobulle : scénarios [B].
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readManifest } from './helpers.ts';
import { stripCode } from './helpers-scene.ts';
import { readSrc2a } from './helpers-home.ts';
import {
  E31_CARDS,
  E31_CASE_LINK,
  E33_HOME_UI,
  HOME_ROUTES,
  type HNode,
  LOCALES,
  byAttr,
  docOrder,
  elChildren,
  exportCss,
  has,
  homeDoc,
  homeMods,
  localeOf,
  one,
  prefixOf,
  siteDir,
  textOf,
  uiText,
  expectedRole,
} from './helpers-home.ts';

const temps: string[] = [];
after(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

test('E6.1 : cinq <button type="button" data-experience aria-pressed="false"> dans l\'ordre de EXPERIENCES, texte = nom de la langue', async () => {
  // E6.1 : liste des expériences.
  const { EXPERIENCES } = await homeMods.tree();
  const { treeUi } = await homeMods.treeUi();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const list = one(homeDoc(route), 'data-tree-experiences', route);
    assert.equal(list.attrs.role, 'group');
    assert.equal(list.attrs['aria-label'], uiText(treeUi, l, 'nav'), `${route} : aria-label de la liste = treeUi.nav`);
    const btns = byAttr(list, 'data-experience');
    assert.deepEqual(btns.map((b) => b.attrs['data-experience']), (EXPERIENCES as { id: string }[]).map((e) => e.id), `${route} : ordre des boutons`);
    for (const [i, b] of btns.entries()) {
      assert.equal(b.tag, 'button');
      assert.equal(b.attrs.type, 'button', `${route} : type="button"`);
      assert.equal(b.attrs['aria-pressed'], 'false', `${route} : aria-pressed="false"`);
      assert.equal(textOf(b), EXPERIENCES[i].name[l], `${route} : texte du bouton ${b.attrs['data-experience']}`);
    }
  }
});

test('E6.2 : [data-tree-card] (aria-live="polite") contient cinq <article data-card hidden>, dans l\'ordre, après la liste', async () => {
  // E6.2 : mutation « fiche visible par défaut ».
  const { EXPERIENCES } = await homeMods.tree();
  for (const route of HOME_ROUTES) {
    const card = one(homeDoc(route), 'data-tree-card', route);
    assert.equal(card.attrs['aria-live'], 'polite', `${route} : aria-live="polite"`);
    const arts = byAttr(card, 'data-card');
    assert.deepEqual(arts.map((a) => a.attrs['data-card']), (EXPERIENCES as { id: string }[]).map((e) => e.id), `${route} : fiches`);
    for (const a of arts) {
      assert.equal(a.tag, 'article', `${route} : [data-card] doit être un <article>`);
      assert.ok(has(a, 'hidden'), `${route} : fiche ${a.attrs['data-card']} sans hidden`);
    }
    assert.equal(byAttr(homeDoc(route), 'data-card').length, 5, `${route} : aucune autre fiche`);
  }
});

test('E6.2 : contenu exact de chaque fiche (rôle · dates, <h2> nom, résultat, sous-titre, compétences dans l\'ordre de litSkills)', async () => {
  // E6.2 : mutation « ordre des compétences inversé ».
  const { EXPERIENCES, litSkills, skillLabel } = await homeMods.tree();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    for (const e of EXPERIENCES as { id: string; name: Record<string, string> }[]) {
      const art = one(homeDoc(route), 'data-card', route, e.id);
      const want = E31_CARDS[e.id]?.[l];
      assert.ok(want, `table E3.1 sans ${e.id}`);
      const role = byAttr(art, 'data-card-role');
      const r = expectedRole(e.id, l);
      if (r === null) assert.equal(role.length, 0, `${route} : ${e.id} ne doit pas avoir de [data-card-role]`);
      else {
        assert.equal(role.length, 1, `${route} : ${e.id} : un [data-card-role]`);
        assert.equal(textOf(role[0] as HNode), r, `${route} : ${e.id} : rôle`);
      }
      const title = one(art, 'data-card-title', `${route} ${e.id}`);
      assert.equal(title.tag, 'h2');
      assert.equal(textOf(title), e.name[l], `${route} : ${e.id} : titre`);
      assert.equal(textOf(one(art, 'data-card-result', `${route} ${e.id}`)), want.result, `${route} : ${e.id} : résultat`);
      assert.equal(textOf(one(art, 'data-card-subtitle', `${route} ${e.id}`)), want.subtitle, `${route} : ${e.id} : sous-titre`);
      const ul = one(art, 'data-card-skills', `${route} ${e.id}`);
      assert.equal(ul.tag, 'ul');
      assert.deepEqual(elChildren(ul).map((li) => li.tag), elChildren(ul).map(() => 'li'), `${route} : ${e.id} : enfants <li> seulement`);
      assert.deepEqual(elChildren(ul).map(textOf), (litSkills(e.id) as string[]).map((s) => skillLabel(s, l)), `${route} : ${e.id} : compétences`);
    }
  }
});

test('E6.2 : chaque fiche a un <button type="button" data-card-close> au texte homeUi.close', async () => {
  // E6.2 : bouton Fermer.
  const { homeUi } = await homeMods.homeUi();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    for (const art of byAttr(homeDoc(route), 'data-card')) {
      const close = one(art, 'data-card-close', `${route} ${art.attrs['data-card']}`);
      assert.equal(close.tag, 'button');
      assert.equal(close.attrs.type, 'button');
      assert.equal(textOf(close), uiText(homeUi, l, 'close'));
      assert.equal(textOf(close), E33_HOME_UI[l].close);
    }
    assert.equal(byAttr(homeDoc(route), 'data-card-close').length, 5, `${route} : cinq boutons Fermer`);
  }
});

// Lot 2b (P4) : BPCE et École 42 ont leur lien ; leur libellé n'est pas donné par FAITS (signalé au rapport du lot 2b),
// il est seulement exigé non vide et sans « BNP ». Les autres libellés restent figés (caseLink, storyLink).
function expectedLabel(id: string, l: 'fr' | 'en', label: string): string | null {
  if (id === 'bnp-paribas') return label === E31_CASE_LINK[l] ? null : `libellé ${JSON.stringify(label)} ≠ ${E31_CASE_LINK[l]}`;
  if (id === 'croix-rouge' || id === 'droit-de-retard') return label === E33_HOME_UI[l].storyLink ? null : `libellé ${JSON.stringify(label)} ≠ ${E33_HOME_UI[l].storyLink}`;
  return label.trim().length > 0 && !/BNP/.test(label) ? null : `libellé ${JSON.stringify(label)} vide ou repris du cas BNP`;
}

test('E7.1 / E7.2 (mis à jour au lot 2b) : liens de fiche des cinq expériences : BNP (caseLink), Croix-Rouge et droit-de-retard (storyLink), BPCE et École 42 (libellé non vide, sans « BNP »), cibles de la langue, sans target', async () => {
  // E7.1–E7.2 : mutations « libellé Lire le récit sur BNP » ; lot 2b : BPCE et École 42 publiées (contrat-lot2b P4).
  const { EXPERIENCES } = await homeMods.tree();
  const paths = new Set(readManifest().paths);
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    for (const e of EXPERIENCES as { id: string; href: string }[]) {
      const links = byAttr(one(homeDoc(route), 'data-card', route, e.id), 'data-card-link');
      const published = paths.has(e.href);
      assert.equal(links.length, published ? 1 : 0, `${route} : ${e.id} : ${published ? 'un lien attendu' : 'aucun lien attendu'}`);
      if (!published) continue;
      const a = links[0] as HNode;
      assert.equal(a.tag, 'a');
      assert.equal(a.attrs.href, prefixOf(l) + e.href, `${route} : ${e.id} : cible`);
      assert.equal(a.attrs.target, undefined, `${route} : ${e.id} : sans target`);
      assert.equal(expectedLabel(e.id, l, textOf(a)), null, `${route} : ${e.id} : libellé`);
    }
    for (const id of ['bnp-paribas', 'bpce', 'croix-rouge', 'ecole-42', 'droit-de-retard']) assert.equal(byAttr(one(homeDoc(route), 'data-card', route, id), 'data-card-link').length, 1, `${route} : ${id} doit avoir un lien au lot 2b`);
  }
});

test('E7.1 / E7.3 : cardLink(id, l) = { href: pagePath(l, href), label } pour les publiées, null sinon', async () => {
  // E7.3 : fonction unique du calcul des liens.
  const { cardLink } = await homeMods.cards();
  const { EXPERIENCES } = await homeMods.tree();
  const paths = new Set(readManifest().paths);
  assert.equal(typeof cardLink, 'function', 'cardLink absent de content/cards.ts');
  for (const l of LOCALES) {
    for (const e of EXPERIENCES as { id: string; href: string }[]) {
      const got = cardLink(e.id, l);
      if (!paths.has(e.href)) {
        assert.equal(got, null, `cardLink(${e.id}, ${l}) doit valoir null`);
        continue;
      }
      const link = got as { href: string; label: string } | null;
      assert.ok(link && typeof link.label === 'string', `cardLink(${e.id}, ${l}) : { href, label } attendu`);
      assert.deepEqual(Object.keys(link).sort(), ['href', 'label'], `cardLink(${e.id}, ${l}) : clés`);
      assert.equal(link.href, prefixOf(l) + e.href, `cardLink(${e.id}, ${l}) : href`);
      assert.equal(expectedLabel(e.id, l, link.label), null, `cardLink(${e.id}, ${l}) : libellé`);
    }
  }
});

test('E7.1 (mis à jour au lot 2b) : cardLink suit routes.json sans liste en dur (copie du manifeste sans ecole-42, avec bpce : bpce lié, ecole-42 null)', async () => {
  // E7.1 : mutation « liste codée en dur des expériences publiées ».
  const src = stripCode(readSrc2a('content/cards.ts'));
  const root = mkdtempSync(join(tmpdir(), 'cards-2a-'));
  temps.push(root);
  for (const d of ['content', 'lib']) cpSync(join(siteDir, d), join(root, d), { recursive: true });
  cpSync(join(siteDir, 'package.json'), join(root, 'package.json'));
  const manifest = JSON.parse(readFileSync(join(root, 'content', 'routes.json'), 'utf8')) as { paths: string[] };
  // Lot 2b : le manifeste réel contient déjà les deux pages ; la copie retire ecole-42 et garantit bpce.
  manifest.paths = manifest.paths.filter((x) => x !== 'experiences/ecole-42/' && x !== 'experiences/bpce/');
  manifest.paths.push('experiences/bpce/');
  writeFileSync(join(root, 'content', 'routes.json'), JSON.stringify(manifest, null, 2));
  let mod: { cardLink?: (id: string, l: string) => unknown } | null = null;
  try {
    mod = await import(pathToFileURL(join(root, 'content', 'cards.ts')).href);
  } catch {
    mod = null;
  }
  if (mod && typeof mod.cardLink === 'function') {
    const bpce = mod.cardLink('bpce', 'fr') as { href: string } | null;
    assert.ok(bpce, 'avec experiences/bpce/ dans routes.json, cardLink(bpce, fr) ne doit plus être null');
    assert.equal(bpce.href, '/fr/experiences/bpce/');
    assert.equal((mod.cardLink('bpce', 'en') as { href: string } | null)?.href, '/experiences/bpce/');
    assert.equal(mod.cardLink('ecole-42', 'fr'), null, 'École 42 reste sans lien');
  } else {
    assert.ok(!/['"`](bpce|ecole-42)['"`]/.test(src) && !/\b(bpce|ecole-42)\b/.test(src), 'cards.ts ne doit contenir ni bpce ni ecole-42 (aucune liste en dur)');
  }
});

test('E6.3 (statique) : dans chaque fiche, l\'ordre du texte est nom → résultat → libellés de litSkills', async () => {
  // E6.3 : annonce de aria-live ; mutation « liste des compétences placée avant le titre ».
  const { EXPERIENCES, litSkills, skillLabel } = await homeMods.tree();
  const { EXPERIENCE_CARDS } = await homeMods.cards();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    for (const e of EXPERIENCES as { id: string; name: Record<string, string> }[]) {
      const art = one(homeDoc(route), 'data-card', route, e.id);
      const order = docOrder(art);
      const at = (attr: string): number => order.indexOf(one(art, attr, `${route} ${e.id}`));
      assert.ok(at('data-card-title') < at('data-card-result') && at('data-card-result') < at('data-card-skills'), `${route} : ${e.id} : ordre titre → résultat → compétences`);
      const text = textOf(art);
      let from = 0;
      for (const s of [e.name[l] ?? '', EXPERIENCE_CARDS[e.id][l].result, ...(litSkills(e.id) as string[]).map((x) => skillLabel(x, l) as string)]) {
        const i = text.indexOf(s, from);
        assert.ok(i >= 0, `${route} : ${e.id} : « ${s} » absent ou hors d'ordre dans « ${text} »`);
        from = i + s.length;
      }
    }
  }
});

test('E6.3 (statique) : [data-card-skills] n\'est jamais masqué par display: none ni visibility: hidden (masquage visuel seulement)', () => {
  // E6.3 : mutation « compétences en display: none sur téléphone ».
  for (const route of HOME_ROUTES) assert.equal(byAttr(homeDoc(route), 'data-card-skills').length, 5, `${route} : cinq [data-card-skills] attendus`);
  // Toute règle qui vise la liste ou ses descendants.
  const bad = exportCss().rules
    .filter((r) => r.selectors.some((s) => s.includes('[data-card-skills')))
    .filter((r) => /^none\b/i.test(r.decls.get('display') ?? '') || /^hidden\b/i.test(r.decls.get('visibility') ?? '') || /^hidden\b/i.test(r.decls.get('content-visibility') ?? ''));
  assert.deepEqual(bad.map((r) => `${r.media ?? ''} ${r.selector}`), [], 'règles qui retirent [data-card-skills] de l\'arbre d\'accessibilité');
});

test('E6.3 (réécrit F14) : labels-dom.ts, piloté par un DOM minimal, donne à chaque étiquette son libellé comme nom accessible et un aria-pressed qui suit la compétence choisie', async () => {
  // Audit Fable T4 : l'ancien test cherchait deux mots dans la source (survivantes L5b « aria-label vide » et L8
  // « aria-pressed toujours false »). Ici, createLabels construit les étiquettes dans un faux document ; on lit ce
  // qu'il a posé. Le faux DOM n'implémente que ce qu'un module de DOM ordinaire appelle.
  const { dom, restore } = installFakeDom();
  try {
    const { createLabels } = await import(pathToFileURL(join(siteDir, 'lib', 'tree', 'labels-dom.ts')).href);
    const { SKILLS, skillLabel } = await import(pathToFileURL(join(siteDir, 'content', 'tree.ts')).href);
    for (const locale of ['fr', 'en'] as const) {
      const stage = dom.createElement('div');
      const ac = new AbortController();
      const anchors = SKILLS.map((s: { id: string }, k: number) => ({ id: s.id, side: k % 2 ? 'left' : 'right' }));
      const labels = createLabels({ stage, locale, anchors, profile: 'desktop', reducedMotion: true, signal: ac.signal, onSkill: () => {} });
      const buttons = dom.all(stage).filter((e) => e.tagName === 'BUTTON' && e.getAttribute('data-skill') !== null && e.className.split(/\s+/).includes('tree-label'));
      assert.equal(buttons.length, SKILLS.length, `${locale} : ${buttons.length} étiquettes au lieu de ${SKILLS.length}`);
      for (const b of buttons) {
        const id = b.getAttribute('data-skill') as string;
        assert.equal(b.getAttribute('aria-label'), skillLabel(id, locale), `${locale} : nom accessible de l'étiquette ${id}`);
        assert.equal(b.getAttribute('aria-pressed'), 'false', `${locale} : ${id} pressée sans sélection`);
      }
      for (const pick of ['python', 'k8s', null]) {
        labels.setSkill(pick);
        const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-skill'));
        assert.deepEqual(pressed, pick ? [pick] : [], `${locale} : aria-pressed après setSkill(${pick})`);
        assert.ok(buttons.every((b) => ['true', 'false'].includes(b.getAttribute('aria-pressed') ?? '')), `${locale} : aria-pressed hors de true/false`);
      }
      labels.remove();
      ac.abort();
    }
  } finally {
    restore();
  }
});

// ---- DOM minimal (F14) : éléments, attributs, dataset, style, classList, écouteurs ; aucune mise en page ----
interface FakeEl {
  tagName: string; id: string; className: string; type: string; hidden: boolean; textContent: string; innerHTML: string;
  style: Record<string, string> & { setProperty(k: string, v: string): void; removeProperty(k: string): void };
  dataset: Record<string, string>; classList: { add(...c: string[]): void; remove(...c: string[]): void; toggle(c: string, f?: boolean): boolean; contains(c: string): boolean };
  children: FakeEl[]; parentElement: FakeEl | null; offsetWidth: number; offsetHeight: number;
  setAttribute(k: string, v: string): void; getAttribute(k: string): string | null; hasAttribute(k: string): boolean; removeAttribute(k: string): void; toggleAttribute(k: string, f?: boolean): boolean;
  appendChild(c: FakeEl): FakeEl; append(...c: FakeEl[]): void; replaceChildren(...c: FakeEl[]): void; remove(): void; contains(c: FakeEl): boolean;
  addEventListener(...a: unknown[]): void; removeEventListener(...a: unknown[]): void; dispatchEvent(): boolean;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; x: number; y: number };
  matches(): boolean; closest(): null; focus(): void; blur(): void; querySelector(): null; querySelectorAll(): FakeEl[];
}
function installFakeDom(): { dom: { createElement(t: string): FakeEl; all(root: FakeEl): FakeEl[] }; restore(): void } {
  const make = (tag: string): FakeEl => {
    const attrs = new Map<string, string>();
    const classes = (): string[] => (attrs.get('class') ?? '').split(/\s+/).filter(Boolean);
    const setClasses = (c: string[]): void => { attrs.set('class', [...new Set(c)].join(' ')); };
    const style = { setProperty(k: string, v: string) { (style as Record<string, unknown>)[k] = v; }, removeProperty(k: string) { delete (style as Record<string, unknown>)[k]; } } as FakeEl['style'];
    const el: FakeEl = {
      tagName: tag.toUpperCase(), type: '', textContent: '', innerHTML: '', children: [], parentElement: null, offsetWidth: 60, offsetHeight: 46, style,
      get id() { return attrs.get('id') ?? ''; }, set id(v: string) { attrs.set('id', v); },
      get className() { return attrs.get('class') ?? ''; }, set className(v: string) { attrs.set('class', v); },
      get hidden() { return attrs.has('hidden'); }, set hidden(v: boolean) { if (v) attrs.set('hidden', ''); else attrs.delete('hidden'); },
      dataset: new Proxy({} as Record<string, string>, {
        get: (_t, k) => attrs.get(`data-${String(k).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`),
        set: (_t, k, v) => { attrs.set(`data-${String(k).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`, String(v)); return true; },
        deleteProperty: (_t, k) => { attrs.delete(`data-${String(k).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`); return true; },
      }),
      classList: {
        add: (...c) => setClasses([...classes(), ...c]),
        remove: (...c) => setClasses(classes().filter((x) => !c.includes(x))),
        toggle: (c, f) => { const on = f ?? !classes().includes(c); setClasses(on ? [...classes(), c] : classes().filter((x) => x !== c)); return on; },
        contains: (c) => classes().includes(c),
      },
      setAttribute: (k, v) => { attrs.set(k.toLowerCase(), String(v)); },
      getAttribute: (k) => attrs.get(k.toLowerCase()) ?? null,
      hasAttribute: (k) => attrs.has(k.toLowerCase()),
      removeAttribute: (k) => { attrs.delete(k.toLowerCase()); },
      toggleAttribute: (k, f) => { const on = f ?? !attrs.has(k); if (on) attrs.set(k, ''); else attrs.delete(k); return on; },
      appendChild: (c) => { c.parentElement?.children.splice(c.parentElement.children.indexOf(c), 1); c.parentElement = el; el.children.push(c); return c; },
      append: (...c) => { for (const x of c) el.appendChild(x); },
      replaceChildren: (...c) => { for (const x of el.children) x.parentElement = null; el.children = []; for (const x of c) el.appendChild(x); },
      remove: () => { if (el.parentElement) { el.parentElement.children.splice(el.parentElement.children.indexOf(el), 1); el.parentElement = null; } },
      contains: (c) => { for (let x: FakeEl | null = c; x; x = x.parentElement) if (x === el) return true; return false; },
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 60, height: 46, right: 60, bottom: 46, x: 0, y: 0 }),
      matches: () => false, closest: () => null, focus: () => {}, blur: () => {}, querySelector: () => null, querySelectorAll: () => [],
    };
    return el;
  };
  const g = globalThis as Record<string, unknown>;
  const saved = ['document', 'matchMedia', 'window', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].map((k) => [k, Object.getOwnPropertyDescriptor(g, k)] as const);
  const body = make('body');
  const mql = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const doc = { createElement: make, body, documentElement: make('html'), activeElement: body, fonts: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() }, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  Object.assign(g, { document: doc, matchMedia: mql, getComputedStyle: () => ({ getPropertyValue: () => '' }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });
  g.window = g;
  const all = (root: FakeEl): FakeEl[] => root.children.flatMap((c) => [c, ...all(c)]);
  return {
    dom: { createElement: make, all },
    restore: () => { for (const [k, d] of saved) { if (d) Object.defineProperty(g, k, d); else delete g[k]; } },
  };
}

