// Contrat E8 (lot 2a) : sections sous l'arbre (projets, hackathons, à propos, contact ; FAQ depuis le lot 6a) et pied, sans animation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  E31_AVAILABILITY,
  E31_FITNESS,
  E32_ALL_HACKATHONS,
  E32_ALL_PROJECTS,
  E32_READ_STORY,
  E32_TOP,
  GITHUB_URL,
  HOME_ROUTES,
  type HNode,
  byAttr,
  byTag,
  exportCss,
  homeDoc,
  homeMods,
  localeOf,
  one,
  pageText,
  prefixOf,
  siteDir,
  textOf,
} from './helpers-home.ts';

interface Project { id: string; name: string; story: string; fr: Record<string, string>; en: Record<string, string> }
interface Hackathon { id: string; name: string; rank: Record<string, string> | null }
const projects = (): Project[] => JSON.parse(readFileSync(join(siteDir, 'content', 'projects.json'), 'utf8')) as Project[];
const hackathons = (): Hackathon[] => JSON.parse(readFileSync(join(siteDir, 'content', 'hackathons.json'), 'utf8')) as Hackathon[];
const section = (route: string, id: string): HNode => one(homeDoc(route), 'data-home-section', route, id);
const links = (n: HNode): { href: string; text: string }[] => byTag(n, 'a').map((a) => ({ href: a.attrs.href ?? '', text: textOf(a) }));

// Lot 6a (contrat-lot6a.md, V1, Q-R4) : E8.1 passe de quatre à cinq sections, la FAQ en dernier ; « aucune FAQ » est
// retiré. Le contenu de la FAQ est contrôlé par v1-faq.test.ts.
test('E8.1 : cinq sections dans l\'ordre projects, hackathons, about, contact, faq (Q-R4, lot 6a)', () => {
  // E8.1 : mutation « section vide ajoutée ».
  for (const route of HOME_ROUTES) {
    const sections = byAttr(homeDoc(route), 'data-home-section');
    assert.deepEqual(sections.map((s) => s.attrs['data-home-section']), ['projects', 'hackathons', 'about', 'contact', 'faq'], `${route} : sections`);
    for (const s of sections) assert.ok(textOf(s).length > 0, `${route} : section ${s.attrs['data-home-section']} vide`);
  }
});

test('E8.2 : projets phares = les trois projets à récit, avec catégorie, lien « Lire le récit » vers le récit de la langue et lien « Tous les projets »', async () => {
  // E8.2 : textes repris de home.ts et projects.json.
  const { home } = await homeMods.home();
  const storied = projects().filter((p) => p.story);
  assert.deepEqual(storied.map((p) => p.id).sort(), ['croix-rouge', 'diary', 'droit-de-retard'], 'projects.json : trois projets à récit attendus');
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const s = section(route, 'projects');
    const text = textOf(s);
    const a = links(s);
    for (const p of storied) {
      assert.ok(a.some((x) => x.href === `${prefixOf(l)}projects/${p.id}/` && x.text === E32_READ_STORY[l]), `${route} : lien « ${E32_READ_STORY[l]} » vers ${prefixOf(l)}projects/${p.id}/ absent`);
      const entry = (home[l].projects as { id: string; name: string; category: string; text: string; role: string }[]).find((x) => x.id === p.id);
      assert.ok(entry, `home.${l}.projects sans ${p.id}`);
      for (const v of [entry.name, entry.category]) assert.ok(text.includes(v), `${route} : « ${v} » (${p.id}) absent de la section projets`);
      assert.ok(text.includes(entry.text) || text.includes(p[l]?.summary ?? '§'), `${route} : résumé de ${p.id} absent`);
      assert.ok(text.includes(entry.role) || text.includes(p[l]?.role ?? '§'), `${route} : rôle de ${p.id} absent`);
    }
    const others = projects().filter((p) => !p.story);
    for (const p of others) assert.ok(!a.some((x) => x.href.includes(`projects/${p.id}`)), `${route} : ${p.id} (sans récit) ne doit pas être en projet phare`);
    assert.ok(a.some((x) => x.href === `${prefixOf(l)}projects/` && x.text.startsWith(E32_ALL_PROJECTS[l])), `${route} : lien « ${E32_ALL_PROJECTS[l]} » absent`);
  }
});

test('E8.2 : une capture éventuelle a width, height, loading="lazy" et decoding="async"', () => {
  // E8.2 : image de droit-de-retard, si elle est gardée.
  for (const route of HOME_ROUTES) {
    section(route, 'projects');
    for (const img of byTag(homeDoc(route), 'img')) {
      for (const a of ['width', 'height']) assert.match(img.attrs[a] ?? '', /^\d+$/, `${route} : <img ${a}> manquant ou non entier`);
      assert.equal(img.attrs.loading, 'lazy', `${route} : loading="lazy"`);
      assert.equal(img.attrs.decoding, 'async', `${route} : decoding="async"`);
    }
  }
});

