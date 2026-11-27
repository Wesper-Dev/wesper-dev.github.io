// Contrat D10.4 et D16 (lot 1c) : mouvement réduit [N], et modules purs du fond, des feuilles, des lucioles et de l'ASCII.
// Fichier rangé en d10 (convention D0 : d1 à d12) : D16 n'a pas de numéro de fichier propre.
// Les formes d'API non écrites dans le contrat (noms des champs de données, des méthodes) sont des choix de ces tests,
// rapportés dans les zones d'ombre ; les valeurs, elles, sont recalculées ici à partir des formules du contrat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesEqual, hex3 } from './helpers-tree.ts';
import {
  asciiMod,
  backdropMod,
  cameraMod,
  engine,
  fakeCanvasFactory,
  fakeContext2d,
  firefliesMod,
  leavesMod,
  ownTypedArrays,
  parseCssColor,
} from './helpers-scene.ts';
import type { FakeCanvas, Mod } from './helpers-scene.ts';

type V3 = [number, number, number];
const mixRef = (a: readonly number[], b: readonly number[], t: number): V3 => [0, 1, 2].map((i) => (a[i] as number) + ((b[i] as number) - (a[i] as number)) * t) as V3;
const scaleRef = (a: readonly number[], s: number): V3 => [0, 1, 2].map((i) => (a[i] as number) * s) as V3;

const positionsOf = (d: Mod): Float32Array => d.positions ?? d.position;
const randOf = (d: Mod): Float32Array => d.rand ?? d.aR;
const typeOf = (d: Mod): ArrayLike<number> => d.type ?? d.aT;

// ================= D10.4 : mouvement réduit =================

test('D10.4 : en mouvement réduit, idleStep ne tourne jamais, même après un long repos', async () => {
  // D10.4 : pas de rotation au repos.
  const { idleStep } = await cameraMod();
  for (const idle of [0, 2.6, 30]) {
    const r = idleStep({ idle, dt: 1 / 60, active: false, reducedMotion: true });
    assert.equal(r.dRot, 0, `idle ${idle} en mouvement réduit`);
  }
});

test('D10.4 : en mouvement réduit, aucune feuille (capacité 0, step toujours faux, live 0) sur les deux profils', async () => {
  // D10.4, D16.2 : le nombre est 0.
  const { createLeaves } = await leavesMod();
  for (const profile of ['phone', 'desktop'] as const) {
    const L = createLeaves(leafOptions(profile, true, 7, await palette('sous-bois')));
    assert.equal(L.capacity, 0, `${profile} : capacité`);
    for (let i = 0; i < 1200; i++) assert.equal(L.step(1 / 60), false);
    assert.equal(L.live, 0);
  }
});

test('D10.4 : en mouvement réduit, aucune luciole même à grande vitesse de souris', async () => {
  // D10.4, D16.3 : naissance seulement hors mouvement réduit.
  const { createFireflies } = await firefliesMod();
  const F = createFireflies({ reducedMotion: true, palette: await palette('sous-bois'), seed: 7 });
  sweep(F, 50, 10);
  assert.equal(F.live, 0);
});

// ================= D16.1 : fond =================

async function palette(id: string): Promise<Mod> {
  const { PALETTES } = await engine.palettes();
  return PALETTES[id];
}

test('D16.1 : comptes exacts du sol, de la forêt et du ciel (k = 0,5 sur phone, 1 sur desktop)', async () => {
  // D16.1 : round(14000k), nT·round(1700k) + (phone 50 : 110), round(5200k) ; D12.3 : 7 000 / 14 000, 17 050 / 68 110, 2 600 / 5 200.
  const { buildGround, buildForest, buildSky } = await backdropMod();
  const want = { phone: { ground: 7000, trees: 20 * 850, flies: 50, sky: 2600 }, desktop: { ground: 14000, trees: 40 * 1700, flies: 110, sky: 5200 } };
  for (const profile of ['phone', 'desktop'] as const) {
    const w = want[profile];
    const g = buildGround(profile, 7);
    const f = buildForest(profile, 7);
    const s = buildSky(profile, 7);
    assert.equal(g.count, w.ground, `${profile} : sol`);
    assert.equal(f.count, w.trees + w.flies, `${profile} : forêt`);
    assert.equal(s.count, w.sky, `${profile} : ciel`);
    for (const [name, d] of [['sol', g], ['forêt', f], ['ciel', s]] as const) {
      assert.ok(positionsOf(d) instanceof Float32Array && positionsOf(d).length === 3 * d.count, `${profile} ${name} : positions 3N`);
      assert.ok(randOf(d) instanceof Float32Array && randOf(d).length === d.count, `${profile} ${name} : rand N`);
    }
    const t = Array.from(typeOf(f));
    assert.equal(t.length, f.count);
    assert.equal(t.filter((x) => x === 1).length, w.trees, `${profile} : points d'arbres (aT = 1)`);
    assert.equal(t.filter((x) => x === 3).length, w.flies, `${profile} : lucioles du fond (aT = 3)`);
  }
});

