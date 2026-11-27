// Contrat B4 : lib/tree/cloud.ts (partie pure). Le nuage desktop de 240 000 points n'est échantillonné qu'une fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, ROLE, axisDistance, bytesEqual, cloudMod, dist, hasChild, memo, rngMod, skeletonMod, vec } from './helpers-tree.ts';
import type { Mod, V3 } from './helpers-tree.ts';

const simple7 = memo(async () => (await skeletonMod()).growSkeleton({ mode: 'simple', seed: 7 }));
const natural7 = memo(async () => (await skeletonMod()).growSkeleton({ mode: 'natural', seed: 7 }));
const phone = memo(async () => (await cloudMod()).sampleCloud(await simple7(), { points: 45000 }));
const desktop = memo(async () => (await cloudMod()).sampleCloud(await natural7(), { points: 240000 }));

// Les deux profils du contrat : phone sur le squelette simple, desktop sur le squelette naturel, graine 7.
const both = async (): Promise<{ name: string; sk: Mod; c: Mod; N: number; mode: string }[]> => [
  { name: 'phone', sk: await simple7(), c: await phone(), N: 45000, mode: 'simple' },
  { name: 'desktop', sk: await natural7(), c: await desktop(), N: 240000, mode: 'natural' },
];

const FIELDS = ['positions', 'segment', 'role', 'size', 'rand', 'start', 'delay'] as const;

test('B4 : POINT_ROLE, PROFILES et LEAF_SHARE', async () => {
  // B4 signature : valeurs figées (proto:212, 215, 516, 518, 695).
  const m = await cloudMod();
  assert.deepEqual({ ...m.POINT_ROLE }, { BARK: 0, ROOT: 1, LEAF: 2 }, `POINT_ROLE ${JSON.stringify(m.POINT_ROLE)}`);
  assert.deepEqual(
    JSON.parse(JSON.stringify(m.PROFILES)),
    { phone: { mode: 'simple', points: 45000, sapDensity: 28, gain: 1 }, desktop: { mode: 'natural', points: 240000, sapDensity: 46, gain: 0.58 } },
    `PROFILES ${JSON.stringify(m.PROFILES)}`,
  );
  assert.deepEqual({ ...m.LEAF_SHARE }, { simple: 0.34, natural: 0.42 }, `LEAF_SHARE ${JSON.stringify(m.LEAF_SHARE)}`);
});

test('B4 : segmentWeight = length × (0,5 + 3r) en simple, length × (0,25 + 7r) en natural', async () => {
  // B4 signature, proto:515.
  const { segmentWeight } = await cloudMod();
  for (const [len, r] of [[1, 0.1], [2.5, 0.46], [0.3, 0.012], [0, 0.2]]) {
    assert.ok(Math.abs(segmentWeight(len, r, 'simple') - len * (0.5 + 3 * r)) < 1e-12, `simple(${len}, ${r}) = ${segmentWeight(len, r, 'simple')}`);
    assert.ok(Math.abs(segmentWeight(len, r, 'natural') - len * (0.25 + 7 * r)) < 1e-12, `natural(${len}, ${r}) = ${segmentWeight(len, r, 'natural')}`);
  }
});

test('B4.1 : count = points exactement, longueurs et types des tableaux, aucune couleur', async () => {
  // B4.1 ; B4 « Le nuage ne contient aucune couleur ».
  for (const x of await both()) {
    const c = x.c;
    assert.equal(c.count, x.N, `${x.name} : count ${c.count}`);
    const types: Record<string, [typeof Float32Array | typeof Uint16Array | typeof Uint8Array, number]> = {
      positions: [Float32Array, 3 * x.N], start: [Float32Array, 3 * x.N], segment: [Uint16Array, x.N], role: [Uint8Array, x.N],
      size: [Float32Array, x.N], rand: [Float32Array, x.N], delay: [Float32Array, x.N],
    };
    for (const [k, [ctor, len]] of Object.entries(types)) {
      assert.ok(c[k] instanceof ctor, `${x.name} : ${k} doit être un ${ctor.name}`);
      assert.equal(c[k].length, len, `${x.name} : ${k}.length = ${c[k].length}, attendu ${len}`);
    }
    const colorKeys = Object.keys(c).filter((k) => /colou?r|rgb/i.test(k));
    assert.deepEqual(colorKeys, [], `${x.name} : champs de couleur dans le nuage : ${colorKeys.join(', ')}`);
  }
});

