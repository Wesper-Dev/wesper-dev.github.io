// Contrat D9 (lot 1c) : lib/tree/camera.ts, caméra pure (cadrage, orientation, verrou de geste, lissage, rotation au repos).
// Chaque valeur est recalculée ici à partir des formules du contrat (proto:796–808, 853–855, 1093).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraMod } from './helpers-scene.ts';

type Bounds = { min: [number, number, number]; max: [number, number, number] };

// Cadrage de référence : boîte élargie de 0,6 de chaque côté (proto:796–803).
function refFrame(b: Bounds, aspect: number, profile: 'phone' | 'desktop'): { fov: number; r: number; y: number; look: number } {
  const fov = aspect < 0.8 ? 58 : 40;
  const min = b.min.map((v) => v - 0.6);
  const max = b.max.map((v) => v + 0.6);
  const H = (max[1] as number) - (min[1] as number);
  const W = Math.max((max[0] as number) - (min[0] as number), (max[2] as number) - (min[2] as number));
  const vf = ((fov * Math.PI) / 180) / 2;
  const hf = Math.atan(Math.tan(vf) * aspect);
  const [uH, uW] = profile === 'phone' ? [0.6, 0.95] : [0.82, 0.42];
  const r = Math.max(H / 2 / Math.tan(vf) / uH, W / 2 / Math.tan(hf) / uW) + 0.3 * W;
  const mid = ((max[1] as number) + (min[1] as number)) / 2;
  const look = profile === 'phone' ? mid - 0.16 * H : mid;
  return { fov, r, y: look + 1.2, look };
}

const BOXES: Bounds[] = [
  { min: [-10.16, -3.57, -6.31], max: [5.23, 15.71, 9.27] }, // proche d'un chêne simple
  { min: [-2, 0, -1], max: [3, 4, 7] }, // boîte large et basse : la contrainte horizontale domine
];

test('D9 : fovFor vaut 58 si aspect < 0,8, 40 sinon (borne 0,8 comprise dans 40)', async () => {
  // D9 : proto:808.
  const { fovFor } = await cameraMod();
  assert.equal(fovFor(0.5), 58);
  assert.equal(fovFor(0.7999), 58);
  assert.equal(fovFor(0.8), 40);
  assert.equal(fovFor(1.6), 40);
});

test('D9.1 : frameCamera recalculé à 1e-9 près sur deux boîtes synthétiques, deux profils et trois rapports d\'aspect', async () => {
  // D9.1 : H, W, vf, hf, r, look, y du contrat.
  const { frameCamera } = await cameraMod();
  for (const b of BOXES) {
    for (const profile of ['phone', 'desktop'] as const) {
      for (const aspect of [0.4621, 1, 1.6]) {
        const got = frameCamera(b, aspect, profile);
        const want = refFrame(b, aspect, profile);
        for (const k of ['fov', 'r', 'y', 'look'] as const) {
          assert.ok(Math.abs(got[k] - want[k]) <= 1e-9, `${profile}, aspect ${aspect}, boîte ${JSON.stringify(b)} : ${k} = ${got[k]}, attendu ${want[k]}`);
        }
      }
    }
  }
});

test('D9.1 : frameCamera sur une boîte calculée à la main (desktop, aspect 1)', async () => {
  // D9.1 : boîte [−1,0,−1]–[1,10,1] : H = 11,2, W = 3,2, vf = hf = 20°, r = 5,6/tan20°/0,82 + 0,96.
  const { frameCamera } = await cameraMod();
  const got = frameCamera({ min: [-1, 0, -1], max: [1, 10, 1] }, 1, 'desktop');
  const t20 = Math.tan(Math.PI / 9);
  const r = Math.max(5.6 / t20 / 0.82, 1.6 / t20 / 0.42) + 0.96;
  assert.ok(Math.abs(got.r - r) <= 1e-9, `r = ${got.r}, attendu ${r}`);
  assert.ok(Math.abs(got.look - 5) <= 1e-9);
  assert.ok(Math.abs(got.y - 6.2) <= 1e-9);
  assert.equal(got.fov, 40);
  const phone = frameCamera({ min: [-1, 0, -1], max: [1, 10, 1] }, 1, 'phone');
  assert.ok(Math.abs(phone.look - (5 - 0.16 * 11.2)) <= 1e-9, `look phone = ${phone.look}`);
});

test('D9.2 : orientToward somme x et z, renvoie null si hypot ≤ 0,3, sinon −atan2(x, z) + 0,25 ramené à moins de π de current', async () => {
  // D9.2 : proto:853–855.
  const { orientToward } = await cameraMod();
  assert.equal(orientToward([[0.1, 5, 0.1], [0.1, 2, 0.1]], 0), null, 'hypot 0,28 → null');
  assert.equal(orientToward([[0.3, 1, 0]], 0), null, 'hypot exactement 0,3 → null');
  assert.equal(orientToward([], 1), null);
  const cases: [number[][], number][] = [
    [[[1, 0, 2], [0.5, 3, -1]], 0],
    [[[-3, 0, 0.2]], 0.6],
    [[[2, 9, -2], [1, 1, -0.5]], 25.3],
    [[[0, 0, -4]], -17.9],
  ];
  for (const [pts, cur] of cases) {
    const x = pts.reduce((s, p) => s + (p[0] as number), 0);
    const z = pts.reduce((s, p) => s + (p[2] as number), 0);
    const base = -Math.atan2(x, z) + 0.25;
    const got = orientToward(pts, cur) as number;
    assert.equal(typeof got, 'number');
    assert.ok(Math.abs(got - cur) <= Math.PI + 1e-12, `|a − current| ≤ π : a = ${got}, current = ${cur}`);
    const k = (got - base) / (2 * Math.PI);
    assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `a doit être congru à ${base} modulo 2π, reçu ${got}`);
  }
});

