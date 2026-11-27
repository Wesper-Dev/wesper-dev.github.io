// Contrat C4 (réécrit au lot 1c, D2.7) : pages BNP exportées (EN /experiences/bnp-paribas/, FR /fr/experiences/bnp-paribas/).
// Le récit est dans le corps (article .prose) et comparé à FAITS.md §1 ; la carte est un <p class="intro"> ordinaire.
// Le composant de preuve du 1a est retiré : les garanties de chargement en deux modules portent désormais sur l'îlot
// de l'arbre (chunk de l'accueil, préchargeable) et sur le module de scène qu'il charge par import() (jamais atteint
// par un import statique, jamais cité par un HTML). Périmètre : seules / et /fr/ référencent l'îlot ; les pages BNP
// n'embarquent aucun composant client propre à l'application.
// La preuve en navigateur (JavaScript désactivé, ordre des requêtes) est hors de cette suite (D13).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BNP_EN,
  BNP_FR,
  assertDistExists,
  bnpExportText,
  bnpPageErrors,
  cleanupTempDirs,
  distDir,
  makeSandbox,
  modeFlags,
  otherRoutesChainErrors,
  pageScriptUrls,
  parseReport,
  readFaitsBnp,
  readManifest,
  routesOf,
  staticClosure,
  treeChainErrors,
} from './helpers.ts';
import type { BnpSpec, TreeChain } from './helpers.ts';
import { treeChunks } from './helpers-scene.ts';

after(cleanupTempDirs);

// Routes hors accueil : aucune ne doit référencer l'îlot de l'arbre.
const nonHomeRoutes = routesOf(readManifest().paths).filter((r) => r !== '/' && r !== '/fr/');

function pageHtml(spec: BnpSpec): string {
  return readFileSync(join(distDir, spec.dir, 'index.html'), 'utf8');
}

// Îlot et module de scène, repérés sur l'export réel (leurs noms sont identiques dans les copies).
function chain(): TreeChain {
  const c = treeChunks(distDir);
  assert.equal(c.scene.length, 1, `un seul module de scène attendu parmi les import() de l'îlot, reçu ${JSON.stringify(c.scene)}`);
  return { island: c.island, scene: c.scene[0] ?? '' };
}

const nameOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);

for (const spec of [BNP_EN, BNP_FR]) {
  test(`C4 (${spec.lang}) : la page ${spec.route} est complète (h1, lang, canonical, hreflang, récit, carte) et sans composant client propre`, () => {
    assertDistExists();
    assert.deepEqual(bnpPageErrors(distDir, spec), [], `la page ${spec.route} doit passer tous les contrôles`);
  });

  test(`C4 (${spec.lang}) : les cinq paragraphes de article .prose sont ceux de FAITS.md §1, dans l'ordre`, () => {
    assertDistExists();
    const ref = readFaitsBnp();
    const exp = bnpExportText(pageHtml(spec));
    assert.deepEqual(exp.paragraphs, ref.paragraphs[spec.lang], `${spec.route} : récit différent de FAITS.md §1`);
  });

  test(`C4 (${spec.lang}) : chiffre, sous-titre de la carte et méta-description sont ceux de FAITS.md (§1 et §7)`, () => {
    assertDistExists();
    const ref = readFaitsBnp();
    const exp = bnpExportText(pageHtml(spec));
    assert.deepEqual(exp.card, ref.card[spec.lang], `${spec.route} : carte différente de FAITS.md §1`);
    assert.equal(exp.meta, ref.meta[spec.lang], `${spec.route} : méta-description différente de la phrase du premier écran (FAITS.md §7)`);
  });
}

test('C4 : la chaîne de l\'arbre est complète (îlot sur / et /fr/, scène par import()) et les routes hors accueil ne référencent pas l\'îlot', () => {
  assertDistExists();
  const c = chain();
  assert.deepEqual(treeChainErrors(distDir, c), [], "la chaîne îlot → scène doit être complète");
  assert.deepEqual(otherRoutesChainErrors(distDir, nonHomeRoutes, c), [], "aucune route hors accueil ne doit référencer l'îlot");
});

test('C4 : le module de scène n\'est atteint par aucun import statique depuis aucune page (BNP comprise) ; l\'accueil atteint l\'îlot', () => {
  assertDistExists();
  const c = chain();
  for (const route of routesOf(readManifest().paths)) {
    const html = readFileSync(join(distDir, route.slice(1) + 'index.html'), 'utf8');
    const reached = staticClosure(distDir, pageScriptUrls(html));
    assert.equal(reached.has(c.scene), false, `${route} atteint ${nameOf(c.scene)} par import statique`);
    if (route === '/' || route === '/fr/') assert.ok(reached.has(c.island), `${route} : îlot non atteint`);
    else assert.equal(reached.has(c.island), false, `${route} : l'îlot ne doit pas être atteint`);
  }
});

