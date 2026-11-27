// Outils des tests du tour Y (tmp/refonte-arbre/contrat-recette-y.md, Y1 à Y11 : corrections de recette du lot 6b).
// Aucune lecture de l'export au chargement du module. Interface attendue du codeur : rapport-tests-recette-y.md §3.
//
// Référence de départ (f43e1cf) : tests/fixtures/recette-y-depart.json, figée par fixtures/figer-recette-y.ts sur un
// export de départ construit hors dépôt (recensement des flèches par lien, nombre d'apostrophes entre deux lettres et de
// plages de dates par page). Les adresses mailto: y sont masquées (« mailto:<adresse> »).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { headMeta } from './helpers-2b.ts';
import { DESKTOP, PHONE, cascade, complexMatch, mediaMatches } from './helpers-cascade.ts';
import type { Cascade, Env } from './helpers-cascade.ts';
import { ldBlocks, ldStrings } from './helpers-6.ts';
import { ancestors, byTag, exportCss, parseHtml } from './helpers-home.ts';
import type { CssRule, HNode } from './helpers-home.ts';
import { pageHtml } from './helpers-scene.ts';
import { ORIGIN, distDir, readManifest, siteDir } from './helpers.ts';

export const DEPART_Y = join(siteDir, 'tests', 'fixtures', 'recette-y-depart.json');
export const pages21 = (): string[] => [...readManifest().paths.flatMap((p) => ['/' + p, '/fr/' + p]), '/404.html'];
export const HOMES_Y: readonly string[] = ['/', '/fr/'];
export const STORIES_Y: readonly string[] = ['/projects/droit-de-retard/', '/fr/projects/droit-de-retard/', '/projects/diary/', '/fr/projects/diary/', '/projects/croix-rouge/', '/fr/projects/croix-rouge/'];
export const EXPERIENCES_Y: readonly string[] = ['/experiences/bnp-paribas/', '/fr/experiences/bnp-paribas/', '/experiences/bpce/', '/fr/experiences/bpce/', '/experiences/ecole-42/', '/fr/experiences/ecole-42/'];
export const redactMail = (s: string): string => s.replace(/^mailto:.*$/i, 'mailto:<adresse>').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<adresse>');

const docs = new Map<string, HNode>();
export function docY(route: string, root: string = distDir): HNode {
  const k = root + '|' + route;
  let d = docs.get(k);
  if (!d) docs.set(k, (d = parseHtml(pageHtml(route, root))));
  return d;
}
export const bodyY = (d: HNode): HNode => byTag(d, 'body')[0] ?? d;
export function descendants(n: HNode): HNode[] {
  const out: HNode[] = [];
  const w = (x: HNode): void => { for (const c of x.children) if (c.tag !== '#text') { out.push(c); w(c); } };
  w(n);
  return out;
}
export const rawText = (n: HNode): string => (n.tag === '#text' ? n.text : n.tag === 'script' || n.tag === 'style' ? '' : n.children.map(rawText).join(''));

