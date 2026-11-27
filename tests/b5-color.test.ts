// Contrat B5 : lib/tree/color.ts (conversions, WCAG, offsetHSL de three r147, couleur des points, recoloration).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE,
  bytesEqual,
  cloudMod,
  colorMod,
  hex3,
  memo,
  palettesMod,
  refMix,
  refOffsetHSL,
  refPointColor,
  skeletonMod,
  testRng,
  wcagContrast,
  wcagLuminance,
} from './helpers-tree.ts';
import type { Mod, V3 } from './helpers-tree.ts';

const close3 = (a: readonly number[], b: readonly number[], eps: number): boolean => a.length === 3 && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) <= eps);
const ORDER = ['sous-bois', 'ardoise', 'foret', 'givre'] as const;

// Nuage synthétique (Pick<Cloud, 'count' | 'role' | 'rand' | 'positions'>) : rapide et indépendant du module cloud.
function fakeCloud(n: number, seed: number): Mod {
  const r = testRng(seed);
  const role = new Uint8Array(n);
  const rand = new Float32Array(n);
  const positions = new Float32Array(3 * n);
  for (let k = 0; k < n; k++) {
    role[k] = Math.floor(r() * 3);
    rand[k] = r();
    positions[3 * k] = r() * 10 - 5;
    positions[3 * k + 1] = r() * 18 - 4;
    positions[3 * k + 2] = r() * 10 - 5;
  }
  return { count: n, role, rand, positions };
}
const BOUNDS = { min: [-5, -4, -5] as V3, max: [5, 14, 5] as V3 };

const phone = memo(async () => {
  const sk = (await skeletonMod()).growSkeleton({ mode: 'simple', seed: 7 });
  return { sk, c: (await cloudMod()).sampleCloud(sk, { points: 45000 }) };
});

test('B5 hexToRgb : #RRGGBB vers [0,1], erreur pour tout autre format', async () => {
  // B5 signature : accepte '#RRGGBB' seulement.
  const { hexToRgb } = await colorMod();
  assert.deepEqual([...hexToRgb('#FF8000')], [1, 128 / 255, 0], `#FF8000 → ${JSON.stringify(hexToRgb('#FF8000'))}`);
  assert.deepEqual([...hexToRgb('#050a08')], [5 / 255, 10 / 255, 8 / 255], `#050a08 → ${JSON.stringify(hexToRgb('#050a08'))}`);
  assert.deepEqual([...hexToRgb('#000000')], [0, 0, 0]);
  for (const bad of ['#fff', 'FF8000', '#FF80001', '#GG8000', '', 'rgb(1,2,3)', '#FF 800', ' #FF8000', '#FF8000 ']) {
    assert.throws(() => hexToRgb(bad), Error, `aucune erreur pour ${JSON.stringify(bad)}`);
  }
});

test('B5 rgbToHex : #rrggbb minuscule, arrondi au plus proche, aller-retour exact', async () => {
  // B5 signature : '#rrggbb', arrondi à l'entier le plus proche.
  const { hexToRgb, rgbToHex } = await colorMod();
  assert.equal(rgbToHex([1, 0.5, 0]), '#ff8000', `[1, 0.5, 0] → ${rgbToHex([1, 0.5, 0])}`);
  assert.equal(rgbToHex([0.2 / 255, 254.6 / 255, 16.49 / 255]), '#00ff10', `arrondi : ${rgbToHex([0.2 / 255, 254.6 / 255, 16.49 / 255])}`);
  const r = testRng(3);
  for (let k = 0; k < 200; k++) {
    const h = '#' + Array.from({ length: 3 }, () => Math.floor(r() * 256).toString(16).padStart(2, '0')).join('');
    assert.equal(rgbToHex(hexToRgb(h)), h, `aller-retour de ${h}`);
    assert.equal(rgbToHex(hexToRgb(h.toUpperCase())), h, `aller-retour de ${h.toUpperCase()}`);
  }
});

