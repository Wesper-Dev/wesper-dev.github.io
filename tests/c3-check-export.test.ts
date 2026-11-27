// Contrat C3 : python3 scripts/check-export.py [--public] [--dist <dossier>] (rapport JSON, comparaison dans les deux sens).
// Indépendant du mode : --public est passé si et seulement si l'export testé est public (robots.txt sans « Disallow: / »).
// Les mutations portent sur la copie artifact (passée en --dist) ; le dossier par défaut témoin ne doit rien changer.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BNP_EN,
  BNP_FR,
  ORIGIN,
  assertDistExists,
  checkScriptPath,
  cleanupTempDirs,
  distDir,
  exportModeOf,
  makePublicArtifact,
  makeSandbox,
  modeFlags,
  namesPage,
  parseReport,
  placeholderPage,
  readManifest,
  routesOf,
  runPython,
  snapshotDir,
} from './helpers.ts';
import type { Sandbox } from './helpers.ts';

after(cleanupTempDirs);

const manifest = readManifest();
const ROUTES = routesOf(manifest.paths);

const PREVIEW_ROBOTS = 'User-agent: *\nDisallow: /\n';
const PUBLIC_ROBOTS = 'User-agent: *\nAllow: /\nSitemap: ' + ORIGIN + '/sitemap.xml\n';

// Un export non modifié doit passer avec les options de son mode : base des mutations.
function assertCleanBaseline(sb: Sandbox, flags: string[]): void {
  const r = sb.checkRun(flags);
  assert.equal(r.status, 0, `avant mutation, l'export doit passer le contrôle (code ${r.status}) : ${r.stdout.slice(0, 400)}${r.stderr.slice(0, 400)}`);
  assert.deepEqual(parseReport(r.stdout).errors, [], 'avant mutation, errors doit être vide');
}

// Après mutation : code 1 et au moins une erreur qui nomme la cible.
function expectDetected(sb: Sandbox, flags: string[], label: string, names: (errors: string[]) => boolean, cible: string): void {
  const r = sb.checkRun(flags);
  assert.equal(r.status, 1, `${label} : code de sortie 1 attendu après mutation, reçu ${r.status}. Sortie : ${r.stdout.slice(0, 300)}${r.stderr.slice(0, 300)}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.length > 0, `${label} : errors doit être non vide après mutation`);
  assert.ok(names(errors), `${label} : aucune erreur ne nomme ${cible}. Erreurs : ${JSON.stringify(errors)}`);
}

// Ajoute une chaîne juste avant </body> d'une page de l'artifact.
function injectIntoPage(sb: Sandbox, relDir: string, snippet: string): void {
  const file = join(sb.artifact, relDir, 'index.html');
  const html = readFileSync(file, 'utf8');
  assert.ok(html.includes('</body>'), `${relDir}/index.html sans </body>`);
  writeFileSync(file, html.replace('</body>', snippet + '</body>'));
}

// Retire le bloc <url> dont le <loc> est exactement `loc`.
function removeUrlBlock(xml: string, loc: string): string {
  const at = xml.indexOf(`<loc>${loc}</loc>`);
  assert.ok(at >= 0, `sitemap de base sans ${loc}`);
  const start = xml.lastIndexOf('<url>', at);
  const end = xml.indexOf('</url>', at) + '</url>'.length;
  return xml.slice(0, start) + xml.slice(end);
}

test('C3 : export réel (mode détecté) : check-export.py passe (code 0, routes = routes du manifeste, errors vide)', () => {
  assertDistExists();
  const flags = modeFlags(distDir);
  const r = runPython([checkScriptPath, ...flags]);
  assert.equal(r.status, 0, `code 0 attendu sur l'export réel (${exportModeOf(distDir)}), reçu ${r.status}. Sortie : ${r.stdout.slice(0, 600)}${r.stderr.slice(0, 300)}`);
  const report = parseReport(r.stdout);
  assert.equal(report.routes, ROUTES.length, `le rapport doit compter ${ROUTES.length} routes, reçu ${String(report.routes)}`);
  assert.deepEqual(report.errors, [], "errors doit être vide sur l'export réel");
  assert.equal(typeof report.mode, 'string', 'le rapport doit contenir une clé mode (chaîne)');
});

// ---- Rapport JSON garanti (échecs d'entrée) ----

