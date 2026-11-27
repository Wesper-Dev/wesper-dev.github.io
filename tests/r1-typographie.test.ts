// Lot 4, corrections d'audit, R1 (tmp/refonte-arbre/arbitrage-audit-lot4.md ; audit C1) : en français, aucune ligne
// ne commence par « : ; ? ! » » et aucune ne finit par « « ». Espace insécable U+00A0 devant « : » et à l'intérieur
// des guillemets, U+202F devant « ; ? ! », dans les textes français de site/content/* et des composants, accueil
// compris. Seuls les blancs changent : aucun mot, aucun signe (Q3 et les tests « mot pour mot » le prouvent toujours,
// helpers-typo.ts). Les deux caractères doivent être dans le sous-ensemble d'Inter Tight.
// Partie statique. Les coupures de ligne réelles (Chromium, Firefox, WebKit, 320 à 2560 px) et le caractère exact
// selon la police rendue sont mesurés dans tmp/refonte-arbre/verif-4/verif.mjs (R1.1, R1.2).
// Lecture retenue : devant « ; ? ! », U+00A0 est admis ici ; R1.2 exige U+202F partout où Inter Tight rend le texte,
// U+00A0 là où c'est IBM Plex Mono, qui n'a pas U+202F (« La suite ? » des pages intérieures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_PAGES, readRoute } from './helpers-4.ts';
import { context, frenchStrings, markdownProse, pageSpacingIssues, spacedSigns, spacingIssues } from './helpers-r.ts';
import { NBSP, NNBSP } from './helpers-typo.ts';
import { assertDistExists, distDir, siteDir } from './helpers.ts';
import { cmapCodepoints, exportCss, inRanges, parseUnicodeRange } from './helpers-home.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (R1)`);
  return html;
};

test('R1 : texte français visible des 21 pages exportées (langue héritée de lang) : aucun blanc sécable devant « : ; ? ! » » ni après « « » ; U+00A0 devant « : » et dans les guillemets', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of ALL_PAGES) for (const e of pageSpacingIssues(page(route))) errors.push(`${route} : ${e}`);
  assert.deepEqual(errors, [], `lot 4, R1 : ${errors.length} écart(s)\n${errors.slice(0, 40).join('\n')}${errors.length > 40 ? `\n… ${errors.length - 40} de plus` : ''}`);
});

// Modules de content/* lus tels quels (sans helpers-typo.untypoModule) ; atelier.ts compris (textes du panneau
// d'atelier, aperçu seulement), et les fiches de l'arbre (content/tree.ts), dessinées au survol et absentes du HTML.
const CONTENT_MODULES = ['home.ts', 'home-ui.ts', 'cards.ts', 'experiences.ts', 'skills.ts', 'tree.ts', 'tree-public.ts', 'tree-ui.ts', 'atelier.ts'];

test('R1 : chaînes françaises de site/content/* (toute chaîne sous une clé fr des modules et des JSON ; récits fr/*.md) : même règle, fiches de l\'arbre comprises', async () => {
  const errors: string[] = [];
  const check = (where: string, s: string): void => {
    for (const x of spacingIssues(s)) errors.push(`${where} : ${x.message} dans « …${context(s, x.at)}… »`);
  };
  const dir = join(siteDir, 'content');
  for (const f of CONTENT_MODULES) {
    const mod = (await import(pathToFileURL(join(dir, f)).href)) as Record<string, unknown>;
    for (const [name, v] of Object.entries(mod)) if (typeof v !== 'function') for (const [p, s] of frenchStrings(v)) check(`content/${f} ${name}.${p}`, s);
  }
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) for (const [p, s] of frenchStrings(JSON.parse(readFileSync(join(dir, f), 'utf8')))) check(`content/${f} ${p}`, s);
  const stories = join(dir, 'stories', 'fr');
  if (existsSync(stories)) for (const f of readdirSync(stories).filter((x) => x.endsWith('.md'))) check(`content/stories/fr/${f}`, markdownProse(readFileSync(join(stories, f), 'utf8')));
  assert.deepEqual(errors, [], `lot 4, R1 : ${errors.length} écart(s)\n${errors.slice(0, 40).join('\n')}${errors.length > 40 ? `\n… ${errors.length - 40} de plus` : ''}`);
});

test('R1 : aucune espace retirée : le nombre de signes français espacés de chaque page (« : ; ? ! » » précédés d\'un blanc, « « » suivis d\'un blanc) est au moins celui de 5afd274', () => {
  // Garde : Q3 compare le texte blancs retirés et ne verrait pas « chacun : » devenu « chacun: ».
  assertDistExists();
  const ref = JSON.parse(readFileSync(join(siteDir, 'tests', 'fixtures', 'r1-signes.json'), 'utf8')) as { commit: string; pages: Record<string, number> };
  const errors: string[] = [];
  // Tour W (contrat-relecture-w.md, W1 B1) : « ici ; ce site passe par des pull requests… » retiré de /fr/skills/, un
  // « ; » espacé de moins ; aucun autre écart.
  const W_SIGNS: Record<string, number> = { '/fr/skills/': -1 };
  for (const route of ALL_PAGES) {
    const want = ref.pages[route] === undefined ? undefined : (ref.pages[route] as number) + (W_SIGNS[route] ?? 0);
    if (want === undefined) errors.push(`${route} absente de fixtures/r1-signes.json`);
    else if (spacedSigns(page(route)) < want) errors.push(`${route} : ${spacedSigns(page(route))} signes espacés < ${want} à ${ref.commit} (espace retirée ?)`);
  }
  assert.deepEqual(errors, [], `lot 4, R1 : seuls les blancs changent de type\n${errors.join('\n')}`);
});

