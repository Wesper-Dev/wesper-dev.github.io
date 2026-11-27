// Contrat D1 (lot 1c) : dépendance three épinglée, seul scene.ts importe three, constantes de compilation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkScriptPath, childEnv, modeFlags, parseReport, runPython, distDir } from './helpers.ts';
import { importsOf, readSrc, siteCodeFiles, siteDir, stripCode, treeChunks } from './helpers-scene.ts';

const pkg = (): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } =>
  JSON.parse(readFileSync(join(siteDir, 'package.json'), 'utf8'));

test('D1.1 : dependencies.three vaut exactement "0.187.0"', () => {
  // D1.1 : version exacte, sans ^ ni ~.
  assert.equal(pkg().dependencies?.three, '0.187.0', `dependencies.three attendu "0.187.0", reçu ${JSON.stringify(pkg().dependencies?.three)}`);
});

test('D1.1 : devDependencies["@types/three"] est épinglé exactement sur 0.187.x', () => {
  // D1.1 : épinglage exact (pas de ^, ~, >, *, x) sur la série 0.187.
  const v = pkg().devDependencies?.['@types/three'];
  assert.equal(typeof v, 'string', '@types/three absent des devDependencies');
  assert.match(String(v), /^0\.187\.\d+$/, `@types/three doit être épinglé exactement sur 0.187.x, reçu ${JSON.stringify(v)}`);
  assert.equal(pkg().dependencies?.['@types/three'], undefined, '@types/three ne doit pas figurer dans dependencies');
});

test('D1.1 : package-lock.json résout node_modules/three en 0.187.0', () => {
  // D1.1 : verrou cohérent avec package.json.
  const lock = JSON.parse(readFileSync(join(siteDir, 'package-lock.json'), 'utf8')) as {
    packages?: Record<string, { version?: string; dev?: boolean }>;
  };
  const three = lock.packages?.['node_modules/three'];
  assert.ok(three, 'node_modules/three absent de package-lock.json');
  assert.equal(three.version, '0.187.0', `version verrouillée de three : ${three.version}`);
  assert.notEqual(three.dev, true, 'three doit être une dépendance de production, pas de développement');
  const types = lock.packages?.['node_modules/@types/three'];
  assert.ok(types, 'node_modules/@types/three absent de package-lock.json');
  assert.match(String(types.version), /^0\.187\.\d+$/, `@types/three verrouillé hors 0.187.x : ${types.version}`);
  assert.equal(types.version, pkg().devDependencies?.['@types/three'], 'version verrouillée de @types/three différente de package.json');
});