test('B5 mix : interpolation linéaire a + (b − a) t', async () => {
  // B5 signature.
  const { mix } = await colorMod();
  const r = testRng(9);
  for (let k = 0; k < 50; k++) {
    const a: V3 = [r(), r(), r()];
    const b: V3 = [r(), r(), r()];
    const t = r();
    assert.ok(close3(mix(a, b, t), refMix(a, b, t), 1e-12), `mix(${a}, ${b}, ${t}) = ${mix(a, b, t)}`);
  }
  assert.deepEqual([...mix([0, 0.5, 1], [1, 0.5, 0], 0)], [0, 0.5, 1]);
  assert.deepEqual([...mix([0, 0.5, 1], [1, 0.5, 0], 1)], [1, 0.5, 0]);
});

test('B5.1 : relativeLuminance et contrastRatio suivent WCAG 2.x (seuil 0,04045)', async () => {
  // B5.1 : noir/blanc = 21, soi-même = 1, symétrie ; recalcul WCAG indépendant.
  const { relativeLuminance, contrastRatio, hexToRgb } = await colorMod();
  assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 1e-9, `noir/blanc = ${contrastRatio('#000000', '#FFFFFF')}`);
  assert.ok(Math.abs(contrastRatio([1, 1, 1], [0, 0, 0]) - 21) < 1e-9, 'blanc/noir en RGB');
  assert.ok(Math.abs(relativeLuminance('#FFFFFF') - 1) < 1e-12, `blanc : ${relativeLuminance('#FFFFFF')}`);
  assert.ok(Math.abs(relativeLuminance('#000000')) < 1e-12, `noir : ${relativeLuminance('#000000')}`);
  const r = testRng(21);
  for (let k = 0; k < 200; k++) {
    const h = () => '#' + Array.from({ length: 3 }, () => Math.floor(r() * 256).toString(16).padStart(2, '0')).join('');
    const a = h();
    const b = h();
    assert.ok(Math.abs(relativeLuminance(a) - wcagLuminance(hex3(a))) < 1e-12, `luminance de ${a} : ${relativeLuminance(a)}, WCAG ${wcagLuminance(hex3(a))}`);
    assert.ok(Math.abs(relativeLuminance(hexToRgb(a)) - wcagLuminance(hex3(a))) < 1e-12, `luminance RGB de ${a}`);
    const ratio = contrastRatio(a, b);
    assert.ok(Math.abs(ratio - wcagContrast(hex3(a), hex3(b))) < 1e-9, `contraste ${a}/${b} : ${ratio}, WCAG ${wcagContrast(hex3(a), hex3(b))}`);
    assert.ok(Math.abs(ratio - contrastRatio(b, a)) < 1e-12, `contraste non symétrique pour ${a}/${b}`);
    assert.ok(Math.abs(contrastRatio(a, a) - 1) < 1e-12, `contraste de ${a} avec lui-même`);
  }
  // Seuil 0,04045 : 10/255 ≈ 0,0392 est sous le seuil (branche linéaire), 11/255 ≈ 0,0431 au-dessus.
  assert.ok(Math.abs(relativeLuminance('#0A0A0A') - 10 / 255 / 12.92) < 1e-12, `#0A0A0A : ${relativeLuminance('#0A0A0A')}`);
  assert.ok(Math.abs(relativeLuminance('#0B0B0B') - ((11 / 255 + 0.055) / 1.055) ** 2.4) < 1e-12, `#0B0B0B : ${relativeLuminance('#0B0B0B')}`);
});

