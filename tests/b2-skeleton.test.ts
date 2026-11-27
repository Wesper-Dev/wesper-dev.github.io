// Contrat B2 : lib/tree/skeleton.ts (growSkeleton, skeletonFromSegments, anchorSkills).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KIND,
  MODES,
  SEEDS,
  bytesEqual,
  cloudMod,
  dist,
  lerp3,
  memo,
  projT,
  rngMod,
  skeletonMod,
  treeMod,
  vec,
} from './helpers-tree.ts';
import type { Mod, V3 } from './helpers-tree.ts';

const ARRAYS = ['a', 'b', 'radius', 'parent', 'attach', 'kind', 'depth'] as const;

// Tous les squelettes exigés : deux modes × graines 7 et 1 à 20, générés une seule fois.
const skeletons = memo(async () => {
  const { growSkeleton } = await skeletonMod();
  const out: { mode: string; seed: number; sk: Mod }[] = [];
  for (const mode of MODES) for (const seed of SEEDS) out.push({ mode, seed, sk: growSkeleton({ mode, seed }) });
  return out;
});

const skills = memo(async () => {
  const { SKILLS } = await treeMod();
  return (SKILLS as { id: string; layer: string }[]).map((s) => ({ id: s.id, layer: s.layer }));
});

const anchored = memo(async () => {
  const { anchorSkills } = await skeletonMod();
  const list = await skills();
  return (await skeletons()).map((x) => ({ ...x, anchors: anchorSkills(x.sk, list) as Mod[] }));
});

function sameSkeleton(x: Mod, y: Mod): string | null {
  for (const k of ['species', 'mode', 'seed', 'count']) if (x[k] !== y[k]) return `${k} : ${x[k]} ≠ ${y[k]}`;
  for (const k of ARRAYS) if (!bytesEqual(x[k], y[k])) return `tableau ${k} différent`;
  try {
    assert.deepStrictEqual(x.bounds, y.bounds);
  } catch {
    return 'bounds différent';
  }
  return null;
}

function collect(fails: string[], max = 8): void {
  if (fails.length) assert.fail(`${fails.length} écart(s), dont : ${fails.slice(0, max).join(' | ')}`);
}

const label = (x: { mode: string; seed: number }): string => `${x.mode}/graine ${x.seed}`;

test('B2 : constantes exportées (SEGMENT_KIND, DEFAULT_SEED, MAX_SEGMENTS, TRUNK_TARGETS)', async () => {
  // B2 signature : valeurs figées par le contrat.
  const m = await skeletonMod();
  assert.deepEqual({ ...m.SEGMENT_KIND }, { TRUNK: 0, BRANCH: 1, ROOT: 2 }, `SEGMENT_KIND reçu ${JSON.stringify(m.SEGMENT_KIND)}`);
  assert.equal(m.DEFAULT_SEED, 7, `DEFAULT_SEED reçu ${m.DEFAULT_SEED}`);
  assert.equal(m.MAX_SEGMENTS, 65535, `MAX_SEGMENTS reçu ${m.MAX_SEGMENTS}`);
  assert.deepEqual([...m.TRUNK_TARGETS], [0.28, 0.5, 0.72, 0.94], `TRUNK_TARGETS reçu ${JSON.stringify(m.TRUNK_TARGETS)}`);
});

test('B2 : structure du squelette (types et longueurs des tableaux, méta-données)', async () => {
  // B2 interface Skeleton : tableaux typés en structure de tableaux, 3 × count pour a et b.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    const n = sk.count;
    const want: Record<string, [unknown, number]> = {
      a: [Float32Array, 3 * n], b: [Float32Array, 3 * n], radius: [Float32Array, n], parent: [Int32Array, n],
      attach: [Float32Array, n], kind: [Uint8Array, n], depth: [Uint8Array, n],
    };
    if (!Number.isInteger(n) || n <= 0) fails.push(`${label(x)} : count ${n}`);
    for (const [k, [ctor, len]] of Object.entries(want)) {
      if (!(sk[k] instanceof (ctor as typeof Float32Array))) fails.push(`${label(x)} : ${k} n'est pas un ${(ctor as { name: string }).name}`);
      else if (sk[k].length !== len) fails.push(`${label(x)} : ${k}.length = ${sk[k].length}, attendu ${len}`);
    }
    if (sk.species !== 'chene' || sk.mode !== x.mode || sk.seed !== x.seed) fails.push(`${label(x)} : méta ${sk.species}/${sk.mode}/${sk.seed}`);
    for (let i = 0; i < n; i++) if (![0, 1, 2].includes(sk.kind[i])) { fails.push(`${label(x)} : kind[${i}] = ${sk.kind[i]}`); break; }
  }
  collect(fails);
});

test('B2.1 : déterminisme octet pour octet, et une graine différente donne un squelette différent', async () => {
  // B2.1 : mêmes entrées → mêmes octets ; graine voisine → squelette différent.
  const { growSkeleton } = await skeletonMod();
  const all = await skeletons();
  const fails: string[] = [];
  for (const x of all) {
    const again = growSkeleton({ mode: x.mode, seed: x.seed, species: 'chene' });
    const diff = sameSkeleton(x.sk, again);
    if (diff) fails.push(`${label(x)} : ${diff}`);
    const other = all.find((y) => y.mode === x.mode && y.seed === (x.seed % 20) + 1 && y.seed !== x.seed);
    if (other && bytesEqual(x.sk.a, other.sk.a) && bytesEqual(x.sk.b, other.sk.b)) fails.push(`${label(x)} identique à la graine ${other.seed}`);
  }
  collect(fails);
});