// ---- Y3 : flèches portées par les liens ----
export const ARROW_RE = /[←-⇿⟰-⟿⤀-⥿⬀-⬑]/gu;
export const arrowsIn = (s: string): string[] => s.match(ARROW_RE) ?? [];
// Sortie du site : http(s) vers une autre origine que https://wesper-dev.github.io, ou mailto:. Tout le reste (chemin du
// site, ancre, PDF du CV, image du récit) est interne.
export const isExit = (href: string): boolean => /^mailto:/i.test(href) || (/^https?:\/\//i.test(href) && !(href === ORIGIN || href.startsWith(ORIGIN + '/')));
// Href comparable d'un recensement à l'autre : mailto masqué, image du récit droit-de-retard sans extension (Y11).
export const hrefKey = (href: string): string => redactMail(href).replace(/^\/images\/droit-de-retard\.[a-z0-9]+$/i, '/images/droit-de-retard.<image>');

export interface PseudoArrow { base: string; glyphs: string[]; media: string | null; selector: string }
// Règles CSS qui dessinent une flèche dans un ::before ou ::after (content), avec le sélecteur de l'élément porteur.
export function pseudoArrows(rules: CssRule[] = exportCss().rules): PseudoArrow[] {
  const out: PseudoArrow[] = [];
  for (const r of rules) {
    const content = r.decls.get('content');
    if (!content) continue;
    const glyphs = arrowsIn(content.replace(/\\(2[0-9a-f]{3})\s?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))));
    if (!glyphs.length) continue;
    for (const sel of r.selectors) {
      const m = /^(.*?)::?(before|after)$/.exec(sel.trim());
      if (m) out.push({ base: (m[1] ?? '').trim() || '*', glyphs, media: r.media, selector: sel });
    }
  }
  return out;
}
export interface LinkArrow { route: string; href: string; key: string; text: string; glyphs: string[]; exit: boolean; cls: string }
const ENVS_Y: Env[] = [DESKTOP, PHONE, { ...DESKTOP, width: 1024 }];
export function linkArrows(route: string, root: string = distDir, pseudo: PseudoArrow[] = pseudoArrows(exportCss(root).rules), doc: HNode = docY(route, root)): LinkArrow[] {
  const body = bodyY(doc);
  return byTag(body, 'a').filter((a) => a.attrs.href !== undefined).map((a) => {
    const href = a.attrs.href ?? '';
    const text = rawText(a);
    const glyphs = arrowsIn(text);
    const nodes = [a, ...descendants(a)];
    const seen = new Set<string>();
    for (const p of pseudo) {
      for (const n of nodes) {
        const ok = ENVS_Y.some((env) => mediaMatches(p.media, env) && (() => { try { return complexMatch(n, p.base, { states: new Map(), env }); } catch { return false; } })());
        if (ok && !seen.has(p.selector + '|' + nodes.indexOf(n))) { seen.add(p.selector + '|' + nodes.indexOf(n)); glyphs.push(...p.glyphs); }
      }
    }
    return { route, href, key: hrefKey(href), text: text.replace(/\s+/g, ' ').trim(), glyphs, exit: isExit(href), cls: a.attrs.class ?? '' };
  });
}
// Exceptions nommées de Y3 (flèches de direction, pas de sortie) : « ← » du lien de retour d'un récit vers sa
// rubrique (.back-link), « ↑ » du lien « En haut » vers #main.
export const directionalOk = (l: LinkArrow, g: string): boolean => (g === '←' && /\bback-link\b/.test(l.cls)) || (g === '↑' && l.href === '#main');

// ---- Y4 : apostrophes entre deux lettres ----
export const STRAIGHT_RE = /(?<=\p{L})'(?=\p{L})/gu;
export const CURLY_RE = /(?<=\p{L})’(?=\p{L})/gu;
const NO_TEXT = new Set(['script', 'style', 'template', 'code', 'pre', 'kbd', 'samp']);
const TEXT_ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'aria-description'];
export interface TextSite { where: string; text: string }
// Textes d'une page soumis à Y4 : texte de <body> (hors code et scripts), attributs textuels, <title>, méta-données
// (content de toutes les <meta> nommées), chaînes du JSON-LD.
export function pageTextSites(route: string, root: string = distDir): TextSite[] {
  const html = pageHtml(route, root);
  const d = docY(route, root);
  const out: TextSite[] = [];
  const w = (x: HNode, path: string): void => {
    if (x.tag === '#text') { if (x.text.trim()) out.push({ where: `${path.replace(/>#text$/, '')} (texte)`, text: x.text }); return; }
    if (NO_TEXT.has(x.tag)) return;
    for (const a of TEXT_ATTRS) if (x.attrs[a]) out.push({ where: `${path}[${a}]`, text: x.attrs[a] as string });
    for (const c of x.children) w(c, `${path}>${c.tag}`);
  };
  w(bodyY(d), 'body');
  const hm = headMeta(html);
  for (const t of hm.titles) out.push({ where: '<title>', text: t });
  for (const [k, vs] of hm.metas) for (const v of vs) out.push({ where: `<meta ${k}>`, text: v });
  for (const b of ldBlocks(html)) if (!b.error) for (const s of ldStrings(b.data)) out.push({ where: 'JSON-LD', text: s });
  return out;
}
export const countRe = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
export const around = (s: string, i: number): string => s.slice(Math.max(0, i - 24), i + 24).replace(/\s+/g, ' ');

