// Contrat G (lot 2a, décision du 22/11/2026) : la rotation au repos s'arrête d'elle-même.
// idleStep attend 2,5 s, tourne à 0,06 rad/s pendant 20 s au plus, puis ne tourne plus jusqu'à la prochaine interaction.
// Les attentes sont écrites en littéraux (2,5 ; 20 ; 22,5 ; 0,06) et décidées sur une horloge propre au test (cumul des
// dt depuis la dernière interaction), jamais sur le compteur `idle` renvoyé : il est seulement réinjecté, comme le fait
// la scène. Zones d'ombre d'un pas autour de 2,5 s et 22,5 s (avant ou après incrément), comme D9.5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraMod } from './helpers-scene.ts';

const DELAY = 2.5;
const STOP = 20;
const END = DELAY + STOP; // 22,5 s
const SPEED = 0.06;
const MAX_ANGLE = STOP * SPEED; // 1,2 rad
const FRAME_MAX = 0.05; // plafond du pas d'image de la scène (scene.ts : Math.min(0.05, …))
const TOL = FRAME_MAX * SPEED + 1e-9; // « à un pas d'image près » : 0,003 rad (plus l'erreur d'arrondi du cumul des dt)

type Step = (o: { idle: number; dt: number; active: boolean; reducedMotion: boolean }) => { idle: number; dRot: number };

// Générateur déterministe (mulberry32) pour les pas irréguliers.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Trace = { total: number; steps: { t0: number; t1: number; dt: number; dRot: number }[]; idle: number };

// Simule un repos découpé en pas `dts`, en partant du compteur `idle` (0 après une interaction).
function rest(idleStep: Step, dts: number[], { idle = 0, reducedMotion = false } = {}): Trace {
  let t = 0;
  let total = 0;
  const steps: Trace['steps'] = [];
  for (const dt of dts) {
    const r = idleStep({ idle, dt, active: false, reducedMotion });
    idle = r.idle;
    steps.push({ t0: t, t1: t + dt, dt, dRot: r.dRot });
    total += r.dRot;
    t += dt;
  }
  return { total, steps, idle };
}

const fixed = (dt: number, seconds: number): number[] => Array.from({ length: Math.round(seconds / dt) }, () => dt);
function irregular(seed: number, seconds: number): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let t = 0;
  while (t < seconds) {
    // Entre 1/144 s et 0,05 s, avec des à-coups au plafond de la scène.
    const dt = r() < 0.08 ? FRAME_MAX : 1 / 144 + r() * (FRAME_MAX - 1 / 144);
    out.push(dt);
    t += dt;
  }
  return out;
}

// Vérifie un repos complet : rien avant 2,5 s, dt·0,06 strictement dans la fenêtre, 0 après 22,5 s, total ≈ 1,2 rad.
function checkCycle(tr: Trace, label: string): void {
  const maxDt = Math.max(...tr.steps.map((s) => s.dt));
  for (const s of tr.steps) {
    if (s.t1 < DELAY - 1e-9) assert.equal(s.dRot, 0, `${label} : rotation avant 2,5 s de repos (pas ${s.t0.toFixed(3)}–${s.t1.toFixed(3)} s : ${s.dRot})`);
    else if (s.t0 > DELAY + maxDt && s.t1 < END - maxDt) {
      assert.ok(Math.abs(s.dRot - s.dt * SPEED) <= 1e-12, `${label} : rotation de ${s.dRot} au lieu de dt·0,06 = ${s.dt * SPEED} à ${s.t0.toFixed(3)} s de repos`);
    } else if (s.t0 > END + maxDt) {
      assert.equal(s.dRot, 0, `${label} : la rotation au repos continue après 22,5 s (pas ${s.t0.toFixed(3)}–${s.t1.toFixed(3)} s : dRot ${s.dRot})`);
    }
  }
  assert.ok(tr.total <= MAX_ANGLE + TOL, `${label} : angle parcouru pendant le repos ${tr.total.toFixed(4)} rad, plafond 20 × 0,06 = 1,2 rad (± ${TOL})`);
  assert.ok(tr.total >= MAX_ANGLE - TOL, `${label} : angle parcouru pendant le repos ${tr.total.toFixed(4)} rad, attendu 1,2 rad (20 s à 0,06 rad/s)`);
}

test('G2 : 60 s de repos à 60 Hz : rien avant 2,5 s, 0,06 rad/s jusqu\'à 22,5 s, puis dRot === 0 ; angle total 1,2 rad à un pas près', async () => {
  const { idleStep } = await cameraMod();
  checkCycle(rest(idleStep, fixed(1 / 60, 60)), '60 Hz');
});

test('G2 : 60 s de repos à 30 Hz et au plafond de la scène (0,05 s) : même cycle, angle total 1,2 rad à un pas près', async () => {
  const { idleStep } = await cameraMod();
  checkCycle(rest(idleStep, fixed(1 / 30, 60)), '30 Hz');
  checkCycle(rest(idleStep, fixed(FRAME_MAX, 60)), '20 Hz (pas de 0,05 s)');
});

test('G2 : pas irréguliers (1/144 s à 0,05 s, trois graines) : même cycle, angle total 1,2 rad à un pas près', async () => {
  const { idleStep } = await cameraMod();
  for (const seed of [1, 42, 20261122]) checkCycle(rest(idleStep, irregular(seed, 60)), `pas irréguliers (graine ${seed})`);
});