function rawReportCase(label: string, prepare: (sb: Sandbox) => { dist: string; flags: string[]; token: string }): void {
  test(`C3 rapport : ${label} → rapport JSON sur stdout, code 1, erreur qui nomme le fichier`, () => {
    const sb = makeSandbox();
    const { dist, flags, token } = prepare(sb);
    const r = sb.checkAt(dist, flags);
    assert.equal(r.status, 1, `code 1 attendu (${label}), reçu ${r.status}. stderr : ${r.stderr.slice(0, 300)}`);
    const report = parseReport(r.stdout);
    assert.ok('mode' in JSON.parse(r.stdout) && 'routes' in JSON.parse(r.stdout), 'le rapport doit contenir les clés mode et routes');
    assert.ok(report.errors.length > 0, `errors doit être non vide (${label})`);
    assert.ok(report.errors.every((e) => e.trim().length > 0), 'chaque erreur doit être une chaîne non vide');
    assert.ok(report.errors.some((e) => e.includes(token)), `une erreur doit nommer « ${token} ». Erreurs : ${JSON.stringify(report.errors)}`);
  });
}

rawReportCase('--dist inexistant', (sb) => ({
  dist: join(sb.root, 'inexistant'),
  flags: [],
  token: 'inexistant',
}));
rawReportCase('404.html manquant', (sb) => {
  rmSync(join(sb.artifact, '404.html'));
  return { dist: sb.artifact, flags: modeFlags(sb.witness), token: '404.html' };
});
rawReportCase('robots.txt manquant', (sb) => {
  const flags = modeFlags(sb.artifact);
  rmSync(join(sb.artifact, 'robots.txt'));
  return { dist: sb.artifact, flags, token: 'robots.txt' };
});
rawReportCase('sitemap.xml manquant', (sb) => {
  rmSync(join(sb.artifact, 'sitemap.xml'));
  return { dist: sb.artifact, flags: modeFlags(sb.witness), token: 'sitemap.xml' };
});
rawReportCase('sitemap.xml tronqué (XML invalide)', (sb) => {
  const file = join(sb.artifact, 'sitemap.xml');
  const xml = readFileSync(file, 'utf8');
  writeFileSync(file, xml.slice(0, Math.floor(xml.length / 2)));
  return { dist: sb.artifact, flags: modeFlags(sb.witness), token: 'sitemap.xml' };
});

// ---- Mutations (a, b, c, d) : détectées sur la copie artifact ----

test('C3 a : route du manifeste sans <route>/index.html (EN projects/diary) → erreur nommant la route', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  rmSync(join(sb.artifact, 'projects', 'diary', 'index.html'));
  expectDetected(sb, flags, 'a (EN)', (e) => namesPage(e, 'projects/diary/'), '/projects/diary/');
});

test('C3 a : route du manifeste sans <route>/index.html (FR fr/projects/diary) → erreur nommant la route', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  rmSync(join(sb.artifact, 'fr', 'projects', 'diary', 'index.html'));
  expectDetected(sb, flags, 'a (FR)', (e) => namesPage(e, 'fr/projects/diary/'), '/fr/projects/diary/');
});

test('C3 b : index.html de répertoire pour une route absente du manifeste → erreur nommant la route', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  mkdirSync(join(sb.artifact, 'unlisted-page'));
  writeFileSync(join(sb.artifact, 'unlisted-page', 'index.html'), placeholderPage('unlisted-page'));
  expectDetected(sb, flags, 'b', (e) => e.some((x) => x.includes('unlisted-page')), 'unlisted-page');
});

test('C3 c : page à plat sans route à la racine (orphan.html) → erreur nommant le fichier', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  writeFileSync(join(sb.artifact, 'orphan.html'), placeholderPage('orphan'));
  expectDetected(sb, flags, 'c (racine)', (e) => e.some((x) => x.includes('orphan')), 'orphan.html');
});

test('C3 c : page à plat sans route dans un sous-dossier (projects/ghost.html) → erreur nommant le fichier', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  writeFileSync(join(sb.artifact, 'projects', 'ghost.html'), placeholderPage('ghost'));
  expectDetected(sb, flags, 'c (sous-dossier)', (e) => e.some((x) => x.includes('ghost')), 'projects/ghost.html');
});