test('B4.2 : déterminisme octet pour octet (phone 45 000, natural 20 000) et effet de la graine', async () => {
  // B4.2 : le desktop à 240 000 n'est pas rééchantillonné ; le déterminisme natural se vérifie à 20 000 points.
  const { sampleCloud } = await cloudMod();
  const again = sampleCloud(await simple7(), { points: 45000 });
  const ref = await phone();
  for (const k of FIELDS) assert.ok(bytesEqual(again[k], ref[k]), `phone : ${k} diffère au second appel`);
  assert.equal(again.count, ref.count);
  const n1 = sampleCloud(await natural7(), { points: 20000 });
  const n2 = sampleCloud(await natural7(), { points: 20000 });
  for (const k of FIELDS) assert.ok(bytesEqual(n1[k], n2[k]), `natural 20 000 : ${k} diffère au second appel`);
  const n3 = sampleCloud(await natural7(), { points: 20000, seed: 7 });
  for (const k of FIELDS) assert.ok(bytesEqual(n1[k], n3[k]), `natural : seed 7 explicite ≠ seed par défaut (sk.seed = 7) sur ${k}`);
  const other = sampleCloud(await natural7(), { points: 20000, seed: 8 });
  assert.ok(!bytesEqual(other.positions, n1.positions), 'une autre graine doit donner d\'autres positions');
});

test('B4.2 : rand suit le flux color et start/delay le flux entry, séparés de la géométrie', async () => {
  // B4.2 et « Animation d'entrée » : un tirage color par point ; quatre tirages entry par point dans l'ordre de proto:527–529.
  const { mulberry32, deriveSeed } = await rngMod();
  const c = await phone();
  const color = mulberry32(deriveSeed(7, 'color'));
  for (let k = 0; k < c.count; k++) {
    const v = color();
    if (Math.abs(c.rand[k] - v) > 1e-7) assert.fail(`rand[${k}] = ${c.rand[k]}, flux color ${v}`);
  }
  const entry = mulberry32(deriveSeed(7, 'entry'));
  for (let k = 0; k < c.count; k++) {
    const a = entry() * Math.PI * 2;
    const rad = 3 + Math.pow(entry(), 0.6) * 16;
    const sy = -1.5 + entry() * 3.5;
    const y = c.positions[3 * k + 1];
    const delay = Math.min(0.55, Math.max(0, (y + 3) / 12) * 0.45 + entry() * 0.12);
    const want: V3 = [Math.cos(a) * rad, sy, Math.sin(a) * rad - 4];
    if (dist(vec(c.start, k), want) > 1e-4) assert.fail(`start[${k}] = ${JSON.stringify(vec(c.start, k))}, flux entry ${JSON.stringify(want)}`);
    if (Math.abs(c.delay[k] - delay) > 1e-5) assert.fail(`delay[${k}] = ${c.delay[k]}, attendu ${delay}`);
  }
});

test('B4.3 : segments valides, rôles 0/1/2 et rôle compatible avec la nature du segment', async () => {
  // B4.3 : ROOT sur ROOT ; BARK sur TRUNK ou BRANCH ; LEAF sur BRANCH sans enfant.
  for (const x of await both()) {
    const { sk, c } = x;
    const parentOf = hasChild(sk.parent);
    for (let k = 0; k < c.count; k++) {
      const s = c.segment[k];
      const r = c.role[k];
      if (s >= sk.count) assert.fail(`${x.name} : segment[${k}] = ${s} ≥ ${sk.count}`);
      const kind = sk.kind[s];
      if (r === ROLE.ROOT && kind !== KIND.ROOT) assert.fail(`${x.name} : point ROOT ${k} sur un segment de nature ${kind}`);
      else if (r === ROLE.BARK && kind !== KIND.TRUNK && kind !== KIND.BRANCH) assert.fail(`${x.name} : point BARK ${k} sur un segment de nature ${kind}`);
      else if (r === ROLE.LEAF && (kind !== KIND.BRANCH || parentOf[s])) assert.fail(`${x.name} : point LEAF ${k} sur le segment ${s} (nature ${kind}, a des enfants : ${parentOf[s]})`);
      else if (r > 2) assert.fail(`${x.name} : rôle ${r}`);
    }
  }
});