test('E8.3 : hackathons = exactement gemma, gcpu et ia-crise, rang collé au sien, lien « Tous les hackathons »', () => {
  // E8.3 : mutation « hackathon LeRobot ajouté ».
  const all = hackathons();
  const keep = ['gemma', 'gcpu', 'ia-crise'];
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const s = section(route, 'hackathons');
    const text = textOf(s);
    for (const h of all) {
      const present = text.includes(h.name);
      assert.equal(present, keep.includes(h.id), `${route} : ${h.id} (${h.name}) ${keep.includes(h.id) ? 'absent' : 'ne doit pas figurer'}`);
    }
    for (const h of all.filter((x) => keep.includes(x.id) && x.rank)) {
      const rank = h.rank?.[l] ?? '';
      const at = text.indexOf(h.name);
      const next = Math.min(...all.filter((x) => keep.includes(x.id) && x.id !== h.id).map((x) => text.indexOf(x.name)).filter((i) => i > at), text.length);
      assert.ok(text.slice(at, next).includes(rank), `${route} : rang « ${rank} » non collé à ${h.name}`);
    }
    for (const h of all.filter((x) => !keep.includes(x.id) && x.rank)) assert.ok(!text.includes(h.rank?.[l] ?? '§'), `${route} : rang d'un autre hackathon (${h.id})`);
    assert.ok(links(s).some((x) => x.href === `${prefixOf(l)}hackathons/` && x.text.startsWith(E32_ALL_HACKATHONS[l])), `${route} : lien « ${E32_ALL_HACKATHONS[l]} » absent`);
  }
});

test('E8.4 : à propos = aboutTitle, aboutIntro, trois communautés, texte Fitness 42 de FAITS §6.3, sans « 300 »', async () => {
  // E8.4 : mutation « ancien texte Fitness ».
  const { home } = await homeMods.home();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const s = section(route, 'about');
    const text = textOf(s);
    assert.equal(textOf(byTag(s, 'h2')[0] ?? s), home[l].aboutTitle, `${route} : titre de la section à propos`);
    assert.ok(text.includes(home[l].aboutIntro), `${route} : aboutIntro absent`);
    for (const c of home[l].communities as { name: string }[]) assert.ok(text.includes(c.name), `${route} : communauté ${c.name} absente`);
    assert.ok(text.includes(E31_FITNESS[l]), `${route} : texte Fitness 42 de FAITS §6.3 absent`);
    assert.ok(!/300/.test(text), `${route} : « 300 » dans la section à propos`);
    assert.equal(byTag(s, 'img').length, 0, `${route} : aucune photo`);
  }
});

test('E8.5 : contact = endTitle, endText, disponibilité de FAITS §7, mailto:, GitHub et LinkedIn, sans téléphone', async () => {
  // E8.5 : mutation « disponibilité 16 octobre ».
  const { home } = await homeMods.home();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const s = section(route, 'contact');
    const text = textOf(s);
    assert.equal(textOf(byTag(s, 'h2')[0] ?? s), home[l].endTitle, `${route} : titre de la section contact`);
    assert.ok(text.includes(home[l].endText), `${route} : endText absent`);
    assert.ok(text.includes(E31_AVAILABILITY[l]), `${route} : disponibilité exacte absente`);
    const a = links(s);
    // home[l].mail est le libellé du lien (« Parlons-en » / « Let’s talk »), pas l'adresse.
    // La flèche décorative (↗, aria-hidden) qui suit le libellé est admise.
    assert.ok(a.some((x) => x.href.startsWith('mailto:') && x.text.replace(/[\s↗→]+$/u, '') === home[l].mail), `${route} : lien mailto: au texte « ${home[l].mail} » absent`);
    assert.ok(a.some((x) => x.href.startsWith(GITHUB_URL)), `${route} : lien GitHub absent`);
    assert.ok(a.some((x) => /^https:\/\/(www\.)?linkedin\.com\//.test(x.href)), `${route} : lien LinkedIn absent`);
    assert.ok(!a.some((x) => /^(tel|callto|sms):/i.test(x.href)), `${route} : lien téléphonique`);
    assert.ok(!/16 octobre 2026|16 October 2026/.test(text), `${route} : disponibilité périmée`);
  }
});

test('E8.6 : pied = « © 2026 Arnaud Durand », home.footer, lien « En haut ↑ » / « Back to top ↑ » vers #main', async () => {
  // E8.6 : pied de l'accueil.
  const { home } = await homeMods.home();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    const f = one(homeDoc(route), 'data-site-footer', route);
    assert.equal(f.tag, 'footer');
    const text = textOf(f);
    assert.ok(text.includes('© 2026 Arnaud Durand'), `${route} : « © 2026 Arnaud Durand » absent`);
    assert.ok(text.includes(home[l].footer), `${route} : home.footer absent`);
    assert.ok(links(f).some((x) => x.href === '#main' && x.text === E32_TOP[l]), `${route} : lien « ${E32_TOP[l]} » vers #main absent`);
  }
});

test('E8.7 : aucune @keyframes autre que tree-arrive, aucune animation dans [data-home-section…] ni [data-site-footer…]', () => {
  // E8.7 : mutation « animation d'apparition ajoutée aux sections ».
  homeDoc('/');
  one(homeDoc('/'), 'data-site-footer', '/');
  const css = exportCss();
  assert.deepEqual([...new Set(css.keyframes)], ['tree-arrive'], `@keyframes : ${css.keyframes.join(', ')}`);
  const bad = css.rules
    .filter((r) => r.selectors.some((s) => s.includes('[data-home-section') || s.includes('[data-site-footer')))
    .filter((r) => [...r.decls.keys()].some((k) => /^animation(-|$)/.test(k) || k === 'view-timeline' || k === 'animation-timeline'));
  assert.deepEqual(bad.map((r) => r.selector), [], 'animation dans les sections ou le pied');
});
