// Outils des tests du lot 4, corrections d'audit (tmp/refonte-arbre/arbitrage-audit-lot4.md, R1 à R7).
// R1 : repérage, dans le texte français, des blancs sécables qui laissent une ligne commencer par « : ; ? ! » » ou
// finir par « « ». Le texte est lu bloc par bloc (un élément de bloc coupe le texte, un élément en ligne non) ; la
// langue est celle du plus proche ancêtre porteur de lang. Le code (code, pre, kbd, samp) n'est pas lu.
// Aucune lecture de l'export au chargement du module.
import { NBSP, NNBSP } from './helpers-typo.ts';
import { parseHtml } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';

export const SIGNS_BEFORE = ':;?!»'; // signes précédés d'une espace en français
export const RUBRIC_PATHS: readonly string[] = ['projects/', 'hackathons/', 'skills/'];
export const RUBRIC_ROUTES: readonly string[] = RUBRIC_PATHS.flatMap((p) => ['/' + p, '/fr/' + p]);

// Blanc qui autorise une coupure de ligne : tout blanc (\s) et l'espace sans chasse U+200B, sauf les insécables
// (U+00A0, U+202F, U+2007) et le gluon U+2060.
export const breakable = (c: string | undefined): boolean => !!c && /[\s\u200b]/.test(c) && !'\u00a0\u202f\u2007\u2060'.includes(c);
const isWs = (c: string | undefined): boolean => !!c && /[\s\u200b\u2060]/.test(c);
export const cp = (c: string): string => 'U+' + (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');

// Texte d'un bloc : chaque caractère avec sa langue. OPAQUE remplace un élément de code (ni blanc, ni français).
export interface Run { text: string; fr: boolean[] }
const OPAQUE = '\u0001';
const SKIP = new Set(['script', 'style', 'template', 'textarea', 'title', 'desc', 'head']);
const CODE = new Set(['code', 'pre', 'kbd', 'samp']);
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'body', 'br', 'button', 'caption', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'html', 'img', 'li', 'main', 'nav', 'noscript', 'ol', 'option', 'p', 'section', 'select', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'svg']);

export function frenchRuns(html: string): Run[] {
  const runs: Run[] = [];
  let cur: Run = { text: '', fr: [] };
  const flush = (): void => {
    if (cur.text.replace(/\s/g, '').length) runs.push(cur);
    cur = { text: '', fr: [] };
  };
  const walkNode = (n: HNode, lang: string): void => {
    if (n.tag === '#text') {
      for (const ch of n.text) {
        cur.text += ch;
        cur.fr.push(lang.startsWith('fr'));
      }
      return;
    }
    if (SKIP.has(n.tag)) return;
    if (CODE.has(n.tag)) {
      cur.text += OPAQUE;
      cur.fr.push(false);
      return;
    }
    const l = (n.attrs.lang ?? lang).toLowerCase();
    const block = BLOCK.has(n.tag);
    if (block) flush();
    for (const c of n.children) walkNode(c, l);
    if (block) flush();
  };
  const doc = parseHtml(html);
  const htmlEl = doc.children.find((c) => c.tag === 'html');
  const lang = (htmlEl?.attrs.lang ?? '').toLowerCase();
  walkNode(htmlEl ?? doc, lang);
  flush();
  // Les tableaux fr suivent les unités de code : un caractère hors BMP compte pour deux.
  return runs.map((r) => ({ text: r.text, fr: [...r.text].flatMap((ch, i) => (ch.length === 2 ? [r.fr[i] ?? false, r.fr[i] ?? false] : [r.fr[i] ?? false])) }));
}

// Jeton d'URL autour d'une position (« https://… », « www.… ») : non contrôlé.
function inUrl(text: string, i: number): boolean {
  let a = i;
  while (a > 0 && !/\s/.test(text[a - 1] ?? ' ')) a--;
  let b = i;
  while (b < text.length && !/\s/.test(text[b] ?? ' ')) b++;
  return /(?:[a-z][\w+.-]*:\/\/|www\.|mailto:)/i.test(text.slice(a, b));
}