test('B4.3 bis : chaque bout de branche (BRANCH sans enfant) reçoit des feuilles', async () => {
  // B4 Feuilles : touffes au bout de chaque segment BRANCH sans enfant, poids 1 chacun.
  for (const x of await both()) {
    const { sk, c } = x;
    const parentOf = hasChild(sk.parent);
    const leaves = new Uint32Array(sk.count);
    for (let k = 0; k < c.count; k++) if (c.role[k] === ROLE.LEAF) leaves[c.segment[k]]++;
    let tips = 0;
    let empty = 0;
    for (let s = 0; s < sk.count; s++) if (sk.kind[s] === KIND.BRANCH && !parentOf[s]) { tips++; if (leaves[s] === 0) empty++; }
    assert.ok(tips > 0, `${x.name} : aucun bout de branche`);
    assert.equal(empty, 0, `${x.name} : ${empty} bouts de branche sur ${tips} sans feuille`);
  }
});

test('B4.4 : écorce et racines sur la surface du segment (t ∈ [0,1], rayon r × [0,75 ; 1,10], stries r × [0,92 ; 1,10] si r > 0,12)', async () => {
  // B4.4 et règle des stries (proto:539–542) : projection et distance à l'axe recalculées.
  for (const x of await both()) {
    const { sk, c } = x;
    let checked = 0;
    for (let k = 0; k < c.count; k++) {
      if (c.role[k] === ROLE.LEAF) continue;
      const s = c.segment[k];
      const r = sk.radius[s];
      const { t, d } = axisDistance(vec(c.positions, k), vec(sk.a, s), vec(sk.b, s));
      if (t < -1e-4 || t > 1 + 1e-4) assert.fail(`${x.name} : point ${k} projeté en t = ${t} sur le segment ${s}`);
      const lo = (r > 0.12 ? 0.92 : 0.75) * r;
      const hi = 1.1 * r;
      if (d < lo * (1 - 1e-3) || d > hi * (1 + 1e-3)) assert.fail(`${x.name} : point ${k} à ${d} de l'axe du segment ${s} (r = ${r}), attendu [${lo}, ${hi}]`);
      checked++;
    }
    assert.ok(checked > 0, `${x.name} : aucun point d'écorce`);
  }
});

test('B4.5 : feuilles à au plus 0,92 du bout b de leur segment', async () => {
  // B4.5.
  for (const x of await both()) {
    const { sk, c } = x;
    let worst = 0;
    for (let k = 0; k < c.count; k++) if (c.role[k] === ROLE.LEAF) worst = Math.max(worst, dist(vec(c.positions, k), vec(sk.b, c.segment[k])));
    assert.ok(worst <= 0.92, `${x.name} : feuille à ${worst} du bout de son segment`);
  }
});

test('B4.6 : nombre de feuilles ≈ N × LEAF_SHARE (écart ≤ count / 2 + 1)', async () => {
  // B4.6.
  const { LEAF_SHARE } = await cloudMod();
  for (const x of await both()) {
    let leaves = 0;
    for (let k = 0; k < x.c.count; k++) if (x.c.role[k] === ROLE.LEAF) leaves++;
    const want = x.N * LEAF_SHARE[x.mode];
    assert.ok(Math.abs(leaves - want) <= x.sk.count / 2 + 1, `${x.name} : ${leaves} feuilles, attendu ${want} ± ${x.sk.count / 2 + 1}`);
  }
});