test('R1 : U+00A0 et U+202F sont dans le sous-ensemble d\'Inter Tight exporté (cmap et unicode-range)', () => {
  assertDistExists();
  const faces = exportCss().fontFaces.filter((f) => f.family === 'Inter Tight');
  assert.ok(faces.length > 0, 'lot 4, R1 : @font-face Inter Tight absente');
  const covered = (cp: number): boolean => faces.some((f) => inRanges(cp, parseUnicodeRange(f.unicodeRange || 'U+0-10FFFF')) && f.urls.some((u) => cmapCodepoints(readFileSync(join(distDir, u.replace(/^\//, '')))).has(cp)));
  for (const ch of [NBSP, NNBSP]) assert.ok(covered(ch.codePointAt(0) as number), `lot 4, R1 : U+${(ch.codePointAt(0) as number).toString(16).toUpperCase()} absent d'Inter Tight : s'arrêter et le signaler (arbitrage R1)`);
  assert.ok(!covered(0x2060), 'témoin : U+2060 ne doit pas être couvert (sinon la lecture du cmap est fausse)');
});

test('R1 (témoins) : le repérage refuse les blancs sécables et les mauvais insécables, admet la bonne forme, ignore l\'anglais, le code et les URL ; le compte suit les espaces retirées', () => {
  const fr = (body: string, lang = 'fr'): string => `<!DOCTYPE html><html lang="${lang}"><head><title>t</title></head><body>${body}</body></html>`;
  const bad: [string, string][] = [
    ['espace devant :', fr('<p>Pour chacun : mon rôle</p>')],
    ['espace devant ;', fr('<p>maternelle ; anglais</p>')],
    ['espace devant ?', fr('<p>La suite ?</p>')],
    ['espace devant !', fr('<p>Voilà !</p>')],
    ['espace devant »', fr('<p>« Droit »</p>'.replace('« ', '«' + NBSP))],
    ['espace après «', fr('<p>« Droit' + NBSP + '»</p>')],
    ['fine sécable U+2009 devant ;', fr('<p>a\u2009; b</p>')],
    ['espace sans chasse devant :', fr('<p>a\u200b: b</p>')],
    ['U+202F devant :', fr(`<p>chacun${NNBSP}: mon rôle</p>`)],
    ['espace puis insécable devant :', fr(`<p>chacun ${NBSP}: mon rôle</p>`)],
    ['espace entre deux éléments en ligne', fr('<p><span>chacun</span> <strong>: mon rôle</strong></p>')],
    ['bloc français dans une page anglaise', fr('<div lang="fr"><p>Une page ?</p></div>', 'en')],
    ['accueil : fiche cachée', fr('<div hidden><p>BNP : file</p></div>')],
  ];
  for (const [label, html] of bad) assert.ok(pageSpacingIssues(html).length > 0, `« ${label} » non signalé`);
  const good: [string, string][] = [
    ['U+00A0 devant :', fr(`<p>chacun${NBSP}: mon rôle</p>`)],
    ['U+202F devant ; ? !', fr(`<p>a${NNBSP}; b${NNBSP}? c${NNBSP}!</p>`)],
    ['U+00A0 devant ? (Mono, contrôlé en navigateur)', fr(`<p>La suite${NBSP}?</p>`)],
    ['guillemets avec U+00A0', fr(`<p>«${NBSP}Droit${NBSP}»</p>`)],
    ['anglais', fr('<p>What’s next ? Note : x</p>', 'en')],
    ['anglais dans une page française', fr('<p lang="en">Read : now</p>')],
    ['code', fr('<p>voir <code>a ? b : c</code></p>')],
    ['URL', fr('<p>https://example.org/?q=1 et mailto:x@y.z</p>')],
    ['pas d\'espace du tout', fr('<p>chacun: mon rôle</p>')],
    ['signe en début de bloc', fr('<p>a</p><p>: b</p>')],
    ['script', fr('<p>a</p><script>x = a ? b : c;</script>')],
  ];
  for (const [label, html] of good) assert.deepEqual(pageSpacingIssues(html), [], `« ${label} » signalé à tort`);
  assert.equal(spacedSigns(fr('<p>chacun : a ; b ? « c »</p>')), 5);
  assert.equal(spacedSigns(fr(`<p>chacun${NBSP}: a${NNBSP}; b${NNBSP}? «${NBSP}c${NBSP}»</p>`)), 5, 'les insécables comptent comme des blancs');
  assert.equal(spacedSigns(fr('<p>chacun: a ; b ? « c »</p>')), 4, 'une espace retirée fait baisser le compte');
  assert.deepEqual(spacingIssues('Les fondations : C'), [{ at: 15, message: 'blanc sécable U+0020 devant « : »' }]);
});
