// Contrat B3 : lib/tree/sap.ts (distances le long du squelette, chemins de sève, front, particules, masques).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, MODES, SEEDS, chainOf, dist, lerp3, memo, sapMod, skeletonMod, testRng, treeMod, vec } from './helpers-tree.ts';
import type { Mod, V3 } from './helpers-tree.ts';

type Seg = { a: V3; b: V3; radius: number; parent: number; kind: number; depth: number };
const seg = (a: V3, b: V3, radius: number, parent: number, kind: number, depth: number): Seg => ({ a, b, radius, parent, kind, depth });

// Squelette synthétique : racine décalée de l'axe (attach 0,25, écart 0,5) et branche collée au bout.
const SYN: Seg[] = [
  seg([0, 0, 0], [0, 4, 0], 0.5, -1, KIND.TRUNK, 0),
  seg([0, 4, 0], [2, 6, 0], 0.2, 0, KIND.BRANCH, 1),
  seg([0.5, 1, 0], [1, -1, 0], 0.3, 0, KIND.ROOT, 1),
  seg([1, -1, 0], [2, -3, 1], 0.2, 2, KIND.ROOT, 2),
  seg([2, 6, 0], [2, 9, 0], 0.1, 1, KIND.BRANCH, 2),
  seg([0, 2, 1], [0, 2, 3], 0.1, 0, KIND.BRANCH, 1), // part du milieu du tronc (attach 0,5), écart 1
];

const synthetic = memo(async () => (await skeletonMod()).skeletonFromSegments(SYN));

// Chênes réels (graine 7 et 3, deux modes) avec les ancrages des compétences de content/tree.ts.
const real = memo(async () => {
  const { growSkeleton, anchorSkills } = await skeletonMod();
  const { SKILLS } = await treeMod();
  const list = (SKILLS as Mod[]).map((s) => ({ id: s.id, layer: s.layer }));
  const out: { name: string; mode: string; sk: Mod; anchors: Mod[] }[] = [];
  for (const mode of MODES) for (const seed of [7, 3]) {
    const sk = growSkeleton({ mode, seed });
    out.push({ name: `${mode}/graine ${seed}`, mode, sk, anchors: anchorSkills(sk, list) });
  }
  return out;
});

const L = (sk: Mod, i: number): number => dist(vec(sk.a, i), vec(sk.b, i));
const P = (sk: Mod, p: number, t: number): V3 => lerp3(vec(sk.a, p), vec(sk.b, p), t);

// Définition B3 de start, recalculée indépendamment.
function refStart(sk: Mod): number[] {
  const s = [0];
  for (let i = 1; i < sk.count; i++) {
    const p = sk.parent[i];
    const t = sk.attach[i];
    s.push(s[p] + t * L(sk, p) + dist(vec(sk.a, i), P(sk, p, t)));
  }
  return s;
}

// Polyligne attendue (B3.4).
function refPoints(sk: Mod, anchor: Mod): V3[] {
  const chain = chainOf(sk.parent, anchor.segment);
  const pts: V3[] = [vec(sk.a, 0)];
  for (let j = 1; j < chain.length; j++) {
    const i = chain[j];
    const p = chain[j - 1];
    const q = P(sk, p, sk.attach[i]);
    pts.push(q);
    if (dist(vec(sk.a, i), q) > 1e-6) pts.push(vec(sk.a, i));
  }
  pts.push([...anchor.position] as V3);
  return pts;
}

const anchorOn = (sk: Mod, segment: number, t: number, id = `s${segment}`): Mod => ({
  id, layer: 'canopy', segment, t, position: P(sk, segment, t), side: null,
});

test('B3 : constantes SAP_SPEED = 10 et SAP_JITTER = 0,025', async () => {
  // B3 signature.
  const m = await sapMod();
  assert.equal(m.SAP_SPEED, 10, `SAP_SPEED ${m.SAP_SPEED}`);
  assert.equal(m.SAP_JITTER, 0.025, `SAP_JITTER ${m.SAP_JITTER}`);
});