test('B4.7 : tailles (écorce et racines [0,45 ; 1,4] selon r, feuilles [0,35 ; 0,95])', async () => {
  // B4.7 et règle de taille : (r < 0,05 ? 0,45 : 0,6) + aléa × 0,8 ; feuilles 0,35 + aléa × 0,6.
  for (const x of await both()) {
    const { sk, c } = x;
    const eps = 1e-6;
    for (let k = 0; k < c.count; k++) {
      const z = c.size[k];
      if (c.role[k] === ROLE.LEAF) {
        if (z < 0.35 - eps || z > 0.95 + eps) assert.fail(`${x.name} : taille de feuille ${z}`);
      } else {
        const base = sk.radius[c.segment[k]] < 0.05 ? 0.45 : 0.6;
        if (z < base - eps || z > base + 0.8 + eps || z > 1.4 + eps) assert.fail(`${x.name} : taille ${z} (r = ${sk.radius[c.segment[k]]}), attendu [${base}, ${base + 0.8}]`);
      }
    }
  }
});

test('B4.8 : rand ∈ [0,1), delay ∈ [0 ; 0,55], start.y ∈ [−1,5 ; 2], distance horizontale à (0, −4) ∈ [3 ; 19]', async () => {
  // B4.8.
  for (const x of await both()) {
    const c = x.c;
    const eps = 1e-5;
    for (let k = 0; k < c.count; k++) {
      if (!(c.rand[k] >= 0 && c.rand[k] < 1)) assert.fail(`${x.name} : rand[${k}] = ${c.rand[k]}`);
      if (!(c.delay[k] >= 0 && c.delay[k] <= Math.fround(0.55))) assert.fail(`${x.name} : delay[${k}] = ${c.delay[k]} > fround(0,55)`);
      const [sx, sy, sz] = vec(c.start, k);
      if (sy < -1.5 - eps || sy > 2 + eps) assert.fail(`${x.name} : start.y[${k}] = ${sy}`);
      const h = Math.hypot(sx, sz + 4);
      if (h < 3 - 1e-4 || h > 19 + 1e-4) assert.fail(`${x.name} : distance horizontale de start[${k}] = ${h}`);
    }
  }
});

test('B4.9 : deux segments de même rayon (longueurs 1 et 3) : points par segment = round(nBranch × w / Σw)', async () => {
  // B4.9 et règle nBranch = floor(N × (1 − LEAF_SHARE)) ; poids recalculés indépendamment.
  const { skeletonFromSegments } = await skeletonMod();
  const { sampleCloud, LEAF_SHARE } = await cloudMod();
  const segs = [
    { a: [0, 0, 0], b: [0, 1, 0], radius: 0.1, parent: -1, kind: KIND.TRUNK, depth: 0 },
    { a: [0, 1, 0], b: [0, 4, 0], radius: 0.1, parent: 0, kind: KIND.BRANCH, depth: 1 },
  ];
  for (const mode of ['simple', 'natural']) {
    const sk = skeletonFromSegments(segs, { mode });
    for (const N of [1000, 777, 5003]) {
      const c = sampleCloud(sk, { points: N });
      assert.equal(c.count, N, `${mode}/${N} : count ${c.count}`);
      const nBranch = Math.floor(N * (1 - LEAF_SHARE[mode]));
      const w = [1, 3].map((len) => (mode === 'simple' ? len * (0.5 + 3 * 0.1) : len * (0.25 + 7 * 0.1)));
      const sum = w[0] + w[1];
      const want = w.map((wi) => Math.round((nBranch * wi) / sum));
      const got = [0, 0];
      let leaves = 0;
      for (let k = 0; k < N; k++) {
        if (c.role[k] === ROLE.LEAF) { leaves++; assert.equal(c.segment[k], 1, 'feuille hors du bout de branche'); } else got[c.segment[k]]++;
      }
      assert.deepEqual(got, want, `${mode}/${N} : points d'écorce par segment ${JSON.stringify(got)}, attendu ${JSON.stringify(want)}`);
      assert.equal(leaves, N - want[0] - want[1], `${mode}/${N} : les feuilles doivent compléter jusqu'à N`);
    }
  }
});