test('B2.1 : graine par défaut DEFAULT_SEED (7) et essence par défaut chene', async () => {
  // B2 Génération : seed par défaut DEFAULT_SEED, seule essence 'chene'.
  const { growSkeleton } = await skeletonMod();
  const all = await skeletons();
  for (const mode of MODES) {
    const d = growSkeleton({ mode });
    assert.equal(d.seed, 7, `${mode} : seed par défaut ${d.seed}`);
    assert.equal(d.species, 'chene', `${mode} : essence par défaut ${d.species}`);
    const ref = all.find((y) => y.mode === mode && y.seed === 7)!.sk;
    assert.equal(sameSkeleton(d, ref), null, `${mode} : le squelette par défaut diffère de celui de la graine 7`);
  }
  const s = all.find((y) => y.mode === 'simple' && y.seed === 7)!.sk;
  const n = all.find((y) => y.mode === 'natural' && y.seed === 7)!.sk;
  assert.ok(!bytesEqual(s.a, n.a), 'les modes simple et natural doivent donner des squelettes différents');
});

test('B2.2 : racine unique d\'index 0, de nature TRUNK, avec a = [0,0,0]', async () => {
  // B2.2 : un seul parent = -1, à l'index 0.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    const roots: number[] = [];
    for (let i = 0; i < sk.count; i++) if (sk.parent[i] === -1) roots.push(i);
    if (roots.length !== 1 || roots[0] !== 0) fails.push(`${label(x)} : segments sans parent ${JSON.stringify(roots.slice(0, 5))}`);
    if (sk.kind[0] !== KIND.TRUNK) fails.push(`${label(x)} : kind[0] = ${sk.kind[0]}`);
    const a0 = vec(sk.a, 0);
    if (!(a0[0] === 0 && a0[1] === 0 && a0[2] === 0)) fails.push(`${label(x)} : a[0] = ${JSON.stringify(a0)}`);
  }
  collect(fails);
});

test('B2.3 : ordre topologique (0 ≤ parent[i] < i pour i ≥ 1)', async () => {
  // B2.3 : exclut les cycles.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    for (let i = 1; i < sk.count; i++) {
      const p = sk.parent[i];
      if (!(p >= 0 && p < i)) { fails.push(`${label(x)} : parent[${i}] = ${p}`); break; }
    }
  }
  collect(fails);
});

test('B2.4 : rayons finis, > 0, et aucun enfant plus épais que son parent', async () => {
  // B2.4 : radius[i] ≤ radius[parent[i]] + 1e-6.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    for (let i = 0; i < sk.count; i++) {
      const r = sk.radius[i];
      if (!(Number.isFinite(r) && r > 0)) { fails.push(`${label(x)} : radius[${i}] = ${r}`); break; }
      if (i > 0 && sk.parent[i] >= 0 && r > sk.radius[sk.parent[i]] + 1e-6) {
        fails.push(`${label(x)} : radius[${i}] = ${r} > radius[parent ${sk.parent[i]}] = ${sk.radius[sk.parent[i]]}`);
        break;
      }
    }
  }
  collect(fails);
});

test('B2.5 : ROOT descend, aucun non-ROOT sous un ROOT, non-ROOT collé au bout du parent avec attach = 1', async () => {
  // B2.5 : b.y < a.y pour ROOT ; a = b(parent) à 1e-5 et attach = 1 pour les autres.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    for (let i = 0; i < sk.count; i++) {
      const a = vec(sk.a, i);
      const b = vec(sk.b, i);
      const p = sk.parent[i];
      if (sk.kind[i] === KIND.ROOT) {
        if (!(b[1] < a[1])) fails.push(`${label(x)} : ROOT ${i} ne descend pas (a.y ${a[1]}, b.y ${b[1]})`);
        continue;
      }
      if (p < 0) continue;
      if (sk.kind[p] === KIND.ROOT) fails.push(`${label(x)} : segment ${i} (kind ${sk.kind[i]}) a un parent ROOT ${p}`);
      const gap = dist(a, vec(sk.b, p));
      if (gap > 1e-5) fails.push(`${label(x)} : |a[${i}] − b[${p}]| = ${gap}`);
      if (Math.abs(sk.attach[i] - 1) > 1e-6) fails.push(`${label(x)} : attach[${i}] = ${sk.attach[i]}, attendu 1`);
    }
  }
  collect(fails);
});

test('B2.6 : attach est la projection bornée de a sur le parent ; ≈ 0,25 / L(0) pour les racines du segment 0', async () => {
  // B2.6 : recalcul indépendant de la projection.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    const a0 = vec(sk.a, 0);
    const L0 = dist(a0, vec(sk.b, 0));
    for (let i = 1; i < sk.count; i++) {
      const p = sk.parent[i];
      const t = projT(vec(sk.a, i), vec(sk.a, p), vec(sk.b, p));
      if (Math.abs(sk.attach[i] - t) > 1e-4) fails.push(`${label(x)} : attach[${i}] = ${sk.attach[i]}, projection ${t}`);
      if (sk.kind[i] === KIND.ROOT && p === 0) {
        const want = 0.25 / L0;
        if (Math.abs(sk.attach[i] - want) > 0.1 * want) fails.push(`${label(x)} : racine ${i} attach ${sk.attach[i]}, attendu ≈ ${want}`);
      }
    }
  }
  collect(fails);
});

test('B2.7 : bounds est l\'étendue recalculée sur a et b, sans marge', async () => {
  // B2.7 : min et max sur tous les a et b.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const arr of [sk.a, sk.b]) for (let i = 0; i < arr.length; i++) {
      const c = i % 3;
      if (arr[i] < min[c]) min[c] = arr[i];
      if (arr[i] > max[c]) max[c] = arr[i];
    }
    for (let c = 0; c < 3; c++) {
      if (Math.abs(sk.bounds.min[c] - min[c]) > 1e-6 || Math.abs(sk.bounds.max[c] - max[c]) > 1e-6) {
        fails.push(`${label(x)} : bounds ${JSON.stringify(sk.bounds)}, recalculé min ${JSON.stringify(min)} max ${JSON.stringify(max)}`);
        break;
      }
    }
  }
  collect(fails);
});

