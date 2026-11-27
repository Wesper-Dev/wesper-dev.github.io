// Contrat D12 et D18 (lot 1c) : observabilité (statique), table des points attendus recoupée par les modules purs, documentation.
// window.__arbre, CustomEvent arbre:state et performance.measure sont vérifiés en navigateur [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backdropMod, engine, filesUnder, leavesMod, readSrc, siteDir, stripCode } from './helpers-scene.ts';

test('D12.1 : aucun console.log dans lib/tree ni dans components/tree', () => {
  // D12.1 [S-a] : la console reste propre dans tous les builds.
  const files = [...filesUnder('lib/tree'), ...filesUnder('components/tree')];
  assert.ok(files.includes('lib/tree/scene.ts') && files.includes('components/tree/TreeIsland.tsx'), 'scene.ts et TreeIsland.tsx attendus');
  const hits = files.filter((f) => /\bconsole\s*\.\s*log\b/.test(stripCode(readFileSync(join(siteDir, f), 'utf8'))));
  assert.deepEqual(hits, [], `console.log dans : ${hits.join(', ')}`);
});

test('D12.1 : la scène émet arbre:state et les mesures arbre:* nommées par le contrat', () => {
  // D12.1 [S-a, approché] : les noms de mesures et d'événement figurent dans les sources de la scène ou de l'îlot.
  const src = ['lib/tree/scene.ts', 'components/tree/TreeIsland.tsx'].map((f) => stripCode(readSrc(f))).join('\n');
  assert.match(src, /['"`]arbre:state['"`]/, 'CustomEvent arbre:state absent');
  for (const m of ['skeleton', 'anchors', 'cloud', 'colors', 'sapD', 'upload', 'first-frame']) {
    assert.ok(src.includes(`arbre:${m}`) || new RegExp(`['"\`]arbre:['"\`]\\s*\\+|\`arbre:\\$\\{`).test(src), `mesure arbre:${m} absente`);
  }
});

test('D12.3 : la table des points attendus se recoupe avec les modules purs (arbre + sol + feuilles, forêt, ciel)', async () => {
  // D12.3 : phone 45 000 + 7 000 + 12 = 52 012 (52 000 en mouvement réduit) ; desktop 240 000 + 14 000 + 28 = 254 028 (254 000).
  const { PROFILES } = await engine.cloud();
  const { buildGround, buildForest, buildSky } = await backdropMod();
  const { createLeaves } = await leavesMod();
  const { PALETTES } = await engine.palettes();
  const want = { phone: { total: 52012, reduced: 52000, forest: 17050, sky: 2600 }, desktop: { total: 254028, reduced: 254000, forest: 68110, sky: 5200 } };
  for (const profile of ['phone', 'desktop'] as const) {
    const cloud = { count: 1, positions: new Float32Array(3), role: new Uint8Array([2]), segment: new Uint16Array(1) };
    const opts = (rm: boolean): Record<string, unknown> => ({ profile, reducedMotion: rm, seed: 7, palette: PALETTES['sous-bois'], cloud, data: { cloud } });
    const tree = PROFILES[profile].points as number;
    const ground = buildGround(profile, 7).count as number;
    assert.equal(tree + ground + createLeaves(opts(false)).capacity, want[profile].total, `${profile} : total`);
    assert.equal(tree + ground + createLeaves(opts(true)).capacity, want[profile].reduced, `${profile} : total en mouvement réduit`);
    assert.equal(buildForest(profile, 7).count, want[profile].forest, `${profile} : forêt`);
    assert.equal(buildSky(profile, 7).count, want[profile].sky, `${profile} : ciel`);
  }
});

test('D18 : site/README.md documente TreeHero, ?atelier, ?ascii, __arbre, le calcul du poids et le retrait de client-proof', () => {
  // D18 [S-a] : présence des mots ?atelier, __arbre, TreeHero (et des autres points listés).
  const readme = readSrc('README.md');
  for (const w of ['TreeHero', '?atelier', '?ascii', '__arbre', 'client-proof']) assert.ok(readme.includes(w), `README.md : « ${w} » absent`);
  assert.match(readme, /gzip/i, 'README.md : calcul du poids (gzip) non documenté');
});

test('D18 (arbitrage) : le README documente le redimensionnement : plafond de DPR et taille de toile réappliqués, profil du premier écran conservé', () => {
  // Arbitrage de l'audit : le profil (nombre de points) n'est pas régénéré au redimensionnement ; à documenter.
  const readme = readSrc('README.md');
  const para = readme.split(/\n\s*\n/).find((p) => /redimension|resiz/i.test(p) && /profil|profile/i.test(p));
  assert.ok(para, 'README.md : aucun paragraphe ne relie redimensionnement et profil');
  assert.match(para, /DPR|devicePixelRatio|résolution|pixel/i, 'README.md : le plafond de DPR réappliqué n\'est pas mentionné');
  assert.match(para, /premier écran|premier chargement|montage|first (screen|load)|régén|regener/i, 'README.md : le profil conservé depuis le premier écran n\'est pas mentionné');
});
