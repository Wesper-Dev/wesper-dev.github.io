// Contrat D11 durci après l'audit astra du lot 1c (arbitrage du 21/11) : îlot cantonné à l'accueil (y compris dans le
// flux RSC et le routeur), Worker livré sous /_next/static/build.worker-*.js et compté dans le budget tout compris,
// three atteint seulement par la scène, et mutations de check-export.py que le contrôle acceptait à tort.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, distDir, makeSandbox, modeFlags, pageScriptUrls, parseReport, staticClosure, staticSpecifiers } from './helpers.ts';
import type { Sandbox } from './helpers.ts';
import {
  HOME_ROUTES,
  allFiles,
  basename,
  chunksCiting,
  exportPages,
  fileSize,
  islandClientIds,
  jsUrls,
  readUrl,
  treeChunks,
  urlExists,
  workerUrls,
} from './helpers-scene.ts';

after(cleanupTempDirs);

const rel = (f: string): string => f.slice(distDir.length + 1);
// Fichiers servis pour l'accueil : HTML et flux RSC des deux langues (formes répertoire et à plat).
const HOME_FILES = new Set(['index.html', 'index.rsc', 'fr.html', 'fr.rsc', 'fr/index.html', 'fr/index.rsc']);

test('D11.1 (audit) : l\'îlot n\'est cité, ni par son nom ni par sa référence client, par aucun HTML ni flux RSC hors accueil', () => {
  // Audit « îlot monté sur une autre route » : le routeur et le flux RSC de /skills/ ne doivent pas pouvoir le monter.
  const { island } = treeChunks();
  const ids = islandClientIds(distDir, island);
  assert.ok(ids.length >= 1, `référence client de l'îlot introuvable dans le routeur (${basename(island)})`);
  const needles = [basename(island), ...ids.map((i) => `"${i}"`)];
  const docs = allFiles(distDir).filter((f) => /\.(html|rsc)$/.test(f));
  assert.ok(docs.some((f) => f.endsWith('.rsc')), 'aucun flux .rsc dans l\'export');
  const bad: string[] = [];
  for (const f of docs) {
    const r = rel(f);
    if (HOME_FILES.has(r)) continue;
    const text = readFileSync(f, 'utf8');
    for (const n of needles) if (text.includes(n)) bad.push(`${r} cite ${n}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  for (const route of HOME_ROUTES) {
    const html = readFileSync(join(distDir, route === '/' ? 'index.html' : 'fr/index.html'), 'utf8');
    assert.ok(ids.some((i) => html.includes(i)) || html.includes(basename(island)), `${route} : l'îlot doit être référencé`);
  }
});

test('D11.1 (audit) : le chunk __THREE__ n\'est importé statiquement que par la fermeture du module de scène', () => {
  // Audit « bridge.mts » : un module intermédiaire qui réexporte three ne doit pas l'attirer ailleurs.
  const { three, scene, island } = treeChunks();
  const sceneClosure = staticClosure(distDir, scene);
  const bad: string[] = [];
  for (const u of jsUrls()) {
    for (const spec of staticSpecifiers(readUrl(distDir, u))) {
      const target = new URL(spec, 'http://site' + u).pathname;
      if (three.includes(target) && !sceneClosure.has(u)) bad.push(`${u} importe ${target}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  assert.equal([...staticClosure(distDir, [island])].some((u) => three.includes(u)), false, "l'îlot atteint three statiquement");
});

test('D15.6 (audit) : le Worker est livré sous /_next/static/build.worker-<hash>.js, cité par la seule fermeture de la scène, sans three', () => {
  // Arbitrage : présence, forme d'URL réellement livrée, graphe du Worker.
  const { scene, three } = treeChunks();
  const workers = workerUrls();
  assert.equal(workers.length, 1, `un seul Worker attendu sous /_next/static/build.worker-*.js, reçu ${JSON.stringify(workers)}`);
  const w = workers[0] ?? '';
  const citing = chunksCiting(distDir, w);
  const sceneClosure = staticClosure(distDir, scene);
  assert.ok(citing.length >= 1, `aucun chunk ne cite ${basename(w)}`);
  assert.deepEqual(citing.filter((u) => !sceneClosure.has(u)), [], `${basename(w)} cité hors de la fermeture de la scène`);
  const sceneText = scene.map((u) => readUrl(distDir, u)).join('\n');
  assert.ok(sceneText.includes(w) || sceneText.includes('./' + basename(w)) || sceneText.includes('../' + basename(w)), `la scène doit citer l'URL livrée ${w}`);
  const closure = staticClosure(distDir, [w]);
  const missing = [...closure].filter((u) => !urlExists(distDir, u));
  assert.deepEqual(missing, [], `imports du Worker introuvables : ${missing.join(', ')}`);
  assert.deepEqual([...closure].filter((u) => three.includes(u) || readUrl(distDir, u).includes('__THREE__')), [], 'le Worker ne doit pas embarquer three');
  for (const p of exportPages()) assert.ok(!p.html.includes(basename(w)), `${p.route} cite le Worker dans le HTML`);
});

test('D11.3 (audit) : poids tout compris îlot + scène + modules partagés + Worker ≤ 230 000 octets gzip -9', (t) => {
  // Arbitrage : tout ce que l'accueil charge en plus d'une page sans arbre (base : /projects/), atelier exclu.
  const { island, islandDynamic, atelier, mode } = treeChunks();
  const base = staticClosure(distDir, pageScriptUrls(readFileSync(join(distDir, 'projects', 'index.html'), 'utf8')));
  const workers = workerUrls();
  assert.equal(workers.length, 1, 'Worker absent : le budget tout compris doit le compter');
  const all = new Set<string>([...staticClosure(distDir, [island]), ...staticClosure(distDir, islandDynamic.filter((u) => !atelier.includes(u))), ...staticClosure(distDir, workers)]);
  for (const route of HOME_ROUTES) {
    const html = readFileSync(join(distDir, route === '/' ? 'index.html' : 'fr/index.html'), 'utf8');
    for (const u of pageScriptUrls(html)) if (!base.has(u)) for (const x of staticClosure(distDir, [u])) all.add(x);
  }
  for (const u of [...all]) if (base.has(u) || atelier.includes(u) || !u.endsWith('.js')) all.delete(u);
  const sizes = [...all].map((u) => [u, fileSize(distDir, u)] as [string, number]).sort((a, b) => b[1] - a[1]);
  const total = sizes.reduce((s, [, n]) => s + n, 0);
  const islandScene = fileSize(distDir, island) + islandDynamic.filter((u) => !atelier.includes(u)).reduce((s, u) => s + fileSize(distDir, u), 0);
  t.diagnostic(`(${mode}) îlot + scène = ${islandScene} octets ; tout compris = ${total} octets : ${sizes.map(([u, n]) => `${basename(u)}=${n}`).join(', ')}`);
  assert.ok(sizes.some(([u]) => workers.includes(u)), 'le Worker doit compter dans le total');
  assert.ok(total <= 230000, `poids tout compris ${total} octets gzip > 230 000`);
});

// ---- Mutations de check-export.py (tableau de l'audit) ----

function islandId(): string {
  const { island } = treeChunks();
  const id = islandClientIds(distDir, island)[0];
  assert.ok(id, 'référence client de l\'îlot introuvable');
  return id;
}

function inject(sb: Sandbox, relFile: string, where: 'head' | 'body', snippet: string): void {
  const file = join(sb.artifact, relFile);
  const html = readFileSync(file, 'utf8');
  const marker = where === 'head' ? '</head>' : '</body>';
  assert.ok(html.includes(marker), `${relFile} sans ${marker}`);
  writeFileSync(file, html.replace(marker, snippet + marker));
}

function expectRejected(label: string, mutate: (sb: Sandbox) => void, names: string[]): void {
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  const base = sb.checkRun(flags);
  assert.equal(base.status, 0, `témoin : l'export non modifié doit passer (${base.stdout.slice(0, 300)})`);
  mutate(sb);
  const r = sb.checkRun(flags);
  assert.equal(r.status, 1, `${label} : check-export doit échouer (code 1), reçu ${r.status}. ${r.stdout.slice(0, 400)}`);
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => names.some((n) => e.includes(n))), `${label} : aucune erreur ne nomme ${names.join(' ou ')}. Erreurs : ${JSON.stringify(errors)}`);
}

test('check-export (audit) : <link rel=preload as=script> du module de scène sur l\'accueil → refusé', () => {
  const { scene } = treeChunks();
  const s = scene[0] ?? '';
  expectRejected('preload as=script de la scène', (sb) => inject(sb, 'index.html', 'head', `<link rel="preload" as="script" href="${s}"/>`), [basename(s)]);
});

test('check-export (audit) : <link rel=preload as=script> de l\'îlot sur /projects/ → refusé', () => {
  const { island } = treeChunks();
  expectRejected('preload as=script de l\'îlot', (sb) => inject(sb, 'projects/index.html', 'head', `<link rel="preload" as="script" href="${island}"/>`), [basename(island)]);
});

test('check-export (audit) : <script type=module src=îlot> sur /projects/ → refusé', () => {
  const { island } = treeChunks();
  expectRejected('script de l\'îlot', (sb) => inject(sb, 'projects/index.html', 'head', `<script type="module" src="${island}"></script>`), [basename(island)]);
});

test('check-export (audit) : <script type=module src=scène> sur l\'accueil → refusé', () => {
  const { scene } = treeChunks();
  const s = scene[0] ?? '';
  expectRejected('script de la scène', (sb) => inject(sb, 'fr/index.html', 'head', `<script type="module" src="${s}"></script>`), [basename(s)]);
});

test('check-export (audit) : préchargement de l\'îlot dans 404.html → refusé', () => {
  const { island } = treeChunks();
  expectRejected('îlot dans 404.html', (sb) => inject(sb, '404.html', 'head', `<link rel="modulepreload" href="${island}"/>`), [basename(island), '404']);
});

test('check-export (audit) : préchargement de l\'îlot dans l\'alias à plat projects.html → refusé', () => {
  const { island } = treeChunks();
  expectRejected('îlot dans projects.html', (sb) => inject(sb, 'projects.html', 'head', `<link rel="modulepreload" href="${island}"/>`), [basename(island), 'projects.html']);
});

test('check-export (audit) : préchargement indu de l\'îlot avec un exemple visible <code>I["<id>"]</code> → refusé', () => {
  const { island } = treeChunks();
  const id = islandId();
  expectRejected('chaîne hors du flux React', (sb) => {
    inject(sb, 'projects/index.html', 'head', `<link rel="modulepreload" href="${island}"/>`);
    inject(sb, 'projects/index.html', 'body', `<p><code>I["${id}"]</code></p>`);
  }, [basename(island)]);
});

test('check-export (audit) : routeur valide dont une fonction async () => {…} devient async function () {…} → accepté', () => {
  // Témoin : le contrôle ne doit pas dépendre de la syntaxe émise par vinext pour les préchargements légitimes.
  const sb = makeSandbox();
  const flags = modeFlags(sb.artifact);
  const router = jsUrls(sb.artifact).filter((u) => /async\s*\(\s*\)\s*=>\s*\{/.test(readUrl(sb.artifact, u)) && readUrl(sb.artifact, u).includes(basename(treeChunks().island)));
  assert.ok(router.length >= 1, 'routeur (chunk qui charge l\'îlot par une fonction async fléchée) introuvable');
  for (const u of router) {
    const file = join(sb.artifact, u.replace(/^\//, ''));
    writeFileSync(file, readFileSync(file, 'utf8').replace(/async\s*\(\s*\)\s*=>\s*\{/g, 'async function(){'));
  }
  const r = sb.checkRun(flags);
  assert.deepEqual(parseReport(r.stdout).errors, [], 'préchargements légitimes rejetés après un changement de syntaxe du routeur');
  assert.equal(r.status, 0);
});

test('check-export (2a, E15.3) : <link rel=preload as=script> d\'un chunk propre à l\'accueil copié dans /fr/skills/ → refusé', () => {
  // E15.3 : l'en-tête, le menu, les fiches et les sections du 2a n'ajoutent aucun script hors de l'îlot ; tout chunk que
  // seules les pages d'accueil référencent reste refusé ailleurs, quel qu'il soit.
  const refs = (rel: string): Set<string> => new Set(pageScriptUrls(readFileSync(join(distDir, rel), 'utf8')).filter((u) => u.endsWith('.js')));
  const en = refs('index.html');
  const fr = refs('fr/index.html');
  const skills = refs('fr/skills/index.html');
  const own = [...en].filter((u) => fr.has(u) && !skills.has(u));
  assert.ok(own.length >= 1, 'aucun chunk propre à l\'accueil (îlot attendu au moins)');
  for (const u of own) {
    expectRejected(`preload as=script de ${basename(u)} sur /fr/skills/`, (sb) => inject(sb, 'fr/skills/index.html', 'head', `<link rel="preload" as="script" href="${u}"/>`), [basename(u)]);
  }
});