test('B2.8 : nombre de segments ROOT dans [270, 720], profondeur 1 à 4', async () => {
  // B2.8 : 6 racines, 3 segments par nœud, 2 ou 3 enfants.
  const fails: string[] = [];
  for (const x of await skeletons()) {
    const sk = x.sk;
    let n = 0;
    for (let i = 0; i < sk.count; i++) if (sk.kind[i] === KIND.ROOT) {
      n++;
      if (sk.depth[i] < 1 || sk.depth[i] > 4) { fails.push(`${label(x)} : ROOT ${i} profondeur ${sk.depth[i]}`); break; }
    }
    if (n < 270 || n > 720) fails.push(`${label(x)} : ${n} segments ROOT`);
  }
  collect(fails);
});

function horizontalReach(sk: Mod): number {
  let r = 0;
  for (const arr of [sk.a, sk.b]) for (let i = 0; i < arr.length; i += 3) r = Math.max(r, Math.hypot(arr[i], arr[i + 2]));
  return r;
}

test('B2.9 : bornes du mode simple (count, 3 TRUNK, depth ≤ 7, hauteurs, emprise)', async () => {
  // B2.9 : valeurs du contrat.
  const fails: string[] = [];
  for (const x of (await skeletons()).filter((y) => y.mode === 'simple')) {
    const sk = x.sk;
    if (sk.count < 1800 || sk.count > 4500) fails.push(`${label(x)} : count ${sk.count}`);
    let trunks = 0;
    let maxDepth = 0;
    for (let i = 0; i < sk.count; i++) {
      if (sk.kind[i] === KIND.TRUNK) trunks++;
      maxDepth = Math.max(maxDepth, sk.depth[i]);
    }
    if (trunks !== 3) fails.push(`${label(x)} : ${trunks} segments TRUNK`);
    if (maxDepth > 7) fails.push(`${label(x)} : profondeur max ${maxDepth}`);
    const top = sk.bounds.max[1];
    const bottom = sk.bounds.min[1];
    if (top < 13 || top > 17.5) fails.push(`${label(x)} : bounds.max.y ${top}`);
    if (bottom < -4.8 || bottom > -3) fails.push(`${label(x)} : bounds.min.y ${bottom}`);
    const reach = horizontalReach(sk);
    if (reach > 12.5) fails.push(`${label(x)} : emprise horizontale ${reach}`);
  }
  collect(fails);
});

test('B2.10 : bornes du mode natural (count, 9 à 70 TRUNK, hauteurs, emprise)', async () => {
  // B2.10 : valeurs du contrat.
  const fails: string[] = [];
  for (const x of (await skeletons()).filter((y) => y.mode === 'natural')) {
    const sk = x.sk;
    if (sk.count < 2800 || sk.count > 4500) fails.push(`${label(x)} : count ${sk.count}`);
    let trunks = 0;
    for (let i = 0; i < sk.count; i++) if (sk.kind[i] === KIND.TRUNK) trunks++;
    if (trunks < 9 || trunks > 70) fails.push(`${label(x)} : ${trunks} segments TRUNK`);
    const top = sk.bounds.max[1];
    const bottom = sk.bounds.min[1];
    if (top < 9.5 || top > 13.5) fails.push(`${label(x)} : bounds.max.y ${top}`);
    if (bottom < -4.8 || bottom > -3) fails.push(`${label(x)} : bounds.min.y ${bottom}`);
    const reach = horizontalReach(sk);
    if (reach > 9.5) fails.push(`${label(x)} : emprise horizontale ${reach}`);
  }
  collect(fails);
});

test('B2.11 : count ≤ MAX_SEGMENTS', async () => {
  // B2.11 : index tenant dans un Uint16Array.
  const { MAX_SEGMENTS } = await skeletonMod();
  for (const x of await skeletons()) assert.ok(x.sk.count <= MAX_SEGMENTS, `${label(x)} : count ${x.sk.count}`);
});

// ---- skeletonFromSegments ----

type Seg = { a: V3; b: V3; radius: number; parent: number; kind: number; depth: number };
const seg = (a: V3, b: V3, radius: number, parent: number, kind: number, depth: number): Seg => ({ a, b, radius, parent, kind, depth });

// Tronc, branche au bout, racine décalée de l'axe (projection 0,25 sur un tronc de 4).
const SMALL: Seg[] = [
  seg([0, 0, 0], [0, 4, 0], 0.5, -1, KIND.TRUNK, 0),
  seg([0, 4, 0], [2, 6, 0], 0.2, 0, KIND.BRANCH, 1),
  seg([0.5, 1, 0], [1, -1, 0], 0.3, 0, KIND.ROOT, 1),
  seg([1, -1, 0], [2, -3, 1], 0.2, 2, KIND.ROOT, 2),
  seg([0, 9, 0], [0, 12, 0], 0.1, 1, KIND.BRANCH, 2), // a au-delà de b du parent : projection bornée à 1
];

test('B2 skeletonFromSegments : recopie les segments, calcule attach et bounds', async () => {
  // B2 skeletonFromSegments : attach = projection bornée, bounds = étendue brute.
  const { skeletonFromSegments } = await skeletonMod();
  const sk = skeletonFromSegments(SMALL);
  assert.equal(sk.count, 5, `count ${sk.count}`);
  assert.deepEqual(Array.from(sk.parent), [-1, 0, 0, 2, 1], `parent ${Array.from(sk.parent)}`);
  assert.deepEqual(Array.from(sk.kind), [0, 1, 2, 2, 1], `kind ${Array.from(sk.kind)}`);
  assert.deepEqual(Array.from(sk.depth), [0, 1, 1, 2, 2], `depth ${Array.from(sk.depth)}`);
  assert.deepEqual(Array.from(sk.b.slice(9, 12)), [2, -3, 1], `b[3] ${Array.from(sk.b.slice(9, 12))}`);
  const attach: number[] = Array.from(sk.attach as Float32Array);
  const want = [1, 1, 0.25, 1, 1];
  for (let i = 1; i < 5; i++) assert.ok(Math.abs(attach[i] - want[i]) < 1e-6, `attach[${i}] = ${attach[i]}, attendu ${want[i]}`);
  assert.deepEqual([...sk.bounds.min], [0, -3, 0], `bounds.min ${JSON.stringify(sk.bounds.min)}`);
  assert.deepEqual([...sk.bounds.max], [2, 12, 1], `bounds.max ${JSON.stringify(sk.bounds.max)}`);
  assert.ok(Math.abs(sk.radius[2] - 0.3) < 1e-6, `radius[2] ${sk.radius[2]}`);
});