test('D16.1 : sol : rayon 16·r^0,7 (médiane 16·0,5^0,7), angle uniforme, y ∈ [−0,05 ; 0,03], rand ∈ [0, 1)', async () => {
  // D16.1 : bornes et loi du rayon ; une loi uniforme du rayon (médiane 8) est refusée.
  const { buildGround } = await backdropMod();
  for (const [profile, seed] of [['desktop', 7], ['phone', 13]] as const) {
    const g = buildGround(profile, seed);
    const P = positionsOf(g);
    const R = randOf(g);
    const radii: number[] = [];
    const quadrants = [0, 0, 0, 0];
    for (let i = 0; i < g.count; i++) {
      const x = P[3 * i] as number, y = P[3 * i + 1] as number, z = P[3 * i + 2] as number;
      assert.ok(y >= -0.05 - 1e-6 && y <= 0.03 + 1e-6, `${profile} sol : y = ${y}`);
      const r = Math.hypot(x, z);
      assert.ok(r <= 16 + 1e-4, `${profile} sol : rayon ${r} > 16`);
      radii.push(r);
      const a = Math.atan2(z, x) + Math.PI;
      quadrants[Math.min(3, Math.floor(a / (Math.PI / 2)))]++;
      assert.ok((R[i] as number) >= 0 && (R[i] as number) < 1);
    }
    radii.sort((a, b) => a - b);
    const median = radii[radii.length >> 1] as number;
    assert.ok(Math.abs(median - 16 * 0.5 ** 0.7) < 0.35, `${profile} sol : médiane du rayon ${median}, attendu ≈ ${16 * 0.5 ** 0.7}`);
    for (const q of quadrants) assert.ok(Math.abs(q / g.count - 0.25) < 0.03, `${profile} sol : angle non uniforme ${JSON.stringify(quadrants)}`);
  }
});

test('D16.1 : forêt : arbres dans l\'anneau [15, 35] à l\'arrière (angle π(0,96 + 1,08·t/nT) + r·0,05), lucioles r ∈ [4, 16] et y ∈ [0,5 ; 10,5]', async () => {
  // D16.1 : aucun point d'arbre devant l'arbre principal (angles 0,75 à 2,6 rad exclus), hauteur ≤ 15.
  const { buildForest } = await backdropMod();
  for (const [profile, seed] of [['desktop', 7], ['phone', 21]] as const) {
    const f = buildForest(profile, seed);
    const P = positionsOf(f);
    const T = typeOf(f);
    let back = 0;
    let trees = 0;
    for (let i = 0; i < f.count; i++) {
      const x = P[3 * i] as number, y = P[3 * i + 1] as number, z = P[3 * i + 2] as number;
      const h = Math.hypot(x, z);
      if (T[i] === 1) {
        trees++;
        assert.ok(h >= 15 - 4.4 - 1e-3 && h <= 35 + 4.4 + 1e-3, `${profile} arbre : distance ${h} hors de l'anneau`);
        assert.ok(y >= -1e-6 && y <= 15 + 1e-3, `${profile} arbre : y = ${y}`);
        let a = Math.atan2(z, x);
        if (a < 0) a += 2 * Math.PI;
        assert.ok(!(a > 0.75 && a < 2.6), `${profile} arbre : angle ${a} devant la scène`);
        if (z < 0) back++;
      } else {
        assert.equal(T[i], 3);
        assert.ok(h >= 4 - 1e-4 && h <= 16 + 1e-4, `${profile} luciole : rayon ${h}`);
        assert.ok(y >= 0.5 - 1e-4 && y <= 10.5 + 1e-4, `${profile} luciole : y = ${y}`);
      }
    }
    assert.ok(back / trees > 0.85, `${profile} : la forêt doit être derrière (z < 0) pour l'essentiel, ${back}/${trees}`);
  }
});

test('D16.1 : ciel : étoiles sur la sphère de rayon 95 centrée en (0, 4, 0), réparties en hauteur', async () => {
  // D16.1 : round(5200k) étoiles, décalage +4.
  const { buildSky } = await backdropMod();
  for (const [profile, seed] of [['desktop', 7], ['phone', 2]] as const) {
    const s = buildSky(profile, seed);
    const P = positionsOf(s);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < s.count; i++) {
      const x = P[3 * i] as number, y = P[3 * i + 1] as number, z = P[3 * i + 2] as number;
      const d = Math.hypot(x, y - 4, z);
      assert.ok(Math.abs(d - 95) < 2e-3, `${profile} étoile ${i} à ${d} du centre`);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    assert.ok(maxY > 90 && minY < 20, `${profile} ciel : étendue en y [${minY}, ${maxY}]`);
  }
});

test('D16.1 : fond déterministe pour une graine, différent pour une autre graine', async () => {
  // D16.1 : graine sur SCENE_STREAMS.backdrop.
  const { buildGround, buildForest, buildSky } = await backdropMod();
  for (const build of [buildGround, buildForest, buildSky]) {
    const a = build('phone', 9);
    const b = build('phone', 9);
    const c = build('phone', 10);
    assert.ok(bytesEqual(positionsOf(a), positionsOf(b)) && bytesEqual(randOf(a), randOf(b)), 'même graine : mêmes données');
    assert.ok(!bytesEqual(positionsOf(a), positionsOf(c)), 'graines 9 et 10 : positions identiques');
  }
});