export interface SpacingIssue { at: number; message: string }
// Écarts à R1 dans une chaîne (fr(i) : le caractère i est français). Pour « ; ? ! », U+202F est attendu ; U+00A0
// est admis ici, parce qu'un texte en IBM Plex Mono n'a pas U+202F : le caractère exact selon la police rendue est
// contrôlé en navigateur (verif-4, R1.2).
export function spacingIssues(text: string, fr: (i: number) => boolean = () => true): SpacingIssue[] {
  const out: SpacingIssue[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (!fr(i)) continue;
    if (SIGNS_BEFORE.includes(c) && i > 0 && isWs(text[i - 1]) && !inUrl(text, i)) {
      let a = i;
      while (a > 0 && isWs(text[a - 1])) a--;
      const run = text.slice(a, i);
      const bad = [...run].find(breakable);
      if (bad) out.push({ at: i, message: `blanc sécable ${cp(bad)} devant « ${c} »` });
      else if ((c === ':' || c === '»') && run !== NBSP) out.push({ at: i, message: `${[...run].map(cp).join('+')} devant « ${c} » (U+00A0 seul attendu)` });
      else if (c !== ':' && c !== '»' && run !== NNBSP && run !== NBSP) out.push({ at: i, message: `${[...run].map(cp).join('+')} devant « ${c} » (U+202F seul attendu)` });
    }
    if (c === '«' && isWs(text[i + 1])) {
      let b = i + 1;
      while (b < text.length && isWs(text[b])) b++;
      const run = text.slice(i + 1, b);
      const bad = [...run].find(breakable);
      if (bad) out.push({ at: i, message: `blanc sécable ${cp(bad)} après « « »` });
      else if (run !== NBSP) out.push({ at: i, message: `${[...run].map(cp).join('+')} après « « » (U+00A0 seul attendu)` });
    }
  }
  return out;
}

export const context = (text: string, at: number): string => text.slice(Math.max(0, at - 28), at + 18).replace(/\s/g, (s) => (s === ' ' ? ' ' : `⟨${cp(s)}⟩`));

// Écarts R1 dans le texte français d'une page exportée.
export function pageSpacingIssues(html: string): string[] {
  const out: string[] = [];
  for (const r of frenchRuns(html)) for (const x of spacingIssues(r.text, (i) => r.fr[i] ?? false)) out.push(`${x.message} dans « …${context(r.text, x.at)}… »`);
  return out;
}

// Nombre de signes français précédés d'un blanc (quel qu'il soit) et de « suivis d'un blanc. Une espace retirée
// (« chacun : » devenu « chacun: ») le fait baisser ; R1 ne change que le type du blanc.
export function spacedSigns(html: string): number {
  let n = 0;
  for (const r of frenchRuns(html)) {
    for (let i = 0; i < r.text.length; i++) {
      if (!r.fr[i]) continue;
      const c = r.text[i] as string;
      if (SIGNS_BEFORE.includes(c) && i > 0 && isWs(r.text[i - 1]) && !inUrl(r.text, i)) n++;
      if (c === '«' && isWs(r.text[i + 1])) n++;
    }
  }
  return n;
}

// Chaînes françaises d'une valeur de content/* : toute chaîne sous une clé « fr ». Rend [chemin, chaîne].
export function frenchStrings(x: unknown, path = '', inFr = false, out: [string, string][] = []): [string, string][] {
  if (typeof x === 'string') {
    if (inFr) out.push([path, x]);
  } else if (Array.isArray(x)) x.forEach((v, i) => frenchStrings(v, `${path}[${i}]`, inFr, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) frenchStrings(v, path ? `${path}.${k}` : k, inFr || k === 'fr', out);
  return out;
}

// Texte d'un récit Markdown sans le code (blocs et en ligne), sans les cibles de liens ni les commentaires.
export const markdownProse = (md: string): string =>
  md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, '\u0001')
    .replace(/\]\([^)\s]*\)/g, ']');