test('B2 skeletonFromSegments : méta par défaut simple / DEFAULT_SEED / chene, et méta fournie respectée', async () => {
  // B2 skeletonFromSegments : mode par défaut 'simple', graine par défaut DEFAULT_SEED.
  const { skeletonFromSegments } = await skeletonMod();
  const d = skeletonFromSegments(SMALL);
  assert.deepEqual([d.species, d.mode, d.seed], ['chene', 'simple', 7], `méta par défaut ${d.species}/${d.mode}/${d.seed}`);
  const m = skeletonFromSegments(SMALL, { mode: 'natural', seed: 42 });
  assert.deepEqual([m.species, m.mode, m.seed], ['chene', 'natural', 42], `méta fournie ${m.species}/${m.mode}/${m.seed}`);
});

test('B2 skeletonFromSegments : erreurs (vide, parent[0], parent hors [0,i), rayon ≤ 0 ou non fini, trop de segments)', async () => {
  // B2 skeletonFromSegments : cas d'erreur listés.
  const { skeletonFromSegments, MAX_SEGMENTS } = await skeletonMod();
  const variant = (i: number, patch: Partial<Seg>): Seg[] => SMALL.map((s, k) => (k === i ? { ...s, ...patch } : s));
  const cases: [string, Seg[]][] = [
    ['liste vide', []],
    ['parent[0] = 0', variant(0, { parent: 0 })],
    ['parent[0] = 2', variant(0, { parent: 2 })],
    ['parent[3] = 3 (soi-même)', variant(3, { parent: 3 })],
    ['parent[2] = 4 (en avant)', variant(2, { parent: 4 })],
    ['parent[1] = -1 (seconde racine)', variant(1, { parent: -1 })],
    ['parent[4] = -2', variant(4, { parent: -2 })],
    ['rayon nul', variant(1, { radius: 0 })],
    ['rayon négatif', variant(3, { radius: -0.1 })],
    ['rayon NaN', variant(2, { radius: Number.NaN })],
    ['rayon infini', variant(2, { radius: Infinity })],
    ['coordonnée NaN', variant(1, { b: [2, Number.NaN, 0] })],
    ['coordonnée infinie', variant(3, { a: [1, -Infinity, 0] })],
  ];
  for (const [name, segs] of cases) {
    assert.throws(() => skeletonFromSegments(segs), Error, `aucune erreur pour : ${name}`);
  }
  const chain = (n: number): Seg[] =>
    Array.from({ length: n }, (_, i) => seg([0, i * 0.01, 0], [0, (i + 1) * 0.01, 0], 0.1, i - 1, KIND.TRUNK, 0));
  assert.throws(() => skeletonFromSegments(chain(MAX_SEGMENTS + 1)), Error, `aucune erreur pour ${MAX_SEGMENTS + 1} segments`);
  const ok = skeletonFromSegments(chain(MAX_SEGMENTS));
  assert.equal(ok.count, MAX_SEGMENTS, `exactement MAX_SEGMENTS segments doivent être acceptés, count ${ok.count}`);
});

// ---- anchorSkills ----

test('B2 ancrages 1 : un ancrage par compétence, dans l\'ordre reçu', async () => {
  // Ancrages, propriété 1.
  const list = await skills();
  const fails: string[] = [];
  for (const x of await anchored()) {
    const ids = x.anchors.map((a: Mod) => a.id);
    if (JSON.stringify(ids) !== JSON.stringify(list.map((s) => s.id))) fails.push(`${label(x)} : ${JSON.stringify(ids)}`);
    for (const a of x.anchors) if (a.layer !== list.find((s) => s.id === a.id)?.layer) fails.push(`${label(x)} : couche de ${a.id} = ${a.layer}`);
  }
  collect(fails);
});

test('B2 ancrages 2 : nature du segment conforme à la couche et filtres respectés', async () => {
  // Ancrages, propriété 2 : root → ROOT (depth ≥ 3, b.y < −0,6) ; canopy → BRANCH (depth ≥ 1, b.y > 0,55 Htop) ; trunk → TRUNK.
  const fails: string[] = [];
  for (const x of await anchored()) {
    const sk = x.sk;
    const Htop = sk.bounds.max[1];
    for (const an of x.anchors) {
      const s = an.segment;
      const b = vec(sk.b, s);
      if (!Number.isInteger(s) || s < 0 || s >= sk.count) { fails.push(`${label(x)} : ${an.id} segment ${s}`); continue; }
      if (an.layer === 'root') {
        if (sk.kind[s] !== KIND.ROOT || sk.depth[s] < 3 || !(b[1] < -0.6)) fails.push(`${label(x)} : ${an.id} sur ${s} (kind ${sk.kind[s]}, depth ${sk.depth[s]}, b.y ${b[1]})`);
      } else if (an.layer === 'canopy') {
        if (sk.kind[s] !== KIND.BRANCH || sk.depth[s] < 1 || !(b[1] > 0.55 * Htop)) fails.push(`${label(x)} : ${an.id} sur ${s} (kind ${sk.kind[s]}, depth ${sk.depth[s]}, b.y ${b[1]}, seuil ${0.55 * Htop})`);
      } else if (sk.kind[s] !== KIND.TRUNK) fails.push(`${label(x)} : ${an.id} (tronc) sur ${s} de kind ${sk.kind[s]}`);
      if (an.layer !== 'trunk') {
        if (an.t !== 1 || an.side !== null) fails.push(`${label(x)} : ${an.id} t ${an.t}, side ${an.side}`);
        if (dist([...an.position], b) > 1e-6) fails.push(`${label(x)} : ${an.id} position ${JSON.stringify(an.position)} ≠ b ${JSON.stringify(b)}`);
      }
    }
  }
  collect(fails);
});