test('G2 : repos très long (10 min à 60 Hz, puis compteur de 1e6 s) : plus aucune rotation après 22,5 s', async () => {
  const { idleStep } = await cameraMod();
  const tr = rest(idleStep, fixed(1 / 60, 600));
  const late = tr.steps.filter((s) => s.t0 > END + 1 / 60);
  const moving = late.filter((s) => s.dRot !== 0);
  assert.equal(moving.length, 0, `la rotation au repos continue après 22,5 s : ${moving.length} pas sur ${late.length} tournent encore, angle total ${tr.total.toFixed(3)} rad`);
  for (const idle of [END + 0.1, 30, 1e6]) {
    for (const dt of [1 / 60, FRAME_MAX]) {
      const r = idleStep({ idle, dt, active: false, reducedMotion: false });
      assert.equal(r.dRot, 0, `idleStep({ idle: ${idle}, dt: ${dt} }) tourne encore (dRot ${r.dRot})`);
    }
  }
});

test('G2 : pas très longs (un pas de 30 s, un pas de 15 s en plein cycle, pas de 1 s et de 7 s) : l\'angle total ne dépasse jamais 1,2 rad (borne haute seule)', async () => {
  // Point mal spécifié : pour un pas plus long que le plafond de la scène, le contrat ne dit pas si la fenêtre traversée
  // doit être rattrapée d'un coup ou ignorée. Seul le plafond « 1,2 rad à un pas d'image (0,05 s) près » est exigé.
  const { idleStep } = await cameraMod();
  const cases: [string, number[]][] = [
    ['un seul pas de 30 s', [30]],
    ['un pas de 22 s puis 60 Hz', [22, ...fixed(1 / 60, 30)]],
    ['60 Hz jusqu\'à 10 s, un pas de 15 s, puis 60 Hz', [...fixed(1 / 60, 10), 15, ...fixed(1 / 60, 30)]],
    ['pas de 1 s pendant 60 s', fixed(1, 60)],
    ['pas de 7 s pendant 63 s', fixed(7, 63)],
  ];
  for (const [label, dts] of cases) {
    const tr = rest(idleStep, dts);
    assert.ok(tr.total <= MAX_ANGLE + TOL, `${label} : angle parcouru ${tr.total.toFixed(4)} rad, plafond 1,2 rad (± ${TOL})`);
    for (const s of tr.steps) if (s.t0 > END + 1e-9) assert.equal(s.dRot, 0, `${label} : rotation après 22,5 s de repos (pas ${s.t0}–${s.t1} s : ${s.dRot})`);
  }
});

test('G3 : une interaction en pleine rotation (10 s), après l\'arrêt (40 s) ou maintenue 60 s relance un cycle complet : 2,5 s d\'attente, 20 s de rotation, arrêt', async () => {
  const { idleStep } = await cameraMod();
  const interact = (idle: number, n = 1): number => {
    for (let k = 0; k < n; k++) {
      const r = idleStep({ idle, dt: 1 / 60, active: true, reducedMotion: false });
      assert.deepEqual({ idle: r.idle, dRot: r.dRot }, { idle: 0, dRot: 0 }, 'interaction : compteur à 0, pas de rotation');
      idle = r.idle;
    }
    return idle;
  };
  for (const [label, before, hold] of [
    ['en pleine rotation', 10, 1],
    ['après l\'arrêt', 40, 1],
    ['maintenue 60 s (sélection ouverte) après l\'arrêt', 40, 3600],
  ] as const) {
    const first = rest(idleStep, fixed(1 / 60, before));
    const idle = interact(first.idle, hold);
    checkCycle(rest(idleStep, fixed(1 / 60, 60), { idle }), `cycle relancé (interaction ${label})`);
  }
  // Trois cycles enchaînés, chacun suivi d'une interaction : 1,2 rad par cycle, jamais plus.
  let idle = 0;
  for (let k = 0; k < 3; k++) {
    const tr = rest(idleStep, fixed(1 / 60, 30), { idle });
    checkCycle(tr, `cycle ${k + 1} sur 3`);
    idle = interact(tr.idle);
  }
});

test('G4 (témoin, vert) : mouvement réduit : 60 s de repos à 60 Hz et pas irréguliers, aucune rotation', async () => {
  const { idleStep } = await cameraMod();
  for (const [label, dts] of [['60 Hz', fixed(1 / 60, 60)], ['pas irréguliers', irregular(7, 60)]] as const) {
    const tr = rest(idleStep, dts, { reducedMotion: true });
    assert.equal(tr.total, 0, `${label} : rotation en mouvement réduit (${tr.total} rad)`);
  }
});

test('G (témoin, vert) : avant 22,5 s de repos, la rotation reste celle de D9.5 (0,06 rad/s à partir de 2,5 s, 1,2 rad à 22,4 s)', async () => {
  // Garde contre un arrêt trop tôt : les 20 s de rotation sont dues en entier.
  const { idleStep } = await cameraMod();
  const tr = rest(idleStep, fixed(1 / 60, 22.4));
  const want = (22.4 - DELAY) * SPEED;
  assert.ok(Math.abs(tr.total - want) <= TOL, `à 22,4 s de repos : ${tr.total.toFixed(4)} rad, attendu ${want.toFixed(4)} rad`);
});