test('D16.1 : paintBackdrop écrit les couleurs du contrat (sol, arbres, étoiles, lucioles) pour deux palettes', async () => {
  // D16.1 : mix(bark1, leaf0, r·0,5)·0,7 ; mix(mix(leaf0, leaf1, r·0,4), bg2, 0,15)·0,75 ; ink·(0,5 + 0,5r) ; sap0.
  const { buildGround, buildForest, buildSky, paintBackdrop } = await backdropMod();
  const data = { ground: buildGround('desktop', 3), forest: buildForest('phone', 3), sky: buildSky('desktop', 3) };
  for (const pid of ['sous-bois', 'givre']) {
    const p = await palette(pid);
    for (const kind of ['ground', 'forest', 'sky'] as const) {
      const d = data[kind];
      const out = new Float32Array(3 * d.count).fill(-1);
      paintBackdrop(kind, d, p, out);
      const R = randOf(d);
      const T = kind === 'forest' ? typeOf(d) : null;
      for (let i = 0; i < d.count; i += 7) {
        const r = R[i] as number;
        let want: V3;
        if (kind === 'ground') want = scaleRef(mixRef(hex3(p.bark[1]), hex3(p.leaf[0]), r * 0.5), 0.7);
        else if (kind === 'sky') want = scaleRef(hex3(p.ink), 0.5 + 0.5 * r);
        else if (T && T[i] === 3) want = hex3(p.sap[0]);
        else want = scaleRef(mixRef(mixRef(hex3(p.leaf[0]), hex3(p.leaf[1]), r * 0.4), hex3(p.bg2), 0.15), 0.75);
        for (let c = 0; c < 3; c++) {
          assert.ok(Math.abs((out[3 * i + c] as number) - want[c]) < 2e-6, `${pid} ${kind} point ${i} composante ${c} : ${out[3 * i + c]}, attendu ${want[c]}`);
        }
      }
    }
  }
});

test('D16.1 : backdropCss donne exactement les dégradés de proto:761–765 (halo 42 % / 56 %, forêt, ciel)', async () => {
  // D16.1 : suffixes d'opacité AA, 2E, 0A ; le fond Nuit n'est pas porté.
  const { backdropCss } = await backdropMod();
  const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
  for (const pid of ['sous-bois', 'foret']) {
    const p = await palette(pid);
    for (const profile of ['phone', 'desktop'] as const) {
      const halo = `radial-gradient(ellipse 70% 60% at 50% ${profile === 'phone' ? 42 : 56}%, ${p.bg2} 0%, ${p.bg} 72%)`;
      const want: Record<string, string> = {
        halo,
        foret: `linear-gradient(to bottom, transparent 55%, ${p.bg2}AA 72%, transparent 92%), ${halo}`,
        ciel: `radial-gradient(circle at 80% 13%, ${p.ink}2E 0, ${p.ink}0A 4%, transparent 16%), linear-gradient(to bottom, ${p.bg2} 0%, ${p.bg} 62%)`,
      };
      for (const kind of ['halo', 'foret', 'ciel']) assert.equal(norm(backdropCss(kind, p, profile)), norm(want[kind] as string), `${pid} ${profile} ${kind}`);
    }
  }
});

// ================= D16.2 : feuilles =================

// Nuage synthétique : un seul point LEAF, en (5, 3, −2) ; les autres sont BARK ou ROOT près de l'origine.
function syntheticCloud(): Mod {
  const positions = new Float32Array([0, 0, 0, 0, -1, 0, 5, 3, -2, 0, 0.5, 0]);
  const role = new Uint8Array([0, 1, 2, 0]);
  const cloud = { count: 4, positions, role, segment: new Uint16Array(4), size: new Float32Array(4).fill(1), rand: new Float32Array(4), start: new Float32Array(12), delay: new Float32Array(4) };
  return cloud;
}

function leafOptions(profile: 'phone' | 'desktop', reducedMotion: boolean, seed: number, pal: Mod): Record<string, unknown> {
  const cloud = syntheticCloud();
  return { profile, reducedMotion, seed, palette: pal, cloud, positions: cloud.positions, role: cloud.role, data: { cloud, profile, seed } };
}

test('D16.2 : capacité des feuilles : 12 sur phone, 28 sur desktop', async () => {
  // D16.2 : reducedMotion ? 0 : phone 12 : 28.
  const { createLeaves } = await leavesMod();
  const pal = await palette('sous-bois');
  assert.equal(createLeaves(leafOptions('phone', false, 7, pal)).capacity, 12);
  assert.equal(createLeaves(leafOptions('desktop', false, 7, pal)).capacity, 28);
});

interface LeafRun {
  births: number[][]; // par feuille : instants de naissance observés
  gaps: number[]; // attente entre une mort et la naissance suivante
  colors: Set<string>;
}