test('B4 : sans bout de branche, tous les points vont à l\'écorce (ou aux racines)', async () => {
  // B4 « S'il n'y a aucun bout de branche, tous les points vont à l'écorce ».
  const { skeletonFromSegments } = await skeletonMod();
  const { sampleCloud } = await cloudMod();
  const trunk = skeletonFromSegments([{ a: [0, 0, 0], b: [0, 3, 0], radius: 0.3, parent: -1, kind: KIND.TRUNK, depth: 0 }]);
  const c = sampleCloud(trunk, { points: 2000 });
  assert.equal(c.count, 2000, `count ${c.count}`);
  assert.ok(c.role.every((r: number) => r === ROLE.BARK), 'tous les points d\'un tronc nu doivent être BARK');
  const withRoot = skeletonFromSegments([
    { a: [0, 0, 0], b: [0, 3, 0], radius: 0.3, parent: -1, kind: KIND.TRUNK, depth: 0 },
    { a: [0, 0.25, 0], b: [1, -1, 0], radius: 0.2, parent: 0, kind: KIND.ROOT, depth: 1 },
  ]);
  const d = sampleCloud(withRoot, { points: 3001 });
  assert.equal(d.count, 3001, `count ${d.count}`);
  assert.ok(d.role.every((r: number) => r !== ROLE.LEAF), 'aucune feuille sans bout de branche');
  assert.ok(d.role.some((r: number) => r === ROLE.ROOT), 'le segment ROOT doit recevoir des points ROOT');
});

// ---- Durcissement après l'audit du 20 novembre 2026 ----

test('B4.8 : cloud.rand strictement < 1 après stockage Float32 (graine 50)', async () => {
  // Audit : pour la graine 50, le tirage couleur nº 6 496 vaut 0,99999999 et devient 1 en Float32.
  const { sampleCloud } = await cloudMod();
  const sk = await simple7();
  for (const seed of [50, 7]) {
    const c = sampleCloud(sk, { points: 45000, seed });
    const bad: string[] = [];
    for (let k = 0; k < c.count; k++) if (!(c.rand[k] >= 0 && c.rand[k] < 1)) bad.push(`rand[${k}] = ${c.rand[k]}`);
    assert.deepEqual(bad, [], `graine ${seed} : ${bad.slice(0, 5).join(', ')}`);
  }
});

test('B4 feuilles : budget inférieur au nombre de bouts, la sélection ne favorise pas les premiers rameaux', async () => {
  // Audit : le module couvrait d'abord les bouts dans l'ordre du squelette ; tirage uniforme par feuille (proto:550).
  const { skeletonFromSegments } = await skeletonMod();
  const { sampleCloud } = await cloudMod();
  const T = 400;
  const segs: Mod[] = [{ a: [0, 0, 0], b: [0, 10, 0], radius: 0.5, parent: -1, kind: KIND.TRUNK, depth: 0 }];
  for (let i = 0; i < T; i++) {
    const a = (i / T) * Math.PI * 2;
    segs.push({ a: [0, 10, 0], b: [0.1 * Math.cos(a), 10.02, 0.1 * Math.sin(a)], radius: 0.01, parent: 0, kind: KIND.BRANCH, depth: 1 });
  }
  const sk = skeletonFromSegments(segs);
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const c = sampleCloud(sk, { points: 300, seed });
    const ranks: number[] = [];
    for (let k = 0; k < c.count; k++) if (c.role[k] === ROLE.LEAF) ranks.push((c.segment[k] - 1) / (T - 1));
    assert.ok(ranks.length >= 50 && ranks.length < T / 1.5, `précondition : ${ranks.length} feuilles pour ${T} bouts`);
    const mean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
    const lastQuarter = ranks.filter((r) => r >= 0.75).length / ranks.length;
    assert.ok(mean > 0.35 && mean < 0.65, `graine ${seed} : rang moyen des bouts choisis ${mean.toFixed(3)} (uniforme ≈ 0,5)`);
    assert.ok(lastQuarter > 0.1, `graine ${seed} : ${(lastQuarter * 100).toFixed(1)} % des feuilles sur le dernier quart des bouts (uniforme ≈ 25 %)`);
  }
});