test('B5.2 : offsetHSL(c, 0, 0, 0) ≈ c, sorties dans [0,1], sémantique de three r147', async () => {
  // B5.2 et signature : comparaison à Color.getHSL / setHSL de three r147 recalculés.
  const { offsetHSL } = await colorMod();
  const r = testRng(77);
  for (let k = 0; k < 300; k++) {
    const c: V3 = [r(), r(), r()];
    assert.ok(close3(offsetHSL(c, 0, 0, 0), c, 1e-6), `offsetHSL(${c}, 0, 0, 0) = ${offsetHSL(c, 0, 0, 0)}`);
    const dh = (r() - 0.5) * 3;
    const ds = (r() - 0.5) * 2.5;
    const dl = (r() - 0.5) * 2.5;
    const out = offsetHSL(c, dh, ds, dl);
    assert.ok(out.every((v: number) => v >= 0 && v <= 1), `offsetHSL hors de [0,1] : ${out}`);
    const want = refOffsetHSL(c, dh, ds, dl);
    assert.ok(close3(out, want, 1e-6), `offsetHSL(${c}, ${dh}, ${ds}, ${dl}) = ${out}, three r147 : ${want}`);
  }
  for (const c of [[0, 0, 0], [1, 1, 1], [0.5, 0.5, 0.5], [1, 0, 0]] as V3[]) {
    assert.ok(close3(offsetHSL(c, 0.1, 0.08, 0.02), refOffsetHSL(c, 0.1, 0.08, 0.02), 1e-6), `cas particulier ${c}`);
  }
});

test('B5.3 : avec rand = 0,05, un point LEAF prend offsetHSL(leafAcc, …) calculé directement', async () => {
  // B5.3.
  const { pointColor, offsetHSL, hexToRgb } = await colorMod();
  const { PALETTES } = await palettesMod();
  for (const id of ORDER) {
    const p = PALETTES[id];
    const want = offsetHSL(hexToRgb(p.leafAcc), (((0.05 * 3.7) % 1) - 0.5) * 0.03, 0.08, (((0.05 * 7.31) % 1) - 0.5) * 0.08);
    for (const h of [0, 0.4, 1]) {
      const got = pointColor(ROLE.LEAF, 0.05, h, p);
      assert.ok(close3(got, want, 1e-9), `${id}, h = ${h} : ${got}, attendu ${want}`);
    }
  }
});

test('B5 pointColor : formules de proto:499–503 pour les trois rôles et leurs seuils', async () => {
  // B5 pointColor : recalcul indépendant, seuils 0,07 (LEAF) et 0,1 (BARK) des deux côtés.
  const { pointColor } = await colorMod();
  const { PALETTES } = await palettesMod();
  const r = testRng(12);
  const rands = [0, 0.0699, 0.07, 0.0999, 0.1, 0.5, 0.999, ...Array.from({ length: 40 }, () => r())];
  for (const id of ORDER) {
    const p = PALETTES[id];
    for (const role of [ROLE.BARK, ROLE.ROOT, ROLE.LEAF]) for (const rand of rands) for (const h of [-0.1, 0, 0.3, 0.6, 1, 1.2]) {
      const got = pointColor(role, rand, h, p);
      const want = refPointColor(role, rand, h, p);
      if (!close3(got, want, 1e-6)) assert.fail(`${id}, rôle ${role}, rand ${rand}, h ${h} : ${got}, attendu ${want}`);
    }
  }
});

test('B5 applyPalette : h = (y − (min.y − 0,6)) / max(1, max.y − min.y + 1,2), sortie 3N, couleur de chaque point', async () => {
  // B5 applyPalette : recalcul indépendant de h ; couleur = pointColor du module.
  const { applyPalette, pointColor } = await colorMod();
  const { PALETTES } = await palettesMod();
  const cases: [string, Mod, Mod][] = [
    ['synthétique', fakeCloud(3000, 4), BOUNDS],
    ['synthétique plat', fakeCloud(500, 5), { min: [-1, 2, -1], max: [1, 2.1, 1] }],
  ];
  const { sk, c } = await phone();
  cases.push(['phone', c, sk.bounds]);
  for (const [name, cloud, bounds] of cases) {
    for (const id of ['sous-bois', 'givre']) {
      const p = PALETTES[id];
      const out = applyPalette(cloud, bounds, p);
      assert.ok(out instanceof Float32Array && out.length === 3 * cloud.count, `${name} : Float32Array de longueur 3N attendu`);
      const step = Math.max(1, Math.floor(cloud.count / 3000));
      for (let k = 0; k < cloud.count; k += step) {
        const y = cloud.positions[3 * k + 1];
        const h = (y - (bounds.min[1] - 0.6)) / Math.max(1, bounds.max[1] - bounds.min[1] + 1.2);
        const want = pointColor(cloud.role[k], cloud.rand[k], h, p);
        const got: number[] = [out[3 * k], out[3 * k + 1], out[3 * k + 2]];
        if (!close3(got, want, 1e-6)) assert.fail(`${name}/${id} : point ${k} ${got}, attendu ${want} (h ${h})`);
      }
    }
  }
});

