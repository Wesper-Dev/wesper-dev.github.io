// Contrat D6 (lot 1c) : lib/tree/shaders.ts, chaînes GLSL ES 1.0 et constantes. La compilation réelle est un scénario [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, shadersMod, stripCode } from './helpers-scene.ts';

// Attributs déclarés et uniformes attendus par paire (position est fourni par ShaderMaterial et n'est pas redéclaré).
const PAIRS: Record<string, { attributes: string[]; uniforms: string[] }> = {
  TREE: { attributes: ['aColor', 'aDelay', 'aHi', 'aSapD', 'aSize', 'aStart'], uniforms: ['uFront', 'uGain', 'uHiMix', 'uProg', 'uPx', 'uTime', 'uWarm'] },
  SAP_LINE: { attributes: ['aD'], uniforms: ['uFront', 'uSapA', 'uSapB'] },
  SAP_POINTS: { attributes: ['aD', 'aR'], uniforms: ['uFront', 'uPx', 'uSapA', 'uSapB', 'uTime'] },
  GROUND: { attributes: ['aC', 'aR'], uniforms: ['uPx'] },
  FOREST: { attributes: ['aC', 'aR', 'aT'], uniforms: ['uPx', 'uTime'] },
  SKY: { attributes: ['aC', 'aR'], uniforms: ['uPx', 'uTime'] },
  LEAF: { attributes: ['aA', 'aC', 'aRot', 'aS'], uniforms: ['uPx'] },
};

function declared(src: string, keyword: 'attribute' | 'uniform'): { names: string[]; types: Map<string, string> } {
  const names: string[] = [];
  const types = new Map<string, string>();
  for (const m of stripCode(src).matchAll(new RegExp(`\\b${keyword}\\s+(?:(?:lowp|mediump|highp)\\s+)?(\\w+)\\s+([^;]+);`, 'g'))) {
    for (const raw of (m[2] ?? '').split(',')) {
      const n = raw.replace(/\[.*\]/, '').trim();
      if (n) {
        names.push(n);
        types.set(n, m[1] ?? '');
      }
    }
  }
  return { names, types };
}