test('D1.2 : seul lib/tree/scene.ts importe three, par imports nommés depuis « three » uniquement', () => {
  // D1.2 : aucun autre fichier du site, ni import * as, ni three/addons, three/examples, three/webgpu, three/tsl, three/src/….
  const problems: string[] = [];
  let sceneImports = 0;
  for (const rel of siteCodeFiles()) {
    const src = readFileSync(join(siteDir, rel), 'utf8');
    for (const ref of importsOf(src)) {
      if (ref.spec !== 'three' && !ref.spec.startsWith('three/')) continue;
      if (rel !== 'lib/tree/scene.ts') {
        problems.push(`${rel} importe « ${ref.spec} »${ref.kind === 'type' ? ' (type)' : ''} : seul lib/tree/scene.ts importe three`);
        continue;
      }
      if (ref.spec !== 'three') problems.push(`scene.ts : spécificateur interdit « ${ref.spec} »`);
      if (ref.kind === 'dynamic') problems.push('scene.ts : import() de three interdit (imports nommés statiques seulement)');
      else if (!/^(type\s+)?\{[^}]*\}$/.test(ref.clause.trim())) problems.push(`scene.ts : import non nommé de three « import ${ref.clause} from 'three' »`);
      else sceneImports++;
    }
    if (rel === 'lib/tree/scene.ts' && /\bimport\s*\*\s*as\b[^;]*['"]three/.test(stripCode(src))) problems.push('scene.ts : import * as interdit');
  }
  assert.ok(existsSync(join(siteDir, 'lib/tree/scene.ts')), 'lib/tree/scene.ts absent');
  assert.ok(sceneImports >= 1, 'lib/tree/scene.ts doit importer three par imports nommés');
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('D1.3 : vite.config.ts définit __TREE_ATELIER__ et __TREE_DIAG__ = process.env.SITE_PUBLIC !== "1"', () => {
  // D1.3 : deux constantes de compilation, vraies hors export public.
  const src = stripCode(readSrc('vite.config.ts'));
  assert.match(src, /\bdefine\s*:/, 'vite.config.ts : clé define absente');
  for (const name of ['__TREE_ATELIER__', '__TREE_DIAG__']) {
    const re = new RegExp(`['"]?${name}['"]?\\s*:\\s*(?:JSON\\.stringify\\(\\s*)?\\(?\\s*process\\.env\\.SITE_PUBLIC\\s*!==\\s*['"]1['"]`);
    assert.match(src, re, `vite.config.ts : ${name} doit valoir process.env.SITE_PUBLIC !== '1'`);
  }
});

test('D1.3 : types/tree-globals.d.ts déclare les deux constantes en boolean, et tsc --noEmit passe', () => {
  // D1.3 : déclaration des globales de compilation et typage du projet.
  const dts = stripCode(readSrc('types/tree-globals.d.ts'));
  for (const name of ['__TREE_ATELIER__', '__TREE_DIAG__']) {
    assert.match(dts, new RegExp(`declare\\s+const\\s+${name}\\s*:\\s*boolean\\s*;?`), `types/tree-globals.d.ts : declare const ${name}: boolean absent`);
  }
  const tsc = join(siteDir, 'node_modules', '.bin', 'tsc');
  assert.ok(existsSync(tsc), 'node_modules/.bin/tsc absent : npm ci');
  const r = spawnSync(tsc, ['--noEmit'], { cwd: siteDir, env: childEnv(), encoding: 'utf8', timeout: 180000 });
  assert.equal(r.status, 0, `tsc --noEmit en échec :\n${(r.stdout ?? '').slice(0, 2000)}${(r.stderr ?? '').slice(0, 500)}`);
});

test('D1.4 : l\'export construit contient three et check-export passe dans son mode (0 erreur)', () => {
  // D1.4 : le texte de three ne déclenche aucun motif interdit ni numéro de téléphone.
  const chunks = treeChunks(distDir);
  assert.ok(chunks.three.length >= 1, "aucun chunk __THREE__ dans l'export");
  const r = runPython([checkScriptPath, ...modeFlags(distDir)]);
  const report = parseReport(r.stdout);
  assert.deepEqual(report.errors, [], `check-export (${chunks.mode}) doit passer avec three dans l'export`);
  assert.equal(r.status, 0, `check-export : code ${r.status}`);
});

test('D1.2 (audit) : le contrôle couvre .mts, .cts et les réexports (export { X } from \'three\', export * from \'three\')', () => {
  // Audit : un bridge.mts qui réexporte Vector3 passait la suite. Témoins du détecteur, puis contrôle réel du site.
  for (const src of [`export { Vector3 } from 'three';`, `export * from "three";`, `export type { Vector3 } from 'three/webgpu';`, `import 'three';`, `const m = await import('three');`]) {
    assert.ok(importsOf(src).some((r) => r.spec === 'three' || r.spec.startsWith('three/')), `détecteur aveugle à : ${src}`);
  }
  const files = siteCodeFiles();
  const others = files.filter((f) => /\.(mts|cts|mjs|cjs)$/.test(f) && f !== 'lib/tree/scene.ts');
  const hits = others.filter((f) => importsOf(readFileSync(join(siteDir, f), 'utf8')).some((r) => r.spec === 'three' || r.spec.startsWith('three/')));
  assert.deepEqual(hits, [], `three importé ou réexporté hors de scene.ts : ${hits.join(', ')}`);
  assert.ok(files.every((f) => !/\.(mts|cts)$/.test(f) || !f.startsWith('node_modules')), 'parcours des sources');
});