// Simule `seconds` secondes au pas dt en contrôlant, à chaque pas, les invariants de D16.2.
function runLeaves(L: Mod, cap: number, seconds: number, dt: number, pal: Mod): LeafRun {
  const arrays = ownTypedArrays(L);
  assert.ok(arrays.size >= 4, `les feuilles doivent exposer leurs tableaux typés (position, rotation, alpha, couleur, taille), trouvé ${[...arrays.keys()].join(', ')}`);
  const named = [...arrays.entries()].filter(([, v]) => v.byteLength / (v as Float32Array).BYTES_PER_ELEMENT === 3 * cap) as [string, Float32Array][];
  const triples = named.map(([, v]) => v);
  assert.ok(triples.length >= 2, 'tableaux de 3 × capacité attendus (position, couleur)');
  const allowed = [hex3(pal.leaf[1]), hex3(pal.leafAcc), hex3(pal.root[0])];
  // Repérage par nom si possible (position, couleur), sinon par les valeurs (les couleurs restent dans [0, 1]).
  let pos: Float32Array | null = named.find(([k]) => /^(position|positions|pos|aPosition)$/i.test(k))?.[1] ?? null;
  let col: Float32Array | null = named.find(([k]) => /^(color|colors|colour|aC|col)$/i.test(k))?.[1] ?? null;
  const prevY = new Float64Array(cap);
  const lastDeath = new Float64Array(cap).fill(NaN);
  const births: number[][] = Array.from({ length: cap }, () => []);
  const gaps: number[] = [];
  const colors = new Set<string>();
  let prevLive = 0;
  const steps = Math.round(seconds / dt);
  for (let s = 1; s <= steps; s++) {
    const t = s * dt;
    const dirty = L.step(dt);
    assert.equal(typeof dirty, 'boolean', 'step(dt) renvoie un booléen dirty');
    const live = L.live as number;
    assert.ok(Number.isInteger(live) && live >= 0 && live <= cap, `live = ${live}`);
    if (live > 0) assert.equal(dirty, true, `t = ${t.toFixed(3)} : une feuille vole, dirty doit être vrai`);
    if (live === 0 && prevLive === 0) assert.equal(dirty, false, `t = ${t.toFixed(3)} : toutes les feuilles attendent, dirty doit être faux`);
    if (live < prevLive) assert.equal(dirty, true, 'une feuille vient de mourir : dirty vrai');
    prevLive = live;
    for (const [k, v] of ownTypedArrays(L)) assert.equal(v, arrays.get(k), `tableau ${k} réalloué au pas ${s}`);
    if (!pos) pos = triples.find((v) => v.some((x) => Math.abs(x) > 1.5)) ?? null;
    if (!pos) continue;
    if (!col) col = triples.find((v) => v !== pos && v.some((x) => x > 0) && v.every((x) => x >= 0 && x <= 1)) ?? null;
    for (let j = 0; j < cap; j++) {
      const x = pos[3 * j] as number, y = pos[3 * j + 1] as number, z = pos[3 * j + 2] as number;
      const py = prevY[j] as number;
      if (y > 2.5 && py < 0.05) {
        births[j]?.push(t);
        if (!Number.isNaN(lastDeath[j] as number)) gaps.push(t - (lastDeath[j] as number));
      } else if (y < 0.05 && py >= 0.05) lastDeath[j] = t;
      else if (y >= 0.05 && py >= 0.05 && y < py) {
        const vy = (py - y) / dt;
        assert.ok(vy >= 0.45 - 1e-3 && vy <= 0.85 + 1e-3, `feuille ${j} : vitesse de chute ${vy} hors de [0,45 ; 0,85]`);
      }
      if (y >= 0.05) {
        assert.ok(Math.abs(x - 5) <= 1.95 && Math.abs(z + 2) <= 0.67, `feuille ${j} née ailleurs que sur le point LEAF : (${x}, ${y}, ${z})`);
        assert.ok(y <= 3 + 1e-5, `feuille ${j} au-dessus de son point de naissance : y = ${y}`);
        if (col) {
          const c = [col[3 * j] as number, col[3 * j + 1] as number, col[3 * j + 2] as number];
          const k = allowed.findIndex((a) => a.every((v, i) => Math.abs(v - (c[i] as number)) < 1e-6));
          assert.ok(k >= 0, `feuille ${j} : couleur ${JSON.stringify(c)} hors de [leaf1, leafAcc, root0]`);
          colors.add(String(k));
        }
      }
      prevY[j] = y;
    }
  }
  assert.ok(pos, 'aucune feuille n\'est née sur le point LEAF (positions jamais écrites)');
  return { births, gaps, colors };
}

