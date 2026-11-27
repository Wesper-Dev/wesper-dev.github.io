// Cascade CSS minimale sur le DOM exporté (audit du lot 2a) : appariement de sélecteurs, spécificité, médias simples,
// états (:hover, :focus, :focus-visible, :active, :focus-within), héritage de color et font-family, évaluation des
// couleurs (var(), color-mix() en oklab/srgb, alpha). Sert au contraste des liens et boutons par état et à la police
// réellement appliquée à chaque texte. Les sélecteurs hors du sous-ensemble pris en charge sont comptés, non devinés.
import type { CssRule, HNode } from './helpers-home.ts';
import { ancestors, splitTop } from './helpers-home.ts';

export type RGBA = [number, number, number, number];

// ---- Couleurs (CSS Color 4), reprises de d2-contraste.test.ts ----
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
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => Math.min(1, Math.max(0, toEnc(x))));
}
const NAMED: Record<string, RGBA> = { white: [1, 1, 1, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };

export function evalColor(raw: string, vars: Map<string, string>, depth = 0): RGBA {
  if (depth > 20) throw new Error(`récursion de var() : ${raw}`);
  const v = raw.trim().replace(/\s*!important$/, '');
  const named = NAMED[v.toLowerCase()];
  if (named) return named;
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
    const conv = space === 'oklab' ? rgbToOklab : space === 'srgb-linear' ? (c: number[]) => c.map(toLin) : space === 'srgb' ? (c: number[]) => c : null;
    const back = space === 'oklab' ? oklabToRgb : space === 'srgb-linear' ? (c: number[]) => c.map(toEnc) : (c: number[]) => c;
    if (!conv) throw new Error(`espace de color-mix non pris en charge : ${space}`);
    const A = conv(ca.slice(0, 3)), B = conv(cb.slice(0, 3));
    const mixed = alpha === 0 ? [0, 0, 0] : A.map((x, i) => (x * ca[3] * w1 + (B[i] as number) * cb[3] * w2) / alpha);
    return [...back(mixed), alpha * alphaMul] as RGBA;
  }
  throw new Error(`couleur non évaluable : ${v}`);
}
export const over = (fg: RGBA, bg: number[]): number[] => [0, 1, 2].map((i) => (fg[i] as number) * fg[3] + (bg[i] as number) * (1 - fg[3]));

