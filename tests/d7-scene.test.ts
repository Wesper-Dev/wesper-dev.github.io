// Contrat D0 et D7 (lot 1c) : pureté des modules du 1c, contrôles statiques de scene.ts (couleurs, gestes, défilement).
// Le comportement de la scène (renderer, matériaux, sève, profil, redimensionnement) est vérifié en navigateur [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOME_ROUTES, PURE_1C, filesUnder, importsOf, importsThree, load1c, pageHtml, readSrc, resolveSrc, siteDir, stripCode } from './helpers-scene.ts';
import { type CssRule, type HNode, byAttr, exportCss, parseHtml } from './helpers-home.ts';
import { DESKTOP, type Env, PHONE, cascade } from './helpers-cascade.ts';

// Retire les chaînes et gabarits (le GLSL vit dans des gabarits) pour ne contrôler que le code.
const codeOnly = (src: string): string => stripCode(src).replace(/`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '""');

test('D0 : les huit modules purs du 1c s\'importent dans Node sans erreur', async () => {
  // D0 : build, shaders, camera, guard, backdrop, leaves, fireflies, ascii.
  const errors: string[] = [];
  for (const rel of PURE_1C) {
    try {
      await load1c(rel);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('D0 : modules purs : imports relatifs en .ts seulement, ni three, ni react, ni scene.ts, ni labels-dom.ts', () => {
  // D0 (B0 à l'identique) : TypeScript effaçable, aucun spécificateur nu.
  const problems: string[] = [];
  for (const rel of PURE_1C) {
    let src: string;
    try {
      src = readSrc(rel);
    } catch (e) {
      problems.push((e as Error).message);
      continue;
    }
    for (const ref of importsOf(src)) {
      if (!ref.spec.startsWith('./') && !ref.spec.startsWith('../')) problems.push(`${rel} : spécificateur non relatif « ${ref.spec} »`);
      else if (!ref.spec.endsWith('.ts')) problems.push(`${rel} : import sans extension .ts « ${ref.spec} »`);
      const target = resolveSrc(rel, ref.spec);
      if (target === 'lib/tree/scene.ts' || target === 'lib/tree/labels-dom.ts') problems.push(`${rel} importe ${target}`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('D0 : modules purs : ni window, document, requestAnimationFrame, performance, localStorage, sessionStorage, matchMedia, navigator, Date.now, Math.random', () => {
  // D0 : le temps et le hasard sont injectés.
  const banned = ['window', 'document', 'requestAnimationFrame', 'performance', 'localStorage', 'sessionStorage', 'matchMedia', 'navigator'];
  const problems: string[] = [];
  for (const rel of PURE_1C) {
    let src: string;
    try {
      src = codeOnly(readSrc(rel));
    } catch (e) {
      problems.push((e as Error).message);
      continue;
    }
    for (const w of banned) if (new RegExp(`(?<![\\w$.])${w}\\b`).test(src)) problems.push(`${rel} : « ${w} »`);
    if (/\bDate\s*\.\s*now\b/.test(src)) problems.push(`${rel} : « Date.now »`);
    if (/\bMath\s*\.\s*random\b/.test(src)) problems.push(`${rel} : « Math.random »`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('D0 : modules purs : TypeScript effaçable (ni enum, ni namespace, ni propriété de paramètre, ni JSX) et aucun état global mutable', () => {
  // D0 (B0) : syntaxe acceptée par node --experimental-strip-types.
  const rules: [RegExp, string][] = [
    [/(?:^|[\s;])(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+[A-Za-z_$]/m, 'enum'],
    [/(?:^|[\s;])(?:export\s+)?(?:declare\s+)?(?:namespace|module)\s+[A-Za-z_$][\w$.]*\s*\{/m, 'namespace'],
    [/constructor\s*\([^)]*\b(?:public|private|protected|readonly|override)\s+[A-Za-z_$]/, 'propriété de paramètre'],
    [/^(?:export\s+)?(?:let|var)\s+[A-Za-z_$]/m, 'let/var au niveau du module'],
    [/return\s*\(?\s*<[A-Za-z]/, 'JSX'],
  ];
  const problems: string[] = [];
  for (const rel of PURE_1C) {
    let src: string;
    try {
      src = codeOnly(readSrc(rel));
    } catch (e) {
      problems.push((e as Error).message);
      continue;
    }
    for (const [re, name] of rules) if (re.test(src)) problems.push(`${rel} : ${name}`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('D0 : labels-dom.ts n\'importe pas three ; scene.ts importe three', () => {
  // D0 : scene.ts est le seul fichier du dépôt qui importe three (D1.2 contrôle tout le site).
  assert.equal(importsThree(readSrc('lib/tree/labels-dom.ts')), false, 'labels-dom.ts ne doit pas importer three');
  assert.equal(importsThree(readSrc('lib/tree/scene.ts')), true, 'scene.ts doit importer three');
});

test('D7.1 : scene.ts n\'importe ni Color, Clock, Fog, FogExp2, et ne contient ni ColorManagement, ni .setHex(, ni new Color(', () => {
  // D7.1, D7.2 : pas de brouillard ni d'horloge ; couleurs en sRGB encodé brut, jamais un Color depuis un hexadécimal.
  const src = readSrc('lib/tree/scene.ts');
  const named = importsOf(src)
    .filter((r) => r.spec === 'three')
    .flatMap((r) => r.clause.replace(/^type\s+/, '').replace(/[{}]/g, '').split(','))
    .map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0] ?? '')
    .filter(Boolean);
  assert.ok(named.length > 0, 'scene.ts : aucun import nommé de three');
  for (const n of ['Color', 'Clock', 'Fog', 'FogExp2']) assert.ok(!named.includes(n), `scene.ts importe ${n}`);
  const code = stripCode(src);
  for (const s of ['ColorManagement', '.setHex(', 'new Color(']) assert.ok(!code.includes(s), `scene.ts contient « ${s} »`);
  // AdditiveBlending remplacé par le mélange personnalisé r147 (arbitrage de l'audit, amendement de D7.3).
  for (const n of ['WebGLRenderer', 'ShaderMaterial', 'SRGBColorSpace', 'NoToneMapping', 'CustomBlending', 'SrcAlphaFactor', 'OneFactor']) {
    assert.ok(named.includes(n), `scene.ts doit importer ${n} (D7.1, D7.3)`);
  }
});

test('D7.5 (réécrit F14) : aucune chaîne « wheel » dans lib/tree ni components/tree, et la toile résout touch-action en pan-y sans pan-x', () => {
  // D7.5 : la molette fait défiler la page ; le glisser vertical aussi.
  const files = [...filesUnder('lib/tree'), ...filesUnder('components/tree', /\.(ts|tsx|css)$/)];
  assert.ok(files.includes('lib/tree/scene.ts') && files.includes('components/tree/TreeIsland.tsx'), 'scene.ts et TreeIsland.tsx attendus');
  const wheel = files.filter((f) => /\bwheel\b/i.test(stripCode(readFileSync(join(siteDir, f), 'utf8'))));
  assert.deepEqual(wheel, [], `« wheel » trouvé dans : ${wheel.join(', ')}`);
  // F14 (audit Fable) : l'ancien contrôle cherchait « pan-y » dans n'importe quel fichier (survivante C5). La valeur est
  // maintenant résolue par la cascade de l'export pour la toile, placée comme l'îlot la place (dans [data-tree-stage]) :
  // le défilement vertical reste au navigateur (pan-y), le glisser horizontal à la scène (ni pan-x, ni auto, ni
  // manipulation) ; pinch-zoom est permis (F2).
  for (const route of HOME_ROUTES) for (const env of [DESKTOP, PHONE]) {
    const v = canvasTouchAction(route, exportCss().rules, env);
    assert.deepEqual(touchActionProblems(v), [], `${route} (${env === DESKTOP ? 'PC' : 'téléphone'}) : touch-action de la toile = ${v ?? 'auto (aucune règle)'}`);
  }
});

// Toile ajoutée dans [data-tree-stage] comme le fait TreeIsland (classe tree-canvas, tabindex 0 en ready).
function canvasTouchAction(route: string, rules: CssRule[], env: Env): string | undefined {
  const doc = parseHtml(pageHtml(route).replace(/(<section\b[^>]*\bdata-tree-state=")html(")/, '$1ready$2'));
  const stage = byAttr(doc, 'data-tree-stage')[0];
  assert.ok(stage, `${route} : [data-tree-stage] absent`);
  const canvas: HNode = { tag: 'canvas', attrs: { class: 'tree-canvas', tabindex: '0' }, children: [], parent: stage, text: '', start: 0 };
  stage.children.push(canvas);
  return cascade(rules, { states: new Map(), env }).get(canvas, 'touch-action');
}
function touchActionProblems(v: string | undefined): string[] {
  const t = (v ?? 'auto').trim().split(/\s+/);
  const out: string[] = [];
  if (!t.includes('pan-y')) out.push('pan-y absent (défilement vertical pris par la scène)');
  for (const bad of ['pan-x', 'pan-left', 'pan-right', 'auto', 'manipulation', 'none']) if (t.includes(bad)) out.push(`${bad} (glisser horizontal rendu au navigateur ou défilement bloqué)`);
  return out;
}

test('D7.5 (témoin F14) : sans touch-action:pan-y sur .tree-canvas (survivante C5), le contrôle de la toile échoue', () => {
  const rules = exportCss().rules.map((r) => {
    if (!r.selectors.includes('.tree-canvas') || !r.decls.has('touch-action')) return r;
    const list = r.declList.filter(([k]) => k !== 'touch-action');
    return { ...r, declList: list, decls: new Map(list) };
  });
  assert.notDeepEqual(touchActionProblems(canvasTouchAction('/fr/', rules, PHONE)), [], 'la suppression de touch-action sur .tree-canvas passe le contrôle');
  assert.deepEqual(touchActionProblems('pan-y pinch-zoom'), [], 'pan-y pinch-zoom (correction F2) doit rester accepté');
  assert.notDeepEqual(touchActionProblems('manipulation'), []);
});

test('D7.3 (arbitrage) : mélange r147 reproduit : CustomBlending, RGB et alpha en SrcAlphaFactor / OneFactor (alpha source au carré), plus d\'AdditiveBlending', () => {
  // Arbitrage de l'audit : r147 additionnait l'alpha source au carré (blendFunc(SRC_ALPHA, ONE)) ; r187 l'additionne tel quel.
  const code = stripCode(readSrc('lib/tree/scene.ts'));
  assert.ok(!/\bAdditiveBlending\b/.test(code), 'scene.ts ne doit plus utiliser AdditiveBlending');
  const rules: [RegExp, string][] = [
    [/\bblending\s*[:=]\s*CustomBlending\b/, 'blending: CustomBlending'],
    [/\bblendSrc\s*[:=]\s*SrcAlphaFactor\b/, 'blendSrc: SrcAlphaFactor'],
    [/\bblendDst\s*[:=]\s*OneFactor\b/, 'blendDst: OneFactor'],
    [/\bblendSrcAlpha\s*[:=]\s*SrcAlphaFactor\b/, 'blendSrcAlpha: SrcAlphaFactor'],
    [/\bblendDstAlpha\s*[:=]\s*OneFactor\b/, 'blendDstAlpha: OneFactor'],
  ];
  const missing = rules.filter(([re]) => !re.test(code)).map(([, n]) => n);
  assert.deepEqual(missing, [], `facteurs de mélange absents de scene.ts : ${missing.join(', ')}`);
  assert.ok(!/\bblendEquation(?:Alpha)?\s*[:=]\s*(?!AddEquation\b)\w+/.test(code), 'équation de mélange autre que AddEquation');
});