test('C3 c : les exceptions index.html, 404.html, missing.html et fr.html ne déclenchent aucune erreur', () => {
  const sb = makeSandbox();
  const { errors } = parseReport(sb.checkRun(modeFlags(sb.artifact)).stdout);
  const named = errors.filter((e) => /(^|[\s'"(])(404|missing|fr|index)\.html\b/.test(e));
  assert.deepEqual(named, [], `les pages d'exception ne doivent pas être signalées : ${JSON.stringify(named)}`);
});

test('C3 d : sitemap sans une route du manifeste (EN projects/diary) → erreur nommant sitemap ou la route', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  writeFileSync(sitemap, removeUrlBlock(readFileSync(sitemap, 'utf8'), manifest.origin + '/projects/diary/'));
  expectDetected(sb, flags, 'd (URL retirée)', (e) => e.some((x) => /sitemap/i.test(x)) || namesPage(e, 'projects/diary/'), 'sitemap.xml ni /projects/diary/');
});

test('C3 d : sitemap avec une URL en trop (ghost) → erreur nommant sitemap ou la route', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  const xml = readFileSync(sitemap, 'utf8');
  writeFileSync(sitemap, xml.replace('</urlset>', `<url><loc>${manifest.origin}/ghost/</loc></url>\n</urlset>`));
  expectDetected(sb, flags, 'd (URL en trop)', (e) => e.some((x) => /sitemap/i.test(x)) || e.some((x) => x.includes('ghost')), 'sitemap.xml ni /ghost/');
});

// ---- Sitemap : entrées dupliquées, éléments remplacés, alternances fausses ----

test('C3 sitemap : une entrée <url> dupliquée → erreur (21 entrées pour 20 routes)', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  const xml = readFileSync(sitemap, 'utf8');
  const first = /<url>[\s\S]*?<\/url>/.exec(xml)?.[0] ?? '';
  assert.ok(first.length > 0, 'sitemap de base sans bloc <url>');
  writeFileSync(sitemap, xml.replace(first, first + '\n' + first));
  expectDetected(sb, flags, 'sitemap dupliqué', (e) => e.some((x) => /sitemap/i.test(x)), 'sitemap.xml');
});

test('C3 sitemap : les <url> remplacés par un autre élément → erreur', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  const xml = readFileSync(sitemap, 'utf8');
  writeFileSync(sitemap, xml.replace(/<url>/g, '<autre>').replace(/<\/url>/g, '</autre>'));
  expectDetected(sb, flags, 'sitemap à éléments remplacés', (e) => e.some((x) => /sitemap/i.test(x)), 'sitemap.xml');
});

test('C3 sitemap : alternance hreflang fr fausse dans la première entrée → erreur', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  const xml = readFileSync(sitemap, 'utf8');
  const good = `hreflang="fr" href="${manifest.origin}/fr/"`;
  assert.ok(xml.includes(good), 'sitemap de base sans alternance fr de la racine');
  writeFileSync(sitemap, xml.replace(good, `hreflang="fr" href="${manifest.origin}/mauvaise/"`));
  expectDetected(sb, flags, 'alternance fr', (e) => e.some((x) => /sitemap/i.test(x)), 'sitemap.xml (alternance fr)');
});

test('C3 sitemap : alternance x-default fausse dans la première entrée → erreur', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  const xml = readFileSync(sitemap, 'utf8');
  const good = `hreflang="x-default" href="${manifest.origin}/"`;
  assert.ok(xml.includes(good), 'sitemap de base sans x-default de la racine');
  writeFileSync(sitemap, xml.replace(good, `hreflang="x-default" href="${manifest.origin}/mauvaise/"`));
  expectDetected(sb, flags, 'alternance x-default', (e) => e.some((x) => /sitemap/i.test(x)), 'sitemap.xml (x-default)');
});

test('C3 sitemap : alternance en fausse dans la première entrée → erreur', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  const xml = readFileSync(sitemap, 'utf8');
  const good = `hreflang="en" href="${manifest.origin}/"`;
  assert.ok(xml.includes(good), 'sitemap de base sans alternance en de la racine');
  writeFileSync(sitemap, xml.replace(good, `hreflang="en" href="${manifest.origin}/mauvaise/"`));
  expectDetected(sb, flags, 'alternance en', (e) => e.some((x) => /sitemap/i.test(x)), 'sitemap.xml (en)');
});

// ---- Liens internes ----

test('C3 liens : un lien vers un répertoire existant sans slash final (/fr/skills) est accepté', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(sb, BNP_FR.dir, '<a href="/fr/skills">Compétences</a>');
  const { errors } = parseReport(sb.checkRun(flags).stdout);
  assert.deepEqual(errors, [], `un lien vers /fr/skills (répertoire existant) ne doit pas être signalé : ${JSON.stringify(errors)}`);
});

