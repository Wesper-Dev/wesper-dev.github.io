// Contrat B6 : lib/tree/labels.ts (partie pure) : projection, placement des étiquettes, infobulle, cache de tailles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelsMod, testRng } from './helpers-tree.ts';
import type { Mod } from './helpers-tree.ts';

type Item = { id: string; x: number; y: number; visible: boolean; side: 'left' | 'right'; width: number; height: number; priority?: number };
const item = (id: string, x: number, y: number, side: 'left' | 'right', width: number, height: number, priority?: number, visible = true): Item =>
  ({ id, x, y, visible, side, width, height, ...(priority === undefined ? {} : { priority }) });

// Violations des propriétés 4 (cadre) et 5 (recouvrement vertical ≤ 2 px si recouvrement horizontal > 0).
function violations(items: readonly Item[], out: Mod[], vp: { width: number; height: number }): string[] {
  const errs: string[] = [];
  const eps = 1e-6;
  const vis = out.map((o, i) => ({ o, w: items[i].width, h: items[i].height })).filter((x) => x.o.visible);
  for (const { o, w, h } of vis) {
    if (o.left < 8 - eps || o.left + w > vp.width - 8 + eps || o.top < 8 - eps || o.top + h > vp.height - 8 + eps) {
      errs.push(`${o.id} hors cadre (left ${o.left}, top ${o.top}, w ${w}, h ${h})`);
    }
  }
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i];
    const b = vis[j];
    const ox = Math.min(a.o.left + a.w, b.o.left + b.w) - Math.max(a.o.left, b.o.left);
    const oy = Math.min(a.o.top + a.h, b.o.top + b.h) - Math.max(a.o.top, b.o.top);
    if (ox > eps && oy > 2 + eps) errs.push(`${a.o.id} et ${b.o.id} se recouvrent (${ox.toFixed(2)} × ${oy.toFixed(2)} px)`);
  }
  return errs;
}

function scene(seed: number, n: number, vp: { width: number; height: number }): Item[] {
  const r = testRng(seed);
  return Array.from({ length: n }, (_, k) =>
    item(`e${String(k).padStart(2, '0')}`, r() * vp.width, r() * vp.height, r() < 0.5 ? 'left' : 'right', 60 + Math.floor(r() * 120), 18 + Math.floor(r() * 10), Math.floor(r() * 5)));
}

test('B6 : constantes LABEL_MARGIN = 8, LABEL_GAP = 6, LABEL_OVERLAP_TOLERANCE = 2', async () => {
  // B6 signature (proto:1067–1070, 1079).
  const m = await labelsMod();
  assert.deepEqual([m.LABEL_MARGIN, m.LABEL_GAP, m.LABEL_OVERLAP_TOLERANCE], [8, 6, 2], `reçu ${[m.LABEL_MARGIN, m.LABEL_GAP, m.LABEL_OVERLAP_TOLERANCE]}`);
});

test('B6.1 : projectToScreen (x, y en pixels, visible ⇔ −1 ≤ z < 1)', async () => {
  // B6.1 : formules de proto:1064–1065, 1071, bornes de z des deux côtés.
  const { projectToScreen } = await labelsMod();
  for (const vp of [{ width: 1200, height: 800 }, { width: 390, height: 844 }]) {
    const W = vp.width;
    const H = vp.height;
    for (const [nx, ny] of [[0, 0], [1, 1], [-1, -1], [0.5, -0.25], [-0.3, 0.7]]) {
      const p = projectToScreen([nx, ny, 0], vp);
      assert.ok(Math.abs(p.x - (nx * 0.5 + 0.5) * W) < 1e-9, `x pour ${nx} : ${p.x}`);
      assert.ok(Math.abs(p.y - (-ny * 0.5 + 0.5) * H) < 1e-9, `y pour ${ny} : ${p.y}`);
    }
  }
  const vp = { width: 100, height: 100 };
  const vis = (z: number): boolean => projectToScreen([0, 0, z], vp).visible;
  assert.equal(vis(-1), true, 'z = −1 doit être visible');
  assert.equal(vis(0.9999), true, 'z = 0,9999 doit être visible');
  assert.equal(vis(1), false, 'z = 1 ne doit pas être visible');
  assert.equal(vis(-1.0001), false, 'z = −1,0001 ne doit pas être visible');
  assert.equal(vis(1.5), false, 'z = 1,5 ne doit pas être visible');
});

