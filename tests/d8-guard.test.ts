// Contrat D8 (lot 1c) : lib/tree/guard.ts, garde de cadence, lecture des paramètres d'URL (D3.4), choix du profil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, guardMod } from './helpers-scene.ts';
import type { Mod } from './helpers-scene.ts';

// Horodatages d'images à cadence fixe, à partir d'une origine arbitraire.
const frames = (n: number, fps: number, t0 = 12345.678): number[] => Array.from({ length: n }, (_, i) => t0 + (i * 1000) / fps);

function pushAll(g: Mod, ts: number[]): string[] {
  return ts.map((t) => g.push(t));
}

test('D8.1 : 45 images à 30 i/s donnent ok à la 45ᵉ exactement, pending avant ; fps = 44 / ((t45 − t1)/1000)', async () => {
  // D8.1 : valeurs par défaut 45 images et 28 i/s.
  const { createFpsGuard } = await guardMod();
  const g = createFpsGuard();
  const out = pushAll(g, frames(45, 30));
  assert.deepEqual(out.slice(0, 44), Array(44).fill('pending'), 'pending avant la 45ᵉ image');
  assert.equal(out[44], 'ok');
  assert.equal(g.frames, 45);
  assert.ok(Math.abs(g.fps - 30) < 1e-9, `fps attendu 30, reçu ${g.fps}`);
});

// Arbitrage de l'audit (21/11) : un seul intervalle long isolé ne doit pas déclencher le repli ; la lenteur est confirmée
// sur une seconde fenêtre avant le verdict fail, qui reste figé ; une dégradation tardive est réévaluée. Les tests
// ci-dessous fixent ces comportements sans imposer l'algorithme (bornes : fail jamais avant la 45ᵉ image, au plus tard
// à la 90ᵉ pour une lenteur continue dès le départ).

// Série à cadence fixe avec des intervalles longs insérés après les images d'indices donnés (0 = première image).
function series(n: number, fps: number, longAfter: number[] = [], longMs = 1350, t0 = 5000): number[] {
  const out: number[] = [];
  let t = t0;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += longAfter.includes(i) ? longMs : 1000 / fps;
  }
  return out;
}

const firstIndex = (out: string[], v: string): number => out.indexOf(v);

test('D8.1 (arbitrage) : lenteur continue à 27 i/s : jamais ok, pending jusqu\'à la 44ᵉ image, fail au plus tard à la 90ᵉ ; fps null avant la 45ᵉ', async () => {
  // D8.1 : seuil 28 i/s ; confirmation possible sur une seconde fenêtre (audit).
  const { createFpsGuard } = await guardMod();
  const g = createFpsGuard();
  const ts = series(120, 27);
  const out: string[] = [];
  for (let i = 0; i < ts.length; i++) {
    out.push(g.push(ts[i] as number));
    if (i === 43) assert.equal(g.fps, null, 'fps null avant la 45ᵉ image');
  }
  assert.deepEqual(out.slice(0, 44), Array(44).fill('pending'));
  assert.ok(!out.includes('ok'), 'une lenteur continue ne doit jamais donner ok');
  const f = firstIndex(out, 'fail');
  assert.ok(f >= 44 && f <= 89, `fail attendu entre la 45ᵉ et la 90ᵉ image, obtenu à l'image ${f + 1}`);
  assert.ok(Math.abs(g.fps - 27) < 1e-6, `fps attendu 27, reçu ${g.fps}`);
});

test('D8.1 (arbitrage) : un seul intervalle long isolé (1 350 ms) dans une série à 60 i/s ne déclenche jamais fail, où qu\'il tombe', async () => {
  // Audit : un intervalle de 1 350 ms donnait 21,29 i/s à la 45ᵉ image et mémorisait le repli.
  const { createFpsGuard } = await guardMod();
  for (const at of [0, 10, 43, 44, 45, 70, 89, 90, 150]) {
    const g = createFpsGuard();
    const out = series(300, 60, [at]).map((t) => g.push(t));
    assert.ok(!out.includes('fail'), `intervalle long après l'image ${at + 1} : fail à l'image ${firstIndex(out, 'fail') + 1}`);
    assert.equal(out[out.length - 1], 'ok', `intervalle long après l'image ${at + 1} : ok attendu en fin de série`);
  }
});

test('D8.1 (arbitrage) : 30 i/s continus ne donnent jamais fail sur 300 images', async () => {
  // D8.1 : au-dessus du seuil.
  const { createFpsGuard } = await guardMod();
  const g = createFpsGuard();
  const out = series(300, 30).map((t) => g.push(t));
  assert.ok(!out.includes('fail'));
  assert.equal(out[44], 'ok');
});