test('C3 liens : un lien vers un chemin absent est refusé et nomme la cible', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(sb, BNP_FR.dir, '<a href="/fr/chemin-absent/">Absent</a>');
  expectDetected(sb, flags, 'lien absent', (e) => e.some((x) => x.includes('chemin-absent')), '/fr/chemin-absent/');
});

test('C3 liens : une ancre absente dans une page répertoire (/fr/skills/#zz-absente) est refusée', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(sb, BNP_FR.dir, '<a href="/fr/skills/#zz-absente">Ancre</a>');
  expectDetected(sb, flags, 'ancre absente', (e) => e.some((x) => x.includes('zz-absente')), '#zz-absente');
});

// ---- Confidentialité : téléphones nationaux et liens tel: ----

for (const phone of ['01 00 00 00 00', '0100000000', '06.00.00.00.00', '+33 1 00 00 00 00', '0033 1 00 00 00 00']) {
  test(`C3 confidentialité : le numéro « ${phone} » affiché dans une page → erreur nommant la page`, () => {
    const sb = makeSandbox();
    const flags = modeFlags(sb.artifact);
    assertCleanBaseline(sb, flags);
    injectIntoPage(sb, BNP_FR.dir, `<p>Contact : ${phone}</p>`);
    expectDetected(sb, flags, `téléphone ${phone}`, (e) => namesPage(e, 'fr/experiences/bnp-paribas/'), 'la page BNP FR');
  });
}

test('C3 confidentialité : un lien tel: dans une page → erreur nommant la page', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(sb, BNP_EN.dir, '<a href="tel:0100000000">Appeler</a>');
  expectDetected(sb, flags, 'lien tel:', (e) => namesPage(e, 'experiences/bnp-paribas/'), 'la page BNP EN');
});

test('C3 confidentialité : des mesures et dates BNP (3–5, 1 500, 600 Go, dates, coordonnées SVG) ne sont pas signalées', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(
    sb,
    BNP_FR.dir,
    '<p>3–5 ans, 1 500 lignes, 600 Go, le 12/05/2024, 2024-05-12, 10 h 30, 48.8566 2.3522</p>' +
      '<svg><path d="M 12.34 56.78 L 90.12 34.56"/></svg>',
  );
  const { errors } = parseReport(sb.checkRun(flags).stdout);
  assert.deepEqual(errors, [], `des mesures et dates légitimes ne doivent pas déclencher d'erreur : ${JSON.stringify(errors)}`);
});

// ---- Métadonnées : canonical, x-default, robots.txt public ----

test('C3 métadonnées : une canonical fausse suivie de la bonne → erreur nommant la page', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const file = join(sb.artifact, BNP_EN.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, html.replace('<link rel="canonical"', `<link rel="canonical" href="${manifest.origin}/faux/"/><link rel="canonical"`));
  expectDetected(sb, flags, 'canonical double', (e) => namesPage(e, 'experiences/bnp-paribas/'), 'la page BNP EN');
});

