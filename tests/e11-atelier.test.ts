// Contrat E3.4 et E11.5 (lot 2a) : libellés de l'atelier rangés dans content/atelier.ts, importé par le seul
// AtelierPanel.tsx ; rien de l'atelier dans l'export public. Panneau, palette dans l'adresse, téléphone : scénarios [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allFiles, importsOf, requireDist, resolveSrc, siteCodeFiles, siteDir, treeChunks } from './helpers-scene.ts';
import { distDir, homeMods, homeRoot, readSrc2a } from './helpers-home.ts';
import { staticClosure } from './helpers.ts';

const ATELIER = 'content/atelier.ts';
const PANEL = 'components/tree/AtelierPanel.tsx';
const ATELIER_STRINGS = ['Croissance naturelle', 'Croissance simple'];
const rel = (f: string): string => '/' + f.slice(distDir.length + 1);

test('E3.4 : content/atelier.ts porte « Croissance naturelle » et « Croissance simple » et n\'est importé que par AtelierPanel.tsx', () => {
  // E3.4 / E11.5 : mutation « atelier.ts importé par TreeIsland.tsx ».
  const src = readSrc2a(ATELIER);
  for (const s of ATELIER_STRINGS) assert.ok(src.includes(s), `${ATELIER} : « ${s} » absent`);
  for (const s of ['Halo', 'Forêt', 'Ciel', 'ASCII']) assert.ok(src.includes(s), `${ATELIER} : libellé « ${s} » absent (E3.4)`);
  const importers = siteCodeFiles().filter((f) => f !== ATELIER && importsOf(readFileSync(join(siteDir, f), 'utf8')).some((r) => resolveSrc(f, r.spec) === ATELIER));
  assert.deepEqual(importers, [PANEL], `importeurs de ${ATELIER}`);
});

test('E3.4 : aucun autre fichier de code du site ne contient « Croissance naturelle » ni « Croissance simple »', () => {
  // E3.4 : chaînes stockées une seule fois, dans content/atelier.ts.
  readSrc2a(ATELIER);
  const bad = siteCodeFiles().filter((f) => f !== ATELIER && ATELIER_STRINGS.some((s) => readFileSync(join(siteDir, f), 'utf8').includes(s)));
  assert.deepEqual(bad, [], `chaînes de l'atelier hors de ${ATELIER} : ${bad.join(', ')}`);
});

test('E11.5 : aucun HTML exporté ne contient un nom de palette (PALETTES[id].name)', async () => {
  // E11.5 : mutation « nom de palette rendu dans le HTML ».
  const { PALETTES } = await homeMods.palettes();
  const names = Object.values(PALETTES as Record<string, { name?: string }>).map((p) => p.name);
  assert.ok(names.every((n) => typeof n === 'string' && n.length > 0), 'PALETTES[id].name attendu pour chaque palette');
  requireDist();
  homeRoot('/');
  const bad: string[] = [];
  for (const f of allFiles(distDir).filter((x) => x.endsWith('.html'))) {
    const t = readFileSync(f, 'utf8');
    for (const n of names) if (t.includes(n as string)) bad.push(`${rel(f)} : ${n}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('E11.5 : export public : aucun fichier ne contient « Croissance naturelle », « Croissance simple », data-tree-atelier ni __arbre ; aperçu : seulement les chunks de l\'atelier', () => {
  // E11.5 / D11.4 : l'atelier est retiré du build public.
  const mode = requireDist();
  homeRoot('/');
  const files = allFiles(distDir).filter((f) => /\.(html|rsc|js|css|json|txt|xml)$/.test(f));
  if (mode === 'public') {
    const bad: string[] = [];
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      for (const s of [...ATELIER_STRINGS, 'data-tree-atelier', '__arbre']) if (t.includes(s)) bad.push(`${rel(f)} : ${s}`);
    }
    assert.deepEqual(bad, [], bad.join('\n'));
  } else {
    const { atelier } = treeChunks();
    assert.ok(atelier.length >= 1, 'aperçu : chunk de l\'atelier introuvable');
    const holders = files.filter((f) => ATELIER_STRINGS.some((s) => readFileSync(f, 'utf8').includes(s))).map(rel);
    assert.ok(holders.length >= 1, 'aperçu : les libellés de l\'atelier doivent être livrés dans le chunk de l\'atelier');
    const closure = staticClosure(distDir, atelier);
    assert.deepEqual(holders.filter((u) => !closure.has(u)), [], 'aperçu : libellés de l\'atelier hors du chunk de l\'atelier (et de ses imports statiques)');
  }
});
