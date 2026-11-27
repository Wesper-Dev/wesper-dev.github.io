// Contrat C2 : node scripts/normalize-export.mjs [--dist <dossier>], exécuté sur une copie ne contenant que les sources à plat.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanupTempDirs,
  dirIndexFor,
  fillMissingFlatPages,
  flatSourceFor,
  makeSandbox,
  readManifest,
  removeDirIndexes,
  removeGenerated,
  robotsDisallowsAll,
  routesOf,
  sitemapLocs,
  sitemapLocsOf,
  snapshotDir,
} from './helpers.ts';
import type { Sandbox } from './helpers.ts';

after(cleanupTempDirs);

const manifest = readManifest();
const routes = routesOf(manifest.paths);

// Copie qui ne contient que les sources à plat : aucun produit de normalisation, aucun index de répertoire.
function flatOnly(): Sandbox {
  const sb = makeSandbox();
  removeGenerated(sb.artifact);
  removeDirIndexes(sb.artifact, routes);
  fillMissingFlatPages(sb.artifact, routes);
  return sb;
}

function ranOk(sb: Sandbox, env: Record<string, string> = {}): void {
  const r = sb.normalizeRun(env);
  assert.equal(r.status, 0, `normalize doit réussir (code ${r.status}) : ${r.stderr.slice(0, 400)}`);
}

test('C2 : depuis les seules sources à plat, la normalisation recrée <route>/index.html pour chaque route du manifeste', () => {
  const sb = flatOnly();
  for (const route of routes) assert.ok(!existsSync(join(sb.artifact, dirIndexFor(route))) || route === '/', `copie de départ : ${dirIndexFor(route)} ne doit pas exister`);
  ranOk(sb);
  for (const route of routes) {
    const dest = join(sb.artifact, dirIndexFor(route));
    assert.ok(existsSync(dest), `${route} : ${dirIndexFor(route)} absent après normalisation`);
    assert.equal(readFileSync(dest, 'utf8'), readFileSync(join(sb.artifact, flatSourceFor(route)), 'utf8'), `${route} : doit être une copie de ${flatSourceFor(route)}`);
  }
});

test('C2 : depuis les seules sources à plat, la normalisation écrit 404.html, copie de missing.html', () => {
  const sb = flatOnly();
  ranOk(sb);
  const notFound = join(sb.artifact, '404.html');
  assert.ok(existsSync(notFound), '404.html absent après normalisation');
  assert.equal(readFileSync(notFound, 'utf8'), readFileSync(join(sb.artifact, 'missing.html'), 'utf8'), '404.html doit être une copie de missing.html');
});

test('C2 : depuis les seules sources à plat, la normalisation écrit .nojekyll', () => {
  const sb = flatOnly();
  ranOk(sb);
  assert.ok(existsSync(join(sb.artifact, '.nojekyll')), '.nojekyll absent après normalisation');
});

test('C2 : depuis les seules sources à plat, sitemap.xml liste exactement les URL du manifeste lu', () => {
  const sb = flatOnly();
  ranOk(sb);
  const locs = sitemapLocs(readFileSync(join(sb.artifact, 'sitemap.xml'), 'utf8'));
  const expected = sitemapLocsOf(manifest);
  assert.equal(locs.length, expected.length, `le sitemap doit lister ${expected.length} URL, reçu ${locs.length} : ${locs.join(' ')}`);
  assert.deepEqual([...locs].sort(), [...expected].sort(), 'les URL du sitemap doivent être exactement celles du manifeste, avec origin');
});

test('C2 : robots.txt bloque tout sans SITE_PUBLIC, y compris avec SITE_PUBLIC=0', () => {
  const envs: Record<string, string>[] = [{}, { SITE_PUBLIC: '0' }];
  for (const env of envs) {
    const sb = flatOnly();
    ranOk(sb, env);
    const robots = readFileSync(join(sb.artifact, 'robots.txt'), 'utf8');
    assert.ok(robotsDisallowsAll(robots), `avec ${JSON.stringify(env)}, robots.txt doit contenir « Disallow: / ». Reçu : ${JSON.stringify(robots)}`);
  }
});

