// Audit astra n° 3 du lot 2a, point H11 : le JS de l'export public (scène, worker, îlot…) ne livre que les textes
// retenus. Ni identifiant de question (A-02, A-05, A-06…), ni marqueur d'attente (`unconfirmed`), ni variante de texte
// écartée par les réponses en vigueur (« 42 : Inception », « Gemma lit et rédige » tant que A-05 est sans réponse…).
// La liste des variantes écartées n'est pas figée ici : elle est tirée de FAITS §6 (ou de sa copie versionnée, F12) et
// de site/content/tree.ts, moins les textes que le site affiche avec ANSWERS (skillLabel, skillTooltip).
// Ne porte que sur un export public (robots.txt, comme F11) ; en aperçu, le test le dit et passe sans être sauté.
// En local : SITE_TEST_DIST=<export public>/dist/client npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { distDir, exportModeOf } from './helpers.ts';
import { faitsSource } from './helpers-faits.ts';
import { leaksIn, treeTexts } from './helpers-h11.ts';
import { allFiles, requireDist } from './helpers-scene.ts';

test('H11 : la liste des variantes écartées, tirée de FAITS §6 et de tree.ts, n\'est pas vide et ne contient aucun texte affiché', async () => {
  const { retained, rejected } = await treeTexts();
  // Avec les réponses du 20/11 (A-05 sans réponse), au moins les fragments liés à A-05 et aux liens « à confirmer ».
  assert.ok(rejected.length > 0, `aucune variante écartée trouvée (source : ${faitsSource()}) : le test ne contrôlerait rien`);
  for (const r of rejected) assert.ok(!retained.some((t) => t.includes(r)), `« ${r} » est aussi un texte affiché`);
});

test('H11 : export public : aucun fichier JS ne contient d\'identifiant de question (A-0x), « unconfirmed » ni variante de texte écartée', async (t) => {
  requireDist();
  if (exportModeOf(distDir) !== 'public') {
    t.diagnostic('H11 ne s\'applique qu\'à un export public (robots.txt de l\'aperçu : Disallow) ; en local : SITE_TEST_DIST=<export public> npm test');
    return;
  }
  const { rejected } = await treeTexts();
  const hits: string[] = [];
  for (const f of allFiles(distDir).filter((x) => /\.m?js$/.test(x))) {
    for (const h of leaksIn(readFileSync(f, 'utf8'), rejected)) hits.push(`${relative(distDir, f)} : ${h}`);
  }
  assert.deepEqual(hits, [], 'export public : décisions éditoriales ou textes non retenus livrés dans le JS');
});

test('H11 (témoins) : le repérage trouve A-05, unconfirmed et une variante même échappée ; il laisse passer un texte retenu', async () => {
  const { retained, rejected } = await treeTexts();
  const v = rejected[0] as string;
  const escaped = JSON.stringify(v).replace(/[^\x20-\x7e]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`).replace(/'/g, "\\'");
  assert.ok(leaksIn(`const t={c:"A-05"}`, rejected).some((x) => x.includes('A-05')));
  assert.ok(leaksIn(`if(c==="unconfirmed")return!1`, rejected).length >= 1);
  assert.ok(leaksIn(`var s=${escaped};`, rejected).some((x) => x.includes(v)), `variante échappée non repérée : ${escaped}`);
  assert.deepEqual(leaksIn(`var s=${JSON.stringify(retained.filter((r) => r.length > 0).join('|'))};var n="DATA-01";`, rejected), [], 'un texte retenu ou un nom voisin est signalé à tort');
});
