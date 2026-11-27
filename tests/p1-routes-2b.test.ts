// Contrat du lot 2b, P1 (tmp/refonte-arbre/contrat-lot2b.md) : routes experiences/bpce/ et experiences/ecole-42/.
// Vingt routes (dix chemins × FR/EN) dans routes.json et le sitemap, alternances réciproques, accès direct en 200 à plat
// et en répertoire, slug inconnu en 404, check-export vert ; pages servies avec la carte statique, sans module client
// propre (règle C4 du lot 1a). Attentes écrites en dur : elles ne se déduisent pas du manifeste.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ORIGIN, assertDistExists, checkScriptPath, childEnv, cleanupTempDirs, distDir, makeSandbox, modeFlags, parseReport, readManifest, routesOf, runPython, sitemapLocs } from './helpers.ts';
import { treeChunks } from './helpers-scene.ts';
import { DETAIL_SPECS, EXPECTED_PATHS, LOT2B_ROUTES, conformingPage, normalizedDocument, readPage, staticPageErrors } from './helpers-2b.ts';

const running: ChildProcess[] = [];
after(() => {
  for (const c of running.splice(0)) c.kill('SIGKILL');
  cleanupTempDirs();
});

test('P1 : routes.json contient exactement les dix chemins attendus (huit du lot 1a, experiences/bpce/, experiences/ecole-42/), soit 20 routes', () => {
  const paths = readManifest().paths;
  assert.deepEqual([...paths].sort(), [...EXPECTED_PATHS].sort(), `chemins du manifeste : ${JSON.stringify(paths)}`);
  assert.equal(new Set(paths).size, paths.length, 'chemin en double dans routes.json');
  assert.equal(routesOf(paths).length, 20, '20 routes attendues (10 chemins × FR/EN)');
});

test('P1 : chaque nouvelle route a sa page à plat (<chemin>.html) et son index de répertoire, au même contenu', () => {
  assertDistExists();
  const missing: string[] = [];
  for (const s of DETAIL_SPECS) {
    const flat = join(distDir, s.flat);
    const dir = join(distDir, s.dir, 'index.html');
    if (!existsSync(flat)) missing.push(`${s.route} : page à plat ${s.flat} absente`);
    if (!existsSync(dir)) missing.push(`${s.route} : index de répertoire ${s.dir}/index.html absent`);
    if (existsSync(flat) && existsSync(dir) && normalizedDocument(readFileSync(flat, 'utf8')) !== normalizedDocument(readFileSync(dir, 'utf8'))) {
      missing.push(`${s.route} : page à plat et index de répertoire différents`);
    }
  }
  assert.deepEqual(missing, []);
});

test('P1 : sous experiences/, l\'export ne contient que bnp-paribas, bpce et ecole-42 (aucune page pour un slug inconnu)', () => {
  assertDistExists();
  for (const base of ['experiences', join('fr', 'experiences')]) {
    const dir = join(distDir, base);
    const slugs = existsSync(dir) ? [...new Set(readdirSync(dir).map((f) => f.replace(/\.(html|rsc)$/, '')))].sort() : [];
    assert.deepEqual(slugs, ['bnp-paribas', 'bpce', 'ecole-42'], `${base}/ : ${JSON.stringify(readdirSync(dir))}`);
  }
});

test('P1 : sitemap.xml liste exactement les 20 routes, chaque nouvelle une fois avec ses alternances en, fr et x-default réciproques', () => {
  assertDistExists();
  const xml = readFileSync(join(distDir, 'sitemap.xml'), 'utf8');
  const locs = sitemapLocs(xml);
  const want = routesOf([...EXPECTED_PATHS]).map((r) => ORIGIN + r);
  assert.deepEqual([...locs].sort(), [...want].sort(), 'URL du sitemap');
  for (const route of LOT2B_ROUTES) {
    const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1] ?? '').filter((b) => b.includes(`<loc>${ORIGIN + route}</loc>`));
    assert.equal(blocks.length, 1, `${route} : une entrée attendue, reçu ${blocks.length}`);
    const slug = route.replace(/^\/(fr\/)?/, '');
    const alt = (hl: string): string[] => [...(blocks[0] ?? '').matchAll(new RegExp(`<xhtml:link[^>]*hreflang="${hl}"[^>]*href="([^"]*)"`, 'g'))].map((m) => m[1] ?? '');
    assert.deepEqual(alt('en'), [`${ORIGIN}/${slug}`], `${route} : alternance en`);
    assert.deepEqual(alt('fr'), [`${ORIGIN}/fr/${slug}`], `${route} : alternance fr`);
    assert.deepEqual(alt('x-default'), [`${ORIGIN}/${slug}`], `${route} : alternance x-default`);
  }
});