test('D16.2 : desktop : naissance sur le point LEAF, chute à 0,45–0,85, attente initiale 1 + r·12, attente après mort 2 + r·9, couleurs du contrat, tableaux constants', async () => {
  // D16.2 : 200 s simulées au pas de 1/60 s (12 000 pas), identité des tableaux contrôlée à chaque pas.
  const { createLeaves } = await leavesMod();
  const pal = await palette('ardoise');
  const dt = 1 / 60;
  const L = createLeaves(leafOptions('desktop', false, 11, pal));
  for (let i = 0; i < 59; i++) assert.equal(L.step(dt), false, 'aucune feuille avant 1 s : dirty faux');
  assert.equal(L.live, 0);
  const run = runLeaves(L, 28, 200, dt, pal);
  const first = run.births.map((b) => b[0]).filter((x): x is number => x !== undefined).map((x) => x + 59 * dt);
  assert.equal(first.length, 28, 'chaque feuille naît au moins une fois en 200 s');
  for (const t of first) assert.ok(t >= 1 - 2 * dt && t <= 13 + 3 * dt, `première naissance à ${t} s hors de [1, 13]`);
  assert.ok(Math.max(...first) - Math.min(...first) > 4, 'attentes initiales tirées au hasard (étalées)');
  assert.ok(run.gaps.length > 100, `assez de cycles observés (${run.gaps.length})`);
  for (const g of run.gaps) assert.ok(g >= 2 - 2 * dt && g <= 11 + 2 * dt, `attente après mort ${g} s hors de [2, 11] (desktop)`);
  assert.ok(run.colors.size >= 2, 'couleurs tirées parmi les trois');
});

test('D16.2 : phone : attente après mort 2 + r·14 (au moins une attente > 11,2 s), 12 feuilles', async () => {
  // D16.2 : attente plus longue sur phone.
  const { createLeaves } = await leavesMod();
  const pal = await palette('foret');
  const dt = 1 / 30;
  const L = createLeaves(leafOptions('phone', false, 4, pal));
  const run = runLeaves(L, 12, 220, dt, pal);
  for (const g of run.gaps) assert.ok(g >= 2 - 2 * dt && g <= 16 + 2 * dt, `attente après mort ${g} s hors de [2, 16] (phone)`);
  assert.ok(run.gaps.some((g) => g > 11.2), `aucune attente au-delà de 11,2 s : ${Math.max(...run.gaps)}`);
});

test('D16.2 : feuilles déterministes pour une graine (flux SCENE_STREAMS.leaves), différentes pour une autre', async () => {
  // D16.2 : le hasard est injecté par la graine.
  const { createLeaves } = await leavesMod();
  const pal = await palette('sous-bois');
  const snap = (seed: number): ArrayBufferView[] => {
    const L = createLeaves(leafOptions('desktop', false, seed, pal));
    for (let i = 0; i < 900; i++) L.step(1 / 60);
    return [...ownTypedArrays(L).values()];
  };
  const a = snap(5);
  const b = snap(5);
  const c = snap(6);
  assert.ok(a.every((x, i) => bytesEqual(x, b[i] as ArrayBufferView)), 'même graine : mêmes tableaux');
  assert.ok(a.some((x, i) => !bytesEqual(x, c[i] as ArrayBufferView)), 'graines 5 et 6 : tableaux identiques');
});

// ================= D16.3 : lucioles =================

// Balayage horizontal de la souris : `moves` déplacements de v px/ms (pas de 10 ms).
function sweep(F: Mod, moves: number, v: number, t0 = 1000, pointerType = 'mouse'): void {
  let x = 100;
  F.pointerMove({ x, y: 300, t: t0, pointerType });
  for (let i = 1; i <= moves; i++) {
    x += v * 10;
    F.pointerMove({ x, y: 300, t: t0 + 10 * i, pointerType });
  }
}

async function fireflies(seed = 7, pid = 'sous-bois'): Promise<{ F: Mod; sprites: Mod; made: FakeCanvas[]; pal: Mod }> {
  const { createFireflies, createSprites } = await firefliesMod();
  const pal = await palette(pid);
  const { make, made } = fakeCanvasFactory();
  const sprites = createSprites(pal, make);
  const F = createFireflies({ reducedMotion: false, palette: pal, seed });
  return { F, sprites, made, pal };
}

interface Drawn {
  img: unknown;
  cx: number;
  cy: number;
  size: number;
  alpha: number;
}

function drawLog(F: Mod, sprites: Mod): { drawn: Drawn[]; methods: string[] } {
  const fake = fakeContext2d();
  F.draw(fake.ctx, sprites);
  const methods = [...new Set(fake.calls.map((c) => c.name))];
  const drawn = fake.calls
    .filter((c) => c.name === 'drawImage')
    .map((c) => {
      assert.equal(c.args.length, 5, 'drawImage(sprite, x, y, w, h) attendu');
      assert.equal(c.state.globalCompositeOperation, 'lighter', 'mode lighter pendant le dessin');
      const [img, x, y, w, h] = c.args as [unknown, number, number, number, number];
      assert.ok(Math.abs(w - h) < 1e-9, 'sprite carré');
      return { img, cx: x + w / 2, cy: y + h / 2, size: w, alpha: c.state.globalAlpha as number };
    });
  return { drawn, methods };
}