test('B6.2 : étiquette seule au centre (right : left = x + 6 ; left : left = x + 6 − w ; top = y − h/2)', async () => {
  // B6.2, deux jeux de données.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 1200, height: 800 };
  for (const [x, y, w, h] of [[600, 400, 100, 24], [500, 300, 73, 19]]) {
    const [r] = layoutLabels([item('a', x, y, 'right', w, h)], vp);
    assert.deepEqual(r, { id: 'a', left: x + 6, top: y - h / 2, side: 'right', visible: true }, `côté droit : ${JSON.stringify(r)}`);
    const [l] = layoutLabels([item('a', x, y, 'left', w, h)], vp);
    assert.deepEqual(l, { id: 'a', left: x + 6 - w, top: y - h / 2, side: 'left', visible: true }, `côté gauche : ${JSON.stringify(l)}`);
  }
});

test('B6.3 : basculement de côté aux seuils exacts (W − 8 et 8)', async () => {
  // B6.3 : right → left si x + 6 + w > W − 8 ; left → right si x + 6 − w < 8 ; égalité = pas de bascule.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 1000, height: 600 };
  const one = (x: number, side: 'left' | 'right'): Mod => layoutLabels([item('a', x, 300, side, 100, 20)], vp)[0];
  let o = one(886, 'right');
  assert.deepEqual([o.side, o.left], ['right', 892], `x = 886 (égalité) : ${JSON.stringify(o)}`);
  o = one(887, 'right');
  assert.deepEqual([o.side, o.left], ['left', 793], `x = 887 : ${JSON.stringify(o)}`);
  o = one(102, 'left');
  assert.deepEqual([o.side, o.left], ['left', 8], `x = 102 (égalité) : ${JSON.stringify(o)}`);
  o = one(101, 'left');
  assert.deepEqual([o.side, o.left], ['right', 107], `x = 101 : ${JSON.stringify(o)}`);
});

test('B6.4 : bornage haut et bas (ancre à y = 0, à y = H, aux bords latéraux)', async () => {
  // B6.4 : 8 ≤ left, left + w ≤ W − 8, 8 ≤ top, top + h ≤ H − 8.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 900, height: 700 };
  const cases: Item[][] = [
    [item('haut', 400, 0, 'right', 120, 24)],
    [item('bas', 400, 700, 'left', 120, 24)],
    [item('coin', 0, 0, 'left', 200, 30)],
    [item('coin2', 900, 700, 'right', 200, 30)],
  ];
  for (const items of cases) {
    const out = layoutLabels(items, vp);
    assert.equal(out[0].visible, true, `${items[0].id} doit rester visible : ${JSON.stringify(out[0])}`);
    assert.deepEqual(violations(items, out, vp), [], `${items[0].id} : ${JSON.stringify(out[0])}`);
  }
  const [top] = layoutLabels([item('t', 400, 0, 'right', 120, 24)], vp);
  assert.equal(top.top, 8, `ancre à y = 0 : top ${top.top}, attendu 8`);
  const [bottom] = layoutLabels([item('b', 400, 700, 'right', 120, 24)], vp);
  assert.equal(bottom.top, 700 - 8 - 24, `ancre à y = H : top ${bottom.top}, attendu ${700 - 8 - 24}`);
});

