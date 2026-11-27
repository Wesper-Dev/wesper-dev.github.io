// Contrat D11 (lot 1c) : chargement, chunks et budgets, vérifiés sur l'export construit (mode détecté par robots.txt).
// L'îlot est repéré par son comportement (voir treeChunks dans helpers-scene.ts), pas par un nom de fichier.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, distDir, makeSandbox, modeFlags, pageScriptUrls, parseReport, staticClosure } from './helpers.ts';
import type { Sandbox } from './helpers.ts';
import {
  HOME_ROUTES,
  basename,
  exportPages,
  fileSize,
  filesUnder,
  jsUrls,
  readSrc,
  readUrl,
  allFiles,
  siteCodeFiles,
  siteDir,
  treeChunks,
  urlExists,
} from './helpers-scene.ts';

after(cleanupTempDirs);

test('D11.1 : / et /fr/ référencent le chunk de l\'îlot ; aucune autre page (18 routes et la 404, lot 2b) ne le référence', () => {
  // D11.1 : l'îlot n'est chargé que sur l'accueil.
  const { island } = treeChunks();
  const pages = exportPages();
  assert.equal(pages.length, 21, '20 routes et la 404 (lot 2b)');
  for (const p of pages) {
    const refs = pageScriptUrls(p.html);
    const mentions = p.html.includes(basename(island));
    if (HOME_ROUTES.includes(p.route)) assert.ok(refs.includes(island), `${p.route} doit référencer ${island}`);
    else assert.ok(!mentions, `${p.route} référence le chunk de l'îlot ${basename(island)}`);
  }
});

test('D11.1 : le chunk __THREE__ existe, n\'est cité par aucun HTML et n\'est atteint par aucun import statique depuis les entrées d\'une page', () => {
  // D11.1 : three n'arrive que par l'import() de la scène.
  const { three, scene } = treeChunks();
  assert.ok(three.length >= 1, 'chunk __THREE__ absent');
  assert.ok(scene.length >= 1, 'module de scène absent des import() de l\'îlot');
  const lazy = new Set([...three, ...scene]);
  for (const p of exportPages()) {
    for (const u of lazy) assert.ok(!p.html.includes(basename(u)), `${p.route} cite ${basename(u)} (ni <script>, ni modulepreload)`);
    const reached = [...staticClosure(distDir, pageScriptUrls(p.html))].filter((u) => lazy.has(u));
    assert.deepEqual(reached, [], `${p.route} atteint par import statique : ${reached.join(', ')}`);
  }
});

// Copie de l'export, contrôle de base propre, puis mutation et contrôle qui doit échouer en nommant `name`.
function mutateAndCheck(label: string, mutate: (sb: Sandbox) => void, name: string): void {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  const base = sb.checkRun(flags);
  assert.equal(base.status, 0, `avant mutation, l'export doit passer : ${base.stdout.slice(0, 300)}`);
  mutate(sb);
  const r = sb.checkRun(flags);
  assert.equal(r.status, 1, `${label} : check-export doit échouer (code 1), reçu ${r.status}. ${r.stdout.slice(0, 300)}${r.stderr.slice(0, 300)}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => e.includes(name)), `${label} : aucune erreur ne nomme ${name}. Erreurs : ${JSON.stringify(errors)}`);
}

test('D11.2 mutation : module de scène préchargé dans le HTML de l\'accueil → check-export échoue et nomme le module', () => {
  // D11.2 : garantie de C4 reportée sur la scène.
  const { scene } = treeChunks();
  const target = scene[0] ?? '';
  mutateAndCheck('préchargement de la scène', (sb) => {
    const file = join(sb.artifact, 'index.html');
    writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', `<link rel="modulepreload" href="${target}"/></head>`));
  }, basename(target));
});

test('D11.2 mutation : module de scène supprimé → check-export échoue et nomme le module', () => {
  // D11.2 : l'import() de l'îlot doit viser un fichier présent.
  const { scene } = treeChunks();
  const target = scene[0] ?? '';
  mutateAndCheck('scène supprimée', (sb) => rmSync(join(sb.artifact, target.replace(/^\//, ''))), basename(target));
});

test('D11.2 mutation : chunk de l\'îlot référencé depuis projects/ → check-export échoue et nomme le module', () => {
  // D11.2 : l'îlot n'appartient qu'à l'accueil.
  const { island } = treeChunks();
  mutateAndCheck('îlot sur /projects/', (sb) => {
    const file = join(sb.artifact, 'projects', 'index.html');
    writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', `<link rel="modulepreload" href="${island}"/></head>`));
  }, basename(island));
});

test('D11.3 : poids de l\'arbre par route d\'accueil : Σ gzip -9 ≤ 230 000 octets, îlot seul ≤ 8 000 octets', (t) => {
  // D11.3 : T = îlot ∪ fermeture statique des cibles d'import() de l'îlot, moins la fermeture des entrées sans l'îlot, moins l'atelier.
  const { island, islandDynamic, atelier, mode } = treeChunks();
  for (const route of HOME_ROUTES) {
    const html = readFileSync(join(distDir, route === '/' ? 'index.html' : 'fr/index.html'), 'utf8');
    const entries = pageScriptUrls(html).filter((u) => u !== island);
    const base = staticClosure(distDir, entries);
    const T = new Set<string>([island, ...staticClosure(distDir, islandDynamic)]);
    for (const u of [...T]) if (base.has(u) || atelier.includes(u) || !u.endsWith('.js')) T.delete(u);
    const sizes = [...T].map((u) => [u, fileSize(distDir, u)] as [string, number]);
    const total = sizes.reduce((s, [, n]) => s + n, 0);
    const islandGz = fileSize(distDir, island);
    t.diagnostic(`${route} (${mode}) : Σ gzip -9 = ${total} octets ; îlot = ${islandGz} octets ; ${sizes.map(([u, n]) => `${basename(u)}=${n}`).join(', ')}`);
    assert.ok(islandGz <= 8000, `${route} : îlot ${islandGz} octets gzip > 8 000`);
    assert.ok(total <= 230000, `${route} : poids de l'arbre ${total} octets gzip > 230 000`);
    assert.ok(sizes.some(([u]) => readUrl(distDir, u).includes('__THREE__')), `${route} : le chunk three doit compter dans T`);
  }
});