test('C2 : robots.txt ne bloque plus rien avec SITE_PUBLIC=1', () => {
  const sb = flatOnly();
  ranOk(sb, { SITE_PUBLIC: '1' });
  const robots = readFileSync(join(sb.artifact, 'robots.txt'), 'utf8');
  assert.ok(!robotsDisallowsAll(robots), `avec SITE_PUBLIC=1, robots.txt ne doit pas contenir « Disallow: / ». Reçu : ${JSON.stringify(robots)}`);
});

test('C2 : --dist désigne le dossier demandé et le dossier par défaut témoin n\'est pas touché', () => {
  const sb = makeSandbox();
  const witnessBefore = snapshotDir(sb.witness);
  const artifactBefore = snapshotDir(sb.artifact);
  // Dossier distinct : une copie des sources à plat seulement, hors de dist/client.
  const other = join(sb.root, 'autre-sortie');
  cpSync(sb.artifact, other, { recursive: true });
  removeGenerated(other);
  removeDirIndexes(other, routes);
  const r = sb.normalizeAt(other);
  assert.equal(r.status, 0, `normalize --dist doit réussir (code ${r.status}) : ${r.stderr.slice(0, 300)}`);
  assert.ok(existsSync(join(other, 'sitemap.xml')), 'le sitemap doit être écrit dans le dossier passé en --dist');
  assert.ok(existsSync(join(other, dirIndexFor(routes[routes.length - 1]))), 'les index doivent être écrits dans le dossier passé en --dist');
  assert.deepEqual(snapshotDir(sb.witness), witnessBefore, 'le dossier par défaut témoin ne doit pas être modifié');
  assert.deepEqual(snapshotDir(sb.artifact), artifactBefore, 'la copie artifact ne doit pas être modifiée quand --dist désigne un autre dossier');
});

test('C2 : une page à plat absente d\'une route déjà connue (projects/diary) fait échouer la normalisation', () => {
  const sb = flatOnly();
  rmSync(join(sb.artifact, 'projects', 'diary.html'));
  assert.notEqual(sb.normalizeRun().status, 0, 'normalize doit sortir avec un code non nul si projects/diary.html manque');
});

test('C2 : une page à plat absente d\'une route du manifeste (experiences/bnp-paribas) fait échouer la normalisation', () => {
  const sb = flatOnly();
  rmSync(join(sb.artifact, 'experiences', 'bnp-paribas.html'));
  assert.notEqual(sb.normalizeRun().status, 0, 'normalize doit sortir avec un code non nul si experiences/bnp-paribas.html manque (route du manifeste)');
});

// Une source qui n'est pas un fichier lisible : échec avant toute écriture.
test('C2 source : un répertoire nommé index.html à la place de la page d\'accueil → échec avant toute écriture', () => {
  const sb = flatOnly();
  rmSync(join(sb.artifact, 'index.html'));
  mkdirSync(join(sb.artifact, 'index.html'));
  const before = snapshotDir(sb.artifact);
  const r = sb.normalizeRun({ SITE_PUBLIC: '1' });
  assert.notEqual(r.status, 0, `normalize doit sortir avec un code non nul si index.html est un répertoire (reçu ${r.status})`);
  assert.ok(`${r.stdout}\n${r.stderr}`.includes('index.html'), `la sortie doit nommer index.html. stderr : ${r.stderr.slice(0, 300)}`);
  assert.deepEqual(snapshotDir(sb.artifact), before, 'aucun fichier ne doit être écrit');
});

test('C2 source : un répertoire nommé missing.html → échec avant toute écriture, page témoin intacte', () => {
  const sb = flatOnly();
  rmSync(join(sb.artifact, 'missing.html'));
  mkdirSync(join(sb.artifact, 'missing.html'));
  writeFileSync(join(sb.artifact, 'projects', 'index.html'), 'TEMOIN');
  const before = snapshotDir(sb.artifact);
  const r = sb.normalizeRun({ SITE_PUBLIC: '1' });
  assert.notEqual(r.status, 0, `normalize doit sortir avec un code non nul si missing.html est un répertoire (reçu ${r.status})`);
  assert.ok(`${r.stdout}\n${r.stderr}`.includes('missing.html'), `la sortie doit nommer missing.html. stderr : ${r.stderr.slice(0, 300)}`);
  assert.equal(readFileSync(join(sb.artifact, 'projects', 'index.html'), 'utf8'), 'TEMOIN', 'la page témoin ne doit pas être écrasée');
  assert.deepEqual(snapshotDir(sb.artifact), before, 'aucun fichier ne doit être écrit');
});