test('B3 : frontDistance, arrivalTime et sapDuration', async () => {
  // B3 signature : max(0, time) × speed ; distance / speed ; longueur max / speed, 0 si vide.
  const { frontDistance, arrivalTime, sapDuration } = await sapMod();
  assert.equal(frontDistance(-1), 0, `frontDistance(-1) = ${frontDistance(-1)}`);
  assert.equal(frontDistance(0), 0);
  assert.equal(frontDistance(2), 20, `frontDistance(2) = ${frontDistance(2)}`);
  assert.equal(frontDistance(1.5, 4), 6, `frontDistance(1.5, 4) = ${frontDistance(1.5, 4)}`);
  assert.equal(frontDistance(-3, 4), 0);
  assert.equal(arrivalTime(30), 3, `arrivalTime(30) = ${arrivalTime(30)}`);
  assert.equal(arrivalTime(30, 5), 6, `arrivalTime(30, 5) = ${arrivalTime(30, 5)}`);
  assert.equal(sapDuration([]), 0, `sapDuration([]) = ${sapDuration([])}`);
  const fake = (id: string, length: number): Mod => ({ id, segments: new Int32Array([0]), points: new Float32Array(6), distances: new Float32Array([0, length]), length });
  assert.equal(sapDuration([fake('a', 12), fake('b', 37), fake('c', 5)]), 3.7, 'sapDuration = longueur max / 10');
  assert.equal(sapDuration([fake('a', 12), fake('b', 36)], 4), 9, 'sapDuration avec speed = 4');
});

test('B3.1 : chainToBase va de 0 au segment, chaque élément parent du suivant', async () => {
  // B3.1.
  const { chainToBase } = await sapMod();
  for (const x of await real()) {
    const sk = x.sk;
    const r = testRng(11);
    for (let k = 0; k < 40; k++) {
      const s = Math.floor(r() * sk.count);
      const c = chainToBase(sk, s);
      assert.ok(c instanceof Int32Array, `${x.name} : chainToBase doit renvoyer un Int32Array`);
      assert.equal(c[0], 0, `${x.name} : chaîne de ${s} commence à ${c[0]}`);
      assert.equal(c[c.length - 1], s, `${x.name} : chaîne de ${s} finit à ${c[c.length - 1]}`);
      for (let j = 0; j + 1 < c.length; j++) assert.equal(sk.parent[c[j + 1]], c[j], `${x.name} : ${c[j]} n'est pas le parent de ${c[j + 1]}`);
      assert.deepEqual(Array.from(c), chainOf(sk.parent, s), `${x.name} : chaîne de ${s} incomplète`);
    }
    assert.deepEqual(Array.from(chainToBase(sk, 0)), [0], `${x.name} : chaîne du segment 0`);
  }
});

test('B3.2 : segmentDistances suit la définition (start, end) sur un squelette synthétique', async () => {
  // B3 Définitions et B3.2 : valeurs calculées à la main.
  const { segmentDistances } = await sapMod();
  const sk = await synthetic();
  const d = segmentDistances(sk);
  assert.ok(d.start instanceof Float64Array && d.end instanceof Float64Array, 'start et end doivent être des Float64Array');
  assert.equal(d.start.length, 6);
  const want = [
    [0, 4],
    [4, 4 + Math.SQRT2 * 2],
    [1.5, 1.5 + Math.hypot(0.5, 2)],
    [1.5 + Math.hypot(0.5, 2), 1.5 + Math.hypot(0.5, 2) + Math.sqrt(6)],
    [4 + Math.SQRT2 * 2, 4 + Math.SQRT2 * 2 + 3],
    [3, 5],
  ];
  want.forEach(([s, e], i) => {
    assert.ok(Math.abs(d.start[i] - s) < 1e-5, `start[${i}] = ${d.start[i]}, attendu ${s}`);
    assert.ok(Math.abs(d.end[i] - e) < 1e-5, `end[${i}] = ${d.end[i]}, attendu ${e}`);
  });
});