// ---- Mutations du récit et de la carte : détectées par le contrôle de page ----

test('C4 mutation : quatre paragraphes du récit remplacés par « … » (EN) → contrôle en échec', () => {
  const ref = readFaitsBnp();
  const sb = makeSandbox();
  const file = join(sb.artifact, BNP_EN.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const prose = /<div\b[^>]*class="prose"[^>]*>[\s\S]*?<\/div>/i.exec(html)?.[0] ?? '';
  const paragraphs = [...prose.matchAll(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi)].map((m) => m[0]);
  assert.equal(paragraphs.length, 5, 'cinq paragraphes attendus dans la copie');
  const replaced = prose.replace(paragraphs.slice(1).join(''), paragraphs.slice(1).map(() => '<p>…</p>').join(''));
  writeFileSync(file, html.replace(prose, replaced));
  const errors = bnpPageErrors(sb.artifact, BNP_EN, ref);
  assert.ok(errors.some((e) => e.includes('FAITS.md §1')), `les paragraphes remplacés doivent être signalés. Erreurs : ${JSON.stringify(errors)}`);
});

test('C4 mutation : chiffre de la carte modifié (FR) → contrôle en échec', () => {
  const ref = readFaitsBnp();
  const sb = makeSandbox();
  const file = join(sb.artifact, BNP_FR.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  // Tour W (W3 3.1) : espace insécable entre le nombre et « min » ; le témoin prend les deux formes et doit agir.
  const mutated = html.replace(/3–5[ \u00a0]min → 1–3[ \u00a0]min par rapport/, '2 min → 1 min par rapport');
  assert.notEqual(mutated, html, 'témoin sans effet : chiffre de la carte introuvable');
  writeFileSync(file, mutated);
  const errors = bnpPageErrors(sb.artifact, BNP_FR, ref);
  assert.ok(errors.some((e) => e.includes('carte')), `le chiffre de la carte doit être comparé. Erreurs : ${JSON.stringify(errors)}`);
});

test('C4 mutation : méta-description qui ne reprend pas la phrase du premier écran (EN) → contrôle en échec', () => {
  const ref = readFaitsBnp();
  const sb = makeSandbox();
  const file = join(sb.artifact, BNP_EN.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, html.replace(/(<meta[^>]*name="description"[^>]*content=")[^"]*(")/i, '$1Une autre phrase.$2'));
  const errors = bnpPageErrors(sb.artifact, BNP_EN, ref);
  assert.ok(errors.some((e) => e.includes('méta-description')), `la méta-description doit être comparée. Erreurs : ${JSON.stringify(errors)}`);
});

// ---- Mutations de la chaîne de l'arbre : détectées par check-export.py sur la copie artifact ----

test('C4 mutation : import() de la scène cassé dans l\'îlot (sous-dossier inexistant) → check-export signale l\'import', () => {
  const c = chain();
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  const scene = nameOf(c.scene);
  const file = join(sb.artifact, c.island.replace(/^\//, ''));
  const source = readFileSync(file, 'utf8');
  assert.ok(source.includes('./' + scene), `la chaîne ./${scene} doit figurer dans l'îlot`);
  writeFileSync(file, source.split('./' + scene).join('./sous-dossier/' + scene));
  const r = sb.checkRun(flags);
  assert.equal(r.status, 1, `code 1 attendu : import cassé, reçu ${r.status}. stderr : ${r.stderr.slice(0, 300)}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => e.includes(scene) || e.includes('sous-dossier')), `une erreur doit nommer l'import cassé. Erreurs : ${JSON.stringify(errors)}`);
});

test('C4 garde : une chaîne ressemblant à un chemin (console.info("./exemple.js")) dans l\'îlot ne déclenche aucune erreur', () => {
  const c = chain();
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  const file = join(sb.artifact, c.island.replace(/^\//, ''));
  writeFileSync(file, readFileSync(file, 'utf8') + '\nconsole.info("./exemple.js");\n');
  const r = sb.checkRun(flags);
  assert.equal(r.status, 0, `une simple chaîne ne doit pas être traitée comme un import. stdout : ${r.stdout.slice(0, 300)}`);
  assert.deepEqual(parseReport(r.stdout).errors, []);
});

test('C4 mutation : module commun important statiquement le module de scène → check-export signale la chaîne statique', () => {
  const c = chain();
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  const projectsHtml = readFileSync(join(sb.artifact, 'projects', 'index.html'), 'utf8');
  const common = pageScriptUrls(projectsHtml).find((u) => u.includes('/_next/static/chunks/index-'));
  assert.ok(common, 'module commun de /projects/ introuvable');
  const commonFile = join(sb.artifact, common.replace(/^\//, ''));
  writeFileSync(commonFile, `import"./${nameOf(c.scene)}";\n` + readFileSync(commonFile, 'utf8'));
  const r = sb.checkRun(flags);
  assert.equal(r.status, 1, `code 1 attendu : chaîne statique vers le module à la demande, reçu ${r.status}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => e.includes(nameOf(c.scene)) || e.includes('/projects/')), `une erreur doit nommer la chaîne statique. Erreurs : ${JSON.stringify(errors)}`);
});

// ---- Mutations de la chaîne historique (récit) et de la chaîne de l'arbre : détectées par les contrôles du test ----

test('C4 mutation : récit retiré du corps (paragraphes .prose supprimés) → contrôle en échec (EN)', () => {
  const sb = makeSandbox();
  const file = join(sb.artifact, BNP_EN.dir, 'index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/<div\b[^>]*class="prose"[^>]*>[\s\S]*?<\/div>/i, '<div class="prose"></div>'));
  assert.ok(bnpPageErrors(sb.artifact, BNP_EN).length > 0, 'un article sans récit doit être refusé');
});

test('C4 mutation : phrase exigée retirée du corps (FR) → contrôle en échec', () => {
  const sb = makeSandbox();
  const file = join(sb.artifact, BNP_FR.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, html.replace(/<article\b[^>]*>[\s\S]*?<\/article>/i, (a) => a.replace(/en binôme/g, '')));
  const errors = bnpPageErrors(sb.artifact, BNP_FR);
  assert.ok(errors.some((e) => e.includes('en binôme')), `la phrase doit être exigée dans le corps. Erreurs : ${JSON.stringify(errors)}`);
});

test('C4 mutation : la page BNP précharge l\'îlot de l\'arbre (composant client propre) → contrôle en échec', () => {
  const c = chain();
  const sb = makeSandbox();
  const file = join(sb.artifact, BNP_EN.dir, 'index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', `<link rel="modulepreload" href="${c.island}"/></head>`));
  const errors = bnpPageErrors(sb.artifact, BNP_EN);
  assert.ok(errors.some((e) => e.includes(nameOf(c.island))), `un composant client sur la page BNP doit être refusé. Erreurs : ${JSON.stringify(errors)}`);
});

test('C4 mutation : <p class="intro"> transformé en composant (attribut data-client-proof) → contrôle en échec', () => {
  const sb = makeSandbox();
  const file = join(sb.artifact, BNP_FR.dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const changed = html.replace('<p class="intro">', '<p class="intro" data-client-proof="">');
  assert.notEqual(changed, html, '<p class="intro"> introuvable dans la copie');
  writeFileSync(file, changed);
  assert.ok(bnpPageErrors(sb.artifact, BNP_FR).length > 0, 'un <p class="intro"> qui n\'est plus ordinaire doit être refusé');
});

test('C4 mutation : module de scène retiré de l\'export → contrôle en échec', () => {
  const c = chain();
  const sb = makeSandbox();
  rmSync(join(sb.artifact, c.scene.replace(/^\//, '')));
  const errors = treeChainErrors(sb.artifact, c);
  assert.ok(errors.some((e) => e.includes(nameOf(c.scene))), `le module chargé à la demande absent doit être signalé. Erreurs : ${JSON.stringify(errors)}`);
});

test('C4 mutation : module de scène préchargé dans le HTML de /fr/ → contrôle en échec', () => {
  const c = chain();
  const sb = makeSandbox();
  const file = join(sb.artifact, 'fr', 'index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', `<link rel="modulepreload" href="${c.scene}"/></head>`));
  const errors = treeChainErrors(sb.artifact, c);
  assert.ok(errors.some((e) => e.includes(nameOf(c.scene))), `un préchargement du module à la demande doit être refusé. Erreurs : ${JSON.stringify(errors)}`);
});

test('C4 mutation : une route hors accueil (projects/) référence l\'îlot → contrôle en échec', () => {
  const c = chain();
  const sb = makeSandbox();
  const file = join(sb.artifact, 'projects', 'index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', `<link rel="modulepreload" href="${c.island}"/></head>`));
  const errors = otherRoutesChainErrors(sb.artifact, nonHomeRoutes, c);
  assert.ok(errors.some((e) => e.includes('/projects/')), `la route /projects/ doit être signalée. Erreurs : ${JSON.stringify(errors)}`);
});