test('D16.3 : nombre de naissances n = min(6, floor((v − 1,2)·2,5)) si v > 1,4, v = hypot(dx, dy)/max(1, dtMs)', async () => {
  // D16.3 : bornes exactes : v = 1,4 et 1,5 ne donnent rien, 1,7 → 1, 2 → 2, 3 → 4, 5 et 10 → 6 ; dt nul compté 1 ms.
  const cases: [number, number, number, number][] = [
    [14, 0, 10, 0], [15, 0, 10, 0], [17, 0, 10, 1], [20, 0, 10, 2], [0, -30, 10, 4], [18, 24, 10, 4], [50, 0, 10, 6], [100, 0, 10, 6], [3, 0, 0, 4], [12, 0, 4, 4],
  ];
  for (const [dx, dy, dt, want] of cases) {
    const { F } = await fireflies(3);
    F.pointerMove({ x: 200, y: 200, t: 5000, pointerType: 'mouse' });
    assert.equal(F.live, 0, 'le premier mouvement ne fait naître aucune luciole');
    F.pointerMove({ x: 200 + dx, y: 200 + dy, t: 5000 + dt, pointerType: 'mouse' });
    assert.equal(F.live, want, `dx ${dx}, dy ${dy}, dt ${dt} ms → ${want} naissance(s)`);
  }
});

test('D16.3 : aucune naissance au doigt ni au stylet ; à 1 px/ms, aucune', async () => {
  // D16.3 : seulement pour pointerType === 'mouse', et v > 1,4.
  for (const type of ['touch', 'pen']) {
    const { F } = await fireflies();
    sweep(F, 40, 10, 1000, type);
    assert.equal(F.live, 0, `pointerType ${type}`);
  }
  const { F } = await fireflies();
  sweep(F, 40, 1);
  assert.equal(F.live, 0, '1 px/ms');
});

test('D16.3 : pool de 260 : capacité jamais dépassée, tableaux typés constants, retour à 0 quand toutes meurent', async () => {
  // D16.3 : 260 particules en tableaux typés alloués une fois ; retrait par permutation avec la dernière.
  const { F, sprites } = await fireflies();
  assert.equal(F.capacity, 260);
  const arrays = ownTypedArrays(F);
  assert.ok(arrays.size >= 4, `tableaux typés attendus, trouvé ${[...arrays.keys()].join(', ')}`);
  for (const v of arrays.values()) assert.ok((v as Float32Array).length % 260 === 0, 'tableaux dimensionnés sur 260');
  for (let round = 0; round < 6; round++) {
    let x = 100;
    F.pointerMove({ x, y: 200, t: 1e4 * (round + 1), pointerType: 'mouse' });
    for (let i = 1; i <= 80; i++) {
      x += 100;
      F.pointerMove({ x, y: 200 + (i % 7), t: 1e4 * (round + 1) + 10 * i, pointerType: 'mouse' });
      assert.ok(F.live <= 260, `live = ${F.live} > 260`);
      if (i % 5 === 0) F.step(1 / 60);
    }
    if (round === 0) assert.equal(F.live >= 250, true, `le pool doit se remplir, live = ${F.live}`);
    for (const [k, v] of ownTypedArrays(F)) assert.equal(v, arrays.get(k), `tableau ${k} réalloué`);
    for (let i = 0; i < 100; i++) F.step(1 / 60);
    assert.equal(F.live, 0, 'toutes les lucioles meurent en moins de 1,7 s (life −= decay·dt·60, decay ≥ 0,012)');
    assert.equal(drawLog(F, sprites).drawn.length, 0, 'rien à dessiner');
  }
});

test('D16.3 : draw n\'appelle que drawImage (aucun createRadialGradient), alpha = life², taille 8r ∈ [8, 25,6], naissance sur le segment parcouru', async () => {
  // D16.3 : dessin par sprites précalculés, mode lighter.
  const { F, sprites, made } = await fireflies(12);
  F.pointerMove({ x: 400, y: 250, t: 2000, pointerType: 'mouse' });
  F.pointerMove({ x: 300, y: 250, t: 2010, pointerType: 'mouse' }); // v = 10 → 6
  const { drawn, methods } = drawLog(F, sprites);
  assert.deepEqual(methods, ['drawImage'], `draw ne doit appeler que drawImage, reçu ${methods.join(', ')}`);
  assert.equal(drawn.length, 6);
  for (const d of drawn) {
    assert.ok(made.includes(d.img as FakeCanvas), 'drawImage doit dessiner un sprite de createSprites');
    assert.equal(d.alpha, 1, 'life = 1 à la naissance : alpha 1');
    assert.ok(d.size >= 8 - 1e-9 && d.size <= 25.6 + 1e-9, `taille ${d.size} hors de [8, 25,6] (rayon 4r, r ∈ [1, 3,2])`);
    assert.ok(d.cx >= 300 - 1e-6 && d.cx <= 400 + 1e-6 && Math.abs(d.cy - 250) < 1e-6, `naissance hors du segment parcouru : (${d.cx}, ${d.cy})`);
  }
});

