// Audit contradictoire Fable du lot 2a, point F11 (C12, partie statique) : restes de travail dans l'export.
// - fonts/README.md est servi tel quel (public/fonts/) : pas de notes de lot ni de chemin vers tmp/ ;
// - l'export public ne livre pas .vite/manifest.json, qui nomme les sources du site.
// Les mesures arbre:* et snapshot() en public sont des scénarios navigateur (verif-2a, F.11).
// Le second test ne porte que sur un export public (SITE_PUBLIC=1, mode lu dans robots.txt comme ailleurs) : la CI de
// publication l'exécute ; en local, SITE_TEST_DIST=<export public> npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { distDir, exportModeOf } from './helpers.ts';
import { allFiles, requireDist } from './helpers-scene.ts';

// Notes de travail : numéro de lot, chemins du dépôt de travail, noms de chantier.
const WORK_NOTES: RegExp[] = [/\blot\s*\d+[a-z]?\b/i, /\btmp\//, /refonte-arbre/i, /\bREFONTE-ARBRE\b/, /\bdeliverables\//, /\bPASSATION\b/, /\bJOURNAL\.md\b/];

export function workNotes(text: string): string[] {
  return WORK_NOTES.filter((re) => re.test(text)).map((re) => `${re} : « ${(re.exec(text)?.[0] ?? '').trim()} »`);
}

test('F11 : fonts/README.md de l\'export ne contient ni « lot 2a » ni chemin vers tmp/ ni autre note de travail', () => {
  requireDist();
  const readme = join(distDir, 'fonts', 'README.md');
  if (!existsSync(readme)) return; // retiré de l'export : conforme
  assert.deepEqual(workNotes(readFileSync(readme, 'utf8')), [], 'fonts/README.md : notes de travail dans l\'export');
});

test('F11 (témoin) : le repérage des notes de travail attrape « lot 2a » et tmp/refonte-arbre/outils/py, pas une licence ni une adresse de police', () => {
  assert.equal(workNotes('Accueil (lot 2a) : Inter Tight').length, 1);
  assert.ok(workNotes('environnement isolé dans `tmp/refonte-arbre/outils/py`').length >= 1);
  assert.deepEqual(workNotes('Licence SIL OFL 1.1 ; https://fonts.gstatic.com/s/publicsans/v21/ijwRs572Xtc6ZYQws9YVwnNIfJ7QwOk1Fig.woff2 ; wght 300–500'), []);
});

test('F11 : l\'export public ne contient ni .vite/manifest.json ni autre manifeste de build qui nomme les sources', () => {
  requireDist();
  if (exportModeOf(distDir) !== 'public') return; // aperçu : le manifeste de build est permis
  const files = allFiles(distDir).map((f) => relative(distDir, f));
  const leaks = files.filter((f) => /(^|\/)\.vite\/|(^|\/)(manifest|ssr-manifest)\.json$/.test(f));
  assert.deepEqual(leaks, [], 'export public : manifestes de build livrés');
  const named = files.filter((f) => /\.(json|txt|map)$/.test(f)).filter((f) => /components\/tree\/|lib\/tree\/|app\/globals\.css/.test(readFileSync(join(distDir, f), 'utf8')));
  assert.deepEqual(named, [], 'export public : fichiers qui nomment les sources du site');
});

test('F11 / F7 : le JS de l\'export public ne livre ni le corps du diagnostic (snapshot : expectedPoints, pauseReason) ni la lecture de WEBGL_debug_renderer_info', () => {
  // Arbitrage F11 : « en public, ni snapshot() exécuté » ; F7 : l'extension n'est lue « jamais en public ». Un code absent
  // de l'export ne peut pas s'exécuter ; la partie mesurée (performance.measure, console Firefox) est en navigateur.
  requireDist();
  if (exportModeOf(distDir) !== 'public') return; // aperçu : diagnostic permis
  const hits: string[] = [];
  for (const f of allFiles(distDir).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(f, 'utf8');
    for (const k of ['expectedPoints', 'pauseReason', 'WEBGL_debug_renderer_info', 'UNMASKED_RENDERER']) if (src.includes(k)) hits.push(`${relative(distDir, f)} : ${k}`);
  }
  assert.deepEqual(hits, [], 'export public : diagnostic livré');
});
