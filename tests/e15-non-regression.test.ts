// Contrat E15.1 (HTML), E15.4 (sources du moteur) et E16.5 (CV) du lot 2a. Lot 4 : la comparaison du HTML des pages
// secondaires à 4ed945b est remplacée par Q3 et Q2 (voir plus bas). Historique : pages secondaires identiques à 4ed945b,
// au hachage des fichiers près. Une règle CSS non préfixée qui change l'apparence des pages secondaires sans toucher
// leur HTML n'est pas visible ici : c'est le scénario [B] E15.1 (captures comparées) qui l'attrape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { engine } from './helpers-scene.ts';
import { fingerprint, listDir, normalizedBody, headPreloads, readBaseline, secondaryRoutes, siteDir } from './helpers-home.ts';
import { LOT2B_ROUTES } from './helpers-2b.ts';

// Lot 2b : les quatre pages BPCE et École 42 n'existaient pas en 4ed945b ; la référence porte sur les 15 autres.
const refRoutes = (): string[] => secondaryRoutes().filter((r) => !LOT2B_ROUTES.includes(r));

test('E15.1 (mis à jour au lot 2b) : la référence 4ed945b couvre les 15 pages secondaires d\'avant le lot 2b dans les deux modes ; 19 pages secondaires en tout', () => {
  // contrat-lot2a-tests §4.4 : fichier de référence lui-même ; lot 2b : quatre pages de plus, hors référence.
  const ref = readBaseline();
  assert.equal(ref.commit, '4ed945b');
  assert.ok(ref.commande.includes('git worktree add') && ref.commande.includes('SITE_PUBLIC=1'), 'commande de construction de la référence absente');
  assert.equal(secondaryRoutes().length, 19, '18 routes secondaires et la 404 (lot 2b)');
  const routes = refRoutes();
  assert.equal(routes.length, 15);
  for (const mode of ['preview', 'public'] as const) assert.deepEqual(Object.keys(ref.pages[mode]).sort(), [...routes].sort(), `référence ${mode} : routes`);
});

test('E15.1 : la normalisation du test retire scripts, noms hachés et blancs (témoins)', () => {
  // Témoins : deux exports qui ne diffèrent que par le hachage et les scripts ont la même empreinte.
  const a = '<html><head><link rel="stylesheet" href="/_next/static/css/index.AAA.css"/></head><body>\n<p>x</p><script>1</script><img src="/_next/static/media/a-1.png"></body></html>';
  const b = '<html><head><link rel="stylesheet" href="/_next/static/css/index.BBB.css"/></head><body> <p>x</p><script src="/_next/static/chunks/z.js"></script><img src="/_next/static/media/a-2.png"></body></html>';
  assert.deepEqual(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a).body, fingerprint(a.replace('<p>x</p>', '<p>y</p>')).body);
  assert.deepEqual(headPreloads(a), ['/_next/static/*']);
  assert.equal(normalizedBody('<body a="1">\n\t<b>z</b>\n</body>'), '<body a="1"> <b>z</b> </body>');
});

// E15.1 « <body> normalisé et préchargements des pages secondaires = 4ed945b » : remplacé au lot 4 par
// q3-contenu.test.ts (texte, liens, images, titres et métadonnées = a040fb0) et q2-coquille.test.ts (en-tête, pied,
// préchargements de polices) : le lot 4 change à dessein le HTML des pages secondaires (contrat lot 4, Q2 et Q3).

// Lot 5 (contrat-lot5.md, T1 et T4) : le CV public est refait à dessein. E16.5 garde les noms de 4ed945b (Q-R8 :
// mêmes URL) ; l'empreinte figée est remplacée par le contrôle du contenu de chaque PDF (t1-cv-pdf.test.ts, K1 à K14).
test('E16.5 : public/cv contient les mêmes PDF qu\'à 4ed945b (noms, Q-R8) ; leur contenu est contrôlé par t1 (lot 5)', () => {
  // E16.5 : mutation « PDF retiré ou renommé ».
  const ref = readBaseline().cv;
  const files = listDir('public/cv').filter((f) => f.endsWith('.pdf'));
  assert.deepEqual(files, Object.keys(ref).sort(), 'liste des PDF de public/cv');
  for (const f of files) assert.equal(readFileSync(join(siteDir, 'public', 'cv', f)).subarray(0, 5).toString('latin1'), '%PDF-', `${f} n'est pas un PDF`);
});

test('E15.4 : les modules du moteur (rng, skeleton, sap, cloud, color, labels) s\'importent et gardent leurs exports de base', async () => {
  // E15.4 : le comportement est vérifié par les tests B, inchangés ; ici seulement la présence des points d'entrée.
  const want: Record<string, string[]> = {
    color: ['cssVariables', 'contrastRatio'],
    labels: ['layoutLabels'],
  };
  for (const [k, names] of Object.entries(want)) {
    const mod = await (engine as Record<string, () => Promise<Record<string, unknown>>>)[k]!();
    for (const n of names) assert.equal(typeof mod[n], 'function', `lib/tree/${k}.ts : export ${n} absent`);
  }
  for (const k of ['rng', 'skeleton', 'sap', 'cloud']) await (engine as Record<string, () => Promise<unknown>>)[k]!();
});