test('B2 ancrages 3 : segments des racines et de la canopée tous distincts', async () => {
  // Ancrages, propriété 3.
  const fails: string[] = [];
  for (const x of await anchored()) {
    const segs = x.anchors.filter((a: Mod) => a.layer !== 'trunk').map((a: Mod) => a.segment);
    if (new Set(segs).size !== segs.length) fails.push(`${label(x)} : ${JSON.stringify(segs)}`);
  }
  collect(fails);
});

test('B2 ancrages 4 : tronc à y_k = TRUNK_TARGETS[k] × tTop, segment TRUNK d\'index max, côtés alternés', async () => {
  // Ancrages, propriété 4 : recalcul indépendant de tTop, du segment, de t et de la position.
  const { TRUNK_TARGETS } = await skeletonMod();
  const fails: string[] = [];
  for (const x of await anchored()) {
    const sk = x.sk;
    let trunkTop = -Infinity;
    for (let i = 0; i < sk.count; i++) if (sk.kind[i] === KIND.TRUNK) trunkTop = Math.max(trunkTop, sk.b[3 * i + 1]);
    const tTop = Math.min(0.82 * trunkTop, 0.5 * sk.bounds.max[1]);
    const trunk = x.anchors.filter((a: Mod) => a.layer === 'trunk');
    if (trunk.length !== 4) { fails.push(`${label(x)} : ${trunk.length} ancrages de tronc`); continue; }
    const sides = trunk.map((a: Mod) => a.side);
    if (JSON.stringify(sides) !== '["left","right","left","right"]') fails.push(`${label(x)} : côtés ${JSON.stringify(sides)}`);
    let prevY = -Infinity;
    trunk.forEach((an: Mod, k: number) => {
      const y = TRUNK_TARGETS[k] * tTop;
      let best = -1;
      for (let j = 0; j < sk.count; j++) if (sk.kind[j] === KIND.TRUNK && sk.a[3 * j + 1] <= y && y <= sk.b[3 * j + 1]) best = j;
      if (an.segment !== best) fails.push(`${label(x)} : ${an.id} segment ${an.segment}, attendu ${best}`);
      const a = vec(sk.a, best);
      const b = vec(sk.b, best);
      const t = (y - a[1]) / (b[1] - a[1]);
      if (Math.abs(an.t - t) > 1e-4) fails.push(`${label(x)} : ${an.id} t ${an.t}, attendu ${t}`);
      if (dist([...an.position], lerp3(a, b, t)) > 1e-4) fails.push(`${label(x)} : ${an.id} position ${JSON.stringify(an.position)}`);
      if (!(Math.abs(an.position[1] - y) < 1e-4)) fails.push(`${label(x)} : ${an.id} position.y ${an.position[1]}, y_k ${y}`);
      if (!(an.position[1] > prevY)) fails.push(`${label(x)} : hauteurs non strictement croissantes à ${an.id}`);
      prevY = an.position[1];
    });
  }
  collect(fails);
});

function minPairDistance(points: number[][]): number {
  let m = Infinity;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) m = Math.min(m, dist(points[i], points[j]));
  return m;
}

test('B2 ancrages 5 : distance minimale ≥ 2 entre racines et ≥ 3 entre ancrages de canopée', async () => {
  // Ancrages, propriété 5.
  const fails: string[] = [];
  for (const x of await anchored()) {
    const of = (layer: string): number[][] => x.anchors.filter((a: Mod) => a.layer === layer).map((a: Mod) => [...a.position]);
    const r = minPairDistance(of('root'));
    const c = minPairDistance(of('canopy'));
    if (!(r >= 2)) fails.push(`${label(x)} : racines à ${r.toFixed(3)}`);
    if (!(c >= 3)) fails.push(`${label(x)} : canopée à ${c.toFixed(3)}`);
  }
  collect(fails);
});

test('B2 ancrages 6 : déterministes et indépendants des appels à sampleCloud', async () => {
  // Ancrages, propriété 6 ; générateur dérivé de seed ?? sk.seed.
  const { anchorSkills } = await skeletonMod();
  const { sampleCloud } = await cloudMod();
  const list = await skills();
  for (const x of (await anchored()).filter((y) => y.seed === 7 || y.seed === 13)) {
    assert.deepStrictEqual(anchorSkills(x.sk, list), x.anchors, `${label(x)} : second appel différent`);
    assert.deepStrictEqual(anchorSkills(x.sk, list, x.sk.seed), x.anchors, `${label(x)} : seed explicite = sk.seed doit donner le même résultat`);
    sampleCloud(x.sk, { points: 3000 });
    const mid = anchorSkills(x.sk, list);
    sampleCloud(x.sk, { points: 20000, seed: 99 });
    sampleCloud(x.sk, { points: 500 });
    assert.deepStrictEqual(mid, x.anchors, `${label(x)} : différent après un nuage de 3 000 points`);
    assert.deepStrictEqual(anchorSkills(x.sk, list), x.anchors, `${label(x)} : différent après d'autres nuages`);
  }
});