test('B3.2 : sur les chênes réels, end − start = L, start ≥ start[parent], start = end[p] aux jonctions', async () => {
  // B3.2 et définitions : recalcul indépendant de start.
  const { segmentDistances } = await sapMod();
  for (const x of await real()) {
    const sk = x.sk;
    const d = segmentDistances(sk);
    const ref = refStart(sk);
    for (let i = 0; i < sk.count; i++) {
      const Li = L(sk, i);
      if (Math.abs(d.end[i] - d.start[i] - Li) > 1e-5) assert.fail(`${x.name} : end − start = ${d.end[i] - d.start[i]} ≠ L(${i}) = ${Li}`);
      if (Math.abs(d.start[i] - ref[i]) > 1e-4 * Math.max(1, ref[i])) assert.fail(`${x.name} : start[${i}] = ${d.start[i]}, définition ${ref[i]}`);
      if (i === 0) continue;
      const p = sk.parent[i];
      if (d.start[i] < d.start[p]) assert.fail(`${x.name} : start[${i}] < start[parent ${p}]`);
      if (sk.attach[i] === 1 && dist(vec(sk.a, i), vec(sk.b, p)) < 1e-6 && Math.abs(d.start[i] - d.end[p]) > 1e-5) {
        assert.fail(`${x.name} : start[${i}] = ${d.start[i]} ≠ end[${p}] = ${d.end[p]}`);
      }
    }
    assert.equal(d.start[0], 0, `${x.name} : start[0] = ${d.start[0]}`);
  }
});

test('B3.3 et B3.4 : chemin = chaîne vers la base, polyligne réelle et cumuls euclidiens (synthétique)', async () => {
  // B3.3, B3.4 : polyligne attendue écrite à la main depuis la règle.
  const { sapPath } = await sapMod();
  const sk = await synthetic();
  const path = sapPath(sk, anchorOn(sk, 3, 1, 'r'));
  assert.equal(path.id, 'r');
  assert.deepEqual(Array.from(path.segments), [0, 2, 3], `segments ${Array.from(path.segments)}`);
  const want: V3[] = [[0, 0, 0], [0, 1, 0], [0.5, 1, 0], [1, -1, 0], [2, -3, 1]];
  assert.ok(path.points instanceof Float32Array && path.distances instanceof Float32Array, 'points et distances : Float32Array');
  assert.equal(path.points.length, 15, `points : ${path.points.length / 3} sommets, attendu 5 (${Array.from(path.points)})`);
  want.forEach((p, k) => assert.ok(dist(vec(path.points, k), p) < 1e-6, `sommet ${k} = ${JSON.stringify(vec(path.points, k))}, attendu ${JSON.stringify(p)}`));
  const cum = [0, 1, 1.5, 1.5 + Math.hypot(0.5, 2), 1.5 + Math.hypot(0.5, 2) + Math.sqrt(6)];
  cum.forEach((c, k) => assert.ok(Math.abs(path.distances[k] - c) < 1e-5, `distances[${k}] = ${path.distances[k]}, attendu ${c}`));
  assert.ok(Math.abs(path.length - cum[4]) < 1e-5, `length ${path.length}, attendu ${cum[4]}`);
  // Ancrage à mi-segment sur une branche partie du milieu du tronc.
  const mid = sapPath(sk, anchorOn(sk, 5, 0.5, 'm'));
  const wantMid: V3[] = [[0, 0, 0], [0, 2, 0], [0, 2, 1], [0, 2, 2]];
  assert.equal(mid.points.length, 12, `points : ${mid.points.length / 3} sommets, attendu 4`);
  wantMid.forEach((p, k) => assert.ok(dist(vec(mid.points, k), p) < 1e-6, `sommet ${k} = ${JSON.stringify(vec(mid.points, k))}`));
  assert.ok(Math.abs(mid.length - 4) < 1e-5, `length ${mid.length}, attendu 4 (2 + 1 + 0,5 × 2)`);
});