test('B5.4 : une seule recoloration (A puis B dans le même out = B seul), nuage intact, déterminisme', async () => {
  // B5.4.
  const { applyPalette } = await colorMod();
  const { PALETTES } = await palettesMod();
  const { sk, c } = await phone();
  const snap = { role: c.role.slice(), rand: c.rand.slice(), positions: c.positions.slice() };
  const bOnly = applyPalette(c, sk.bounds, PALETTES.foret);
  const out = new Float32Array(3 * c.count);
  const r1 = applyPalette(c, sk.bounds, PALETTES.ardoise, out);
  assert.equal(r1, out, 'applyPalette doit écrire dans le out fourni et le renvoyer');
  const r2 = applyPalette(c, sk.bounds, PALETTES.foret, out);
  assert.equal(r2, out, 'applyPalette doit renvoyer le out fourni');
  assert.ok(bytesEqual(out, bOnly), 'A puis B dans le même out diffère de B seul');
  assert.ok(bytesEqual(applyPalette(c, sk.bounds, PALETTES.foret), bOnly), 'applyPalette non déterministe');
  assert.ok(!bytesEqual(applyPalette(c, sk.bounds, PALETTES.ardoise), bOnly), 'deux palettes différentes donnent les mêmes couleurs');
  for (const k of ['role', 'rand', 'positions'] as const) assert.ok(bytesEqual(c[k], snap[k]), `le nuage a été modifié (${k})`);
  const fc = fakeCloud(800, 8);
  const fsnap = fc.positions.slice();
  const o2 = new Float32Array(3 * 800).fill(0.123);
  applyPalette(fc, BOUNDS, PALETTES.givre, o2);
  assert.ok(bytesEqual(o2, applyPalette(fc, BOUNDS, PALETTES.givre)), 'un out prérempli doit être entièrement réécrit');
  assert.ok(bytesEqual(fc.positions, fsnap), 'positions du nuage synthétique modifiées');
});

test('B5.5 : cssVariables donne --night, --bg2, --ink, --muted, --accent et --warm', async () => {
  // B5.5 (proto:773).
  const { cssVariables } = await colorMod();
  const { PALETTES } = await palettesMod();
  for (const id of ORDER) {
    const p = PALETTES[id];
    const v = cssVariables(p);
    const want: Record<string, string> = { '--night': p.bg, '--bg2': p.bg2, '--ink': p.ink, '--muted': p.muted, '--accent': p.lit, '--warm': p.lit };
    for (const [k, val] of Object.entries(want)) {
      assert.equal(typeof v[k], 'string', `${id} : ${k} absent (${JSON.stringify(v)})`);
      assert.equal(v[k].toLowerCase(), val.toLowerCase(), `${id} : ${k} = ${v[k]}, attendu ${val}`);
    }
  }
});

const TABLE: Record<string, number[]> = {
  'sous-bois': [17.25, 7.69, 11.6, 15.83, 7.05, 10.64],
  ardoise: [16.72, 9.43, 11.67, 14.31, 8.07, 9.99],
  foret: [17.09, 7.41, 13.89, 15.73, 6.82, 12.78],
  givre: [16.74, 6.8, 12.92, 14.09, 5.73, 10.87],
};
const PAIRS = ['ink/bg', 'muted/bg', 'lit/bg', 'ink/bg2', 'muted/bg2', 'lit/bg2'];

