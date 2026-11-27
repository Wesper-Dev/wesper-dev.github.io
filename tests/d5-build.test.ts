// Contrat D5 (lot 1c) : lib/tree/build.ts, données de la scène (squelette, ancrages, nuage, couleurs, sapD, hi), utilisables par un Worker.
// Chaque champ est recalculé indépendamment avec les fonctions du moteur 1b (B2–B5) ou par une formule écrite ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesEqual, memo } from './helpers-tree.ts';
import { buildMod, engine, typedArraysOf } from './helpers-scene.ts';
import type { Mod } from './helpers-scene.ts';

const counter = (step: number): (() => number) => {
  let t = 1000;
  return () => (t += step);
};

const phone7 = memo(async (): Promise<Mod> => {
  const { buildTreeData } = await buildMod();
  const { PALETTES } = await engine.palettes();
  return buildTreeData({ profile: 'phone', palette: PALETTES.givre, now: () => 0 });
});

const desktopSimple5 = memo(async (): Promise<Mod> => {
  const { buildTreeData } = await buildMod();
  const { PALETTES } = await engine.palettes();
  return buildTreeData({ profile: 'desktop', mode: 'simple', seed: 5, palette: PALETTES.ardoise, now: () => 0 });
});

function sameSkeleton(a: Mod, b: Mod, label: string): void {
  assert.equal(a.count, b.count, `${label} : nombre de segments`);
  assert.equal(a.mode, b.mode, `${label} : mode`);
  assert.equal(a.seed, b.seed, `${label} : graine`);
  for (const k of ['a', 'b', 'radius', 'parent', 'attach', 'kind', 'depth']) assert.ok(bytesEqual(a[k], b[k]), `${label} : skeleton.${k} diffère`);
  assert.deepEqual(a.bounds, b.bounds, `${label} : bounds`);
}

function sameCloud(a: Mod, b: Mod, label: string): void {
  assert.equal(a.count, b.count, `${label} : cloud.count`);
  for (const k of ['positions', 'segment', 'role', 'size', 'rand', 'start', 'delay']) assert.ok(bytesEqual(a[k], b[k]), `${label} : cloud.${k} diffère`);
}

test('D0 : build.ts exporte SCENE_STREAMS = { backdrop, leaves, fireflies } et STREAMS (B1) ne change pas', async () => {
  // D0 : les flux nouveaux passent par SCENE_STREAMS, tirés par deriveSeed(seed, label).
  const { SCENE_STREAMS } = await buildMod();
  assert.deepEqual({ ...SCENE_STREAMS }, { backdrop: 'backdrop', leaves: 'leaves', fireflies: 'fireflies' });
  const { STREAMS } = await engine.rng();
  assert.deepEqual({ ...STREAMS }, { anchors: 'anchors', cloud: 'cloud', entry: 'entry', color: 'color', sap: 'sap' }, 'STREAMS (B1) ne doit pas changer');
});

test('D5.1 : phone par défaut : mode simple, graine DEFAULT_SEED, 45 000 points, champs recalculés à l\'identique par le moteur 1b', async () => {
  // D5.1 : squelette, ancrages = anchorSkills(skeleton, SKILLS), nuage, distances, couleurs = applyPalette, hi à 0.
  const d = await phone7();
  const { growSkeleton, anchorSkills, DEFAULT_SEED } = await engine.skeleton();
  const { sampleCloud, PROFILES } = await engine.cloud();
  const { segmentDistances } = await engine.sap();
  const { applyPalette } = await engine.color();
  const { SKILLS } = await engine.tree();
  const { PALETTES } = await engine.palettes();
  assert.equal(d.profile, 'phone');
  assert.equal(d.mode, PROFILES.phone.mode);
  assert.equal(d.mode, 'simple');
  assert.equal(d.seed, DEFAULT_SEED);
  const sk = growSkeleton({ mode: 'simple', seed: DEFAULT_SEED });
  sameSkeleton(d.skeleton, sk, 'phone');
  assert.deepEqual(d.anchors, anchorSkills(sk, SKILLS), 'anchors ≠ anchorSkills(skeleton, SKILLS)');
  const cloud = sampleCloud(sk, { points: PROFILES.phone.points });
  assert.equal(d.cloud.count, 45000);
  sameCloud(d.cloud, cloud, 'phone');
  const dist = segmentDistances(sk);
  assert.ok(bytesEqual(d.distances.start, dist.start) && bytesEqual(d.distances.end, dist.end), 'distances ≠ segmentDistances(skeleton)');
  assert.ok(d.colors instanceof Float32Array && d.colors.length === 3 * 45000, 'colors : Float32Array de 3N');
  assert.ok(bytesEqual(d.colors, applyPalette(cloud, sk.bounds, PALETTES.givre)), 'colors ≠ applyPalette(cloud, bounds, palette)');
  assert.ok(d.hi instanceof Uint8Array && d.hi.length === 45000 && d.hi.every((x: number) => x === 0), 'hi : Uint8Array de N, à 0 au départ');
  assert.ok(d.sapD instanceof Float32Array && d.sapD.length === 45000, 'sapD : Float32Array de N');
});