test('B3.3, B3.4 et B3.5 : chemins des compétences sur les chênes réels', async () => {
  // B3.3 segments = chainToBase ; B3.4 polyligne et cumuls ; B3.5 length = start + t × L, ≥ |position − a0|, canopée > 5.
  const { sapPath, chainToBase, segmentDistances } = await sapMod();
  for (const x of await real()) {
    const sk = x.sk;
    const d = segmentDistances(sk);
    for (const an of x.anchors) {
      const path = sapPath(sk, an);
      const pathD = sapPath(sk, an, d);
      assert.deepStrictEqual(pathD, path, `${x.name}/${an.id} : résultat différent avec d fourni`);
      assert.equal(path.id, an.id);
      assert.deepEqual(Array.from(path.segments), Array.from(chainToBase(sk, an.segment)), `${x.name}/${an.id} : segments ≠ chainToBase`);
      const want = refPoints(sk, an);
      assert.equal(path.points.length, 3 * want.length, `${x.name}/${an.id} : ${path.points.length / 3} sommets, attendu ${want.length}`);
      want.forEach((p, k) => {
        if (dist(vec(path.points, k), p) > 1e-4) assert.fail(`${x.name}/${an.id} : sommet ${k} ${JSON.stringify(vec(path.points, k))} ≠ ${JSON.stringify(p)}`);
      });
      assert.equal(path.distances.length, want.length);
      assert.equal(path.distances[0], 0, `${x.name}/${an.id} : distances[0] = ${path.distances[0]}`);
      let acc = 0;
      for (let k = 1; k < want.length; k++) {
        acc += dist(want[k], want[k - 1]);
        if (path.distances[k] < path.distances[k - 1]) assert.fail(`${x.name}/${an.id} : distances décroissantes en ${k}`);
        if (Math.abs(path.distances[k] - acc) > 1e-3) assert.fail(`${x.name}/${an.id} : distances[${k}] = ${path.distances[k]}, cumul ${acc}`);
      }
      const expected = d.start[an.segment] + an.t * L(sk, an.segment);
      assert.ok(Math.abs(path.length - expected) < 1e-4, `${x.name}/${an.id} : length ${path.length}, distance de l'ancrage ${expected}`);
      assert.ok(path.length >= dist([...an.position], vec(sk.a, 0)) - 1e-6, `${x.name}/${an.id} : length plus courte que la ligne droite`);
      if (an.layer === 'canopy') assert.ok(path.length > 5, `${x.name}/${an.id} : length ${path.length} ≤ 5 (distances normalisées ?)`);
    }
  }
});