test('B6.4 et B6.5 : paquet de 11 étiquettes collées en bas de l\'écran, toutes visibles, dans le cadre, sans chevauchement', async () => {
  // B6.4 (cas du contrat) et B6.5 ; la place suffit (11 × 22 + 2 ≪ 784 px), donc aucune n'est masquée.
  const { layoutLabels } = await labelsMod();
  for (const vp of [{ width: 1200, height: 800 }, { width: 390, height: 700 }]) {
    const items = Array.from({ length: 11 }, (_, k) => item(`s${k}`, vp.width / 2 - 20 + k, vp.height - 1 - k * 0.5, k % 2 ? 'left' : 'right', 110, 24, k % 3));
    const out = layoutLabels(items, vp);
    assert.deepEqual(out.map((o: Mod) => o.id), items.map((i) => i.id), 'même ordre que l\'entrée');
    assert.equal(out.filter((o: Mod) => o.visible).length, 11, `étiquettes masquées alors que la place suffit : ${JSON.stringify(out.filter((o: Mod) => !o.visible).map((o: Mod) => o.id))}`);
    assert.deepEqual(violations(items, out, vp), [], `${vp.width}×${vp.height}`);
  }
});

test('B6.5 : aucun chevauchement > 2 px sur des scènes aléatoires (graines fixées)', async () => {
  // B6.5 avec B6.4 : propriétés vérifiées pour toute scène.
  const { layoutLabels } = await labelsMod();
  for (const [seed, n, vp] of [[1, 30, { width: 1200, height: 800 }], [2, 50, { width: 800, height: 600 }], [3, 25, { width: 390, height: 844 }], [4, 40, { width: 1440, height: 900 }]] as const) {
    const items = scene(seed, n, vp);
    const out = layoutLabels(items, vp);
    assert.equal(out.length, items.length);
    assert.deepEqual(violations(items, out, vp), [], `graine ${seed}`);
    assert.ok(out.some((o: Mod) => o.visible), `graine ${seed} : aucune étiquette visible`);
  }
});

test('B6.6 : place insuffisante → les plus faibles priorités sortent, sans violer 4 et 5', async () => {
  // B6.6 : 11 étiquettes empilées dans 100 px de haut ; seules les plus prioritaires restent.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 400, height: 100 };
  const prio = [5, 9, 1, 7, 3, 10, 0, 8, 2, 6, 4];
  const items = prio.map((p, k) => item(`k${k}`, 150, 50, 'right', 100, 24, p));
  const out = layoutLabels(items, vp);
  assert.deepEqual(violations(items, out, vp), [], 'propriétés 4 et 5 violées');
  const visible = out.filter((o: Mod) => o.visible).map((o: Mod) => prio[Number(o.id.slice(1))]);
  const hidden = out.filter((o: Mod) => !o.visible).map((o: Mod) => prio[Number(o.id.slice(1))]);
  assert.ok(visible.length >= 1, 'au moins une étiquette doit rester visible');
  assert.ok(hidden.length >= 1, 'les 11 étiquettes ne tiennent pas dans 84 px : certaines doivent sortir');
  assert.ok(Math.min(...visible) > Math.max(...hidden), `priorités visibles ${JSON.stringify(visible)}, masquées ${JSON.stringify(hidden)}`);
});

test('B6.6 : à priorité égale, l\'id départage (ensemble visible = début ou fin de l\'ordre des id)', async () => {
  // B6.6 : égalité départagée par id ; le sens du départage n'est pas fixé par le contrat.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 400, height: 100 };
  const ids = ['m', 'c', 'x', 'a', 'q', 'f', 'z', 'b', 'k'];
  const items = ids.map((id) => item(id, 150, 50, 'right', 100, 24, 1));
  const out = layoutLabels(items, vp);
  assert.deepEqual(violations(items, out, vp), []);
  const vis = out.filter((o: Mod) => o.visible).map((o: Mod) => o.id).sort();
  const hid = out.filter((o: Mod) => !o.visible).map((o: Mod) => o.id).sort();
  assert.ok(vis.length >= 1 && hid.length >= 1, `visibles ${vis}, masquées ${hid}`);
  const prefix = vis[vis.length - 1] < hid[0];
  const suffix = vis[0] > hid[hid.length - 1];
  assert.ok(prefix || suffix, `départage non fondé sur l'id : visibles ${vis}, masquées ${hid}`);
});