test('D8.1 (arbitrage) : dégradation tardive réévaluée : 45 images à 60 i/s puis 10 i/s donnent fail au plus tard à la 135ᵉ image', async () => {
  // Audit : « 45 images rapides puis 200 à 10 i/s laissent le verdict ok ».
  const { createFpsGuard } = await guardMod();
  const g = createFpsGuard();
  const ts = [...series(45, 60, [], 0, 1000)];
  let t = ts[44] as number;
  for (let i = 0; i < 200; i++) ts.push((t += 100));
  const out = ts.map((x) => g.push(x));
  assert.equal(out[44], 'ok');
  const f = firstIndex(out, 'fail');
  assert.ok(f > 44 && f <= 134, `fail attendu entre la 46ᵉ et la 135ᵉ image, obtenu à ${f + 1}`);
});

test('D8.1 : fail reste figé : des images rapides ensuite ne le changent pas', async () => {
  // D8.1 : verdict fail figé (le repli est mémorisé).
  const { createFpsGuard } = await guardMod();
  const g = createFpsGuard();
  const out = series(120, 20).map((t) => g.push(t));
  assert.ok(out.includes('fail'));
  let t = 1e6;
  for (let i = 0; i < 200; i++) assert.equal(g.push((t += 5)), 'fail', 'fail figé');
});

test('D8.1 : reset() vide la mesure : frames 0, fps null, les images lentes d\'avant la pause ne comptent plus', async () => {
  // D8.1 : reset est appelé à chaque pause.
  const { createFpsGuard } = await guardMod();
  const g = createFpsGuard();
  series(44, 10).forEach((t) => g.push(t));
  g.reset();
  assert.equal(g.frames, 0);
  assert.equal(g.fps, null);
  const out = series(45, 60, [], 0, 99999).map((t) => g.push(t));
  assert.deepEqual(out.slice(0, 44), Array(44).fill('pending'));
  assert.equal(out[44], 'ok', 'les images lentes d\'avant la pause ne comptent plus');
  g.reset();
  assert.equal(g.frames, 0);
  const out2 = series(120, 20, [], 0, 200000).map((t) => g.push(t));
  const f = firstIndex(out2, 'fail');
  assert.ok(f >= 44 && f <= 89, `après reset, fail entre la 45ᵉ et la 90ᵉ image, obtenu à ${f + 1}`);
});

test('D8.1 (arbitrage) : options frames et minFps : fps égal au seuil donne ok à la frames-ième image ; en dessous, jamais ok et fail au plus tard à 2 × frames', async () => {
  // D8.1 : fail si fps < minFps (inégalité stricte).
  const { createFpsGuard } = await guardMod();
  const eq = createFpsGuard({ frames: 5, minFps: 40 });
  assert.deepEqual([1000, 1020, 1050, 1070, 1100].map((t) => eq.push(t)), ['pending', 'pending', 'pending', 'pending', 'ok']); // 4 / 0,1 s = 40
  assert.equal(eq.fps, 40);
  const below = createFpsGuard({ frames: 5, minFps: 40 });
  const out = series(10, 39.5, [], 0, 1000).map((t) => below.push(t));
  assert.ok(!out.includes('ok'), 'sous le seuil : jamais ok');
  assert.deepEqual(out.slice(0, 4), Array(4).fill('pending'));
  const f = firstIndex(out, 'fail');
  assert.ok(f >= 4 && f <= 9, `fail entre la 5ᵉ et la 10ᵉ image, obtenu à ${f + 1}`);
  const eleven = createFpsGuard({ frames: 11, minFps: 28 });
  const o = series(11, 29).map((t) => eleven.push(t));
  assert.deepEqual(o.slice(0, 10), Array(10).fill('pending'));
  assert.equal(o[10], 'ok');
});

async function defaults(): Promise<{ palette: string; seed: number }> {
  const { DEFAULT_PALETTE } = await engine.palettes();
  const { DEFAULT_SEED } = await engine.skeleton();
  return { palette: DEFAULT_PALETTE, seed: DEFAULT_SEED };
}

// Vue normalisée des drapeaux : croissance absente = null (celle du profil).
function view(f: Mod): Record<string, unknown> {
  return { ascii: f.ascii, atelier: f.atelier, palette: f.palette, backdrop: f.backdrop, growth: f.growth ?? null, seed: f.seed };
}

