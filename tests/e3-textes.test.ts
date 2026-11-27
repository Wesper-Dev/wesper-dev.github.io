// Contrat E3 et E7.3 (lot 2a) : origine de chaque chaîne visible de l'accueil (FAITS, textes repris, textes d'interface).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faitsCorpus, faitsSource } from './helpers-faits.ts';
import { filesUnder, siteDir, stripCode } from './helpers-scene.ts';
import { readSrc2a } from './helpers-home.ts';
import {
  E31_AVAILABILITY,
  E31_CARDS,
  E31_CASE_LINK,
  E31_FITNESS,
  E31_TITLE,
  E33_HOME_UI,
  E33_TREE_NAV,
  HOME_ROUTES,
  LOCALES,
  squash,
  homeMods,
  homeRoot,
  localeOf,
  pageText,
  uiText,
} from './helpers-home.ts';


// Toutes les chaînes de la table E3.1, avec leur provenance.
function e31Strings(): { where: string; value: string }[] {
  const out: { where: string; value: string }[] = [];
  for (const l of LOCALES) {
    out.push({ where: `titre ${l}`, value: E31_TITLE[l] }, { where: `lien BNP ${l}`, value: E31_CASE_LINK[l] }, { where: `disponibilité ${l}`, value: E31_AVAILABILITY[l] }, { where: `Fitness 42 ${l}`, value: E31_FITNESS[l] });
    for (const [id, byL] of Object.entries(E31_CARDS)) for (const [k, v] of Object.entries(byL[l])) out.push({ where: `${id}.${l}.${k}`, value: v as string });
  }
  return out;
}

test('E3.1 : chaque chaîne de la table figure mot pour mot dans FAITS.md (blancs réduits seulement)', () => {
  // E3.1 : la table du test est elle-même vérifiée contre FAITS (apostrophes, tirets et insécables compris).
  // F12 (audit Fable) : sans FAITS.md, contre la copie versionnée (chaînes attestées, une par ligne).
  const faits = squash(faitsCorpus());
  const missing = e31Strings().filter((s) => !faits.includes(s.value));
  assert.deepEqual(missing, [], `chaînes absentes de ${faitsSource()} : ${JSON.stringify(missing)}`);
});

test('E3.1 / E7.3 : EXPERIENCE_CARDS porte exactement les rôles, dates, résultats et sous-titres de la table, pour les cinq expériences', async () => {
  // E3.1 : mutations « caractère changé dans un sous-titre », « rôle donné à École 42 », « espace en trop ».
  const { EXPERIENCE_CARDS } = await homeMods.cards();
  const { EXPERIENCES } = await homeMods.tree();
  assert.ok(EXPERIENCE_CARDS, 'content/cards.ts : EXPERIENCE_CARDS absent');
  assert.deepEqual(Object.keys(EXPERIENCE_CARDS).sort(), (EXPERIENCES as { id: string }[]).map((e) => e.id).sort(), 'clés de EXPERIENCE_CARDS = ids de EXPERIENCES');
  for (const [id, byL] of Object.entries(E31_CARDS)) {
    for (const l of LOCALES) {
      const got = EXPERIENCE_CARDS[id]?.[l];
      assert.ok(got, `EXPERIENCE_CARDS['${id}'].${l} absent`);
      const want = byL[l];
      const norm = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
      assert.deepEqual(norm({ role: got.role, dates: got.dates, result: got.result, subtitle: got.subtitle }), norm({ ...want }), `EXPERIENCE_CARDS['${id}'].${l}`);
    }
  }
  for (const l of LOCALES) {
    const e42 = EXPERIENCE_CARDS['ecole-42'][l];
    assert.equal('role' in e42 && e42.role !== undefined, false, `École 42 (${l}) ne doit pas avoir de rôle`);
    assert.equal('dates' in e42 && e42.dates !== undefined, false, `École 42 (${l}) ne doit pas avoir de dates`);
  }
});