test('D6 : chaque paire de shaders déclare exactement les attributs et uniformes du contrat', async () => {
  // D6 [S-a] : TREE, SAP_LINE, SAP_POINTS, GROUND, FOREST, SKY, LEAF (suffixes _VERTEX et _FRAGMENT).
  const mod = await shadersMod();
  const problems: string[] = [];
  for (const [name, want] of Object.entries(PAIRS)) {
    const vs = mod[`${name}_VERTEX`];
    const fs = mod[`${name}_FRAGMENT`];
    if (typeof vs !== 'string' || typeof fs !== 'string') {
      problems.push(`${name}_VERTEX / ${name}_FRAGMENT absents ou non chaînes`);
      continue;
    }
    const attrs = declared(vs, 'attribute').names;
    if (declared(fs, 'attribute').names.length > 0) problems.push(`${name}_FRAGMENT déclare des attributs`);
    if (new Set(attrs).size !== attrs.length) problems.push(`${name} : attribut déclaré deux fois`);
    if (JSON.stringify([...new Set(attrs)].sort()) !== JSON.stringify(want.attributes)) problems.push(`${name} : attributs ${JSON.stringify([...attrs].sort())}, attendu ${JSON.stringify(want.attributes)}`);
    const uv = declared(vs, 'uniform');
    const uf = declared(fs, 'uniform');
    const uni = [...new Set([...uv.names, ...uf.names])].sort();
    if (JSON.stringify(uni) !== JSON.stringify(want.uniforms)) problems.push(`${name} : uniformes ${JSON.stringify(uni)}, attendu ${JSON.stringify(want.uniforms)}`);
    for (const [u, t] of [...uv.types, ...uf.types]) {
      const wantType = ['uWarm', 'uSapA', 'uSapB'].includes(u) ? 'vec3' : 'float';
      if (t !== wantType) problems.push(`${name} : uniform ${u} de type ${t}, attendu ${wantType}`);
    }
    if (!/\bgl_FragColor\b/.test(fs)) problems.push(`${name}_FRAGMENT : gl_FragColor attendu (GLSL ES 1.0)`);
    if (!/\bvoid\s+main\s*\(/.test(vs) || !/\bvoid\s+main\s*\(/.test(fs)) problems.push(`${name} : void main() absent`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('D6 : aucune chaîne exportée ne contient #version, #include, colorspace_fragment, tonemapping_fragment, uWind, uMouse, uAspect, uFly ni uShow', async () => {
  // D6 [S-a] : syntaxe GLSL ES 1.0, sans conversion de couleur ni uniformes retirés du prototype.
  const mod = await shadersMod();
  const strings = Object.entries(mod).filter(([, v]) => typeof v === 'string') as [string, string][];
  assert.ok(strings.length >= 14, `au moins 14 chaînes de shaders attendues, reçu ${strings.length}`);
  const banned = ['#version', '#include', 'colorspace_fragment', 'tonemapping_fragment', 'uWind', 'uMouse', 'uAspect', 'uFly', 'uShow', 'pc_fragColor', 'texture(', 'layout('];
  const problems = strings.flatMap(([k, v]) => banned.filter((b) => v.includes(b)).map((b) => `${k} contient « ${b} »`));
  assert.deepEqual(problems, [], problems.join('\n'));
  const all = Object.entries(mod);
  const nonString = all.filter(([, v]) => typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'function' && (typeof v !== 'object' || v === null));
  assert.deepEqual(nonString.map(([k]) => k), [], 'le module n\'exporte que des chaînes, des constantes et uniformColors');
});

test('D6.1 : TREE_VERTEX allume par step(aSapD, uFront) et TREE_FRAGMENT écarte les fragments hors du disque', async () => {
  // D6.1 : lit = aHi × uHiMix × step(aSapD, uFront) ; discard si d > 0,5.
  const { TREE_VERTEX, TREE_FRAGMENT } = await shadersMod();
  assert.match(stripCode(TREE_VERTEX), /step\s*\(\s*aSapD\s*,\s*uFront\s*\)/);
  assert.match(stripCode(TREE_VERTEX), /\bgl_PointSize\b/);
  assert.match(stripCode(TREE_FRAGMENT), /\bdiscard\b/);
});

test('D6.2 : SAP_LINE_FRAGMENT écarte vD > uFront ; SAP_POINTS_VERTEX utilise step(aD, uFront)', async () => {
  // D6.2, D6.3 : distances réelles (aD non normalisé) comparées au front.
  const { SAP_LINE_FRAGMENT, SAP_POINTS_VERTEX } = await shadersMod();
  assert.match(stripCode(SAP_LINE_FRAGMENT), /vD\s*>\s*uFront/);
  assert.match(stripCode(SAP_LINE_FRAGMENT), /\bdiscard\b/);
  assert.match(stripCode(SAP_POINTS_VERTEX), /step\s*\(\s*aD\s*,\s*uFront\s*\)/);
});

test('D6 : constantes SAP_HEAD_PARTICLES = 1, SAP_HEAD_LINE = 1,3, SAP_PULSE_FREQ = 2, POINT_SCALE = { tree 36, sap 38, leaf 34, backdrop 30 }', async () => {
  // D6 : valeurs exactes.
  const m = await shadersMod();
  assert.equal(m.SAP_HEAD_PARTICLES, 1.0);
  assert.equal(m.SAP_HEAD_LINE, 1.3);
  assert.equal(m.SAP_PULSE_FREQ, 2.0);
  assert.deepEqual({ ...m.POINT_SCALE }, { tree: 36, sap: 38, leaf: 34, backdrop: 30 });
});

test('D6.6 : uniformColors(p) vaut exactement hexToRgb(p.lit), hexToRgb(p.sap[0]) et hexToRgb(p.sap[1]) pour chaque palette', async () => {
  // D6.6 : composantes sRGB encodées brutes, sans conversion.
  const { uniformColors } = await shadersMod();
  const { hexToRgb } = await engine.color();
  const { PALETTES, PALETTE_ORDER } = await engine.palettes();
  const seen = new Set<string>();
  for (const id of PALETTE_ORDER as string[]) {
    const p = PALETTES[id];
    const u = uniformColors(p);
    const got = { uWarm: Array.from(u.uWarm as number[]), uSapA: Array.from(u.uSapA as number[]), uSapB: Array.from(u.uSapB as number[]) };
    const want = { uWarm: [...hexToRgb(p.lit)], uSapA: [...hexToRgb(p.sap[0])], uSapB: [...hexToRgb(p.sap[1])] };
    assert.deepEqual(got, want, `${id} : uniformColors`);
    seen.add(JSON.stringify(got));
  }
  assert.equal(seen.size, 4, 'les quatre palettes doivent donner quatre jeux d\'uniformes distincts');
});