test('D8.2 : readFlags sans paramètre : ascii et atelier faux, DEFAULT_PALETTE, fond halo, croissance du profil (null), DEFAULT_SEED', async () => {
  // D3.4, D8.2 : valeurs par défaut.
  const { readFlags } = await guardMod();
  const d = await defaults();
  for (const allowed of [true, false]) {
    for (const search of ['', '?']) {
      assert.deepEqual(view(readFlags(search, allowed)), { ascii: false, atelier: false, palette: d.palette, backdrop: 'halo', growth: null, seed: d.seed }, `readFlags(${JSON.stringify(search)}, ${allowed})`);
    }
  }
});

test('D8.2 : ascii vaut vrai pour ?ascii, ?ascii=, ?x&ascii, dans tous les builds ; faux pour ?asciix ou ?xascii', async () => {
  // D3.4, D8.2 : ?ascii actif même sans atelier.
  const { readFlags } = await guardMod();
  for (const allowed of [true, false]) {
    for (const s of ['?ascii', '?ascii=', '?x&ascii', '?x=1&ascii=&y']) assert.equal(readFlags(s, allowed).ascii, true, `${s} (atelier ${allowed})`);
    for (const s of ['?asciix', '?xascii', '?x=ascii']) assert.equal(readFlags(s, allowed).ascii, false, `${s} (atelier ${allowed})`);
  }
});

test('D8.2 : avec l\'atelier permis, atelier, palette, fond, croissance et graine valides sont pris en compte', async () => {
  // D3.4 : ?atelier, palette=<id>, fond=halo|foret|ciel, croissance=simple|naturelle, graine=<entier>.
  const { readFlags } = await guardMod();
  const f = readFlags('?atelier&palette=givre&fond=foret&croissance=simple&graine=42', true);
  assert.deepEqual(view(f), { ascii: false, atelier: true, palette: 'givre', backdrop: 'foret', growth: 'simple', seed: 42 });
  const g = readFlags('?palette=ardoise&fond=ciel&croissance=naturelle&graine=0&ascii', true);
  assert.deepEqual(view(g), { ascii: true, atelier: false, palette: 'ardoise', backdrop: 'ciel', growth: 'natural', seed: 0 });
  assert.equal(readFlags('?fond=halo&palette=foret', true).backdrop, 'halo');
  assert.equal(readFlags('?fond=halo&palette=foret', true).palette, 'foret');
});

test('D8.2 : sans l\'atelier, toutes les clés de l\'atelier sont ignorées (seul ascii reste)', async () => {
  // D3.4 : export public.
  const { readFlags } = await guardMod();
  const d = await defaults();
  const f = readFlags('?atelier&palette=givre&fond=foret&croissance=simple&graine=42&ascii', false);
  assert.deepEqual(view(f), { ascii: true, atelier: false, palette: d.palette, backdrop: 'halo', growth: null, seed: d.seed });
});

test('D8.2 : valeurs inconnues ignorées sans erreur ; graine entière dans [0, 2³²) seulement', async () => {
  // D8.2 : palette contre PALETTE_ORDER, fond contre {halo, foret, ciel}, croissance contre {simple, naturelle}.
  const { readFlags } = await guardMod();
  const d = await defaults();
  const bad = readFlags('?palette=nuit&fond=nuit&croissance=natural&graine=abc', true);
  assert.deepEqual(view(bad), { ascii: false, atelier: false, palette: d.palette, backdrop: 'halo', growth: null, seed: d.seed });
  for (const g of ['-1', '1.5', '4294967296', '1e3', '', 'NaN', 'Infinity', '0x10']) {
    assert.equal(readFlags(`?graine=${g}`, true).seed, d.seed, `graine=${g} doit être ignorée`);
  }
  assert.equal(readFlags('?graine=4294967295', true).seed, 4294967295, 'borne haute 2³² − 1 acceptée');
  assert.equal(readFlags('?graine=123456', true).seed, 123456);
  assert.doesNotThrow(() => readFlags('?%E0%A4%A=1&palette=%ZZ&graine', true), 'un paramètre mal encodé ne doit pas lever');
});

test('D8.3 : chooseProfile renvoie phone si narrow ou coarse, desktop sinon', async () => {
  // D8.3 : (max-width:760px), (pointer:coarse).
  const { chooseProfile } = await guardMod();
  assert.equal(chooseProfile({ narrow: false, coarse: false }), 'desktop');
  assert.equal(chooseProfile({ narrow: true, coarse: false }), 'phone');
  assert.equal(chooseProfile({ narrow: false, coarse: true }), 'phone');
  assert.equal(chooseProfile({ narrow: true, coarse: true }), 'phone');
});