test('D5.1 : desktop par défaut : mode natural et 240 000 points ; mode imposé simple : squelette simple, toujours 240 000 points', async () => {
  // D5.1 : mode par défaut PROFILES[profile].mode, nombre de points PROFILES[profile].points.
  const { buildTreeData } = await buildMod();
  const { PALETTES } = await engine.palettes();
  const { growSkeleton } = await engine.skeleton();
  const nat = buildTreeData({ profile: 'desktop', palette: PALETTES['sous-bois'], now: () => 0 });
  assert.equal(nat.mode, 'natural');
  assert.equal(nat.cloud.count, 240000);
  assert.equal(nat.colors.length, 720000);
  sameSkeleton(nat.skeleton, growSkeleton({ mode: 'natural', seed: 7 }), 'desktop naturel');
  const simple = await desktopSimple5();
  assert.equal(simple.mode, 'simple');
  assert.equal(simple.seed, 5);
  assert.equal(simple.cloud.count, 240000);
  sameSkeleton(simple.skeleton, growSkeleton({ mode: 'simple', seed: 5 }), 'desktop simple graine 5');
});

test('D5.2 : déterminisme octet pour octet à entrées égales, quel que soit now ; une autre graine change les données', async () => {
  // D5.2 : now est exclu de la comparaison.
  const { buildTreeData } = await buildMod();
  const { PALETTES } = await engine.palettes();
  const a = buildTreeData({ profile: 'phone', seed: 3, palette: PALETTES.foret, now: counter(1) });
  const b = buildTreeData({ profile: 'phone', seed: 3, palette: PALETTES.foret, now: counter(37) });
  const ta = typedArraysOf({ ...a, timings: null });
  const tb = typedArraysOf({ ...b, timings: null });
  assert.equal(ta.length, tb.length);
  ta.forEach((x, i) => assert.ok(bytesEqual(x, tb[i] as ArrayBufferView), `tableau ${i} différent entre deux appels identiques`));
  assert.deepEqual(a.anchors, b.anchors);
  const c = buildTreeData({ profile: 'phone', seed: 4, palette: PALETTES.foret, now: counter(1) });
  assert.ok(!bytesEqual(a.cloud.positions, c.cloud.positions), 'graines 3 et 4 : nuages identiques');
});

async function checkSapD(d: Mod, label: string): Promise<void> {
  const { POINT_ROLE } = await engine.cloud();
  const sk = d.skeleton;
  const { start, end } = d.distances;
  const N = d.cloud.count;
  const bad: string[] = [];
  for (let k = 0; k < N && bad.length < 5; k++) {
    const seg = d.cloud.segment[k];
    const v = d.sapD[k];
    if (!(v >= start[seg] - 1e-4 && v <= end[seg] + 1e-4)) bad.push(`point ${k} : sapD ${v} hors de [${start[seg]}, ${end[seg]}]`);
    let want: number;
    if (d.cloud.role[k] === POINT_ROLE.LEAF) want = end[seg];
    else {
      const ax = sk.a[3 * seg], ay = sk.a[3 * seg + 1], az = sk.a[3 * seg + 2];
      const dx = sk.b[3 * seg] - ax, dy = sk.b[3 * seg + 1] - ay, dz = sk.b[3 * seg + 2] - az;
      const l2 = dx * dx + dy * dy + dz * dz;
      const px = d.cloud.positions[3 * k] - ax, py = d.cloud.positions[3 * k + 1] - ay, pz = d.cloud.positions[3 * k + 2] - az;
      const t = l2 === 0 ? 1 : Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / l2));
      want = start[seg] + t * (end[seg] - start[seg]);
    }
    if (Math.abs(v - want) > 1e-4 + 2e-6 * Math.abs(want)) bad.push(`point ${k} (rôle ${d.cloud.role[k]}, segment ${seg}) : sapD ${v}, attendu ${want}`);
  }
  assert.deepEqual(bad, [], `${label} :\n${bad.join('\n')}`);
}

test('D5.3 : sapD = end[seg] pour LEAF, start[seg] + clamp(t,0,1)·L(seg) pour BARK et ROOT, borné par [start, end] (phone, graine 7)', async () => {
  // D5.3 : distance réelle à la base du projeté de chaque point sur son segment.
  await checkSapD(await phone7(), 'phone graine 7');
});

test('D5.3 : même formule de sapD sur un second jeu (desktop simple, graine 5)', async () => {
  // D5.3 : second jeu de données pour exclure toute valeur figée.
  await checkSapD(await desktopSimple5(), 'desktop simple graine 5');
});