// Squelette synthétique pour les ancrages : candidats connus d'avance.
//  - canopée éligible : 2 et 3 (BRANCH, depth ≥ 1, b.y > 5,5) ; 4 trop bas ; 5 de profondeur 0.
//  - racines éligibles : 8 et 9 ; 7 de profondeur 2 ; 12 avec b.y = −0,5.
const ANCHOR_SEGS: Seg[] = [
  seg([0, 0, 0], [0, 4, 0], 0.5, -1, KIND.TRUNK, 0),
  seg([0, 4, 0], [0, 8, 0], 0.4, 0, KIND.TRUNK, 0),
  seg([0, 8, 0], [3, 10, 0], 0.2, 1, KIND.BRANCH, 1),
  seg([0, 8, 0], [-3, 9, 0], 0.2, 1, KIND.BRANCH, 1),
  seg([0, 4, 0], [2, 5, 0], 0.2, 0, KIND.BRANCH, 1),
  seg([0, 8, 0], [0, 9.5, 1], 0.1, 1, KIND.BRANCH, 0),
  seg([0, 0.25, 0], [1, -0.5, 0], 0.3, 0, KIND.ROOT, 1),
  seg([1, -0.5, 0], [2, -3, 0], 0.2, 6, KIND.ROOT, 2),
  seg([2, -3, 0], [3, -4, 0], 0.1, 7, KIND.ROOT, 3),
  seg([2, -3, 0], [2, -4, 2], 0.1, 7, KIND.ROOT, 3),
  seg([0, 0.25, 0], [-1, -0.2, 0], 0.3, 0, KIND.ROOT, 1),
  seg([-1, -0.2, 0], [-2, -0.3, 0], 0.2, 10, KIND.ROOT, 2),
  seg([-2, -0.3, 0], [-3, -0.5, 0], 0.1, 11, KIND.ROOT, 3),
];

test('B2 ancrages : filtres exacts sur un squelette synthétique (candidats connus)', async () => {
  // Ancrages, Racines et Canopée : seuls les segments qui passent les filtres sont choisis, sans doublon.
  const { skeletonFromSegments, anchorSkills } = await skeletonMod();
  const sk = skeletonFromSegments(ANCHOR_SEGS);
  for (const seed of [1, 7, 23]) {
    const res = anchorSkills(sk, [{ id: 'r1', layer: 'root' }, { id: 'c1', layer: 'canopy' }, { id: 'r2', layer: 'root' }, { id: 'c2', layer: 'canopy' }], seed);
    assert.deepEqual(res.map((a: Mod) => a.id), ['r1', 'c1', 'r2', 'c2'], `ordre ${JSON.stringify(res.map((a: Mod) => a.id))}`);
    const rootSegs = [res[0].segment, res[2].segment].sort((p: number, q: number) => p - q);
    const canSegs = [res[1].segment, res[3].segment].sort((p: number, q: number) => p - q);
    assert.deepEqual(rootSegs, [8, 9], `graine ${seed} : racines sur ${JSON.stringify(rootSegs)}, attendu [8, 9]`);
    assert.deepEqual(canSegs, [2, 3], `graine ${seed} : canopée sur ${JSON.stringify(canSegs)}, attendu [2, 3]`);
  }
});

test('B2 ancrages : aucun candidat restant → erreur, sans repli sur le segment 0', async () => {
  // Ancrages, « Aucun candidat » : la fonction lève une erreur.
  const { skeletonFromSegments, anchorSkills } = await skeletonMod();
  const sk = skeletonFromSegments(ANCHOR_SEGS);
  assert.throws(() => anchorSkills(sk, [{ id: 'a', layer: 'root' }, { id: 'b', layer: 'root' }, { id: 'c', layer: 'root' }]), Error, 'trois racines pour deux candidats : erreur attendue');
  assert.throws(() => anchorSkills(sk, [{ id: 'a', layer: 'canopy' }, { id: 'b', layer: 'canopy' }, { id: 'c', layer: 'canopy' }]), Error, 'trois canopées pour deux candidats : erreur attendue');
  const bare = skeletonFromSegments([seg([0, 0, 0], [0, 5, 0], 0.5, -1, KIND.TRUNK, 0), seg([0, 5, 0], [0, 9, 0], 0.4, 0, KIND.TRUNK, 0)]);
  assert.throws(() => anchorSkills(bare, [{ id: 'x', layer: 'root' }]), Error, 'aucun segment ROOT : erreur attendue');
  assert.throws(() => anchorSkills(bare, [{ id: 'x', layer: 'canopy' }]), Error, 'aucun segment BRANCH : erreur attendue');
  const t = anchorSkills(bare, [{ id: 'x', layer: 'trunk' }]);
  assert.equal(t.length, 1, 'une compétence du tronc reste ancrable sur un tronc nu');
});

test('B2 ancrages : borne a.y ≤ y_k ≤ b.y, le segment TRUNK d\'index le plus grand l\'emporte', async () => {
  // Ancrages, Tronc : y_k = 0,5 × tTop tombe exactement à la jonction des segments 0 et 1.
  const { skeletonFromSegments, anchorSkills } = await skeletonMod();
  // trunkTop = 12, Htop = 16 → tTop = min(9,84 ; 8) = 8 ; cibles 2,24 ; 4 ; 5,76 ; 7,52.
  const sk = skeletonFromSegments([
    seg([0, 0, 0], [0, 4, 0], 0.5, -1, KIND.TRUNK, 0),
    seg([0, 4, 0], [0, 8, 0], 0.45, 0, KIND.TRUNK, 0),
    seg([0, 8, 0], [0, 12, 0], 0.4, 1, KIND.TRUNK, 0),
    seg([0, 12, 0], [1, 16, 0], 0.2, 2, KIND.BRANCH, 1),
  ]);
  const res = anchorSkills(sk, ['p', 'd', 'k', 'o'].map((id) => ({ id, layer: 'trunk' })));
  assert.deepEqual(res.map((a: Mod) => a.segment), [0, 1, 1, 1], `segments ${JSON.stringify(res.map((a: Mod) => a.segment))}`);
  const ys = res.map((a: Mod) => a.position[1]);
  [2.24, 4, 5.76, 7.52].forEach((y, k) => assert.ok(Math.abs(ys[k] - y) < 1e-4, `hauteur ${k} : ${ys[k]}, attendu ${y}`));
  assert.ok(Math.abs(res[1].t) < 1e-6, `t à la jonction : ${res[1].t}, attendu 0 sur le segment 1`);
  assert.ok(Math.abs(res[0].t - 0.56) < 1e-5, `t du premier ancrage : ${res[0].t}, attendu 0,56`);
});