test('D9.3 : gestureLock : rotate si |dx| > |dy| et |dx| > 6 ; scroll si |dy| ≥ |dx| et |dy| > 6 ; pending sinon', async () => {
  // D9.3 : bornes exactes (6 n'engage pas, l'égalité |dx| = |dy| fait défiler).
  const { gestureLock } = await cameraMod();
  const cases: [number, number, string][] = [
    [0, 0, 'pending'], [6, 0, 'pending'], [-6, 2, 'pending'], [0, 6, 'pending'], [6, 6, 'pending'],
    [6.01, 0, 'rotate'], [-7, 3, 'rotate'], [20, -19.9, 'rotate'],
    [0, 6.01, 'scroll'], [3, -7, 'scroll'], [7, 7, 'scroll'], [-6.5, 6.5, 'scroll'], [19.9, -20, 'scroll'],
  ];
  for (const [dx, dy, want] of cases) assert.equal(gestureLock(dx, dy), want, `gestureLock(${dx}, ${dy})`);
});

test('D9.4 : smoothing(dt, τ) = 1 − exp(−dt/τ), composable : 1 − (1 − s(dt/2))² = s(dt) à 1e-12, et 0,08 ± 2e-3 pour τ = 0,2 et dt = 1/60', async () => {
  // D9.4 : indépendance vis-à-vis de la cadence.
  const { smoothing } = await cameraMod();
  for (const tau of [0.2, 0.325, 1.7]) {
    for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.05]) {
      const s = smoothing(dt, tau);
      assert.ok(Math.abs(s - (1 - Math.exp(-dt / tau))) <= 1e-12, `smoothing(${dt}, ${tau}) = ${s}`);
      const h = smoothing(dt / 2, tau);
      assert.ok(Math.abs(1 - (1 - h) ** 2 - s) <= 1e-12, `composition dt/2 pour τ = ${tau}, dt = ${dt}`);
    }
  }
  assert.ok(Math.abs(smoothing(1 / 60, 0.2) - 0.08) <= 2e-3);
  assert.equal(smoothing(0, 0.2), 0);
});

test('D9 (mis à jour G1) : CAMERA vaut exactement les constantes du contrat, dont idleStop 20', async () => {
  // D9 : rotStart 0,6, drag 0,006, arrow 0,35, idleDelay 2,5, idleSpeed 0,06, tauRot, tauHi 0,2, tauCam 0,325, near 0,1, far 200.
  // G1 (22/11/2026) : idleStop 20 s de rotation au repos ; les autres constantes ne changent pas.
  const { CAMERA } = await cameraMod();
  assert.deepEqual({ ...CAMERA }, { rotStart: 0.6, drag: 0.006, arrow: 0.35, idleDelay: 2.5, idleSpeed: 0.06, idleStop: 20, tauRot: 0.2, tauHi: 0.2, tauCam: 0.325, near: 0.1, far: 200 });
});

test('D9.5 : idleStep tourne de dt·0,06 au-delà de 2,5 s de repos, rien avant, et repart à 0 à chaque interaction', async () => {
  // D9.5 : proto:1093 ; en dehors de la borne exacte de 2,5 s (zone d'ombre : avant ou après incrément).
  const { idleStep } = await cameraMod();
  for (const dt of [1 / 60, 0.05]) {
    const a = idleStep({ idle: 3, dt, active: false, reducedMotion: false });
    assert.ok(Math.abs(a.dRot - dt * 0.06) <= 1e-15, `dRot attendu ${dt * 0.06}, reçu ${a.dRot}`);
    assert.ok(Math.abs(a.idle - (3 + dt)) <= 1e-12, 'le compteur avance de dt');
    const b = idleStep({ idle: 1, dt, active: false, reducedMotion: false });
    assert.equal(b.dRot, 0, 'pas de rotation avant 2,5 s');
    assert.ok(Math.abs(b.idle - (1 + dt)) <= 1e-12);
    const c = idleStep({ idle: 10, dt, active: true, reducedMotion: false });
    assert.deepEqual({ idle: c.idle, dRot: c.dRot }, { idle: 0, dRot: 0 }, 'interaction : compteur à 0, pas de rotation');
  }
  // Simulation : 2,4 s de repos sans rotation, puis rotation continue.
  let idle = 0;
  let rot = 0;
  for (let i = 0; i < 60 * 4; i++) {
    const r = idleStep({ idle, dt: 1 / 60, active: false, reducedMotion: false });
    idle = r.idle;
    rot += r.dRot;
    if (i < 60 * 2.4) assert.equal(rot, 0, `rotation avant 2,5 s (image ${i})`);
  }
  assert.ok(Math.abs(rot - 0.06 * 1.5) < 0.06 * 0.04, `≈ 1,5 s de rotation à 0,06 rad/s, reçu ${rot}`);
});