test('B6.7 : une entrée invisible ressort invisible et ne déplace aucune autre étiquette', async () => {
  // B6.7 : comparaison avec la même scène sans l'entrée invisible.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 1000, height: 700 };
  const base = Array.from({ length: 6 }, (_, k) => item(`v${k}`, 400 + k * 3, 300 + k * 4, 'right', 120, 24, k));
  const ghost = item('ghost', 401, 302, 'right', 140, 30, 99, false);
  const withGhost = [...base.slice(0, 3), ghost, ...base.slice(3)];
  const out = layoutLabels(withGhost, vp);
  const ref = layoutLabels(base, vp);
  const g = out.find((o: Mod) => o.id === 'ghost');
  assert.equal(g.visible, false, `l'entrée invisible ressort visible : ${JSON.stringify(g)}`);
  for (const r of ref) assert.deepEqual(out.find((o: Mod) => o.id === r.id), r, `${r.id} déplacée par l'entrée invisible`);
});

test('B6.8 : déterminisme et indépendance vis-à-vis de l\'ordre d\'entrée', async () => {
  // B6.8 : permuter l'entrée permute la sortie de la même façon.
  const { layoutLabels } = await labelsMod();
  for (const [seed, vp] of [[7, { width: 1000, height: 600 }], [8, { width: 400, height: 200 }]] as const) {
    const items = scene(seed, 24, vp);
    const out = layoutLabels(items, vp);
    assert.deepStrictEqual(layoutLabels(items, vp), out, `graine ${seed} : non déterministe`);
    const r = testRng(seed * 31);
    const perm = items.map((it) => ({ it, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.it);
    const outPerm = layoutLabels(perm, vp);
    assert.deepEqual(outPerm.map((o: Mod) => o.id), perm.map((p) => p.id), 'la sortie doit suivre l\'ordre de l\'entrée');
    for (const o of outPerm) assert.deepEqual(o, out.find((x: Mod) => x.id === o.id), `graine ${seed} : ${o.id} placée autrement après permutation`);
  }
});

test('B6.9 : createSizeCache mesure une seule fois par clé, et de nouveau après invalidate()', async () => {
  // B6.9 : aucune relecture de taille à chaque image.
  const { createSizeCache } = await labelsMod();
  let calls = 0;
  const cache = createSizeCache((k: { name: string; n: number }) => { calls++; return { width: k.n * 10, height: 20 }; }, (k: { name: string }) => k.name);
  for (let i = 0; i < 1000; i++) assert.deepEqual(cache.get({ name: 'python', n: 6 }), { width: 60, height: 20 });
  assert.equal(calls, 1, `measure appelée ${calls} fois pour 1 000 get`);
  assert.equal(cache.measurements, 1, `measurements = ${cache.measurements}`);
  cache.get({ name: 'llm', n: 3 });
  assert.equal(calls, 2, 'une nouvelle clé doit être mesurée');
  cache.get({ name: 'python', n: 99 });
  assert.equal(calls, 2, 'même clé (keyOf) : pas de nouvelle mesure');
  cache.invalidate();
  assert.deepEqual(cache.get({ name: 'python', n: 7 }), { width: 70, height: 20 }, 'après invalidate, la mesure doit être refaite');
  assert.equal(calls, 3, `après invalidate : ${calls} mesures`);
});

test('B6.10 : placeTooltip (côté selon le centre de l\'ancre, écart 10, bornage à 8 px, y centré)', async () => {
  // B6.10 (proto:942–945), des deux côtés du milieu.
  const { placeTooltip } = await labelsMod();
  const vp = { width: 1000, height: 600 };
  const size = { width: 200, height: 80 };
  assert.deepEqual(placeTooltip({ left: 100, top: 200, width: 40, height: 20 }, size, vp), { x: 150, y: 170, origin: 'left' }, 'ancre à gauche');
  assert.deepEqual(placeTooltip({ left: 800, top: 300, width: 40, height: 20 }, size, vp), { x: 590, y: 270, origin: 'right' }, 'ancre à droite');
  assert.deepEqual(placeTooltip({ left: 480, top: 300, width: 40, height: 20 }, size, vp), { x: 270, y: 270, origin: 'right' }, 'centre exactement à W/2 : à gauche');
  assert.deepEqual(placeTooltip({ left: 479, top: 300, width: 40, height: 20 }, size, vp), { x: 529, y: 270, origin: 'left' }, 'centre juste avant W/2 : à droite');
  assert.deepEqual(placeTooltip({ left: 400, top: 0, width: 90, height: 10 }, { width: 600, height: 80 }, vp), { x: 392, y: 8, origin: 'left' }, 'bornage à droite et en haut');
  assert.deepEqual(placeTooltip({ left: 510, top: 590, width: 10, height: 10 }, { width: 600, height: 80 }, vp), { x: 8, y: 512, origin: 'right' }, 'bornage à gauche et en bas');
});

// ---- Durcissement après l'audit du 20 novembre 2026 ----

test('B6.6 : compactage avant masquage (deux étiquettes 100 × 24 à la même ancre dans 300 × 62)', async () => {
  // Audit : aux hauteurs 8 et 30, les deux tiennent avec les 2 px tolérés ; la seconde ne doit pas sortir.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 300, height: 62 };
  for (const items of [
    [item('a', 50, 31, 'right', 100, 24), item('b', 50, 31, 'right', 100, 24)],
    [item('a', 50, 31, 'right', 100, 24, 2), item('b', 50, 31, 'right', 100, 24, 1)],
  ]) {
    const out = layoutLabels(items, vp);
    assert.deepEqual(out.map((o: Mod) => o.visible), [true, true], `une étiquette masquée alors que les deux tiennent : ${JSON.stringify(out)}`);
    assert.deepEqual(violations(items, out, vp), []);
  }
});

test('B6.4 : un élément plus large que le cadre disponible est masqué', async () => {
  // Audit, mutation « autoriser une étiquette trop large » non détectée.
  const { layoutLabels } = await labelsMod();
  const vp = { width: 300, height: 400 };
  const out = layoutLabels([item('large', 150, 200, 'right', 285, 24), item('juste', 150, 100, 'right', 284, 24)], vp);
  assert.equal(out[0].visible, false, `largeur 285 > 300 − 16 : doit être masquée (${JSON.stringify(out[0])})`);
  assert.equal(out[1].visible, true, `largeur 284 = 300 − 16 : doit tenir (${JSON.stringify(out[1])})`);
  assert.deepEqual(violations([item('large', 150, 200, 'right', 285, 24), item('juste', 150, 100, 'right', 284, 24)], out, vp), []);
});

test('B6.10 : infobulle plus grande que le cadre, coordonnées non négatives et ancrées à la marge', async () => {
  // Audit : infobulle 100 × 80 dans un cadre 60 × 40.
  const { placeTooltip } = await labelsMod();
  for (const anchor of [{ left: 5, top: 5, width: 10, height: 10 }, { left: 45, top: 30, width: 10, height: 10 }]) {
    const r = placeTooltip(anchor, { width: 100, height: 80 }, { width: 60, height: 40 });
    assert.ok(r.x >= 0 && r.y >= 0, `coordonnées négatives : ${JSON.stringify(r)}`);
    assert.deepEqual([r.x, r.y], [8, 8], `l'infobulle doit rester ancrée à la marge : ${JSON.stringify(r)}`);
  }
});

test('B6.1 : projectToScreen avec une composante non finie → visible: false', async () => {
  // Audit : [NaN, 0, 0] donnait visible: true et une abscisse NaN.
  const { projectToScreen } = await labelsMod();
  const vp = { width: 800, height: 600 };
  for (const ndc of [[Number.NaN, 0, 0], [0, Number.NaN, 0], [Infinity, 0, 0], [0, -Infinity, 0.5], [0, 0, Number.NaN]]) {
    assert.equal(projectToScreen(ndc, vp).visible, false, `${JSON.stringify(ndc.map(String))} doit être invisible`);
  }
});