test('D16.3 : intégration ramenée à 60 i/s : x += vx·dt·60, vx *= 0,96^(dt·60), vy = vy·0,96^(dt·60) − 0,01·dt·60, life −= decay·dt·60', async () => {
  // D16.3 : prédiction d'une seconde étape (dt = 1/30) à partir de la première (dt = 1/60), à 1e-6 près.
  const { F, sprites } = await fireflies(21);
  F.pointerMove({ x: 500, y: 400, t: 3000, pointerType: 'mouse' });
  F.pointerMove({ x: 600, y: 400, t: 3010, pointerType: 'mouse' }); // dx/dt = 10 px/ms
  const d0 = drawLog(F, sprites).drawn;
  F.step(1 / 60);
  const d1 = drawLog(F, sprites).drawn;
  F.step(1 / 30);
  const d2 = drawLog(F, sprites).drawn;
  assert.equal(d0.length, 6);
  assert.equal(d1.length, 6);
  assert.equal(d2.length, 6);
  const k1 = 1;
  const k2 = 2;
  d0.forEach((p0, i) => {
    const p1 = d1[i] as Drawn;
    const p2 = d2[i] as Drawn;
    assert.ok(Math.abs(p1.size - p0.size) < 1e-9 && Math.abs(p2.size - p0.size) < 1e-9, 'le rayon ne change pas');
    const life1 = Math.sqrt(p1.alpha);
    const decay = (1 - life1) / k1;
    assert.ok(decay >= 0.012 - 1e-9 && decay <= 0.032 + 1e-9, `decay ${decay} hors de [0,012 ; 0,032]`);
    const vx0 = (p1.cx - p0.cx) / k1;
    const vy0 = (p1.cy - p0.cy) / k1;
    assert.ok(vx0 >= -0.8 - 0.3 - 1e-9 && vx0 <= -0.8 + 0.3 + 1e-9, `vx initiale ${vx0} hors de −dx/dt·0,08 ± 0,3`);
    assert.ok(vy0 >= -0.55 - 1e-9 && vy0 <= 0.05 + 1e-9, `vy initiale ${vy0} hors de [−0,55 ; 0,05]`);
    const life2 = life1 - decay * k2;
    assert.ok(Math.abs(Math.sqrt(p2.alpha) - life2) < 1e-6, `life après dt = 1/30 : ${Math.sqrt(p2.alpha)}, attendu ${life2}`);
    const x2 = p1.cx + vx0 * 0.96 ** k1 * k2;
    const y2 = p1.cy + (vy0 * 0.96 ** k1 - 0.01 * k1) * k2;
    assert.ok(Math.abs(p2.cx - x2) < 1e-6, `x après dt = 1/30 : ${p2.cx}, attendu ${x2}`);
    assert.ok(Math.abs(p2.cy - y2) < 1e-6, `y après dt = 1/30 : ${p2.cy}, attendu ${y2}`);
  });
});

test('D16.3 : couleur sap0 si r < 0,7, sinon leaf1 : environ 70 % de sprites sap0 sur 260 lucioles', async () => {
  // D16.3 : proto:1001.
  const { F, sprites, made, pal } = await fireflies(33, 'givre');
  sweep(F, 60, 10);
  assert.equal(F.live, 260);
  const sap0 = hex3(pal.sap[0]);
  const isSap = (img: unknown): boolean => {
    const c = (img as FakeCanvas).fake.gradients[0]?.stops[0]?.[1];
    const rgba = c ? parseCssColor(c) : null;
    return !!rgba && sap0.every((v, i) => Math.abs(v - (rgba[i] as number)) < 1e-3);
  };
  const { drawn } = drawLog(F, sprites);
  const share = drawn.filter((d) => isSap(d.img)).length / drawn.length;
  assert.ok(share > 0.6 && share < 0.8, `part de sap0 : ${share}`);
  assert.ok(made.length >= 2);
});

test('D16.3 : createSprites rend un sprite par couleur (sap0, leaf1) : dégradé radial 0 : c, 0,25 : c à 0,667, 1 : c à 0', async () => {
  // D16.3 : sprites rendus une fois par palette ; aucun dégradé ensuite.
  const { createSprites } = await firefliesMod();
  for (const pid of ['sous-bois', 'ardoise']) {
    const pal = await palette(pid);
    const { make, made } = fakeCanvasFactory();
    createSprites(pal, make);
    const grads = made.flatMap((c) => c.fake.gradients);
    assert.equal(grads.length, 2, `${pid} : deux dégradés (un par couleur), reçu ${grads.length}`);
    const colorsSeen: string[] = [];
    for (const g of grads) {
      assert.deepEqual(g.stops.map((s) => s[0]), [0, 0.25, 1], `${pid} : arrêts du dégradé`);
      const rgba = g.stops.map((s) => parseCssColor(s[1]));
      assert.ok(rgba.every(Boolean), `${pid} : couleurs illisibles ${JSON.stringify(g.stops)}`);
      const [a, b, c] = rgba as [number, number, number, number][];
      assert.ok(Math.abs(a[3] - 1) < 1e-3 && Math.abs(b[3] - 0.667) < 2e-3 && Math.abs(c[3]) < 1e-3, `${pid} : alphas ${a[3]}, ${b[3]}, ${c[3]}`);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-3 && Math.abs(a[i] - c[i]) < 1e-3, 'même teinte aux trois arrêts');
      colorsSeen.push(a.slice(0, 3).map((v) => Math.round(v * 255)).join(','));
    }
    const want = [hex3(pal.sap[0]), hex3(pal.leaf[1])].map((c) => c.map((v) => Math.round(v * 255)).join(',')).sort();
    assert.deepEqual(colorsSeen.sort(), want, `${pid} : couleurs des sprites`);
  }
});

