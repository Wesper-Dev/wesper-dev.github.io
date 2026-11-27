// Contrat C5 : script npm test, étape du workflow réellement exécutée, conventions des tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packagePath, readJson, siteDir, workflowPath } from './helpers.ts';

const STEP_START = /^\s*-\s/;

test('C5 : package.json a un script test qui lance node --experimental-strip-types --test sur tests/*.test.ts', () => {
  const pkg = readJson(packagePath) as { scripts?: Record<string, unknown> };
  const command = pkg.scripts?.test;
  assert.equal(typeof command, 'string', 'scripts.test absent de package.json');
  const tokens = String(command).trim().split(/\s+/);
  assert.equal(tokens[0], 'node', `scripts.test doit commencer par node, reçu : ${String(command)}`);
  assert.ok(tokens.includes('--experimental-strip-types'), `scripts.test doit contenir --experimental-strip-types : ${String(command)}`);
  assert.ok(tokens.includes('--test'), `scripts.test doit contenir --test : ${String(command)}`);
  assert.ok(
    tokens.some((t) => t.replace(/^['"]|['"]$/g, '') === 'tests/*.test.ts'),
    `scripts.test doit viser tests/*.test.ts : ${String(command)}`,
  );
});

test("C5 : le workflow exécute npm test après npm run build et avant le contrôle d'export", () => {
  assert.ok(existsSync(workflowPath), `workflow absent : ${workflowPath}`);
  const lines = readFileSync(workflowPath, 'utf8').split('\n');
  const buildIdx = lines.findIndex((l) => /\bnpm run build\b/.test(l));
  const testIdx = lines.findIndex((l) => /^\s*(?:-\s*)?(?:run:\s*)?npm test\s*$/.test(l));
  const checkIdx = lines.findIndex((l) => /check-export\.py/.test(l));
  assert.ok(buildIdx >= 0, 'le workflow doit exécuter npm run build');
  assert.ok(checkIdx >= 0, 'le workflow doit exécuter check-export.py');
  assert.ok(testIdx >= 0, 'le workflow doit exécuter npm test (ligne « npm test » absente)');
  assert.ok(buildIdx < testIdx, `npm test (ligne ${testIdx + 1}) doit venir après npm run build (ligne ${buildIdx + 1})`);
  assert.ok(testIdx < checkIdx, `npm test (ligne ${testIdx + 1}) doit venir avant check-export.py (ligne ${checkIdx + 1})`);
});

// Problèmes de l'étape npm test dans un texte de workflow : désactivée, tolérée en échec ou conditionnée.
function npmTestStepProblems(text: string): string[] {
  const lines = text.split('\n');
  const testIdx = lines.findIndex((l) => /^\s*(?:-\s*)?(?:run:\s*)?npm test\s*$/.test(l));
  if (testIdx < 0) return ['npm test absent du workflow'];
  let start = testIdx;
  while (start > 0 && !STEP_START.test(lines[start] ?? '')) start--;
  let end = testIdx + 1;
  while (end < lines.length && !STEP_START.test(lines[end] ?? '')) end++;
  const block = lines.slice(start, end).join('\n');
  const problems: string[] = [];
  if (/continue-on-error\s*:/.test(block)) problems.push('continue-on-error sur l\'étape npm test');
  if (/^\s*if\s*:/m.test(block)) problems.push('condition if sur l\'étape npm test');
  return problems;
}

test("C5 : l'étape npm test du workflow n'est ni désactivée ni tolérée en échec (pas de if, pas de continue-on-error)", () => {
  assert.deepEqual(npmTestStepProblems(readFileSync(workflowPath, 'utf8')), [], "l'étape npm test doit être exécutée sans condition ni tolérance d'échec");
});

test("C5 mutation : étape npm test avec if: false → contrôle en échec", () => {
  const text = readFileSync(workflowPath, 'utf8');
  const mutated = text.replace(/(- name: Run contract tests on the export\n)/, '$1        if: false\n');
  assert.notEqual(mutated, text, 'mutation sans effet : étape npm test introuvable');
  assert.ok(npmTestStepProblems(mutated).length > 0, "une étape npm test désactivée par if doit être refusée");
});

test("C5 mutation : étape npm test avec continue-on-error: true → contrôle en échec", () => {
  const text = readFileSync(workflowPath, 'utf8');
  const mutated = text.replace(/(- name: Run contract tests on the export\n)/, '$1        continue-on-error: true\n');
  assert.notEqual(mutated, text, 'mutation sans effet : étape npm test introuvable');
  assert.ok(npmTestStepProblems(mutated).length > 0, 'une étape npm test tolérée en échec doit être refusée');
});

test('C5 : conventions des tests (node:test, node:assert, imports relatifs en .ts, pas d\'alias @/, pas de enum/namespace)', () => {
  const testsDir = join(siteDir, 'tests');
  assert.ok(existsSync(testsDir), 'dossier tests/ absent');
  const files = readdirSync(testsDir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.some((f) => f.endsWith('.test.ts')), 'aucun fichier *.test.ts dans tests/');
  for (const file of files) {
    const src = readFileSync(join(testsDir, file), 'utf8');
    assert.ok(!/from\s+['"]@\//.test(src), `${file} : alias @/ interdit`);
    for (const m of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      assert.ok((m[1] ?? '').endsWith('.ts'), `${file} : import relatif sans extension .ts : ${m[1]}`);
    }
    assert.ok(!/^\s*(export\s+)?(enum|namespace)\s/m.test(src), `${file} : enum ou namespace interdit (syntaxe non effaçable)`);
    if (file.endsWith('.test.ts')) {
      assert.ok(/from\s+['"]node:test['"]/.test(src), `${file} : doit importer node:test`);
      assert.ok(/from\s+['"]node:assert(\/strict)?['"]/.test(src), `${file} : doit importer node:assert`);
    }
  }
});
