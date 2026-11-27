// Audit contradictoire Fable du lot 2a, point F4 (arbitrage-audit-lot2a-fable.md) : la garde de cadence
// (lib/tree/guard.ts) ne doit pas confondre deux à-coups isolés du fil principal avec une lenteur continue.
// Constat de l'audit (C4) : deux blocages de 1,7 s séparés de 760 ms, cadence de 60 images/s, déclenchent le repli fps.
// Les tests fixent le résultat (verdict) sans imposer l'algorithme ; la lenteur continue reste un témoin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardMod } from './helpers-scene.ts';

// Série d'horodatages à cadence fixe ; après chaque indice de `hitches`, l'intervalle suivant dure `hitchMs`.
function series(n: number, fps: number, hitches: number[] = [], hitchMs = 1700, t0 = 8000): number[] {
  const out: number[] = [];
  let t = t0;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += hitches.includes(i) ? hitchMs : 1000 / fps;
  }
  return out;
}

async function run(ts: number[]): Promise<string[]> {
  const { createFpsGuard } = await guardMod();
  const g = createFpsGuard();
  return ts.map((t) => g.push(t) as string);
}

test('F4 : deux à-coups isolés de 1,7 s, séparés d\'environ 760 ms, à 60 images/s, ne déclenchent jamais fail, où qu\'ils tombent', async () => {
  // Audit C4 : 760 ms à 60 images/s = 45 à 46 images entre les deux blocages. On balaie la position du premier blocage
  // sur deux fenêtres de la garde actuelle (0 à 89) et l'écart de 44 à 47 images (≈ 730 à 780 ms).
  const failures: string[] = [];
  for (let first = 0; first < 90; first++) {
    for (const gap of [44, 45, 46, 47]) {
      const out = await run(series(400, 60, [first + 30, first + 30 + gap]));
      const f = out.indexOf('fail');
      if (f >= 0) failures.push(`premier à-coup après l'image ${first + 31}, écart ${gap} images : fail à l'image ${f + 1}`);
    }
  }
  assert.deepEqual(failures.slice(0, 6), [], `${failures.length}/360 placements donnent fail (repli fps pour deux à-coups) ; premiers : voir ci-dessus`);
});

test('F4 : après deux à-coups isolés, la garde revient à ok (la cadence de 60 images/s est reconnue)', async () => {
  // Résultat attendu : pas de repli, et la mesure continue normalement après les blocages.
  const out = await run(series(400, 60, [60, 106]));
  assert.ok(!out.includes('fail'), `fail à l'image ${out.indexOf('fail') + 1}`);
  assert.equal(out.at(-1), 'ok', `verdict final ${out.at(-1)} au lieu de ok`);
});

test('F4 (témoin) : une lenteur continue d\'environ 18 images/s déclenche toujours fail, au plus tard à la 90ᵉ image (5 s)', async () => {
  // L'arbitrage exige que la lenteur continue garde son repli ; la borne reprend celle de D8.1 (arbitrage du 21/11).
  for (const fps of [18, 20, 25]) {
    const out = await run(series(200, fps));
    const f = out.indexOf('fail');
    assert.ok(f >= 0, `${fps} images/s : jamais fail en 200 images`);
    assert.ok(f <= 89, `${fps} images/s : fail seulement à l'image ${f + 1} (borne : 90ᵉ)`);
    assert.ok(!out.slice(0, f).includes('ok'), `${fps} images/s : ok donné avant fail`);
  }
});

test('F4 (témoin) : une lenteur continue à 18 images/s ponctuée d\'à-coups déclenche aussi fail, au plus tard à la 90ᵉ image', async () => {
  // Les à-coups ne doivent pas servir d'excuse à une lenteur réelle (moyen libre : écarter les valeurs aberrantes, etc.).
  for (const hitches of [[20], [20, 60], [10, 40, 70]]) {
    const out = await run(series(200, 18, hitches));
    const f = out.indexOf('fail');
    assert.ok(f >= 0 && f <= 89, `à-coups après ${JSON.stringify(hitches)} : fail à l'image ${f + 1} (attendu entre 1 et 90)`);
  }
});