test('P1 : check-export.py passe dans le mode de l\'export (code 0, 20 routes, aucune erreur)', () => {
  assertDistExists();
  const r = runPython([checkScriptPath, ...modeFlags(distDir), '--dist', distDir]);
  const report = parseReport(r.stdout);
  assert.deepEqual(report.errors, [], 'erreurs de check-export');
  assert.equal(report.routes, 20, `report.routes attendu 20, reçu ${String(report.routes)}`);
  assert.equal(r.status, 0);
});

// ---- Accès direct par HTTP (scripts/preview.mjs d'une copie, port libre éphémère, jamais 4173) ----

function freePort(): Promise<number> {
  return new Promise((ok, ko) => {
    const server = createServer();
    server.once('error', ko);
    server.listen(0, '127.0.0.1', () => {
      const a = server.address();
      const port = typeof a === 'object' && a !== null ? a.port : 0;
      server.close(() => ok(port));
    });
  });
}

async function servePreview(): Promise<{ base: string; stop: () => void }> {
  const sb = makeSandbox(); // scripts/preview.mjs de la copie sert sa copie de l'export (dist/client du bac à sable)
  const port = await freePort();
  const child = spawn(process.execPath, [join(sb.root, 'scripts', 'preview.mjs'), '--port', String(port)], { cwd: sb.root, env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  running.push(child);
  let out = '';
  child.stdout?.setEncoding('utf8').on('data', (d: string) => (out += d));
  const deadline = Date.now() + 5000;
  while (!out.includes('\n') && Date.now() < deadline && child.exitCode === null) await delay(50);
  if (!out.includes('\n')) throw new Error(`aperçu non démarré sur le port ${port}`);
  return { base: `http://127.0.0.1:${port}`, stop: () => child.kill('SIGTERM') };
}

test('P1 : accès direct : 200 à plat (.html), en répertoire (/) et sans barre finale (redirection suivie), FR et EN ; slug inconnu en 404', { timeout: 30000 }, async () => {
  assertDistExists();
  const srv = await servePreview();
  const bad: string[] = [];
  try {
    const get = async (path: string): Promise<{ status: number; body: string }> => {
      const r = await fetch(srv.base + path, { signal: AbortSignal.timeout(3000) });
      return { status: r.status, body: await r.text() };
    };
    for (const s of DETAIL_SPECS) {
      for (const path of [s.route, '/' + s.flat, s.route.slice(0, -1)]) {
        const r = await get(path);
        if (r.status !== 200) bad.push(`${path} → ${r.status} (200 attendu)`);
        else if (!/<h1\b/i.test(r.body)) bad.push(`${path} → 200 sans <h1>`);
      }
    }
    for (const path of ['/experiences/inconnu/', '/fr/experiences/inconnu/', '/experiences/inconnu.html', '/experiences/bpce-x/', '/fr/experiences/ecole42/']) {
      const r = await get(path);
      if (r.status !== 404) bad.push(`${path} → ${r.status} (404 attendu)`);
    }
  } finally {
    srv.stop();
  }
  assert.deepEqual(bad, []);
});

// ---- Carte statique : aucun module client propre (C4 du lot 1a) ----

test('P1 : les quatre pages n\'embarquent aucun module client propre (scripts ⊆ ceux de /projects/), ni l\'îlot de l\'arbre, ni data-tree-*', () => {
  assertDistExists();
  const { island } = treeChunks();
  const errors: string[] = [];
  for (const s of DETAIL_SPECS) {
    const html = readPage(distDir, s.dir);
    if (!html) errors.push(`${s.route} : page absente (${s.dir}/index.html)`);
    else errors.push(...staticPageErrors(distDir, s, html, island));
  }
  assert.deepEqual(errors, []);
});

test('P1 (témoins) : sur une page conforme synthétique, le contrôle de carte statique refuse l\'îlot préchargé, un script propre et data-tree-*', () => {
  const { island } = treeChunks();
  const sb = makeSandbox();
  const s = DETAIL_SPECS[0]!;
  const ok = conformingPage(sb.artifact, s);
  mkdirSync(join(sb.artifact, s.dir), { recursive: true });
  writeFileSync(join(sb.artifact, s.dir, 'index.html'), ok);
  assert.deepEqual(staticPageErrors(sb.artifact, s, ok, island), [], 'la page synthétique doit passer');
  const cases: [string, string, RegExp][] = [
    ['îlot préchargé', ok.replace('</head>', `<link rel="modulepreload" href="${island}"/></head>`), /îlot|scripts propres/],
    ['script propre', ok.replace('</head>', '<script type="module" src="/_next/static/chunks/propre-1234.js"></script></head>'), /scripts propres/],
    ['élément de l\'arbre', ok.replace('<article class="story">', '<article class="story" data-tree-hero="">'), /data-tree/],
  ];
  for (const [label, html, want] of cases) {
    const errors = staticPageErrors(sb.artifact, s, html, island);
    assert.ok(errors.some((e) => want.test(e)), `${label} : doit être refusé. Erreurs : ${JSON.stringify(errors)}`);
  }
});