// Couleur portée par un raccourci background (null si aucune couleur, ou si un dégradé ou une image la rend illisible).
export function backgroundColorOf(v: string, vars: Map<string, string>): RGBA | 'image' | null {
  const t = v.trim().replace(/\s*!important$/, '');
  if (/gradient\(|url\(/.test(t)) return 'image';
  if (/^(none|0 0|0)$/i.test(t)) return [0, 0, 0, 0];
  for (const tok of splitTop(t, ' ').reverse()) {
    try {
      return evalColor(tok, vars);
    } catch {
      /* jeton suivant */
    }
  }
  return null;
}

// ---- Sélecteurs ----
export type State = 'rest' | 'hover' | 'focus' | 'active';
export interface Env { width: number; hover: boolean; pointer: 'fine' | 'coarse'; reducedMotion: boolean }
export const DESKTOP: Env = { width: 1440, hover: true, pointer: 'fine', reducedMotion: false };
export const PHONE: Env = { width: 390, hover: false, pointer: 'coarse', reducedMotion: false };

export function mediaMatches(media: string | null, env: Env): boolean {
  if (!media) return true;
  // « a and b » produit par l'imbrication de parseCss ; « , » = ou.
  return splitTop(media, ',').some((alt) => alt.split(/\s+and\s+/).every((cond) => {
    const c = cond.trim().replace(/^only\s+screen\s*/, '').replace(/^screen\s*/, '');
    if (!c) return true;
    const neg = /^not\s+/.test(c);
    const x = c.replace(/^not\s+/, '').replace(/^\(|\)$/g, '').replace(/\s+/g, '');
    let r: boolean;
    let m: RegExpExecArray | null;
    if ((m = /^max-width:([\d.]+)px$/.exec(x))) r = env.width <= Number(m[1]);
    else if ((m = /^min-width:([\d.]+)px$/.exec(x))) r = env.width >= Number(m[1]);
    else if ((m = /^width<=([\d.]+)px$/.exec(x))) r = env.width <= Number(m[1]);
    else if ((m = /^width>=([\d.]+)px$/.exec(x))) r = env.width >= Number(m[1]);
    else if (x === 'hover:hover') r = env.hover;
    else if (x === 'hover:none') r = !env.hover;
    else if (x === 'pointer:fine') r = env.pointer === 'fine';
    else if (x === 'pointer:coarse') r = env.pointer === 'coarse';
    else if (x === 'any-hover:hover') r = env.hover;
    else if (x === 'prefers-reduced-motion:reduce') r = env.reducedMotion;
    else if (x === 'prefers-reduced-motion:no-preference') r = !env.reducedMotion;
    // Couleurs forcées et contraste accru : absents de l'environnement des tests (une règle F9 ne s'applique pas ici).
    else if (x === 'forced-colors:active') r = false;
    else if (x === 'forced-colors:none') r = true;
    else if (/^prefers-contrast:(more|less|custom|high|low)$/.test(x)) r = false;
    else if (x === 'prefers-contrast:no-preference') r = true;
    else if (x === 'inverted-colors:inverted') r = false;
    // Lot 4, R4 : l'environnement des tests est un écran ; une règle @media print ne s'y applique pas.
    else if (x === 'print') r = false;
    else if (x === 'all') r = true;
    else if (/^(min|max)-height/.test(x) || /^orientation/.test(x)) r = true;
    else r = true;
    return neg ? !r : r;
  }));
}

interface Compound { parts: string[] } // jetons simples
type Complex = { compounds: Compound[]; combinators: string[] };

export class Unsupported extends Error {}

function parseComplex(sel: string): Complex {
  const compounds: Compound[] = [];
  const combinators: string[] = [];
  let i = 0;
  let cur: string[] = [];
  const s = sel.trim();
  const pushCompound = (): void => {
    if (cur.length) compounds.push({ parts: cur });
    cur = [];
  };
  while (i < s.length) {
    const ch = s[i] as string;
    if (/\s|>|\+|~/.test(ch)) {
      let j = i;
      let comb = ' ';
      while (j < s.length && /[\s>+~]/.test(s[j] as string)) {
        if (/[>+~]/.test(s[j] as string)) comb = s[j] as string;
        j++;
      }
      pushCompound();
      if (compounds.length && j < s.length) combinators.push(comb);
      i = j;
      continue;
    }
    // jeton simple
    let j = i + 1;
    if (ch === '[') {
      let q: string | null = null;
      while (j < s.length) {
        const c = s[j] as string;
        if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ']') { j++; break; }
        j++;
      }
    } else if (ch === ':') {
      if (s[j] === ':') j++;
      while (j < s.length && /[\w-]/.test(s[j] as string)) j++;
      if (s[j] === '(') {
        let d = 0;
        for (; j < s.length; j++) { if (s[j] === '(') d++; if (s[j] === ')' && --d === 0) { j++; break; } }
      }
    } else {
      while (j < s.length && /[\w-\\]/.test(s[j] as string)) j++;
    }
    cur.push(s.slice(i, j));
    i = j;
  }
  pushCompound();
  return { compounds, combinators };
}

export interface Spec { a: number; b: number; c: number }
const addSpec = (x: Spec, y: Spec): Spec => ({ a: x.a + y.a, b: x.b + y.b, c: x.c + y.c });
const cmpSpec = (x: Spec, y: Spec): number => x.a - y.a || x.b - y.b || x.c - y.c;
const maxSpec = (xs: Spec[]): Spec => xs.reduce((m, s) => (cmpSpec(s, m) > 0 ? s : m), { a: 0, b: 0, c: 0 });

export function specificity(sel: string): Spec {
  let sp: Spec = { a: 0, b: 0, c: 0 };
  for (const comp of parseComplex(sel).compounds) for (const t of comp.parts) {
    if (t.startsWith('#')) sp = addSpec(sp, { a: 1, b: 0, c: 0 });
    else if (t.startsWith('.') || t.startsWith('[')) sp = addSpec(sp, { a: 0, b: 1, c: 0 });
    else if (/^:(is|not|has)\(/.test(t)) sp = addSpec(sp, maxSpec(splitTop(t.slice(t.indexOf('(') + 1, -1), ',').map(specificity)));
    else if (/^:where\(/.test(t)) continue;
    else if (t.startsWith('::') || /^:(before|after|first-line|first-letter)$/.test(t)) sp = addSpec(sp, { a: 0, b: 0, c: 1 });
    else if (t.startsWith(':')) sp = addSpec(sp, { a: 0, b: 1, c: 0 });
    else if (t !== '*') sp = addSpec(sp, { a: 0, b: 0, c: 1 });
  }
  return sp;
}

export interface Ctx { states: Map<HNode, Set<string>>; env: Env }

function attrMatch(n: HNode, tok: string): boolean {
  const m = /^\[\s*([\w:-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*(i)?)?\s*\]$/.exec(tok);
  if (!m) throw new Unsupported(tok);
  const name = (m[1] ?? '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(n.attrs, name)) return false;
  if (!m[2]) return true;
  const v = n.attrs[name] ?? '';
  const want = m[3] ?? m[4] ?? m[5] ?? '';
  switch (m[2]) {
    case '=': return v === want;
    case '~=': return v.split(/\s+/).includes(want);
    case '^=': return v.startsWith(want);
    case '$=': return v.endsWith(want);
    case '*=': return v.includes(want);
    case '|=': return v === want || v.startsWith(want + '-');
  }
  return false;
}

function simpleMatch(n: HNode, tok: string, ctx: Ctx): boolean {
  if (tok === '*') return true;
  if (tok.startsWith('#')) return n.attrs.id === tok.slice(1);
  if (tok.startsWith('.')) return (n.attrs.class ?? '').split(/\s+/).includes(tok.slice(1).replace(/\\/g, ''));
  if (tok.startsWith('[')) return attrMatch(n, tok);
  if (tok.startsWith('::') || /^:(before|after|first-line|first-letter|placeholder|marker|selection)$/.test(tok)) throw new Unsupported(`pseudo-élément ${tok}`);
  if (tok.startsWith(':')) {
    const name = /^:([\w-]+)/.exec(tok)?.[1] ?? '';
    const arg = tok.includes('(') ? tok.slice(tok.indexOf('(') + 1, -1) : '';
    const st = ctx.states.get(n) ?? new Set<string>();
    switch (name) {
      case 'hover': case 'focus': case 'focus-visible': case 'active': case 'focus-within': return st.has(name);
      case 'not': return !splitTop(arg, ',').some((x) => complexMatch(n, x, ctx));
      case 'is': case 'where': case 'matches': return splitTop(arg, ',').some((x) => complexMatch(n, x, ctx));
      case 'root': return n.tag === 'html';
      case 'first-child': return n.parent?.children.filter((c) => c.tag !== '#text')[0] === n;
      case 'last-child': { const k = n.parent?.children.filter((c) => c.tag !== '#text') ?? []; return k[k.length - 1] === n; }
      case 'link': case 'any-link': return n.tag === 'a' && 'href' in n.attrs;
      case 'visited': return false;
      case 'popover-open': case 'target': case 'checked': case 'disabled': case 'empty': return false;
      case 'focus-visible-within': return false;
      default: throw new Unsupported(`pseudo-classe ${tok}`);
    }
  }
  return n.tag === tok.toLowerCase();
}
function compoundMatch(n: HNode, c: Compound, ctx: Ctx): boolean {
  return n.tag !== '#text' && c.parts.every((t) => simpleMatch(n, t, ctx));
}
const elementSiblingsBefore = (n: HNode): HNode[] => {
  const k = n.parent?.children.filter((c) => c.tag !== '#text') ?? [];
  return k.slice(0, k.indexOf(n));
};
function matchFrom(n: HNode, cx: Complex, idx: number, ctx: Ctx): boolean {
  const comp = cx.compounds[idx];
  if (!comp || !compoundMatch(n, comp, ctx)) return false;
  if (idx === 0) return true;
  const comb = cx.combinators[idx - 1];
  if (comb === '>') return !!n.parent && matchFrom(n.parent, cx, idx - 1, ctx);
  if (comb === '+') { const s = elementSiblingsBefore(n); const p = s[s.length - 1]; return !!p && matchFrom(p, cx, idx - 1, ctx); }
  if (comb === '~') return elementSiblingsBefore(n).some((p) => matchFrom(p, cx, idx - 1, ctx));
  for (const a of ancestors(n)) if (a.tag !== '#root' && matchFrom(a, cx, idx - 1, ctx)) return true;
  return false;
}
export function complexMatch(n: HNode, sel: string, ctx: Ctx): boolean {
  const cx = parseComplex(sel);
  if (!cx.compounds.length) return false;
  return matchFrom(n, cx, cx.compounds.length - 1, ctx);
}

// ---- Cascade ----
export interface Decl { value: string; important: boolean; spec: Spec; order: number }
export interface Cascade { unsupported: Set<string>; get: (n: HNode, prop: string) => string | undefined; props: (n: HNode) => Map<string, Decl> }

export function cascade(rules: CssRule[], ctx: Ctx): Cascade {
  const unsupported = new Set<string>();
  const cache = new Map<HNode, Map<string, Decl>>();
  const indexed = rules.map((r, order) => ({ r, order }));
  const declsFor = (n: HNode): Map<string, Decl> => {
    let m = cache.get(n);
    if (m) return m;
    m = new Map();
    for (const { r, order } of indexed) {
      if (!mediaMatches(r.media, ctx.env)) continue;
      let best: Spec | null = null;
      for (const sel of r.selectors) {
        try {
          if (complexMatch(n, sel, ctx)) {
            const sp = specificity(sel);
            if (!best || cmpSpec(sp, best) > 0) best = sp;
          }
        } catch (e) {
          if (e instanceof Unsupported) unsupported.add(sel);
          else throw e;
        }
      }
      if (!best) continue;
      for (const [k, raw] of r.declList) {
        const important = /!important\s*$/.test(raw);
        const value = raw.replace(/\s*!important\s*$/, '');
        const d: Decl = { value, important, spec: best, order };
        const cur = m.get(k);
        const wins = !cur || (important !== cur.important ? important : cmpSpec(best, cur.spec) > 0 || (cmpSpec(best, cur.spec) === 0 && order >= cur.order));
        if (wins) m.set(k, d);
      }
    }
    // Style en ligne (variables seulement : couleur et fond sont déclarés en CSS).
    const inline = n.attrs.style;
    if (inline) for (const part of inline.split(';')) {
      const i = part.indexOf(':');
      if (i > 0) m.set(part.slice(0, i).trim().toLowerCase(), { value: part.slice(i + 1).trim(), important: false, spec: { a: 1, b: 0, c: 0 }, order: 1e9 });
    }
    cache.set(n, m);
    return m;
  };
  return { unsupported, get: (n, prop) => declsFor(n).get(prop)?.value, props: declsFor };
}

// États d'un élément ciblé : :hover et :active se propagent aux ancêtres, :focus et :focus-visible non.
export function statesFor(target: HNode, state: State): Map<HNode, Set<string>> {
  const m = new Map<HNode, Set<string>>();
  const add = (n: HNode, s: string): void => { if (!m.has(n)) m.set(n, new Set()); m.get(n)?.add(s); };
  if (state === 'hover' || state === 'active') for (const n of [target, ...ancestors(target)]) { add(n, 'hover'); if (state === 'active') add(n, 'active'); }
  if (state === 'focus') { add(target, 'focus'); add(target, 'focus-visible'); for (const a of ancestors(target)) add(a, 'focus-within'); }
  return m;
}

// Valeur héritée (color, font-family) : premier ancêtre-ou-soi qui la déclare autrement que inherit.
export function inherited(c: Cascade, n: HNode, prop: string): { value: string; from: HNode } | null {
  for (const x of [n, ...ancestors(n)]) {
    if (x.tag === '#text' || x.tag === '#root') continue;
    const v = c.get(x, prop);
    if (v !== undefined && !/^(inherit|unset)$/i.test(v)) return { value: v, from: x };
  }
  return null;
}