test('D11.4 : atelier : absent de l\'export public (ni data-tree-atelier ni __arbre) ; dans l\'aperçu, un seul chunk, atteint seulement par import()', () => {
  // D11.4 [S-b] : selon le mode de l'export construit.
  const { mode, atelier } = treeChunks();
  if (mode === 'public') {
    const hits = allFiles(distDir).filter((f) => {
      const text = readFileSync(f, 'latin1');
      return text.includes('data-tree-atelier') || text.includes('__arbre');
    });
    assert.deepEqual(hits, [], `export public : atelier ou __arbre présents dans ${hits.join(', ')}`);
    return;
  }
  assert.equal(atelier.length, 1, `aperçu : exactement un chunk contient data-tree-atelier, reçu ${atelier.length}`);
  const a = atelier[0] ?? '';
  for (const p of exportPages()) {
    assert.ok(!p.html.includes('data-tree-atelier'), `${p.route} : data-tree-atelier dans le HTML`);
    assert.ok(!p.html.includes(basename(a)), `${p.route} cite le chunk de l'atelier`);
    assert.ok(!staticClosure(distDir, pageScriptUrls(p.html)).has(a), `${p.route} atteint l'atelier par import statique`);
  }
  const importers = jsUrls().filter((u) => readUrl(distDir, u).match(new RegExp(`import\\(\\s*["'\`][^"'\`]*${basename(a).replace(/[.$]/g, '\\$&')}`)));
  assert.ok(importers.length >= 1, 'le chunk de l\'atelier doit être la cible d\'un import()');
});

test('D11.4 [S-a] : le littéral data-tree-atelier n\'apparaît que dans components/tree/AtelierPanel.tsx', () => {
  // D11.4 : seul l'atelier porte ce marqueur.
  const hits = siteCodeFiles().filter((f) => readFileSync(join(siteDir, f), 'utf8').includes('data-tree-atelier'));
  assert.deepEqual(hits, ['components/tree/AtelierPanel.tsx'], `data-tree-atelier trouvé dans : ${hits.join(', ')}`);
  assert.ok(filesUnder('components/tree').includes('components/tree/AtelierPanel.tsx'));
  readSrc('components/tree/AtelierPanel.tsx');
});

test('D11.5 : chaque new URL("<x>.js", import.meta.url) d\'un chunk désigne un fichier présent, et un module de Worker n\'embarque pas three', () => {
  // D11.5 : seulement si D15 retient le Worker ; sinon, seul l'export du 1c (îlot présent) est exigé.
  const { three } = treeChunks();
  const problems: string[] = [];
  for (const u of jsUrls()) {
    for (const m of readUrl(distDir, u).matchAll(/new URL\(\s*["'`]([^"'`]+\.js)["'`]\s*,\s*import\.meta\.url\s*\)/g)) {
      const target = new URL(m[1] ?? '', 'http://site' + u).pathname;
      if (!urlExists(distDir, target)) problems.push(`${u} : new URL("${m[1]}") vise un fichier absent`);
      else if (three.includes(target) || [...staticClosure(distDir, [target])].some((x) => three.includes(x))) problems.push(`${target} (Worker) atteint three`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});