test('D5.3 : le long de chainToBase de chaque ancrage, le minimum de sapD par segment ne décroît pas', async () => {
  // D5.3 : monotonie de la distance le long du chemin de sève.
  const { chainToBase } = await engine.sap();
  for (const d of [await phone7(), await desktopSimple5()]) {
    const N = d.cloud.count;
    const minBySeg = new Float64Array(d.skeleton.count).fill(Infinity);
    for (let k = 0; k < N; k++) {
      const s = d.cloud.segment[k];
      if (d.sapD[k] < minBySeg[s]) minBySeg[s] = d.sapD[k];
    }
    for (const a of d.anchors) {
      const chain = [...chainToBase(d.skeleton, a.segment)].filter((s) => Number.isFinite(minBySeg[s as number]));
      for (let i = 1; i < chain.length; i++) {
        const prev = minBySeg[chain[i - 1] as number] as number;
        const cur = minBySeg[chain[i] as number] as number;
        assert.ok(cur >= prev - 1e-4, `ancrage ${a.id} : min sapD décroît du segment ${chain[i - 1]} (${prev}) au segment ${chain[i]} (${cur})`);
      }
    }
  }
});

test('D5.4 : sapMask renvoie sapPath (B3) de chaque compétence et hi = pointMask(cloud.segment, segmentMask(…))', async () => {
  // D5.4 : BNP (cinq compétences), une compétence seule, et aucune.
  const { sapMask } = await buildMod();
  const { sapPath, segmentMask, pointMask } = await engine.sap();
  const { litSkills } = await engine.tree();
  for (const d of [await phone7(), await desktopSimple5()]) {
    for (const skills of [litSkills('bnp-paribas'), ['c'], ['agents', 'unix']]) {
      const r = sapMask(d, skills);
      assert.equal(r.paths.length, skills.length, `${skills.join(',')} : un chemin par compétence`);
      const want = skills.map((s: string) => sapPath(d.skeleton, d.anchors.find((a: { id: string }) => a.id === s), d.distances));
      r.paths.forEach((p: Mod, i: number) => {
        const w = want[i];
        assert.equal(p.id, w.id, `chemin ${i} : id`);
        assert.equal(p.length, w.length, `chemin ${p.id} : longueur`);
        for (const k of ['segments', 'points', 'distances']) assert.ok(bytesEqual(p[k], w[k]), `chemin ${p.id} : ${k} ≠ sapPath`);
      });
      const hi = pointMask(d.cloud.segment, segmentMask(d.skeleton, want));
      assert.ok(r.hi instanceof Uint8Array && bytesEqual(r.hi, hi), `${skills.join(',')} : hi ≠ pointMask(cloud.segment, segmentMask(…))`);
    }
    const none = sapMask(d, []);
    assert.deepEqual(none.paths, []);
    assert.ok(none.hi.length === d.cloud.count && none.hi.every((x: number) => x === 0), 'aucune compétence : hi entièrement à 0');
  }
});

test('D5.5 : transferables renvoie les ArrayBuffer distincts de tous les tableaux typés de TreeData, sans doublon ni manque', async () => {
  // D5.5 : transfert vers un Worker sans copie.
  const { transferables } = await buildMod();
  const d = await phone7();
  const bufs = transferables(d) as ArrayBuffer[];
  assert.ok(Array.isArray(bufs));
  assert.ok(bufs.every((b) => b instanceof ArrayBuffer), 'chaque élément doit être un ArrayBuffer');
  assert.equal(new Set(bufs).size, bufs.length, 'doublon dans transferables');
  const expected = new Set(typedArraysOf(d).map((v) => v.buffer));
  assert.ok(expected.size >= 18, `au moins 18 tableaux typés attendus dans TreeData, trouvé ${expected.size}`);
  const missing = [...expected].filter((b) => !bufs.includes(b as ArrayBuffer)).length;
  const extra = bufs.filter((b) => !expected.has(b)).length;
  assert.equal(missing, 0, `${missing} tampon(s) manquant(s)`);
  assert.equal(extra, 0, `${extra} tampon(s) étranger(s) à TreeData`);
});

test('D5.6 : timings vient uniquement de now : 0 partout avec now constant, multiples exacts du pas avec un now à pas fixe', async () => {
  // D5.6 : aucune lecture d'horloge réelle.
  const { buildTreeData } = await buildMod();
  const { PALETTES } = await engine.palettes();
  const keys = ['anchors', 'cloud', 'colors', 'sapD', 'skeleton'];
  const flat = await phone7();
  assert.deepEqual(Object.keys(flat.timings).sort(), keys);
  for (const k of keys) assert.equal(flat.timings[k], 0, `timings.${k} avec now constant`);
  const d = buildTreeData({ profile: 'phone', seed: 2, palette: PALETTES.givre, now: counter(1000) });
  for (const k of keys) {
    const v = d.timings[k];
    assert.ok(Number.isInteger(v / 1000) && v >= 1000, `timings.${k} = ${v} : multiple non nul de 1000 attendu (seul now compte)`);
  }
});