test('B4 feuilles : dispersion autour du bout (pas toutes au centre de leur touffe)', async () => {
  // Audit, mutation « rabattre toutes les feuilles au centre de leur touffe » : au plus 4 centres par bout.
  for (const x of await both()) {
    const byTip = new Map<number, Set<string>>();
    const counts = new Map<number, number>();
    for (let k = 0; k < x.c.count; k++) {
      if (x.c.role[k] !== ROLE.LEAF) continue;
      const s = x.c.segment[k];
      const key = vec(x.c.positions, k).map((v) => v.toFixed(4)).join(',');
      if (!byTip.has(s)) byTip.set(s, new Set());
      byTip.get(s)!.add(key);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    let checked = 0;
    let collapsed = 0;
    for (const [s, n] of counts) {
      if (n < 12) continue;
      checked++;
      if (byTip.get(s)!.size < 0.9 * n) collapsed++;
    }
    assert.ok(checked > 0, `${x.name} : aucun bout avec au moins 12 feuilles`);
    assert.equal(collapsed, 0, `${x.name} : ${collapsed}/${checked} bouts dont les feuilles se confondent`);
    let sum = 0;
    let n = 0;
    for (let k = 0; k < x.c.count; k++) if (x.c.role[k] === ROLE.LEAF) { sum += dist(vec(x.c.positions, k), vec(x.sk.b, x.c.segment[k])); n++; }
    assert.ok(sum / n > 0.15, `${x.name} : distance moyenne au bout ${(sum / n).toFixed(3)}, feuillage trop ramassé`);
  }
});

test('B4.2 : la géométrie suit le flux cloud (oracle proto:536–544 sur un segment fin vertical)', async () => {
  // Audit, mutation « prendre le flux entry pour la géométrie » : t, angle, rayon puis taille, quatre tirages cloud par point.
  const { skeletonFromSegments } = await skeletonMod();
  const { sampleCloud } = await cloudMod();
  const { mulberry32, deriveSeed } = await rngMod();
  const sk = skeletonFromSegments([{ a: [0, 0, 0], b: [0, 3, 0], radius: 0.1, parent: -1, kind: KIND.TRUNK, depth: 0 }]);
  for (const seed of [7, 11]) {
    const c = sampleCloud(sk, { points: 64, seed });
    const g = mulberry32(deriveSeed(seed, 'cloud'));
    for (let k = 0; k < 64; k++) {
      const t = g();
      const ang = g() * Math.PI * 2;
      const rr = Math.fround(0.1) * (0.75 + g() * 0.35);
      const size = 0.6 + g() * 0.8;
      // Repère de proto:536–537 : d = (0,1,0), u = d × (1,0,0) = (0,0,−1), w = d × u = (−1,0,0).
      const want: V3 = [-Math.sin(ang) * rr, 3 * t, -Math.cos(ang) * rr];
      assert.ok(dist(vec(c.positions, k), want) < 1e-5, `graine ${seed}, point ${k} : ${JSON.stringify(vec(c.positions, k))}, oracle ${JSON.stringify(want)}`);
      assert.ok(Math.abs(c.size[k] - size) < 1e-6, `graine ${seed}, point ${k} : taille ${c.size[k]}, oracle ${size}`);
    }
  }
});

test('B4 : POINT_ROLE figé (écriture refusée ou sans effet)', async () => {
  // Audit « données publiques modifiables » : tables numériques exportées.
  const m = await cloudMod();
  const before = { ...m.POINT_ROLE };
  try { (m.POINT_ROLE as Record<string, number>).LEAF = 9; } catch { /* écriture refusée : attendu */ }
  const after = { ...m.POINT_ROLE };
  if (after.LEAF !== before.LEAF) (m.POINT_ROLE as Record<string, number>).LEAF = before.LEAF;
  assert.deepEqual(after, { BARK: 0, ROOT: 1, LEAF: 2 }, `POINT_ROLE modifié : ${JSON.stringify(after)}`);
});