test('D16.3 : lucioles déterministes pour une graine (flux SCENE_STREAMS.fireflies)', async () => {
  // D16.3 : même suite d'événements, même dessin.
  const run = async (seed: number): Promise<string> => {
    const { F, sprites } = await fireflies(seed);
    sweep(F, 10, 4);
    F.step(1 / 60);
    return JSON.stringify(drawLog(F, sprites).drawn.map((d) => [d.cx, d.cy, d.size, d.alpha]));
  };
  assert.equal(await run(8), await run(8));
  assert.notEqual(await run(8), await run(9));
});

// ================= D16.4 : ASCII =================

const RAMP = " .'`:-=+*o#%@";

function refCell(r: number, g: number, b: number): { idx: number; color: number[] } | null {
  const m = Math.max(r, g, b);
  if (m < 14) return null;
  const l = (m / 255) ** 0.8;
  const idx = Math.min(12, 1 + Math.floor(l * 12));
  const s = ((0.55 + 0.45 * l) * 255) / m;
  return { idx, color: [(r * s) | 0, (g * s) | 0, (b * s) | 0] };
}

function readCell(res: Mod): { idx: number; color: number[] } {
  const ch = res.char ?? res.ch;
  const idx = typeof res.idx === 'number' ? res.idx : typeof res.index === 'number' ? res.index : RAMP.indexOf(ch);
  if (typeof ch === 'string') assert.equal(ch, RAMP[idx], 'caractère = RAMP[idx]');
  const c = res.color ?? res.rgb ?? [res.r, res.g, res.b];
  return { idx, color: Array.from(c as number[]) };
}

test('D16.4 : rampe exacte " .\'`:-=+*o#%@"', async () => {
  // D16.4 : 13 caractères.
  const { RAMP: ramp } = await asciiMod();
  assert.equal(ramp, RAMP);
});

test('D16.4 : asciiCell : null si max < 14 (13 → null, 14 → caractère), idx et couleur exacts sur des pixels d\'exemple', async () => {
  // D16.4 : l = (m/255)^0,8 ; idx = min(12, 1 + floor(l·12)) ; s = (0,55 + 0,45·l)·255/m ; couleur tronquée.
  const { asciiCell } = await asciiMod();
  for (const px of [[0, 0, 0], [13, 13, 13], [13, 0, 2]]) assert.equal(asciiCell(...px), null, `pixel ${px}`);
  const samples = [[14, 0, 0], [0, 14, 9], [255, 255, 255], [200, 100, 50], [37, 120, 250], [255, 0, 128], [60, 61, 59], [128, 128, 0], [90, 200, 17]];
  const idxSeen = new Set<number>();
  for (const px of samples) {
    const want = refCell(px[0] as number, px[1] as number, px[2] as number);
    const got = asciiCell(...px);
    assert.ok(got, `pixel ${px} : cellule attendue`);
    assert.deepEqual(readCell(got), want, `pixel ${px}`);
    idxSeen.add(want?.idx ?? -1);
  }
  assert.ok(idxSeen.size >= 5, 'les exemples couvrent plusieurs caractères');
});

test('D16.4 : grille : cellules 6×10 sur phone, 7×12 sur desktop ; cols = ceil(w/CW), rows = ceil(h/CH)', async () => {
  // D16.4 : proto:966–967.
  const { asciiGrid } = await asciiMod();
  const cases: [number, number, 'phone' | 'desktop', number, number][] = [
    [1440, 900, 'desktop', 206, 75], [1441, 901, 'desktop', 206, 76], [1400, 840, 'desktop', 200, 70],
    [390, 844, 'phone', 65, 85], [391, 841, 'phone', 66, 85], [360, 800, 'phone', 60, 80],
  ];
  for (const [w, h, profile, cols, rows] of cases) {
    const g = asciiGrid(w, h, profile);
    assert.equal(g.cols, cols, `${w}×${h} ${profile} : cols`);
    assert.equal(g.rows, rows, `${w}×${h} ${profile} : rows`);
  }
});

test('D16.4 : due(now, last) donne une cadence de 20 i/s (40 ± 4 images en 2 s sur un écran à 60 Hz)', async () => {
  // D16.4 : cadence de l'ASCII, indépendante de la fréquence d'affichage.
  const { due } = await asciiMod();
  for (const hz of [60, 120]) {
    let last = -Infinity;
    let count = 0;
    for (let i = 0; i < 2 * hz; i++) {
      const now = 5000 + (i * 1000) / hz;
      if (due(now, last)) {
        count++;
        last = now;
      }
    }
    assert.ok(count >= 36 && count <= 44, `${hz} Hz : ${count} images ASCII en 2 s, attendu 40 ± 4`);
  }
  assert.equal(due(1000, 1000), false, 'pas deux images ASCII au même instant');
  assert.equal(due(1100, 1000), true, '100 ms après : due');
});