test('B3.6 : litAt allume au passage du front, croît avec t, vide à −1, complet à Infinity, sans état', async () => {
  // B3.6 : fonction pure du temps.
  // Convention : une compétence est allumée dès que time >= arrivalTime(path.length, speed), sans marge.
  const { sapPath, litAt, arrivalTime } = await sapMod();
  for (const x of await real()) {
    const paths = x.anchors.map((an) => sapPath(x.sk, an));
    assert.ok(litAt(paths, -1) instanceof Set, 'litAt doit renvoyer un Set');
    assert.equal(litAt(paths, -1).size, 0, `${x.name} : litAt(−1) non vide`);
    assert.deepEqual([...litAt(paths, Infinity)].sort(), paths.map((p: Mod) => p.id).sort(), `${x.name} : litAt(Infinity) incomplet`);
    for (const p of paths) {
      const t = arrivalTime(p.length);
      assert.ok(litAt(paths, t).has(p.id), `${x.name}/${p.id} : éteint à t = arrivalTime(length) = ${t}`);
      assert.ok(litAt(paths, t, 10).has(p.id), `${x.name}/${p.id} : éteint à t = arrivalTime(length), speed explicite`);
      assert.ok(!litAt(paths, arrivalTime(p.length) - 1e-3).has(p.id), `${x.name}/${p.id} : allumé 1 ms avant l'arrivée`);
    }
    const times = Array.from({ length: 40 }, (_, k) => k * 0.1 - 0.5);
    const forward = times.map((t) => [...litAt(paths, t)].sort());
    for (let k = 1; k < forward.length; k++) {
      for (const id of forward[k - 1]) assert.ok(forward[k].includes(id), `${x.name} : ${id} s'éteint entre ${times[k - 1]} et ${times[k]}`);
    }
    const backward = [...times].reverse().map((t) => [...litAt(paths, t)].sort()).reverse();
    assert.deepEqual(backward, forward, `${x.name} : litAt dépend de l'ordre des appels (état conservé)`);
    const half = litAt(paths, 0.3, 5);
    for (const p of paths) assert.equal(half.has(p.id), 0.3 >= arrivalTime(p.length, 5), `${x.name}/${p.id} : speed fourni ignoré`);
  }
});

test('B3.7 : squelette en Y, branches de 3 et 6 s\'allument à 0,3 s et 0,6 s', async () => {
  // B3.7 : base ponctuelle (segment 0 de longueur nulle, attach = 1 car a = b du parent), branches de 3 et 6.
  const { skeletonFromSegments } = await skeletonMod();
  const { sapPath, litAt, arrivalTime } = await sapMod();
  const sk = skeletonFromSegments([
    seg([0, 0, 0], [0, 0, 0], 0.5, -1, KIND.TRUNK, 0),
    seg([0, 0, 0], [0, 3, 0], 0.3, 0, KIND.BRANCH, 1),
    seg([0, 0, 0], [3.6, 4.8, 0], 0.3, 0, KIND.BRANCH, 1),
  ]);
  const p3 = sapPath(sk, anchorOn(sk, 1, 1, 'trois'));
  const p6 = sapPath(sk, anchorOn(sk, 2, 1, 'six'));
  assert.ok(Math.abs(p3.length - 3) < 1e-6 && Math.abs(p6.length - 6) < 1e-6, `longueurs ${p3.length} et ${p6.length}`);
  assert.ok(Math.abs(arrivalTime(p3.length) - 0.3) < 1e-7, `arrivée 1 : ${arrivalTime(p3.length)}`);
  assert.ok(Math.abs(arrivalTime(p6.length) - 0.6) < 1e-7, `arrivée 2 : ${arrivalTime(p6.length)}`);
  const at = (t: number): string[] => [...litAt([p3, p6], t)].sort();
  assert.deepEqual(at(0.299), [], `à 0,299 s : ${JSON.stringify(at(0.299))}`);
  assert.deepEqual(at(0.3001), ['trois'], `à 0,3001 s : ${JSON.stringify(at(0.3001))}`);
  assert.deepEqual(at(0.599), ['trois'], `à 0,599 s : ${JSON.stringify(at(0.599))}`);
  assert.deepEqual(at(0.6001), ['six', 'trois'], `à 0,6001 s : ${JSON.stringify(at(0.6001))}`);
});