// ---- Y5 : plages de dates ----
const MONTH = "(?:janv(?:ier)?|f[ée]vr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|october|november|dec(?:ember)?)\\.?";
const SP = '[\\s\\u00a0\\u202f\\u2007\\u2060]';
const DATE = `(?:\\d{1,2}${SP}+)?(?:${MONTH}${SP}+)?\\d{4}`;
// « 14 juin 2025 – 15 juin 2025 », « avr. 2026 – oct. 2026 », « 2019–2026 », « 4–5 April 2025 », « 4 et 5 avril 2025 ».
export const DATE_RANGE_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${DATE}${SP}*[–—-]${SP}*${DATE}|\\d{1,2}${SP}*(?:[–—-]|et|and|to)${SP}*\\d{1,2}${SP}+${MONTH}${SP}+\\d{4})(?![\\p{L}\\p{N}])`, 'giu');
// Blanc où une ligne peut se couper (les insécables U+00A0, U+202F, U+2007 et U+2060 ne le sont pas).
export const BREAKABLE_RE = /[\t\n\r\f   -  -​ 　]/u;
const BLOCKS = new Set(['address', 'article', 'aside', 'blockquote', 'body', 'br', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'section', 'table', 'td', 'th', 'tr', 'ul', 'button']);
// Texte brut de chaque bloc (les sous-blocs sont coupés), blancs d'origine conservés ; pour chaque caractère, vrai s'il
// est dans un élément où la ligne ne peut pas se couper (white-space nowrap ou pre, text-wrap-mode nowrap ; cascade
// exportée, bureau ET téléphone).
export interface Run { text: string; nowrap: boolean[] }
export function blockRuns(root: HNode, nowrapOf: (el: HNode) => boolean = () => false): Run[] {
  const runs: Run[] = [];
  let cur: Run = { text: '', nowrap: [] };
  const flush = (): void => { if (cur.text.trim()) runs.push(cur); cur = { text: '', nowrap: [] }; };
  const w = (x: HNode, parent: HNode | null): void => {
    if (x.tag === '#text') { const nw = parent ? nowrapOf(parent) : false; cur.text += x.text; for (const _ of x.text) cur.nowrap.push(nw); return; }
    if (NO_TEXT.has(x.tag) || x.attrs['aria-hidden'] === 'true') return;
    const block = BLOCKS.has(x.tag);
    if (block) flush();
    for (const c of x.children) w(c, x);
    if (block) flush();
  };
  w(root, null);
  flush();
  return runs;
}
const NOWRAP_PROPS = ['white-space', 'text-wrap-mode', 'text-wrap'];
export function nowrapFor(root: string = distDir): (el: HNode) => boolean {
  const rules = exportCss(root).rules;
  const cs = [DESKTOP, PHONE].map((env) => cascade(rules, { states: new Map(), env }));
  const memo = new Map<HNode, boolean>();
  return (el: HNode): boolean => {
    let v = memo.get(el);
    if (v === undefined) {
      v = cs.every((c) => {
        for (const x of [el, ...ancestors(el)]) {
          if (x.tag === '#text' || x.tag === '#root') continue;
          const props = c.props(x);
          const d = NOWRAP_PROPS.map((p) => props.get(p)?.value).find((val) => val !== undefined && !/^(inherit|unset)$/i.test(val));
          if (d !== undefined) return /^(nowrap|pre)\b/i.test(d.trim());
        }
        return false;
      });
      memo.set(el, v);
    }
    return v;
  };
}
// Plage protégée : aucun blanc sécable ET pas de coupure possible après un tiret, soit parce que toute la plage est dans un
// élément nowrap, soit parce que chaque tiret est suivi de U+2060 (WORD JOINER). Une insécable après le tiret ne suffit
// pas : UAX #14 (LB12a) autorise la coupure entre « – » et U+00A0 (constaté dans Chromium et WebKit, verif-7 Y5.1).
export interface DateRange { range: string; breakable: boolean; why: string }
export function dateRangesOf(route: string, root: string = distDir, nowrapOf: (el: HNode) => boolean = nowrapFor(root)): DateRange[] {
  return dateRangesIn(bodyY(docY(route, root)), nowrapOf);
}
export function dateRangesIn(body: HNode, nowrapOf: (el: HNode) => boolean): DateRange[] {
  const out: DateRange[] = [];
  for (const run of blockRuns(body, nowrapOf)) {
    for (const m of run.text.matchAll(DATE_RANGE_RE)) {
      const start = [...run.text.slice(0, m.index ?? 0)].length;
      const cs = [...m[0]];
      const all = cs.every((_, i) => run.nowrap[start + i]);
      const blank = BREAKABLE_RE.test(m[0]);
      const dash = !all && cs.some((ch, i) => /[–—-]/.test(ch) && cs[i + 1] !== '\u2060');
      out.push({ range: m[0], breakable: blank || dash, why: blank ? 'espace sécable' : dash ? 'coupure possible après le tiret (ni parent nowrap, ni U+2060)' : '' });
    }
  }
  return out;
}
export const showBlanks = (s: string): string => s.replace(/[\s   ⁠]/g, (c) => (c === ' ' ? '␠' : c === ' ' ? '⍽' : c === ' ' ? '⁀' : `<U+${c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}>`));

// ---- Y5 : text-wrap des titres (propriété héritée ; text-wrap est le raccourci de text-wrap-mode et text-wrap-style) ----
export function textWrapStyle(c: Cascade, n: HNode): string {
  for (const x of [n, ...ancestors(n)]) {
    if (x.tag === '#root' || x.tag === '#text') continue;
    const props = c.props(x);
    const cands = ['text-wrap', 'text-wrap-style'].map((p) => ({ p, d: props.get(p) })).filter((e) => e.d && !/^(inherit|unset)$/i.test(e.d.value));
    if (!cands.length) continue;
    const win = cands.reduce((a, b) => {
      const da = a.d!, db = b.d!;
      if (da.important !== db.important) return da.important ? a : b;
      const cmp = da.spec.a - db.spec.a || da.spec.b - db.spec.b || da.spec.c - db.spec.c || da.order - db.order;
      return cmp >= 0 ? a : b;
    });
    const v = win.d!.value.trim().toLowerCase();
    const style = v.split(/\s+/).find((t) => ['balance', 'pretty', 'stable', 'auto'].includes(t));
    return style ?? (/^(wrap|nowrap)$/.test(v) && win.p === 'text-wrap' ? 'auto' : v);
  }
  return 'auto';
}

// ---- Référence de départ ----
export interface DepartY {
  commit: string;
  commande: string;
  fleches: Record<string, [string, number][]>; // route → [hrefKey, nombre de flèches] trié
  apostrophes: Record<string, number>; // route → apostrophes entre deux lettres (droites + courbes), textes de pageTextSites
  plages: Record<string, number>; // route → plages de dates (DATE_RANGE_RE) portant au moins un blanc
  images: Record<string, StoryImage[]>; // récits droit-de-retard (FR, EN) → images de /images/droit-de-retard.* (Y11)
  llmsApostrophes: number;
}
export interface StoryImage { src: string; width: string; height: string; alt: string; loading: string; bytes: number }
export const DDR_ROUTES: readonly string[] = ['/projects/droit-de-retard/', '/fr/projects/droit-de-retard/'];
export function storyImages(route: string, root: string = distDir): StoryImage[] {
  return byTag(bodyY(docY(route, root)), 'img').filter((i) => /^\/images\/droit-de-retard\./.test(i.attrs.src ?? '')).map((i) => {
    const f = join(root, i.attrs.src as string);
    return { src: i.attrs.src as string, width: i.attrs.width ?? '', height: i.attrs.height ?? '', alt: i.attrs.alt ?? '', loading: i.attrs.loading ?? '', bytes: existsSync(f) ? statSync(f).size : -1 };
  });
}
export function readDepartY(): DepartY {
  if (!existsSync(DEPART_Y)) throw new Error(`${DEPART_Y} absent (référence du tour Y, figée par tests/fixtures/figer-recette-y.ts)`);
  return JSON.parse(readFileSync(DEPART_Y, 'utf8')) as DepartY;
}
export function departSnapshot(root: string): Omit<DepartY, 'commit' | 'commande' | 'llmsApostrophes'> {
  const images: DepartY['images'] = {};
  for (const r of DDR_ROUTES) images[r] = storyImages(r, root);
  const pseudo = pseudoArrows(exportCss(root).rules);
  const fleches: DepartY['fleches'] = {};
  const apostrophes: DepartY['apostrophes'] = {};
  const plages: DepartY['plages'] = {};
  for (const r of pages21()) {
    fleches[r] = linkArrows(r, root, pseudo).map((l): [string, number] => [l.key, l.glyphs.length]).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
    apostrophes[r] = pageTextSites(r, root).reduce((n, t) => n + countRe(t.text, STRAIGHT_RE) + countRe(t.text, CURLY_RE), 0);
    plages[r] = dateRangesOf(r, root, () => false).filter((x) => /[\s  ]/.test(x.range)).length;
  }
  return { fleches, apostrophes, plages, images };
}