test('E7.3 : le résultat et le sous-titre BNP sont les chaînes cardFigure et cardSubtitle de experiences.ts (importées, pas recopiées)', async () => {
  // E7.3 : source partagée avec la page BNP.
  const { EXPERIENCE_CARDS } = await homeMods.cards();
  const { experiences } = await homeMods.experiences();
  for (const l of LOCALES) {
    assert.equal(EXPERIENCE_CARDS['bnp-paribas'][l].result, experiences['bnp-paribas'][l].cardFigure, `résultat BNP ${l}`);
    assert.equal(EXPERIENCE_CARDS['bnp-paribas'][l].subtitle, experiences['bnp-paribas'][l].cardSubtitle, `sous-titre BNP ${l}`);
  }
  const src = stripCode(readSrc2a('content/cards.ts'));
  for (const l of LOCALES) {
    assert.ok(!src.includes(E31_CARDS['bnp-paribas']?.[l].result ?? '§'), `cards.ts recopie le résultat BNP (${l}) au lieu de l'importer`);
    assert.ok(!src.includes(E31_CARDS['bnp-paribas']?.[l].subtitle ?? '§'), `cards.ts recopie le sous-titre BNP (${l}) au lieu de l'importer`);
  }
  assert.match(src, /from\s*['"]\.\/experiences(\.ts)?['"]/, 'cards.ts doit importer ./experiences.ts');
});

test('E3.1 : cards.ts cite la section de FAITS de chaque fiche (§1 à §5) en commentaire', () => {
  // E3.1 : « chaque chaîne est stockée une seule fois dans site/content/ avec un commentaire qui cite sa section ».
  const src = readSrc2a('content/cards.ts');
  for (const n of [1, 2, 3, 4, 5]) assert.match(src, new RegExp(`FAITS\\s*§\\s*${n}\\b`), `commentaire « FAITS §${n} » absent de content/cards.ts`);
});

test('E3.1 : le titre « Ingénieur logiciel » / « Software Engineer » est un littéral de site/content/, dans un fichier qui cite FAITS §7', () => {
  // E3.1 : titre de l'en-tête ; le module n'est pas fixé par le contrat.
  const files = [...filesUnder('content', /\.(ts|json)$/)];
  for (const l of LOCALES) {
    const carriers = files.filter((f) => readFileSync(join(siteDir, f), 'utf8').includes(E31_TITLE[l]));
    assert.ok(carriers.length >= 1, `« ${E31_TITLE[l]} » absent de site/content/`);
    assert.ok(carriers.some((f) => /FAITS\s*§\s*7/.test(readFileSync(join(siteDir, f), 'utf8'))), `le fichier qui porte « ${E31_TITLE[l]} » doit citer FAITS §7 (${carriers.join(', ')})`);
  }
});

test('E3.1 : disponibilité = availability de experiences.ts, Fitness 42 = texte de FAITS §6.3 dans home.ts', async () => {
  // E3.1 : disponibilité FAITS §7 ; texte Fitness 42 remplacé (FAITS §6.3).
  const exp = await homeMods.experiences();
  const { home } = await homeMods.home();
  for (const l of LOCALES) {
    const av = exp.availability?.[l] ?? exp.availability;
    assert.equal(av, E31_AVAILABILITY[l], `availability (${l})`);
    const fitness = (home[l].communities as { name: string; text: string }[]).filter((c) => /Fitness 42/.test(c.name));
    assert.equal(fitness.length, 1, `une communauté Fitness 42 attendue (${l})`);
    assert.equal(fitness[0]?.text, E31_FITNESS[l], `texte Fitness 42 (${l})`);
  }
});

test('E3.3 : homeUi a des clés fr/en appariées, non vides, aux valeurs exactes du contrat, et le commentaire « à valider par Arnaud »', async () => {
  // E3.3 : mutation « storyLink traduit autrement ».
  const src = readSrc2a('content/home-ui.ts');
  assert.match(src, /à valider par Arnaud/, 'commentaire « à valider par Arnaud » absent de content/home-ui.ts');
  const { homeUi } = await homeMods.homeUi();
  assert.ok(homeUi, 'content/home-ui.ts : export homeUi absent');
  assert.deepEqual(Object.keys(homeUi).sort(), ['en', 'fr'], 'homeUi : clés fr et en');
  assert.deepEqual(Object.keys(homeUi.fr).sort(), Object.keys(homeUi.en).sort(), 'homeUi : clés appariées');
  for (const l of LOCALES) {
    for (const [k, v] of Object.entries(E33_HOME_UI[l])) assert.equal(homeUi[l][k], v, `homeUi.${l}.${k}`);
    for (const [k, v] of Object.entries(homeUi[l] as Record<string, unknown>)) assert.ok(typeof v === 'string' && v.trim().length > 0, `homeUi.${l}.${k} vide`);
  }
  assert.deepEqual(Object.keys(homeUi.fr).sort(), Object.keys(E33_HOME_UI.fr).sort(), 'homeUi : aucune autre clé que celles de E3.3');
});

test('E3.3 : treeUi garde ses clés du 1c, nav = Expériences / Experiences, avec le commentaire « à valider par Arnaud »', async () => {
  // E3.3 : remplace « provisoire, à valider au lot 2a ».
  const src = readSrc2a('content/tree-ui.ts');
  assert.match(src, /à valider par Arnaud/, 'commentaire « à valider par Arnaud » absent de content/tree-ui.ts');
  assert.doesNotMatch(src, /provisoire, à valider au lot 2a/, 'ancien commentaire « provisoire, à valider au lot 2a » encore présent');
  const { treeUi } = await homeMods.treeUi();
  for (const l of LOCALES) assert.equal(uiText(treeUi, l, 'nav'), E33_TREE_NAV[l], `treeUi nav (${l})`);
});

test('E3.3 : EXPERIENCE_CARDS est gelé en profondeur (affectation imbriquée → TypeError)', async () => {
  // E7.3 : « gelé en profondeur ».
  const { EXPERIENCE_CARDS } = await homeMods.cards();
  assert.ok(Object.isFrozen(EXPERIENCE_CARDS), 'EXPERIENCE_CARDS non gelé');
  for (const [id, byL] of Object.entries(EXPERIENCE_CARDS as Record<string, Record<string, Record<string, string>>>)) {
    assert.ok(Object.isFrozen(byL), `EXPERIENCE_CARDS['${id}'] non gelé`);
    for (const l of LOCALES) {
      assert.ok(Object.isFrozen(byL[l]), `EXPERIENCE_CARDS['${id}'].${l} non gelé`);
      assert.throws(() => {
        'use strict';
        (byL[l] as Record<string, string>).result = 'x';
      }, TypeError, `affectation de EXPERIENCE_CARDS['${id}'].${l}.result acceptée`);
    }
  }
});

test('E3.2 : l\'accueil n\'affiche plus home.title, titleEnd, intro, role, availability, ni les entrées de experiences et systems', async () => {
  // E3.2 / E1.5 / E16.3 : mutation « ancienne intro laissée ». Les noms et années repris par E3.1 restent permis.
  const { home } = await homeMods.home();
  const { EXPERIENCES } = await homeMods.tree();
  for (const route of HOME_ROUTES) {
    homeRoot(route);
    const l = localeOf(route);
    const text = pageText(route);
    const h = home[l];
    const permitted = new Set<string>([
      ...(EXPERIENCES as { name: Record<string, string> }[]).map((e) => e.name[l] ?? ''),
      ...Object.values(E31_CARDS).flatMap((c) => Object.values(c[l])),
    ]);
    const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
    const banned = [h.title, h.titleEnd, h.intro, h.role, h.availability, ...strings(h.experiences), ...strings(h.systems)]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .filter((s) => !permitted.has(s) && !/^\d{4}(–\d{4})?$/.test(s));
    const found = banned.filter((s) => text.includes(s.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(found, [], `${route} : anciens textes encore visibles`);
  }
});