test('B3.7 bis : squelette en Y avec une base de 2, arrivées à (2 + 3)/10 et (2 + 6)/10', async () => {
  // B3.7 généralisé : distances réelles depuis la base, base comprise.
  const { skeletonFromSegments } = await skeletonMod();
  const { sapPath, arrivalTime, sapDuration } = await sapMod();
  const sk = skeletonFromSegments([
    seg([0, 0, 0], [0, 2, 0], 0.5, -1, KIND.TRUNK, 0),
    seg([0, 2, 0], [0, 5, 0], 0.3, 0, KIND.BRANCH, 1),
    seg([0, 2, 0], [0, 2 + 4.8, 3.6], 0.3, 0, KIND.BRANCH, 1),
  ]);
  const p3 = sapPath(sk, anchorOn(sk, 1, 1, 'a'));
  const p6 = sapPath(sk, anchorOn(sk, 2, 1, 'b'));
  assert.ok(Math.abs(arrivalTime(p3.length) - 0.5) < 1e-6, `arrivée a : ${arrivalTime(p3.length)}`);
  assert.ok(Math.abs(arrivalTime(p6.length) - 0.8) < 1e-6, `arrivée b : ${arrivalTime(p6.length)}`);
  assert.ok(Math.abs(sapDuration([p3, p6]) - 0.8) < 1e-6, `sapDuration ${sapDuration([p3, p6])}`);
});

test('B3.8 : sur le chêne réel (graine 7, deux modes), python arrive avant llm', async () => {
  // B3.8.
  const { sapPath, arrivalTime } = await sapMod();
  for (const x of (await real()).filter((y) => y.name.endsWith('graine 7'))) {
    const by = (id: string): Mod => sapPath(x.sk, x.anchors.find((a) => a.id === id));
    const tp = arrivalTime(by('python').length);
    const tl = arrivalTime(by('llm').length);
    assert.ok(tp < tl, `${x.name} : python ${tp} s, llm ${tl} s`);
  }
});

// Point de la polyligne à la distance s (interpolation sur points / distances).
function pointAt(path: Mod, s: number): V3 {
  const n = path.distances.length;
  for (let k = 1; k < n; k++) {
    if (path.distances[k] >= s) {
      const d0 = path.distances[k - 1];
      const d1 = path.distances[k];
      const f = d1 - d0 > 1e-9 ? (s - d0) / (d1 - d0) : 0;
      return lerp3(vec(path.points, k - 1), vec(path.points, k), Math.min(1, Math.max(0, f)));
    }
  }
  return vec(path.points, n - 1);
}

test('B3.9 : sapParticles (nombre, distances réelles, écart ≤ SAP_JITTER, rand, déterminisme)', async () => {
  // B3.9 : count = max(40, round(length × density)).
  const { sapPath, sapParticles, SAP_JITTER } = await sapMod();
  const [x] = await real();
  const synth = await synthetic();
  const cases: [string, Mod][] = [
    ...x.anchors.filter((a) => ['llm', 'c', 'docker'].includes(a.id)).map((a): [string, Mod] => [`${x.name}/${a.id}`, sapPath(x.sk, a)]),
    ['synthétique', sapPath(synth, anchorOn(synth, 3, 1, 'r'))],
  ];
  for (const [name, path] of cases) {
    for (const density of [28, 46, 1, 3.3]) {
      const sp = sapParticles(path, density, 7);
      const want = Math.max(40, Math.round(path.length * density));
      assert.equal(sp.count, want, `${name}, densité ${density} : count ${sp.count}, attendu ${want}`);
      assert.equal(sp.positions.length, 3 * want);
      assert.equal(sp.distance.length, want);
      assert.equal(sp.rand.length, want);
      assert.ok(Math.abs(sp.distance[0]) < 1e-6, `${name} : première distance ${sp.distance[0]}`);
      assert.ok(Math.abs(sp.distance[want - 1] - path.length) < 1e-4 * Math.max(1, path.length), `${name} : dernière distance ${sp.distance[want - 1]}, length ${path.length}`);
      for (let k = 0; k < want; k++) {
        if (k > 0 && sp.distance[k] < sp.distance[k - 1]) assert.fail(`${name} : distance décroissante en ${k}`);
        if (!(sp.rand[k] >= 0 && sp.rand[k] < 1)) assert.fail(`${name} : rand[${k}] = ${sp.rand[k]}`);
        const q = pointAt(path, sp.distance[k]);
        const p = vec(sp.positions, k);
        for (let c = 0; c < 3; c++) {
          if (Math.abs(p[c] - q[c]) > SAP_JITTER + 1e-4) assert.fail(`${name} : particule ${k} s'écarte de ${Math.abs(p[c] - q[c])} sur l'axe ${c}`);
        }
      }
      const again = sapParticles(path, density, 7);
      assert.deepStrictEqual(again, sp, `${name} : non déterministe`);
    }
  }
});

