// Contrat B1 : lib/tree/rng.ts (mulberry32, deriveSeed, STREAMS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rngMod } from './helpers-tree.ts';

const take = (g: () => number, n: number): number[] => Array.from({ length: n }, () => g());

test('B1 : STREAMS contient exactement les cinq flux nommés', async () => {
  // B1 signature : STREAMS = { anchors, cloud, entry, color, sap }, valeur = clé.
  const { STREAMS } = await rngMod();
  assert.deepEqual({ ...STREAMS }, { anchors: 'anchors', cloud: 'cloud', entry: 'entry', color: 'color', sap: 'sap' }, `STREAMS reçu : ${JSON.stringify(STREAMS)}`);
});

test('B1.1 : mulberry32 reproduit exactement proto:271 (graines 7 et 0)', async () => {
  // B1.1 : valeurs exactes (===) figées par le contrat.
  const { mulberry32 } = await rngMod();
  const s7 = take(mulberry32(7), 3);
  assert.deepEqual(s7, [0.011704753153026104, 0.06195825757458806, 0.97690763277933], `graine 7, reçu ${JSON.stringify(s7)}`);
  const s0 = take(mulberry32(0), 3);
  assert.deepEqual(s0, [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197], `graine 0, reçu ${JSON.stringify(s0)}`);
});

test('B1.2 : 10⁵ tirages dans [0, 1)', async () => {
  // B1.2 : toute valeur tirée est dans [0, 1).
  const { mulberry32 } = await rngMod();
  for (const seed of [7, 123456789]) {
    const g = mulberry32(seed);
    for (let i = 0; i < 100000; i++) {
      const v = g();
      if (!(typeof v === 'number' && v >= 0 && v < 1)) assert.fail(`graine ${seed}, tirage ${i} hors de [0,1) : ${v}`);
    }
  }
});

test('B1.2 : mulberry32(s) et mulberry32(s + 2**32) donnent la même suite', async () => {
  // B1.2 : la graine est ramenée à un entier 32 bits.
  const { mulberry32 } = await rngMod();
  for (const s of [7, 0, 99991, 2147483000]) {
    const a = take(mulberry32(s), 20);
    const b = take(mulberry32(s + 2 ** 32), 20);
    assert.deepEqual(b, a, `graine ${s} : suites différentes avec s + 2**32`);
  }
});

test('B1.3 : instances indépendantes (aucun état global)', async () => {
  // B1.3 : créer et consommer un second générateur ne change pas la suite du premier.
  const { mulberry32 } = await rngMod();
  const ref = take(mulberry32(42), 10);
  const g1 = mulberry32(42);
  const first = take(g1, 3);
  const g2 = mulberry32(42);
  take(g2, 50);
  const g3 = mulberry32(1000);
  take(g3, 17);
  const rest = take(g1, 7);
  assert.deepEqual([...first, ...rest], ref, 'la suite du premier générateur a été perturbée par un autre');
  const g4 = mulberry32(42);
  assert.deepEqual(take(g4, 10), ref, 'une nouvelle instance de même graine doit repartir du début');
});

test('B1.4 : deriveSeed renvoie un entier de [0, 2³²), de façon déterministe', async () => {
  // B1.4 : entier non signé 32 bits, déterministe.
  const { deriveSeed, STREAMS } = await rngMod();
  for (const seed of [0, 1, 7, 8, 20, 4294967295, -3]) {
    for (const label of [...Object.values(STREAMS as Record<string, string>), 'autre', '']) {
      const v = deriveSeed(seed, label);
      assert.ok(Number.isInteger(v) && v >= 0 && v < 2 ** 32, `deriveSeed(${seed}, ${JSON.stringify(label)}) = ${v} hors de [0, 2³²)`);
      assert.equal(deriveSeed(seed, label), v, `deriveSeed(${seed}, ${label}) non déterministe`);
    }
  }
});

test('B1.4 : pour la graine 7, les cinq flux donnent cinq valeurs distinctes, toutes ≠ 7', async () => {
  // B1.4 : flux séparés.
  const { deriveSeed, STREAMS } = await rngMod();
  const labels = Object.values(STREAMS as Record<string, string>);
  assert.equal(labels.length, 5, `cinq flux attendus, reçu ${labels.length}`);
  const values = labels.map((l) => deriveSeed(7, l));
  assert.equal(new Set(values).size, 5, `valeurs non distinctes : ${JSON.stringify(values)}`);
  for (const v of values) assert.notEqual(v, 7, `un flux renvoie la graine elle-même : ${JSON.stringify(values)}`);
});

test('B1.4 : deriveSeed(7, l) !== deriveSeed(8, l) pour chaque flux', async () => {
  // B1.4 : la graine compte.
  const { deriveSeed, STREAMS } = await rngMod();
  for (const l of Object.values(STREAMS as Record<string, string>)) {
    assert.notEqual(deriveSeed(7, l), deriveSeed(8, l), `flux ${l} : même valeur pour les graines 7 et 8`);
  }
});

test('B1.4 : deux graines distantes de 2³¹ donnent des dérivés différents pour chaque flux', async () => {
  // Audit : le bit de poids fort de la graine disparaissait des cinq flux (7 et 2 147 483 655 identiques).
  const { deriveSeed, STREAMS } = await rngMod();
  const fails: string[] = [];
  for (const s of [7, 0, 1, 12345, 2 ** 30 + 3]) {
    for (const l of Object.values(STREAMS as Record<string, string>)) {
      if (deriveSeed(s, l) === deriveSeed(s + 2 ** 31, l)) fails.push(`${s} / ${s + 2 ** 31} sur ${l}`);
    }
  }
  assert.deepEqual(fails, [], `dérivés identiques : ${fails.join(', ')}`);
});