test('B5.6 : paletteContrasts ≥ 4,5 pour ink, muted, lit sur bg et bg2, valeurs du tableau au centième', async () => {
  // B5.6 : tableau figé par le contrat, et recalcul WCAG indépendant.
  const { paletteContrasts } = await colorMod();
  const { PALETTES } = await palettesMod();
  for (const id of ORDER) {
    const p = PALETTES[id];
    const res = paletteContrasts(p) as { pair: string; ratio: number }[];
    const byPair = new Map(res.map((x) => [x.pair, x.ratio]));
    PAIRS.forEach((pair, i) => {
      const ratio = byPair.get(pair);
      assert.equal(typeof ratio, 'number', `${id} : paire ${pair} absente (reçu ${JSON.stringify(res.map((x) => x.pair))})`);
      const [fg, bg] = pair.split('/');
      const indep = wcagContrast(hex3(p[fg]), hex3(p[bg]));
      assert.ok(Math.abs((ratio as number) - indep) < 1e-9, `${id} ${pair} : ${ratio}, WCAG ${indep}`);
      assert.equal(Math.round((ratio as number) * 100) / 100, TABLE[id][i], `${id} ${pair} : ${ratio}, tableau ${TABLE[id][i]}`);
      assert.ok((ratio as number) >= 4.5, `${id} ${pair} : ${ratio} < 4,5`);
    });
  }
});

// ---- Durcissement après l'audit du 20 novembre 2026 ----

test('B5.4 : recoloration complète d\'un buffer de 240 000 points prérempli d\'une sentinelle (tous canaux, dernier point compris)', async () => {
  // Audit, mutation « borner la boucle à 65 536 points » non détectée.
  const { applyPalette } = await colorMod();
  const { PALETTES } = await palettesMod();
  const cloud = fakeCloud(240000, 31);
  const out = new Float32Array(3 * 240000).fill(-7);
  applyPalette(cloud, BOUNDS, PALETTES['sous-bois'], out);
  applyPalette(cloud, BOUNDS, PALETTES.foret, out);
  const fresh = applyPalette(cloud, BOUNDS, PALETTES.foret);
  let left = 0;
  for (let i = 0; i < out.length; i++) if (out[i] === -7 || !(out[i] >= 0 && out[i] <= 1)) left++;
  assert.equal(left, 0, `${left} canaux non recolorés sur ${out.length}`);
  const last = out.length - 3;
  assert.deepEqual(Array.from(out.subarray(last)), Array.from(fresh.subarray(last)), 'dernier point non recoloré');
  assert.ok(bytesEqual(out, fresh), 'le buffer recoloré diffère d\'une recoloration fraîche');
});

test('B5 applyPalette : refuse un out qui partage la mémoire de cloud.positions', async () => {
  // Audit « entrées dégradées » : passer cloud.positions comme out écrasait la géométrie.
  const { applyPalette } = await colorMod();
  const { PALETTES } = await palettesMod();
  const cloud = fakeCloud(1000, 3);
  const snap = cloud.positions.slice();
  assert.throws(() => applyPalette(cloud, BOUNDS, PALETTES.givre, cloud.positions), Error, 'out = cloud.positions : erreur attendue');
  const buf = new ArrayBuffer(4 * 3000 * 2);
  const shared = { ...cloud, positions: new Float32Array(buf, 0, 3000) };
  shared.positions.set(snap);
  assert.throws(() => applyPalette(shared, BOUNDS, PALETTES.givre, new Float32Array(buf, 4 * 1500, 3000)), Error, 'out chevauchant positions : erreur attendue');
  assert.ok(bytesEqual(cloud.positions, snap), 'les positions ont été écrasées');
  const apart = new Float32Array(buf, 4 * 3000, 3000);
  assert.equal(applyPalette(shared, BOUNDS, PALETTES.givre, apart), apart, 'un out disjoint dans le même ArrayBuffer reste accepté');
});