test('B3.10 : segmentMask est l\'union des chaînes, pointMask[k] = mask[pointSegment[k]]', async () => {
  // B3.10 : recalcul indépendant de l'union.
  const { sapPath, segmentMask, pointMask } = await sapMod();
  for (const x of await real()) {
    const sk = x.sk;
    const chosen = x.anchors.filter((a) => ['llm', 'c', 'k8s'].includes(a.id));
    const paths = chosen.map((a) => sapPath(sk, a));
    const mask = segmentMask(sk, paths);
    assert.ok(mask instanceof Uint8Array && mask.length === sk.count, `${x.name} : masque Uint8Array de longueur count attendu`);
    const want = new Uint8Array(sk.count);
    for (const a of chosen) for (const i of chainOf(sk.parent, a.segment)) want[i] = 1;
    assert.deepEqual(Array.from(mask), Array.from(want), `${x.name} : masque ≠ union des chaînes`);
    assert.equal(segmentMask(sk, []).reduce((s: number, v: number) => s + v, 0), 0, `${x.name} : masque non vide sans chemin`);
    const r = testRng(5);
    const ps = new Uint16Array(5000).map(() => Math.floor(r() * sk.count));
    const pm = pointMask(ps, mask);
    assert.ok(pm instanceof Uint8Array && pm.length === ps.length, 'pointMask : Uint8Array de même longueur');
    for (let k = 0; k < ps.length; k++) if (pm[k] !== mask[ps[k]]) assert.fail(`${x.name} : pointMask[${k}] = ${pm[k]}, attendu ${mask[ps[k]]}`);
  }
});

// ---- Durcissement après l'audit du 20 novembre 2026 ----

const allSeeds = memo(async () => {
  const { growSkeleton, anchorSkills } = await skeletonMod();
  const { sapPath } = await sapMod();
  const { SKILLS } = await treeMod();
  const list = (SKILLS as Mod[]).map((s) => ({ id: s.id, layer: s.layer }));
  const out: { name: string; paths: Mod[] }[] = [];
  for (const mode of MODES) for (const seed of SEEDS) {
    const sk = growSkeleton({ mode, seed });
    out.push({ name: `${mode}/graine ${seed}`, paths: anchorSkills(sk, list).map((a: Mod) => sapPath(sk, a)) });
  }
  return out;
});

test('B3.6 dernier allumage : litAt(paths, sapDuration(paths)) contient les 11 compétences (deux modes, graines 7 et 1 à 20)', async () => {
  // Audit, bloquant 1 : à la durée de fin, aucune compétence ne reste éteinte (convention time >= arrivalTime).
  const { litAt, sapDuration } = await sapMod();
  const fails: string[] = [];
  for (const x of await allSeeds()) {
    if (x.paths.length !== 11) fails.push(`${x.name} : ${x.paths.length} chemins`);
    for (const speed of [undefined, 10, 7, 13.7]) {
      const T = speed === undefined ? sapDuration(x.paths) : sapDuration(x.paths, speed);
      const lit = speed === undefined ? litAt(x.paths, T) : litAt(x.paths, T, speed);
      if (lit.size !== x.paths.length) {
        const off = x.paths.filter((p: Mod) => !lit.has(p.id)).map((p: Mod) => p.id);
        fails.push(`${x.name}, speed ${speed ?? 'défaut'} : ${lit.size}/${x.paths.length} allumées à ${T} s (éteintes : ${off.join(', ')})`);
      }
    }
  }
  if (fails.length) assert.fail(`${fails.length} cas, dont : ${fails.slice(0, 8).join(' | ')}`);
});