test('B2 ancrages : plus de 4 compétences du tronc réparties uniformément entre 0,28 et 0,94', async () => {
  // Ancrages, Tronc : 6 compétences → fractions 0,28 + k × 0,132.
  const { skeletonFromSegments, anchorSkills } = await skeletonMod();
  const sk = skeletonFromSegments([
    seg([0, 0, 0], [0, 4, 0], 0.5, -1, KIND.TRUNK, 0),
    seg([0, 4, 0], [0.2, 8, 0], 0.45, 0, KIND.TRUNK, 0),
    seg([0.2, 8, 0], [0.3, 12, 0], 0.4, 1, KIND.TRUNK, 0),
    seg([0.3, 12, 0], [1, 16, 0], 0.2, 2, KIND.BRANCH, 1),
  ]);
  const res = anchorSkills(sk, Array.from({ length: 6 }, (_, k) => ({ id: `t${k}`, layer: 'trunk' })));
  const tTop = 8;
  res.forEach((a: Mod, k: number) => {
    const y = (0.28 + (k * (0.94 - 0.28)) / 5) * tTop;
    assert.ok(Math.abs(a.position[1] - y) < 1e-4, `compétence ${k} : y ${a.position[1]}, attendu ${y}`);
  });
  assert.deepEqual(res.map((a: Mod) => a.side), ['left', 'right', 'left', 'right', 'left', 'right'], `côtés ${JSON.stringify(res.map((a: Mod) => a.side))}`);
});

// ---- Durcissement après l'audit du 20 novembre 2026 ----

test('B2 skeletonFromSegments : erreur si une coordonnée ou un rayon devient non fini ou nul en Float32', async () => {
  // Audit : 1e100 devient Infinity, 1e-100 devient 0 une fois stocké en Float32.
  const { skeletonFromSegments } = await skeletonMod();
  const variant = (i: number, patch: Partial<Seg>): Seg[] => SMALL.map((s, k) => (k === i ? { ...s, ...patch } : s));
  const cases: [string, Seg[]][] = [
    ['coordonnée 1e100', variant(1, { b: [1e100, 6, 0] })],
    ['coordonnée 3,5e38 (au-delà du plus grand Float32)', variant(3, { b: [2, -3.5e38, 1] })],
    ['coordonnée −1e300 sur a', variant(2, { a: [-1e300, 1, 0] })],
    ['rayon 1e100', variant(0, { radius: 1e100 })],
    ['rayon 1e-100', variant(4, { radius: 1e-100 })],
    ['rayon 1e-46 (sous le plus petit Float32)', variant(3, { radius: 1e-46 })],
  ];
  for (const [name, segs] of cases) assert.throws(() => skeletonFromSegments(segs), Error, `aucune erreur pour : ${name}`);
  assert.equal(skeletonFromSegments(variant(4, { radius: 1e-30 })).count, 5, 'un rayon minuscule mais représentable reste accepté');
});

test('B2 ancrages : tronc discontinu, hauteur cible dans le vide → erreur, sans repli', async () => {
  // Audit, mutation « renvoyer le segment 0 » : tronc dont aucune hauteur cible n'est traversée.
  const { skeletonFromSegments, anchorSkills } = await skeletonMod();
  // trunkTop = 10, Htop = 12 → tTop = 6 ; les cibles 3 et 4,32 tombent dans le vide entre y = 2 et y = 5.
  const sk = skeletonFromSegments([
    seg([0, 0, 0], [0, 2, 0], 0.5, -1, KIND.TRUNK, 0),
    seg([0, 5, 0], [0, 10, 0], 0.4, 0, KIND.TRUNK, 0),
    seg([0, 10, 0], [1, 12, 0], 0.2, 1, KIND.BRANCH, 1),
  ]);
  assert.throws(() => anchorSkills(sk, ['p', 'd', 'k', 'o'].map((id) => ({ id, layer: 'trunk' }))), Error, 'hauteur cible non traversée : erreur attendue');
  const one = anchorSkills(sk, [{ id: 'p', layer: 'trunk' }]);
  assert.equal(one[0].segment, 0, 'la cible 1,68 est traversée par le segment 0');
});

test('B2 ancrages : deux graines explicites différentes donnent des ancrages différents', async () => {
  // Audit, mutation « ignorer la graine explicite de anchorSkills ».
  const { anchorSkills } = await skeletonMod();
  const list = await skills();
  for (const x of (await skeletons()).filter((y) => y.seed === 7)) {
    const a = anchorSkills(x.sk, list, 1);
    const b = anchorSkills(x.sk, list, 2);
    const segsOf = (r: Mod[]): number[] => r.filter((v) => v.layer !== 'trunk').map((v) => v.segment);
    assert.notDeepEqual(segsOf(a), segsOf(b), `${label(x)} : graines 1 et 2 donnent les mêmes segments ${JSON.stringify(segsOf(a))}`);
    assert.deepEqual(a.filter((v: Mod) => v.layer === 'trunk'), b.filter((v: Mod) => v.layer === 'trunk'), `${label(x)} : le tronc ne dépend pas de la graine`);
  }
});

