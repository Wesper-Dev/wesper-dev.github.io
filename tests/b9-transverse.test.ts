// Contrat B9 (et B0) : contrôles transverses des huit fichiers du lot 1b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { CONTRACT_FILES, load, siteDir, stripComments } from './helpers-tree.ts';

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const read = (rel: string): string => {
  const p = join(siteDir, rel);
  if (!existsSync(p)) throw new Error(`fichier absent : site/${rel}`);
  return readFileSync(p, 'utf8');
};

// Spécificateurs importés ou réexportés (statiques, dynamiques, require).
function specifiers(src: string): { spec: string; typeOnly: boolean }[] {
  const out: { spec: string; typeOnly: boolean }[] = [];
  for (const m of src.matchAll(/\b(import|export)\s+(type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g)) out.push({ spec: m[3], typeOnly: !!m[2] });
  for (const m of src.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) out.push({ spec: m[1], typeOnly: false });
  for (const m of src.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g)) out.push({ spec: m[1], typeOnly: false });
  for (const m of src.matchAll(/\brequire\s*\(\s*['"`]([^'"`]+)['"`]/g)) out.push({ spec: m[1], typeOnly: false });
  return out;
}

test('B9 : les huit modules s\'importent dans Node sans erreur', async () => {
  // B9 « Import des huit modules dans Node sans erreur ».
  const errors: string[] = [];
  for (const rel of CONTRACT_FILES) {
    try {
      await load(rel);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('B9 / B0 : aucune occurrence de Math.random dans lib/tree/** ni dans content/tree.ts (commentaires compris)', () => {
  // B0 : texte « Math.random » interdit, y compris dans les commentaires.
  const files = walk(join(siteDir, 'lib', 'tree'));
  assert.ok(files.length > 0, 'site/lib/tree/ absent ou vide');
  const tree = join(siteDir, 'content', 'tree.ts');
  assert.ok(existsSync(tree), 'site/content/tree.ts absent');
  const hits = [...files, tree].filter((f) => readFileSync(f, 'utf8').includes('Math.random')).map((f) => relative(siteDir, f));
  assert.deepEqual(hits, [], `Math.random trouvé dans : ${hits.join(', ')}`);
});

test('B9 / B0 : imports limités aux fichiers relatifs du même ensemble, en .ts, sans three, react, alias ni JSON', () => {
  // B0 Pureté : aucun spécificateur nu. Exception : content/tree.ts importe le type Locale de ./home.ts (signature B8).
  const allowed = new Set(CONTRACT_FILES.map((f) => normalize(f)));
  const problems: string[] = [];
  for (const rel of CONTRACT_FILES) {
    for (const { spec, typeOnly } of specifiers(stripComments(read(rel)))) {
      if (!spec.startsWith('./') && !spec.startsWith('../')) { problems.push(`${rel} : spécificateur non relatif « ${spec} »`); continue; }
      if (!spec.endsWith('.ts')) { problems.push(`${rel} : import sans extension .ts « ${spec} »`); continue; }
      const target = normalize(join(dirname(rel), spec));
      if (allowed.has(target)) continue;
      if (rel === 'content/tree.ts' && target === normalize('content/home.ts') && typeOnly) continue;
      problems.push(`${rel} : import hors des huit fichiers « ${spec} »${typeOnly ? '' : ' (non type)'}`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('B9 / B0 : ni window, document, requestAnimationFrame, performance, localStorage, Date.now', () => {
  // B0 Pureté : globales interdites (hors commentaires).
  const banned = ['window', 'document', 'requestAnimationFrame', 'performance', 'localStorage'];
  const problems: string[] = [];
  for (const rel of CONTRACT_FILES) {
    const src = stripComments(read(rel));
    for (const w of banned) if (new RegExp(`\\b${w}\\b`).test(src)) problems.push(`${rel} : « ${w} »`);
    if (/\bDate\s*\.\s*now\b/.test(src)) problems.push(`${rel} : « Date.now »`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('B9 / B0 : TypeScript effaçable (pas d\'enum, de namespace, de propriété de paramètre, d\'import = require, de JSX)', () => {
  // B0 : syntaxe acceptée par node --experimental-strip-types.
  const rules: [RegExp, string][] = [
    [/(?:^|[\s;])(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+[A-Za-z_$]/m, 'enum'],
    [/(?:^|[\s;])(?:export\s+)?(?:declare\s+)?(?:namespace|module)\s+[A-Za-z_$][\w$.]*\s*\{/m, 'namespace'],
    [/constructor\s*\([^)]*\b(?:public|private|protected|readonly|override)\s+[A-Za-z_$]/, 'propriété de paramètre'],
    [/\bimport\s+[A-Za-z_$][\w$]*\s*=\s*require\b/, 'import = require'],
    [/\bfrom\s+['"]@\//, 'alias @/'],
    [/return\s*\(?\s*<[A-Za-z]/, 'JSX'],
  ];
  const problems: string[] = [];
  for (const rel of CONTRACT_FILES) {
    const src = stripComments(read(rel));
    for (const [re, name] of rules) if (re.test(src)) problems.push(`${rel} : ${name}`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('B9 / B0 : aucun état global mutable (pas de let ni var au niveau du module)', () => {
  // B0 Pureté : « Aucun état global mutable » (contrôle statique approché : let/var en début de ligne).
  const problems: string[] = [];
  for (const rel of CONTRACT_FILES) {
    const src = stripComments(read(rel));
    for (const m of src.matchAll(/^(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)/gm)) problems.push(`${rel} : ${m[0].trim()}`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('B9 : les neuf fichiers de test b1 à b9 utilisent node:test et node:assert/strict', () => {
  // B9 « Fichiers de test » : vérifie la présence et les conventions de cette suite elle-même.
  const names = ['b1-rng', 'b2-skeleton', 'b3-sap', 'b4-cloud', 'b5-color', 'b6-labels', 'b7-palettes', 'b8-tree', 'b9-transverse'];
  for (const n of names) {
    const p = join(siteDir, 'tests', `${n}.test.ts`);
    assert.ok(existsSync(p), `tests/${n}.test.ts absent`);
    const src = readFileSync(p, 'utf8');
    assert.match(src, /from 'node:test'/);
    assert.match(src, /from 'node:assert\/strict'/);
  }
  // Ce test passe déjà : il garantit seulement que la suite reste conforme si elle est modifiée.
});
