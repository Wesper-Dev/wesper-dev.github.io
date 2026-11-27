// Contrat D2.6 et B5 durcis après l'audit astra (arbitrage du 21/11) : contraste ≥ 4,5 des textes de l'arbre, calculé sur
// la couleur réellement demandée par le CSS (var(), color-mix() en oklab ou srgb, alpha, opacity), sur bg et sur bg2,
// pour les quatre palettes. Vérifier le jeton muted seul ne suffit pas : l'état atténué peut le mélanger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wcagContrast } from './helpers-tree.ts';
import { engine, filesUnder, siteDir } from './helpers-scene.ts';

type RGBA = [number, number, number, number];

// ---- Conversions (CSS Color 4) ----
const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toEnc = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function rgbToOklab([r, g, b]: number[]): number[] {
  const [R, G, B] = [toLin(r as number), toLin(g as number), toLin(b as number)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToRgb([L, a, b]: number[]): number[] {
  const l = ((L as number) + 0.3963377774 * (a as number) + 0.2158037573 * (b as number)) ** 3;
  const m = ((L as number) - 0.1055613458 * (a as number) - 0.0638541728 * (b as number)) ** 3;
  const s = ((L as number) - 0.0894841775 * (a as number) - 1.291485548 * (b as number)) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [R, G, B].map((x) => Math.min(1, Math.max(0, toEnc(x))));
}

// Découpe des arguments au premier niveau de parenthèses.
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let d = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') d++;
    if (ch === ')') d--;
    if (ch === sep && d === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Évalue une valeur de couleur CSS ; `vars` donne les propriétés personnalisées connues pour la palette.
function evalColor(raw: string, vars: Map<string, string>, depth = 0): RGBA {
  if (depth > 20) throw new Error(`récursion de var() : ${raw}`);
  const v = raw.trim().replace(/\s*!important$/, '');
  let m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(v);
  if (m) {
    const x = vars.get(m[1] ?? '') ?? m[2];
    if (x === undefined) throw new Error(`variable inconnue ${m[1]}`);
    return evalColor(x, vars, depth + 1);
  }
  m = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (m) {
    let h = m[1] ?? '';
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i: number): number => parseInt(h.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
  }
  m = /^rgba?\(([\s\S]+)\)$/i.exec(v);
  if (m) {
    const parts = (m[1] ?? '').split(/[\s,/]+/).filter(Boolean);
    const num = (p: string, scale: number): number => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / scale);
    return [num(parts[0] ?? '0', 255), num(parts[1] ?? '0', 255), num(parts[2] ?? '0', 255), parts[3] === undefined ? 1 : num(parts[3], 1)];
  }
  m = /^color-mix\(\s*in\s+([\w-]+)\s*,([\s\S]+)\)$/i.exec(v);
  if (m) {
    const space = (m[1] ?? '').toLowerCase();
    const [a, b] = splitTop(m[2] ?? '', ',').map((arg) => {
      const pm = /^([\s\S]*?)\s+(\d+(?:\.\d+)?)%$/.exec(arg) ?? /^(\d+(?:\.\d+)?)%\s+([\s\S]*)$/.exec(arg);
      if (!pm) return { c: arg, p: null as number | null };
      return /%$/.test(arg) ? { c: pm[1] ?? '', p: parseFloat(pm[2] ?? '') } : { c: pm[2] ?? '', p: parseFloat(pm[1] ?? '') };
    });
    if (!a || !b) throw new Error(`color-mix illisible : ${v}`);
    let p1 = a.p, p2 = b.p;
    if (p1 === null && p2 === null) { p1 = 50; p2 = 50; } else if (p1 === null) p1 = 100 - (p2 as number); else if (p2 === null) p2 = 100 - p1;
    const sum = (p1 as number) + (p2 as number);
    const w1 = (p1 as number) / sum, w2 = (p2 as number) / sum;
    const alphaMul = sum < 100 ? sum / 100 : 1;
    const ca = evalColor(a.c, vars, depth + 1), cb = evalColor(b.c, vars, depth + 1);
    const alpha = ca[3] * w1 + cb[3] * w2;
    // Mélange en prémultiplié (CSS Color 4), puis retour dans l'espace sRGB.
    const conv = space === 'oklab' ? rgbToOklab : space === 'srgb-linear' ? (c: number[]) => c.map(toLin) : space === 'srgb' ? (c: number[]) => c : null;
    const back = space === 'oklab' ? oklabToRgb : space === 'srgb-linear' ? (c: number[]) => c.map(toEnc) : (c: number[]) => c;
    if (!conv) throw new Error(`espace de color-mix non pris en charge par le test : ${space}`);
    const A = conv(ca.slice(0, 3)), B = conv(cb.slice(0, 3));
    const mixed = alpha === 0 ? [0, 0, 0] : A.map((x, i) => (x * ca[3] * w1 + (B[i] as number) * cb[3] * w2) / alpha);
    return [...back(mixed), alpha * alphaMul] as RGBA;
  }
  throw new Error(`couleur non évaluable : ${v}`);
}

const over = (fg: RGBA, bg: number[]): number[] => [0, 1, 2].map((i) => (fg[i] as number) * fg[3] + (bg[i] as number) * (1 - fg[3]));

interface Rule { selector: string; decls: Map<string, string> }

// Lot 4, R4 : les blocs @media print (encre foncée sur papier blanc) ne sont pas lus ici, où chaque couleur est
// mesurée sur bg et bg2 de l'écran ; leurs contrastes sur papier sont mesurés par le scénario R4.1 (verif-4).
function withoutPrint(css: string): string {
  let out = css;
  for (let m = /@media\s+print\b[^{]*\{/i.exec(out); m; m = /@media\s+print\b[^{]*\{/i.exec(out)) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < out.length && depth > 0; i++) depth += out[i] === '{' ? 1 : out[i] === '}' ? -1 : 0;
    out = out.slice(0, m.index) + out.slice(i);
  }
  return out;
}

function cssRules(): Rule[] {
  const files = ['app/globals.css', ...filesUnder('components/tree', /\.css$/), ...filesUnder('components/home', /\.css$/), ...filesUnder('components', /\.css$/), ...filesUnder('app', /\.css$/)];
  const out: Rule[] = [];
  for (const f of [...new Set(files)]) {
    const css = withoutPrint(readFileSync(join(siteDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls = new Map<string, string>();
      for (const d of splitTop(m[2] ?? '', ';')) {
        const i = d.indexOf(':');
        if (i > 0) decls.set(d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim());
      }
      out.push({ selector: (m[1] ?? '').trim(), decls });
    }
  }
  return out;
}

// Portée étendue au 2a (E10.6, E15.3) : règles de l'accueil ([data-home…], [data-site-…]) en plus de celles de l'arbre,
// toujours hors atelier. Les variables déclarées sur [data-home] entrent dans la table vars comme celles de l'arbre.
const isTree = (sel: string): boolean => /\[data-home|\[data-site-|\[data-tree-|\.tree-/.test(sel) && !/atelier/i.test(sel);
const SKIP = /^(inherit|initial|unset|revert|currentcolor|transparent)$/i;

test('D2.6 (audit, étendu au 2a, E15.3) : chaque couleur de texte de l\'accueil ([data-home…], [data-site-…]) et du bloc de l\'arbre atteint 4,5 sur bg et bg2, mélanges et opacité compris, pour les quatre palettes', async () => {
  // Audit : Forêt 4,80/4,42 et Givre 4,45/3,74 sur le texte atténué réellement composé.
  const { cssVariables } = await engine.color();
  const { PALETTES, PALETTE_ORDER } = await engine.palettes();
  const rules = cssRules();
  const tree = rules.filter((r) => isTree(r.selector));
  const texts = tree.filter((r) => r.decls.has('color') && !SKIP.test(r.decls.get('color') ?? ''));
  assert.ok(texts.length >= 1, 'aucune couleur de texte trouvée dans les règles du bloc de l\'arbre ([data-tree-…], .tree-…)');
  const problems: string[] = [];
  const report: string[] = [];
  for (const id of PALETTE_ORDER as string[]) {
    const p = PALETTES[id];
    const vars = new Map<string, string>(Object.entries(cssVariables(p) as Record<string, string>));
    // Propriétés personnalisées déclarées par les règles de l'arbre (et :root) : la dernière l'emporte.
    for (const r of rules) if (isTree(r.selector) || /:root|^html$/.test(r.selector)) for (const [k, v] of r.decls) if (k.startsWith('--') && !vars.has(k)) vars.set(k, v);
    for (const r of texts) {
      let fg: RGBA;
      try {
        fg = evalColor(r.decls.get('color') ?? '', vars);
      } catch (e) {
        problems.push(`${id} « ${r.selector} » : ${(e as Error).message}`);
        continue;
      }
      const op = r.decls.has('opacity') ? parseFloat(r.decls.get('opacity') ?? '1') : 1;
      fg = [fg[0], fg[1], fg[2], fg[3] * (Number.isFinite(op) ? op : 1)];
      const localBg = r.decls.get('background-color') ?? r.decls.get('background');
      let backs: [string, number[]][];
      let local: RGBA | null = null;
      try {
        local = localBg ? evalColor(localBg, vars) : null;
      } catch {
        local = null;
      }
      if (local && local[3] >= 0.999) backs = [['fond local', local.slice(0, 3)]];
      else backs = [['bg', evalColor(p.bg, vars).slice(0, 3)], ['bg2', evalColor(p.bg2, vars).slice(0, 3)]];
      for (const [name, back] of backs) {
        const ratio = wcagContrast(over(fg, back), back);
        report.push(`${id} ${r.selector} / ${name} : ${ratio.toFixed(2)}`);
        if (ratio < 4.5) problems.push(`${id} « ${r.selector} » sur ${name} : ${ratio.toFixed(2)} < 4,5`);
      }
    }
  }
  assert.deepEqual(problems, [], `${problems.join('\n')}\n— mesures —\n${report.join('\n')}`);
});

test('D2.6 (audit) : l\'évaluateur du test retrouve les valeurs connues (témoins)', () => {
  // Témoins de l'évaluateur : sans eux, un test de contraste vert ne prouverait rien.
  const vars = new Map([['--a', '#ffffff'], ['--b', '#000000']]);
  assert.deepEqual(evalColor('var(--a)', vars).map((x) => Math.round(x * 255)), [255, 255, 255, 255]);
  const half = evalColor('color-mix(in srgb, var(--a) 50%, var(--b))', vars);
  assert.ok(Math.abs((half[0] as number) - 0.5) < 1e-9);
  const ok = evalColor('color-mix(in oklab, #ff0000 50%, #0000ff)', vars).map((x) => Math.round(x * 255));
  assert.deepEqual(ok.slice(0, 3), [140, 83, 162], `oklab : ${ok}`); // valeur de référence des navigateurs (CSS Color 4)
  assert.ok(Math.abs(wcagContrast([1, 1, 1], [0, 0, 0]) - 21) < 1e-9);
});