test('B3.6 dernier allumage : chemins d\'une seule expérience, toutes allumées à sapDuration du sous-ensemble', async () => {
  // Audit, bloquant 1, rejoué pour la sélection d'une expérience (réponses par défaut, aucune, toutes).
  const { litAt, sapDuration } = await sapMod();
  const { EXPERIENCES, litSkills, ANSWERS, NO_ANSWERS } = await treeMod();
  const ALL = { 'A-02': true, 'A-05': true, 'A-06': true };
  const fails: string[] = [];
  for (const x of await allSeeds()) {
    for (const answers of [ANSWERS, NO_ANSWERS, ALL]) for (const e of EXPERIENCES) {
      const ids = new Set(litSkills(e.id, answers) as string[]);
      const sub = x.paths.filter((p: Mod) => ids.has(p.id));
      const lit = litAt(sub, sapDuration(sub));
      if (lit.size !== sub.length) fails.push(`${x.name}/${e.id} : ${lit.size}/${sub.length}`);
    }
  }
  if (fails.length) assert.fail(`${fails.length} cas, dont : ${fails.slice(0, 8).join(' | ')}`);
});

// Chemin rectiligne de longueur 1 (audit : chemin « demo », densité 400, graine 54 737).
const demoPath = (): Mod => ({
  id: 'demo', segments: new Int32Array([0]), points: new Float32Array([0, 0, 0, 1, 0, 0]), distances: new Float32Array([0, 1]), length: 1,
});

test('B3.9 : sapParticles().rand reste strictement < 1 après stockage Float32', async () => {
  // Audit « Les attributs aléatoires peuvent valoir 1 » : graine 54 737 et voisines.
  const { sapParticles } = await sapMod();
  const fails: string[] = [];
  for (let seed = 54730; seed <= 54745; seed++) {
    const sp = sapParticles(demoPath(), 400, seed);
    for (let k = 0; k < sp.count; k++) if (!(sp.rand[k] >= 0 && sp.rand[k] < 1)) fails.push(`graine ${seed}, rand[${k}] = ${sp.rand[k]}`);
  }
  assert.deepEqual(fails, [], fails.join(' | '));
});

test('B3.9 : dispersion non nulle des particules et effet de la graine', async () => {
  // Audit, mutation « supprimer tout décalage aléatoire » : écart moyen de l'ordre de SAP_JITTER / 2.
  const { sapParticles, SAP_JITTER } = await sapMod();
  const path = demoPath();
  const a = sapParticles(path, 400, 7);
  let sum = 0;
  for (let k = 0; k < a.count; k++) {
    const q = [a.distance[k], 0, 0];
    for (let c = 0; c < 3; c++) sum += Math.abs(a.positions[3 * k + c] - q[c]);
  }
  const mean = sum / (3 * a.count);
  assert.ok(mean > SAP_JITTER / 4, `écart moyen ${mean} : particules collées à la polyligne`);
  const b = sapParticles(path, 400, 8);
  assert.notDeepEqual(Array.from(b.positions), Array.from(a.positions), 'une autre graine doit déplacer les particules');
  assert.notDeepEqual(Array.from(b.rand), Array.from(a.rand), 'une autre graine doit changer rand');
});

test('B3.9 : sapParticles refuse une densité non finie ou négative', async () => {
  // Audit « entrées dégradées » : densité NaN → count NaN et tableaux vides.
  const { sapParticles } = await sapMod();
  for (const d of [Number.NaN, -1, -0.5, Infinity, -Infinity]) {
    assert.throws(() => sapParticles(demoPath(), d, 7), Error, `aucune erreur pour la densité ${d}`);
  }
  assert.equal(sapParticles(demoPath(), 0, 7).count, 40, 'densité nulle : 40 particules (minimum)');
});
