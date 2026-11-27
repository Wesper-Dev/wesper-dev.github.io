// Contrat D3 (lot 1c) : forme de l'îlot client TreeIsland.tsx, composants serveur TreeHero et TreeFallback.
// La séquence au montage (D3.3) et les paramètres d'URL en navigateur (D3.4) sont des scénarios [B] hors de cette suite ;
// readFlags (D3.4 [N]) est testé en d8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filesUnder, importsOf, importsThree, readSrc, resolveSrc, siteCodeFiles, siteDir, sourceStaticClosure, stripCode } from './helpers-scene.ts';

const ISLAND = 'components/tree/TreeIsland.tsx';

// Première instruction d'un source : directive 'use client' ou "use client".
const firstStatement = (src: string): string => stripCode(src).trimStart().split(/;|\n/)[0]?.trim() ?? '';

test('D3.1 : TreeIsland.tsx commence par la directive \'use client\'', () => {
  // D3.1 : première instruction.
  assert.match(firstStatement(readSrc(ISLAND)), /^['"]use client['"]$/, `première instruction de ${ISLAND} : « ${firstStatement(readSrc(ISLAND))} »`);
});

test('D3.1 : imports statiques de TreeIsland limités à react et à des fichiers sans three (fermeture comprise), sans scene.ts, content/tree.ts ni AtelierPanel.tsx', () => {
  // D3.1 : rien de lourd dans le chunk de l'îlot.
  const problems: string[] = [];
  for (const ref of importsOf(readSrc(ISLAND))) {
    if (ref.kind !== 'static') continue;
    if (!ref.spec.startsWith('.') && ref.spec !== 'react' && !ref.spec.startsWith('react/')) problems.push(`import statique non autorisé « ${ref.spec} »`);
  }
  const { files, bare } = sourceStaticClosure(ISLAND);
  for (const b of bare) if (b === 'three' || b.startsWith('three/')) problems.push(`three atteint statiquement depuis l'îlot`);
  for (const forbidden of ['lib/tree/scene.ts', 'content/tree.ts', 'components/tree/AtelierPanel.tsx']) {
    if (files.has(forbidden)) problems.push(`${forbidden} atteint par import statique depuis l'îlot`);
  }
  for (const f of files) {
    if (f === ISLAND) continue;
    try {
      if (importsThree(readSrc(f))) problems.push(`${f} (importé statiquement par l'îlot) importe three`);
    } catch {
      problems.push(`${f} importé par l'îlot mais introuvable`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('D3.1 : TreeIsland atteint scene.ts seulement par import(\'../../lib/tree/scene.ts\')', () => {
  // D3.1 : la scène est chargée à la demande.
  const refs = importsOf(readSrc(ISLAND)).filter((r) => resolveSrc(ISLAND, r.spec) === 'lib/tree/scene.ts');
  assert.ok(refs.length >= 1, 'aucun import() de lib/tree/scene.ts dans TreeIsland.tsx');
  assert.ok(refs.every((r) => r.kind === 'dynamic'), 'scene.ts doit être importé seulement par import()');
  assert.ok(refs.some((r) => r.spec === '../../lib/tree/scene.ts'), "spécificateur attendu : '../../lib/tree/scene.ts'");
});

// Vrai si l'index `at` est dans la conséquence d'un if (__TREE_ATELIER__ && …) : bloc entre accolades ou instruction unique.
function insideAtelierIf(code: string, at: number): boolean {
  for (const m of code.matchAll(/\bif\s*\(\s*__TREE_ATELIER__\s*&&/g)) {
    const open = (m.index ?? 0) + m[0].indexOf('(');
    let depth = 0;
    let close = -1;
    for (let i = open; i < code.length; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')' && --depth === 0) {
        close = i;
        break;
      }
    }
    if (close < 0 || close > at) continue;
    const between = code.slice(close + 1, at);
    if (!between.trimStart().startsWith('{')) {
      if (!/[;}]/.test(between)) return true;
      continue;
    }
    let braces = 0;
    for (const ch of between) {
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
    }
    if (braces >= 1) return true;
  }
  return false;
}

test('D3.1 : AtelierPanel.tsx est atteint seulement par un import() placé dans if (__TREE_ATELIER__ && …)', () => {
  // D3.1 : l'atelier disparaît de l'export public par élimination de code mort.
  const src = readSrc(ISLAND);
  const code = stripCode(src);
  const refs = importsOf(src).filter((r) => resolveSrc(ISLAND, r.spec) === 'components/tree/AtelierPanel.tsx');
  assert.ok(refs.length >= 1, 'aucun import() de AtelierPanel.tsx dans TreeIsland.tsx');
  assert.ok(refs.every((r) => r.kind === 'dynamic'), 'AtelierPanel.tsx doit être importé seulement par import()');
  for (const m of code.matchAll(/\bimport\s*\(\s*['"`][^'"`]*AtelierPanel[^'"`]*['"`]/g)) {
    assert.ok(insideAtelierIf(code, m.index ?? 0), 'import() de AtelierPanel hors d\'un if (__TREE_ATELIER__ && …)');
  }
});

test('D3.2 : TreeHero.tsx et TreeFallback.tsx sont des composants serveur (sans \'use client\')', () => {
  // D3.2 : rendus dans le HTML exporté.
  for (const rel of ['components/tree/TreeHero.tsx', 'components/tree/TreeFallback.tsx']) {
    const src = stripCode(readSrc(rel));
    assert.doesNotMatch(src, /^\s*['"]use client['"]/m, `${rel} ne doit pas porter 'use client'`);
    assert.equal(importsThree(src), false, `${rel} ne doit pas importer three`);
  }
});

test('D3.4 (audit) : readFlags n\'est appelé qu\'avec __TREE_ATELIER__ comme second argument (jamais true en dur)', () => {
  // Audit : readFlags(location.search, true) dans l'îlot activait les paramètres de l'atelier dans l'export public.
  const files = [...filesUnder('components/tree'), ...filesUnder('lib/tree')].filter((f) => f !== 'lib/tree/guard.ts');
  const calls: string[] = [];
  const bad: string[] = [];
  for (const f of files) {
    const code = stripCode(readSrc(f));
    for (const m of code.matchAll(/\breadFlags\s*\(/g)) {
      let depth = 0;
      let end = -1;
      const open = (m.index ?? 0) + m[0].length - 1;
      for (let i = open; i < code.length; i++) {
        if ('([{'.includes(code[i] ?? '')) depth++;
        else if (')]}'.includes(code[i] ?? '') && --depth === 0) { end = i; break; }
      }
      const args = code.slice(open + 1, end);
      let d = 0;
      let cut = -1;
      for (let i = 0; i < args.length; i++) {
        const ch = args[i] ?? '';
        if ('([{'.includes(ch)) d++;
        else if (')]}'.includes(ch)) d--;
        else if (ch === ',' && d === 0) { cut = i; break; }
      }
      const second = cut < 0 ? '' : args.slice(cut + 1).trim().replace(/,$/, '').trim();
      calls.push(`${f} : readFlags(…, ${second})`);
      if (second !== '__TREE_ATELIER__') bad.push(`${f} : second argument « ${second} »`);
    }
  }
  assert.ok(calls.length >= 1, 'aucun appel à readFlags dans components/tree ni lib/tree');
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('D2.1 (audit) : seul portfolio-home.tsx importe TreeHero, et seul TreeHero.tsx importe TreeIsland', () => {
  // Audit « îlot monté sur une autre route » : aucune autre page ni composant ne peut monter l'arbre.
  const importers = (target: string): string[] =>
    siteCodeFiles().filter((f) => /\.(ts|tsx|mts|cts|js|mjs|jsx)$/.test(f) && importsOf(readFileSync(join(siteDir, f), 'utf8')).some((r) => r.kind !== 'type' && resolveSrc(f, r.spec) === target));
  assert.deepEqual(importers('components/tree/TreeHero.tsx'), ['components/portfolio-home.tsx']);
  assert.deepEqual(importers('components/tree/TreeIsland.tsx'), ['components/tree/TreeHero.tsx']);
});
