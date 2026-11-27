// Contrat E4.2–E4.5 (lot 2a) : en-tête de l'accueil (nom et titre, CV, navigation, menu natif popover).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CV_HREF,
  E31_TITLE,
  E32_LANG_LABEL,
  GITHUB_URL,
  HOME_ROUTES,
  type HNode,
  byAttr,
  byTag,
  contains,
  distDir,
  docOrder,
  has,
  homeDoc,
  homeMods,
  localeOf,
  one,
  otherLocale,
  prefixOf,
  textOf,
  uiText,
} from './helpers-home.ts';

const header = (route: string): HNode => one(homeDoc(route), 'data-site-header', route);

test('E4.2 : <h1> = <a data-site-name href="/fr/" ou "/" aria-current="page">Arnaud Durand</a> + [data-site-title] = titre de FAITS §7', () => {
  // E4.2 : nom et titre.
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const h = header(route);
    const name = one(h, 'data-site-name', route);
    assert.equal(name.tag, 'a', `${route} : [data-site-name] doit être un lien`);
    assert.equal(name.parent?.tag === 'h1' || byTag(h, 'h1').some((h1) => contains(h1, name)), true, `${route} : [data-site-name] dans le <h1>`);
    assert.equal(textOf(name), 'Arnaud Durand', `${route} : texte du nom`);
    assert.equal(name.attrs.href, prefixOf(l), `${route} : href du nom`);
    assert.equal(name.attrs['aria-current'], 'page', `${route} : aria-current="page"`);
    const title = one(h, 'data-site-title', route);
    assert.ok(byTag(h, 'h1').some((h1) => contains(h1, title)), `${route} : [data-site-title] dans le <h1>`);
    assert.equal(textOf(title), E31_TITLE[l], `${route} : titre professionnel`);
  }
});

test('E4.3 : <a data-site-cv> vers le PDF de la langue (type, hreflang, texte homeUi.cv), présent dans l\'export, hors de #site-menu', async () => {
  // E4.3 : mutations « CV dans le menu », « CV EN sur /fr/ ». Structure d'abord, texte (module homeUi) ensuite.
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const doc = homeDoc(route);
    const cv = one(header(route), 'data-site-cv', route);
    assert.equal(cv.tag, 'a');
    assert.equal(cv.attrs.href, CV_HREF[l], `${route} : href du CV`);
    assert.equal(cv.attrs.type, 'application/pdf', `${route} : type du CV`);
    assert.equal(cv.attrs.hreflang, l, `${route} : hreflang du CV`);
    assert.ok(existsSync(join(distDir, (cv.attrs.href ?? '').replace(/^\//, ''))), `${route} : ${cv.attrs.href} absent de l'export`);
    const menu = one(doc, 'id', route, 'site-menu');
    assert.ok(!contains(menu, cv), `${route} : le CV ne doit pas être dans #site-menu`);
  }
  const { homeUi } = await homeMods.homeUi();
  for (const route of HOME_ROUTES) assert.equal(textOf(one(header(route), 'data-site-cv', route)), uiText(homeUi, localeOf(route), 'cv'), `${route} : texte du CV`);
});

test('E4.4 : <nav data-site-nav aria-label=mainNav> contient #site-menu[popover] avec, dans l\'ordre, projects, hackathons, skills, github, lang', async () => {
  // E4.4 : mutation « lien GitHub absent ».
  const { homeUi } = await homeMods.homeUi();
  const { home } = await homeMods.home();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const p = prefixOf(l);
    const h = header(route);
    const nav = one(h, 'data-site-nav', route);
    assert.equal(nav.tag, 'nav', `${route} : [data-site-nav] doit être un <nav>`);
    assert.equal(nav.attrs['aria-label'], uiText(homeUi, l, 'mainNav'), `${route} : aria-label du <nav>`);
    const menu = one(homeDoc(route), 'id', route, 'site-menu');
    assert.ok(contains(nav, menu), `${route} : #site-menu doit être dans le <nav>`);
    assert.ok(has(menu, 'popover'), `${route} : #site-menu sans attribut popover`);
    const links = byAttr(menu, 'data-site-link');
    assert.deepEqual(links.map((a) => a.attrs['data-site-link']), ['projects', 'hackathons', 'skills', 'github', 'lang'], `${route} : ordre des liens`);
    assert.equal(byAttr(homeDoc(route), 'data-site-link').length, 5, `${route} : aucun autre [data-site-link]`);
    const want = [
      { href: `${p}projects/`, text: home[l].nav[0] },
      { href: `${p}hackathons/`, text: home[l].nav[1] },
      { href: `${p}skills/`, text: home[l].nav[2] },
      { href: GITHUB_URL, text: 'GitHub' },
      { href: prefixOf(otherLocale(l)), text: E32_LANG_LABEL[l].text },
    ];
    assert.deepEqual(links.map((a) => ({ href: a.attrs.href, text: textOf(a) })), want, `${route} : cibles et textes`);
    for (const a of links) assert.equal(a.tag, 'a');
    for (const a of links) assert.equal(a.attrs.target, undefined, `${route} : ${a.attrs['data-site-link']} sans target`);
  }
});

test('E4.4 : le lien de langue porte hreflang, lang et l\'aria-label de site-shell', () => {
  // E4.4 / E12.1 : mutation « lien de langue sans hreflang ».
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const lang = one(header(route), 'data-site-link', route, 'lang');
    assert.equal(lang.attrs.hreflang, otherLocale(l), `${route} : hreflang`);
    assert.equal(lang.attrs.lang, otherLocale(l), `${route} : lang`);
    assert.equal(lang.attrs['aria-label'], E32_LANG_LABEL[l].aria, `${route} : aria-label`);
  }
});

test('E4.4 : ni « À propos » / « About » ni ancre #about dans l\'en-tête', async () => {
  // E4.4 : liste du lot 2a.
  const { home } = await homeMods.home();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const h = header(route);
    const text = textOf(h);
    assert.ok(!/À propos|About/.test(text), `${route} : « À propos » / « About » dans l'en-tête : « ${text} »`);
    assert.ok(!text.includes(home[l].nav[3] ?? '§'), `${route} : home.nav[3] dans l'en-tête`);
    const anchors = byTag(h, 'a').map((a) => a.attrs.href ?? '');
    assert.ok(!anchors.some((x) => x.includes('#about')), `${route} : ancre #about dans l'en-tête`);
  }
});

test('E4.5 : <button type="button" data-site-menu popovertarget="site-menu"> au texte homeUi.menu, aucun script ni gestionnaire dans l\'en-tête', async () => {
  // E4.5 : menu natif ; mutation « popovertarget faux ».
  const { homeUi } = await homeMods.homeUi();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const h = header(route);
    const btn = one(h, 'data-site-menu', route);
    assert.equal(btn.tag, 'button');
    assert.equal(btn.attrs.type, 'button', `${route} : type="button"`);
    assert.equal(btn.attrs.popovertarget, 'site-menu', `${route} : popovertarget`);
    assert.equal(textOf(btn), uiText(homeUi, l, 'menu'), `${route} : texte du bouton`);
    assert.equal(byTag(h, 'script').length, 0, `${route} : aucun <script> dans l'en-tête`);
    const handlers = docOrder(h).filter((n) => Object.keys(n.attrs).some((a) => /^on[a-z]+$/.test(a)));
    assert.deepEqual(handlers.map((n) => n.tag), [], `${route} : gestionnaires on* dans l'en-tête`);
  }
});