test('C3 métadonnées : un x-default étranger → erreur nommant la page', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const file = join(sb.artifact, BNP_FR.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const changed = html.replace(/(<link[^>]*hreflang="x-default"[^>]*href=")[^"]*(")/i, `$1https://example.invalid/$2`);
  assert.notEqual(changed, html, 'x-default introuvable dans la page BNP FR');
  writeFileSync(file, changed);
  expectDetected(sb, flags, 'x-default étranger', (e) => namesPage(e, 'fr/experiences/bnp-paribas/'), 'la page BNP FR');
});

test('C3 métadonnées : un x-default absent → erreur nommant la page', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const file = join(sb.artifact, BNP_EN.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const changed = html.replace(/<link[^>]*hreflang="x-default"[^>]*\/?>/i, '');
  assert.notEqual(changed, html, 'x-default introuvable dans la page BNP EN');
  writeFileSync(file, changed);
  expectDetected(sb, flags, 'x-default absent', (e) => namesPage(e, 'experiences/bnp-paribas/'), 'la page BNP EN');
});

test('C3 métadonnées : robots.txt public vide avec --public → code 1 et erreur sur robots.txt', () => {
  const sb = makeSandbox();
  writeFileSync(join(sb.artifact, 'robots.txt'), '');
  const r = sb.checkRun(['--public']);
  assert.equal(r.status, 1, `code 1 attendu avec un robots.txt public vide, reçu ${r.status}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => /robots\.txt/i.test(e)), `une erreur doit nommer robots.txt. Erreurs : ${JSON.stringify(errors)}`);
});

// ---- Incohérence de mode : robots.txt fixé dans la copie, indépendant du mode réel ----

test('C3 mode : robots.txt d\'aperçu (Disallow: /) avec --public → code 1 et erreur sur robots', () => {
  const sb = makeSandbox();
  writeFileSync(join(sb.artifact, 'robots.txt'), PREVIEW_ROBOTS);
  const r = sb.checkRun(['--public']);
  assert.equal(r.status, 1, `code 1 attendu : aperçu contrôlé avec --public, reçu ${r.status}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => /robots\.txt/i.test(e)), `une erreur doit nommer robots. Erreurs : ${JSON.stringify(errors)}`);
});

test('C3 mode : robots.txt public (sans Disallow: /) sans --public → code 1 et erreur sur robots', () => {
  const sb = makeSandbox();
  writeFileSync(join(sb.artifact, 'robots.txt'), PUBLIC_ROBOTS);
  const r = sb.checkRun([]);
  assert.equal(r.status, 1, `code 1 attendu : export public contrôlé sans --public, reçu ${r.status}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => /robots\.txt/i.test(e)), `une erreur doit nommer robots. Erreurs : ${JSON.stringify(errors)}`);
});

// Référence de lecture : le contrôle ne doit jamais toucher le dossier par défaut témoin.
test('C3 : check-export.py ne modifie pas le dossier passé en --dist', () => {
  const sb = makeSandbox();
  const before = snapshotDir(sb.artifact);
  sb.checkRun(modeFlags(sb.artifact));
  assert.deepEqual(snapshotDir(sb.artifact), before, 'le contrôle est en lecture seule');
  assert.ok(existsSync(sb.witness), 'témoin présent');
});

// ---- Téléphones reconstitués et champs structurés (confidentialité) ----

const PHONE_SNIPPETS: [string, string][] = [
  ['un numéro reconstitué à travers des éléments en ligne', '<p>0<span>1</span> 00 00 00 00</p>'],
  ['un numéro séparé par un saut de ligne et des espaces', '<p>01 00\n      00 00 00</p>'],
  ['un champ JSON-LD telephone au format national', '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","telephone":"0100000000"}</script>'],
  ['un champ JSON-LD telephone avec espaces', '<script type="application/ld+json">{"@type":"Person","telephone":"01 00 00 00 00"}</script>'],
];

for (const [label, snippet] of PHONE_SNIPPETS) {
  test(`C3 confidentialité : ${label} → erreur nommant la page`, () => {
    const sb = makeSandbox();
    const flags = modeFlags(sb.artifact);
    assertCleanBaseline(sb, flags);
    injectIntoPage(sb, BNP_FR.dir, snippet);
    expectDetected(sb, flags, label, (e) => namesPage(e, 'fr/experiences/bnp-paribas/'), 'la page BNP FR');
  });
}

test('C3 confidentialité : « +33.5 % » et « +331 ms » dans un texte ne déclenchent aucune erreur', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(sb, BNP_FR.dir, '<p>Gain de +33.5 % et temps de réponse de +331 ms.</p>');
  const r = sb.checkRun(flags);
  assert.equal(r.status, 0, `des mesures ne sont pas des numéros de téléphone. Sortie : ${r.stdout.slice(0, 300)}`);
  assert.deepEqual(parseReport(r.stdout).errors, []);
});

// ---- robots.txt : règles par groupe d'agent ----

test('C3 robots : aperçu dont le groupe User-agent: * autorise tout (Disallow: / réservé à OtherBot) → erreur sur robots.txt', () => {
  const sb = makeSandbox();
  writeFileSync(join(sb.artifact, 'robots.txt'), 'User-agent: *\nAllow: /\n\nUser-agent: OtherBot\nDisallow: /\n');
  const r = sb.checkRun([]);
  assert.equal(r.status, 1, `code 1 attendu : le groupe * doit bloquer en aperçu, reçu ${r.status}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => /robots\.txt/i.test(e)), `une erreur doit nommer robots.txt. Erreurs : ${JSON.stringify(errors)}`);
});