// Portage indépendant de SPECIES.chene.build (proto:286–309, 395–397) en flottants 64 bits.
type PSeg = { a: number[]; b: number[]; r: number; parent: number; kind: number; depth: number };
function protoSimple(rnd: () => number): PSeg[] {
  const segs: PSeg[] = [];
  const K: Record<string, number> = { trunk: KIND.TRUNK, branch: KIND.BRANCH, root: KIND.ROOT };
  const normalize = (v: number[]): number[] => {
    const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const grow = (start: number[], dir: number[], len: number, r: number, depth: number, parent: number, kind: string, maxDepth: number, decay: number): void => {
    let p = [...start];
    let d = [...dir];
    let last = parent;
    for (let k = 0; k < 3; k++) {
      const vx = (rnd() - 0.5) * 0.35;
      const vy = (kind === 'root' ? -0.08 : 0.06) + (rnd() - 0.5) * 0.2;
      const vz = (rnd() - 0.5) * 0.35;
      d = normalize([d[0] + vx, d[1] + vy, d[2] + vz]);
      if (kind === 'root' && d[1] > -0.05) { d[1] = -0.05 - rnd() * 0.1; d = normalize(d); }
      const q = [p[0] + d[0] * (len / 3), p[1] + d[1] * (len / 3), p[2] + d[2] * (len / 3)];
      segs.push({ a: p, b: q, r: r * (1 - k * 0.1), parent: last, kind: K[kind === 'branch' && depth === 0 ? 'trunk' : kind], depth });
      last = segs.length - 1;
      p = q;
    }
    if (depth >= maxDepth) return;
    const n = depth === 0 ? 3 : rnd() < 0.35 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd() * 1.2;
      const spread = kind === 'root' ? 0.9 : depth < 2 ? 0.9 + rnd() * 0.4 : 0.6 + rnd() * 0.4;
      const m = kind === 'root' ? 0.6 : 1;
      const up = kind === 'root' ? -0.15 : depth < 2 ? 0.05 : 0.2;
      const nd = normalize([d[0] * m + Math.cos(ang) * spread, d[1] * m + up, d[2] * m + Math.sin(ang) * spread]);
      grow(p, nd, len * (kind === 'root' ? 0.7 : decay), r * 0.62, depth + 1, last, kind, maxDepth, decay);
    }
  };
  grow([0, 0, 0], [0, 1, 0], 5.2, 0.46, 0, -1, 'branch', 7, 0.72);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.5;
    grow([0, 0.25, 0], normalize([Math.cos(a), -0.35, Math.sin(a)]), 2.4, 0.3, 1, 0, 'root', 4, 0.74);
  }
  return segs;
}

test('B2 empreinte : le mode simple égale un portage indépendant de proto:286–309 et 395–397 (graines 7, 1, 20)', async () => {
  // Audit, mutation « longueur initiale 5,20 → 5,22 » non détectée : oracle complet du chêne simple.
  const { growSkeleton } = await skeletonMod();
  const { mulberry32 } = await rngMod();
  for (const seed of [7, 1, 20]) {
    const want = protoSimple(mulberry32(seed));
    const sk = growSkeleton({ mode: 'simple', seed });
    assert.equal(sk.count, want.length, `graine ${seed} : ${sk.count} segments, portage ${want.length}`);
    if (seed === 7) assert.equal(want.length, 3267, `repère du prototype pour la graine 7 : 3 267 segments, portage ${want.length}`);
    for (let i = 0; i < want.length; i++) {
      const w = want[i];
      if (sk.parent[i] !== w.parent || sk.kind[i] !== w.kind || sk.depth[i] !== w.depth) {
        assert.fail(`graine ${seed}, segment ${i} : parent/kind/depth ${sk.parent[i]}/${sk.kind[i]}/${sk.depth[i]}, portage ${w.parent}/${w.kind}/${w.depth}`);
      }
      if (dist(vec(sk.a, i), w.a) > 1e-4 || dist(vec(sk.b, i), w.b) > 1e-4) assert.fail(`graine ${seed}, segment ${i} : extrémités ${JSON.stringify([vec(sk.a, i), vec(sk.b, i)])}, portage ${JSON.stringify([w.a, w.b])}`);
      if (Math.abs(sk.radius[i] - w.r) > 1e-6) assert.fail(`graine ${seed}, segment ${i} : rayon ${sk.radius[i]}, portage ${w.r}`);
    }
  }
});

test('B2 empreinte : repères chiffrés du prototype (tronc simple 5,2 ; ligne naturelle 4,2 en 9 pas ; 3 267 et 3 381 segments à la graine 7)', async () => {
  // Audit « Fidélité » : effectifs mesurés sur v7 et longueurs de proto:388 et 396.
  const all = await skeletons();
  const s = all.find((y) => y.mode === 'simple' && y.seed === 7)!.sk;
  const n = all.find((y) => y.mode === 'natural' && y.seed === 7)!.sk;
  assert.equal(s.count, 3267, `simple, graine 7 : ${s.count} segments`);
  assert.equal(n.count, 3381, `natural, graine 7 : ${n.count} segments`);
  const lenOf = (sk: Mod, idx: number[]): number => idx.reduce((acc, i) => acc + dist(vec(sk.a, i), vec(sk.b, i)), 0);
  for (const x of all.filter((y) => y.mode === 'simple')) {
    const trunk = Array.from({ length: x.sk.count }, (_, i) => i).filter((i) => x.sk.kind[i] === KIND.TRUNK);
    assert.deepEqual(trunk, [0, 1, 2], `${label(x)} : segments TRUNK ${JSON.stringify(trunk)}`);
    assert.ok(Math.abs(lenOf(x.sk, trunk) - 5.2) < 1e-5, `${label(x)} : tronc de longueur ${lenOf(x.sk, trunk)}, attendu 5,2`);
  }
  for (const x of all.filter((y) => y.mode === 'natural')) {
    const line = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    assert.ok(line.every((i) => x.sk.kind[i] === KIND.TRUNK && x.sk.parent[i] === i - 1), `${label(x)} : les 9 premiers segments doivent former la ligne du tronc`);
    assert.ok(Math.abs(lenOf(x.sk, line) - 4.2) < 1e-5, `${label(x)} : ligne de longueur ${lenOf(x.sk, line)}, attendu 4,2`);
  }
});

test('B2 : SEGMENT_KIND figé (écriture refusée ou sans effet)', async () => {
  // Audit « données publiques modifiables » : tables numériques exportées.
  const m = await skeletonMod();
  try { (m.SEGMENT_KIND as Record<string, number>).ROOT = 7; } catch { /* écriture refusée : attendu */ }
  const after = { ...m.SEGMENT_KIND };
  if (after.ROOT !== 2) (m.SEGMENT_KIND as Record<string, number>).ROOT = 2;
  assert.deepEqual(after, { TRUNK: 0, BRANCH: 1, ROOT: 2 }, `SEGMENT_KIND modifié : ${JSON.stringify(after)}`);
});
