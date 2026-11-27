// Contrat C1 : manifeste unique content/routes.json, lu par les deux scripts. Totaux calculés depuis le manifeste lu.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  JALON_PATHS,
  ORIGIN,
  checkScriptPath,
  cleanupTempDirs,
  makeSandbox,
  manifestPath,
  modeFlags,
  normalizeScriptPath,
  parseReport,
  readJson,
  readManifest,
  routesOf,
  sitemapLocs,
  sitemapLocsOf,
} from './helpers.ts';

after(cleanupTempDirs);

const SLUGS = ['droit-de-retard', 'croix-rouge', 'bnp-paribas', 'bpce', 'ecole-42', 'diary', 'hackathons', 'skills', 'projects', 'experiences'];

// Repère les listes de chemins écrites en dur : littéraux entre guillemets contenant un chemin du jalon ou un slug.
function hardCodedRoutesIn(source: string): string[] {
  const found: string[] = [];
  for (const p of JALON_PATHS.filter((x) => x !== '')) {
    for (const v of [p, p.replace(/\/$/, ''), '/' + p]) {
      for (const q of ["'", '"', '`']) {
        if (source.includes(q + v + q)) found.push(q + v + q);
      }
    }
  }
  const re = new RegExp(`(['"\`])[^'"\`\\n]*\\b(${SLUGS.join('|')})\\b[^'"\`\\n]*\\1`, 'g');
  for (const m of source.matchAll(re)) found.push(m[0]);
  return found;
}

test('C1 : content/routes.json existe avec exactement les clés origin et paths', () => {
  assert.ok(existsSync(manifestPath), `manifeste absent : ${manifestPath}`);
  const data = readJson(manifestPath);
  assert.deepEqual(Object.keys(data).sort(), ['origin', 'paths'], 'le manifeste doit avoir exactement les clés origin et paths');
  assert.equal(typeof data.origin, 'string', 'origin doit être une chaîne');
  assert.ok(Array.isArray(data.paths) && data.paths.every((p) => typeof p === 'string'), 'paths doit être un tableau de chaînes');
});

test('C1 : le manifeste contient les huit chemins du jalon et origin wesper-dev', () => {
  const manifest = readManifest();
  assert.equal(manifest.origin, ORIGIN, 'origin attendu : https://wesper-dev.github.io');
  for (const p of JALON_PATHS) {
    assert.ok(manifest.paths.includes(p), `chemin du jalon absent du manifeste : « ${p} »`);
  }
});

test('C1 : normalize-export.mjs ne contient plus de liste de chemins en dur', () => {
  const found = hardCodedRoutesIn(readFileSync(normalizeScriptPath, 'utf8'));
  assert.deepEqual(found, [], `littéraux de routes en dur dans normalize-export.mjs : ${found.join(' ')}`);
});

test('C1 : check-export.py ne contient plus de liste de chemins en dur', () => {
  const found = hardCodedRoutesIn(readFileSync(checkScriptPath, 'utf8'));
  assert.deepEqual(found, [], `littéraux de routes en dur dans check-export.py : ${found.join(' ')}`);
});

test('C1 : normalize-export.mjs lit content/routes.json', () => {
  assert.ok(readFileSync(normalizeScriptPath, 'utf8').includes('routes.json'), 'normalize-export.mjs doit lire content/routes.json');
});

test('C1 : check-export.py lit content/routes.json', () => {
  assert.ok(readFileSync(checkScriptPath, 'utf8').includes('routes.json'), 'check-export.py doit lire content/routes.json');
});

// Comportement : avec un manifeste réduit, les scripts ne produisent que les routes de ce manifeste.
// Exécutés dans le bac à sable (copie des scripts), avec --dist sur la copie artifact.
test('C1 : avec un manifeste réduit, normalize-export.mjs ne liste au sitemap que les routes du manifeste', () => {
  const sb = makeSandbox();
  const manifest = { origin: ORIGIN, paths: ['', 'skills/'] };
  sb.writeManifest(JSON.stringify(manifest));
  const r = sb.normalizeRun();
  assert.equal(r.status, 0, `normalize doit réussir avec le manifeste réduit (code ${r.status}) : ${r.stderr.slice(0, 400)}`);
  const locs = sitemapLocs(readFileSync(join(sb.artifact, 'sitemap.xml'), 'utf8'));
  assert.deepEqual([...locs].sort(), sitemapLocsOf(manifest).sort(), 'le sitemap doit suivre le manifeste réduit, pas une liste en dur');
});

test('C1 : avec un manifeste réduit, check-export.py compte les routes du manifeste', () => {
  const sb = makeSandbox();
  const manifest = { origin: ORIGIN, paths: ['', 'skills/'] };
  sb.writeManifest(JSON.stringify(manifest));
  assert.equal(sb.normalizeRun().status, 0, 'normalize doit réussir avec le manifeste réduit');
  const report = parseReport(sb.checkRun(modeFlags(sb.artifact)).stdout);
  assert.equal(report.routes, routesOf(manifest.paths).length, `le rapport doit compter ${routesOf(manifest.paths).length} routes d'après le manifeste réduit, reçu ${String(report.routes)}`);
});