test('C3 robots : public dont le groupe User-agent: * bloque tout (Googlebot autorisé) avec --public → erreur sur robots.txt', () => {
  const sb = makeSandbox();
  writeFileSync(join(sb.artifact, 'robots.txt'), 'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n');
  const r = sb.checkRun(['--public']);
  assert.equal(r.status, 1, `code 1 attendu : le groupe * bloque, reçu ${r.status}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => /robots\.txt/i.test(e)), `une erreur doit nommer robots.txt. Erreurs : ${JSON.stringify(errors)}`);
});

// ---- Export public synthétique : métas robots de chaque page ----

test('C3 public synthétique : un export public (méta index, follow ; robots public) passe --public', () => {
  const sb = makeSandbox();
  makePublicArtifact(sb);
  const r = sb.checkRun(['--public']);
  assert.equal(r.status, 0, `export public synthétique attendu sans erreur. Sortie : ${r.stdout.slice(0, 500)}${r.stderr.slice(0, 200)}`);
  assert.deepEqual(parseReport(r.stdout).errors, []);
});

test('C3 public : une méta robots noindex ajoutée avant index, follow → erreur nommant la page', () => {
  const sb = makeSandbox();
  makePublicArtifact(sb);
  const flags = ['--public'];
  assertCleanBaseline(sb, flags);
  const file = join(sb.artifact, BNP_EN.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const changed = html.replace(/<meta[^>]*name="robots"[^>]*content="index, follow"/i, '<meta name="robots" content="noindex, nofollow"/>$&');
  assert.notEqual(changed, html, 'méta robots index, follow introuvable dans la page BNP EN');
  writeFileSync(file, changed);
  expectDetected(sb, flags, 'méta robots noindex supplémentaire', (e) => namesPage(e, 'experiences/bnp-paribas/'), 'la page BNP EN');
});

// ---- Ressources : une page HTML n'est ni une image sociale ni un script ----

test('C3 ressources : og:image pointant vers une page HTML (/fr/skills/) → erreur nommant la page', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const file = join(sb.artifact, BNP_FR.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const changed = html.replace(/(<meta[^>]*property="og:image"[^>]*content=")[^"]*(")/i, `$1${ORIGIN}/fr/skills/$2`);
  assert.notEqual(changed, html, 'og:image introuvable dans la page BNP FR');
  writeFileSync(file, changed);
  expectDetected(sb, flags, 'og:image HTML', (e) => namesPage(e, 'fr/experiences/bnp-paribas/'), 'la page BNP FR');
});

test('C3 ressources : script src pointant vers une page HTML (/fr/skills/) → erreur nommant la page', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(sb, BNP_FR.dir, '<script type="module" src="/fr/skills/"></script>');
  expectDetected(sb, flags, 'script HTML', (e) => namesPage(e, 'fr/experiences/bnp-paribas/'), 'la page BNP FR');
});

test('C3 ressources : script src vers /fr/skills (sans slash, répertoire) → erreur nommant la page', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  injectIntoPage(sb, BNP_FR.dir, '<script type="module" src="/fr/skills"></script>');
  expectDetected(sb, flags, 'script répertoire', (e) => namesPage(e, 'fr/experiences/bnp-paribas/'), 'la page BNP FR');
});

// ---- Sitemap : éléments facultatifs du protocole ----

test('C3 sitemap : un <lastmod> valide après le premier loc est accepté (URL, unicité, alternances inchangées)', () => {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  assertCleanBaseline(sb, flags);
  const sitemap = join(sb.artifact, 'sitemap.xml');
  writeFileSync(sitemap, readFileSync(sitemap, 'utf8').replace('</loc>', '</loc><lastmod>2026-11-20</lastmod>'));
  const r = sb.checkRun(flags);
  assert.equal(r.status, 0, `un lastmod valide ne doit pas être refusé. Sortie : ${r.stdout.slice(0, 300)}`);
  assert.deepEqual(parseReport(r.stdout).errors, []);
});

// ---- Motifs de confidentialité invalides : rapport JSON conservé ----

for (const [label, text] of [
  ['motif de confidentialité « ( » non compilable', '["("]'],
  ['motif de confidentialité null', 'null'],
] as [string, string][]) {
  test(`C3 rapport : --private-patterns avec ${label} → rapport JSON sur stdout, code 1`, () => {
    const sb = makeSandbox();
    const patterns = join(sb.root, 'patterns.json');
    writeFileSync(patterns, text);
    const r = sb.checkRun(['--private-patterns', patterns]);
    assert.equal(r.status, 1, `code 1 attendu, reçu ${r.status}. stderr : ${r.stderr.slice(0, 300)}`);
    assert.doesNotMatch(r.stderr, /Traceback/, 'rapport attendu, pas une exception Python non gérée');
    const { errors } = parseReport(r.stdout);
    assert.ok(errors.some((e) => /motif|pattern|private/i.test(e)), `une erreur doit nommer le fichier de motifs. Erreurs : ${JSON.stringify(errors)}`);
  });
}
