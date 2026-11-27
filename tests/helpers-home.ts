// Utilitaires des tests du contrat lot 2a (accueil dans la nouvelle DA). node:test + node:assert, aucune dépendance npm.
// Les modules nouveaux du 2a sont importés dynamiquement : un module absent fait échouer chaque test avec un message clair.
// Les contrôles d'export lisent dist/client (mode détecté par robots.txt, comme C3) et lèvent une erreur claire s'il manque.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
import { distDir, readManifest } from './helpers.ts';
import type { ExportMode } from './helpers.ts';
import { HOME_ROUTES, allFiles, filesUnder, pageHtml, requireDist, siteDir, visibleText } from './helpers-scene.ts';
import { faitsText } from './helpers-tree.ts';
import { untypoModule } from './helpers-typo.ts';

export { HOME_ROUTES, distDir, pageHtml, siteDir };

// deno-lint-ignore no-explicit-any
export type Mod = any;
export type Locale = 'fr' | 'en';
export const LOCALES: readonly Locale[] = ['fr', 'en'];

export const localeOf = (route: string): Locale => (route.startsWith('/fr/') ? 'fr' : 'en');
export const prefixOf = (l: Locale): string => (l === 'fr' ? '/fr/' : '/');
export const otherLocale = (l: Locale): Locale => (l === 'fr' ? 'en' : 'fr');

export async function load2a(rel: string): Promise<Mod> {
  const full = join(siteDir, rel);
  if (!existsSync(full)) throw new Error(`module absent : site/${rel} (contrat lot 2a)`);
  try {
    // Lot 4, R1 : chaînes de content/* sans blanc insécable pour ces tests (helpers-typo.ts).
    return untypoModule(rel, await import(pathToFileURL(full).href));
  } catch (e) {
    throw new Error(`module site/${rel} présent mais en erreur à l'import : ${(e as Error).message}`);
  }
}

export const homeMods = {
  cards: (): Promise<Mod> => load2a('content/cards.ts'),
  homeUi: (): Promise<Mod> => load2a('content/home-ui.ts'),
  treeUi: (): Promise<Mod> => load2a('content/tree-ui.ts'),
  atelier: (): Promise<Mod> => load2a('content/atelier.ts'),
  home: (): Promise<Mod> => load2a('content/home.ts'),
  experiences: (): Promise<Mod> => load2a('content/experiences.ts'),
  tree: (): Promise<Mod> => load2a('content/tree.ts'),
  palettes: (): Promise<Mod> => load2a('content/palettes.ts'),
  color: (): Promise<Mod> => load2a('lib/tree/color.ts'),
};

// Valeur d'interface d'une langue : obj[l][key] (forme fixée par contrat-lot2a-tests §3), à défaut obj[key][l].
export function uiText(obj: Mod, l: Locale, key: string): string | undefined {
  const a = obj?.[l]?.[key];
  if (typeof a === 'string') return a;
  const b = obj?.[key]?.[l];
  return typeof b === 'string' ? b : undefined;
}

// Composants de l'accueil soumis à la règle D4.3 étendue (contrat-lot2a-tests §3) : tous les .tsx de components/tree
// et de components/home (s'il existe). portfolio-home.tsx est à part (littéraux existants admis).
export function homeComponents(): string[] {
  return [...filesUnder('components/tree', /\.tsx$/), ...filesUnder('components/home', /\.tsx$/)];
}
export const PORTFOLIO_HOME = 'components/portfolio-home.tsx';

// Source d'un fichier du lot 2a, avec message clair s'il manque.
export function readSrc2a(rel: string): string {
  const p = join(siteDir, rel);
  if (!existsSync(p)) throw new Error(`fichier absent : site/${rel} (contrat lot 2a)`);
  return readFileSync(p, 'utf8');
}

// ---- E3.1 : table des textes tirés de FAITS, codée en dur (contrat-lot2a-tests §4.1) ----

export interface CardText { role?: string; dates?: string; result: string; subtitle: string }
export const E31_CARDS: Record<string, Record<Locale, CardText>> = {
  'bnp-paribas': {
    fr: { role: 'Data Scientist (stage)', dates: 'sept. 2025 – mars 2026', result: '3–5 min → 1–3 min par rapport', subtitle: 'outil validé pour la production par le comité de pilotage' },
    en: { role: 'Data Scientist Intern', dates: 'Sep 2025 – Mar 2026', result: '3–5 min → 1–3 min per report', subtitle: 'tool approved for production by the steering committee' },
  },
  bpce: {
    fr: { role: 'Ingénierie plateforme IA (stage)', dates: 'avr. 2026 – oct. 2026', result: 'Isolation des outils d’agents', subtitle: 'Docker, exécution non root, réseau en liste blanche' },
    en: { role: 'AI Platform Engineering Intern', dates: 'Apr 2026 – Oct 2026', result: 'Isolating agent tools', subtitle: 'Docker, non-root execution, allow-listed network' },
  },
  'croix-rouge': {
    fr: { role: 'Contribution IA bénévole', dates: '2025', result: 'Bénévole : front du chatbot et RAG co-construit', subtitle: 'plateforme d’équipe testée auprès d’environ 50 secouristes' },
    en: { role: 'Volunteer AI Contributor', dates: '2025', result: 'Volunteer: chatbot front end and co-built RAG', subtitle: 'team platform tested with about 50 first-aiders' },
  },
  'ecole-42': {
    fr: { result: 'École 42 Paris, 2019–2026', subtitle: 'Les fondations : C, UNIX, projets système' },
    en: { result: 'École 42 Paris, 2019–2026', subtitle: 'The foundations: C, UNIX, systems projects' },
  },
  'droit-de-retard': {
    fr: { role: 'Projet personnel', dates: '2026', result: 'Plus de 120 tests hors ligne', subtitle: 'brouillon de réclamation pour vol retardé, prototype local-first' },
    en: { role: 'Personal project', dates: '2026', result: 'More than 120 offline tests', subtitle: 'draft flight-delay claim, local-first prototype' },
  },
};
export const E31_TITLE: Record<Locale, string> = { fr: 'Ingénieur logiciel', en: 'Software Engineer' };
export const E31_CASE_LINK: Record<Locale, string> = { fr: 'Lire le cas BNP Paribas', en: 'Read the BNP Paribas case' };
export const E31_AVAILABILITY: Record<Locale, string> = {
  fr: 'Disponible immédiatement — CDI ; ouvert au freelance et aux projets open source',
  en: 'Available now — permanent role; open to freelance and open-source projects',
};
export const E31_FITNESS: Record<Locale, string> = {
  fr: 'Coach depuis plus de 3 ans : plus de 50 séances, dont plus de 20 menées seul, 15 à 20 personnes par séance.',
  en: 'Coach for 3+ years: 50+ sessions, 20+ of them solo-led, 15–20 participants each.',
};
// E3.3 : textes d'interface proposés par le contrat.
export const E33_HOME_UI: Record<Locale, Record<string, string>> = {
  fr: { cv: 'CV', menu: 'Menu', mainNav: 'Navigation principale', close: 'Fermer', storyLink: 'Lire le récit' },
  en: { cv: 'CV', menu: 'Menu', mainNav: 'Main navigation', close: 'Close', storyLink: 'Read the story' },
};
export const E33_TREE_NAV: Record<Locale, string> = { fr: 'Expériences', en: 'Experiences' };
// E3.2 : textes existants repris par renvoi.
export const E32_LANG_LABEL: Record<Locale, { text: string; aria: string }> = {
  fr: { text: 'EN', aria: 'Read in English' },
  en: { text: 'FR', aria: 'Lire en français' },
};
export const E32_TOP: Record<Locale, string> = { fr: 'En haut ↑', en: 'Back to top ↑' };
export const E32_READ_STORY: Record<Locale, string> = { fr: 'Lire le récit', en: 'Read the story' };
export const E32_ALL_PROJECTS: Record<Locale, string> = { fr: 'Tous les projets', en: 'All projects' };
export const E32_ALL_HACKATHONS: Record<Locale, string> = { fr: 'Tous les hackathons', en: 'All hackathons' };
export const GITHUB_URL = 'https://github.com/Wesper-Dev';
export const CV_HREF: Record<Locale, string> = { fr: '/cv/arnaud-durand-cv-platform-fr.pdf', en: '/cv/arnaud-durand-cv-platform-en.pdf' };

// Chaînes de la table E3.1 (F12 : candidates de la copie versionnée, extractFaitsTexts de helpers-faits.ts).
// Tour Y (Y4) : les chaînes de la table sont écrites avec U+2019 entre deux lettres, comme le site ; FAITS.md et sa
// copie versionnée gardent l'apostrophe droite. Candidats de l'extracteur F12 : chaque chaîne et sa forme droite.
export const straightApos = (s: string): string => s.replace(/(?<=\p{L})\u2019(?=\p{L})/gu, "'");
export const e31FaitsCandidates = (): string[] => [...new Set(e31Candidates().flatMap((s) => [s, straightApos(s)]))];
export function e31Candidates(): string[] {
  const out: string[] = [];
  for (const l of ['fr', 'en'] as const) {
    out.push(E31_TITLE[l], E31_CASE_LINK[l], E31_AVAILABILITY[l], E31_FITNESS[l]);
    for (const byL of Object.values(E31_CARDS)) for (const v of Object.values(byL[l])) if (typeof v === 'string') out.push(v);
  }
  return out;
}

// Rôle « · » dates attendu dans [data-card-role] (E6.2), ou null si la fiche n'a pas de rôle.
export function expectedRole(id: string, l: Locale): string | null {
  const c = E31_CARDS[id]?.[l];
  if (!c?.role) return null;
  return c.dates ? `${c.role} · ${c.dates}` : c.role;
}

// FAITS réduit : blancs seulement (ni apostrophes, ni tirets, ni insécables remplacés).
export const squash = (s: string): string => s.replace(/[ \t\r\n]+/g, ' ').trim();
let faitsSquashed: string | null = null;
export function faitsFlat(): string {
  if (faitsSquashed === null) faitsSquashed = squash(faitsText());
  return faitsSquashed;
}

// ---- Arbre HTML minimal (export React bien formé) ----

export interface HNode {
  tag: string; // '#text' pour un nœud de texte
  attrs: Record<string, string>;
  children: HNode[];
  parent: HNode | null;
  text: string; // texte brut décodé pour '#text'
  start: number;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', rsquo: '’', lsquo: '‘', hellip: '…', ndash: '–', mdash: '—', rarr: '→', uarr: '↑' };
export function decode(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, b: string) => {
    if (b[0] === '#') return String.fromCodePoint(b[1] === 'x' || b[1] === 'X' ? parseInt(b.slice(2), 16) : parseInt(b.slice(1), 10));
    return ENT[b.toLowerCase()] ?? whole;
  });
}

function parseAttrs(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    out[(m[1] ?? '').toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

export function parseHtml(html: string): HNode {
  const root: HNode = { tag: '#root', attrs: {}, children: [], parent: null, text: '', start: 0 };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  let last = 0;
  const pushText = (s: string, at: number): void => {
    if (s.length) cur.children.push({ tag: '#text', attrs: {}, children: [], parent: cur, text: decode(s), start: at });
  };
  for (let m = re.exec(html); m; m = re.exec(html)) {
    pushText(html.slice(last, m.index), last);
    last = re.lastIndex;
    if (!m[2]) continue; // commentaire ou doctype
    const tag = m[2].toLowerCase();
    if (m[1] === '/') {
      let n: HNode | null = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent;
      continue;
    }
    const body = m[3] ?? '';
    const node: HNode = { tag, attrs: parseAttrs(body.replace(/\/\s*$/, '')), children: [], parent: cur, text: '', start: m.index };
    cur.children.push(node);
    if (VOID.has(tag) || /\/\s*$/.test(body)) continue;
    if (RAW.has(tag)) {
      const close = new RegExp(`</${tag}\\s*>`, 'ig');
      close.lastIndex = last;
      const c = close.exec(html);
      const end = c ? c.index : html.length;
      if (tag !== 'script' && tag !== 'style') node.children.push({ tag: '#text', attrs: {}, children: [], parent: node, text: decode(html.slice(last, end)), start: last });
      last = c ? close.lastIndex : html.length;
      re.lastIndex = last;
      continue;
    }
    cur = node;
  }
  pushText(html.slice(last), last);
  return root;
}

export const isEl = (n: HNode): boolean => n.tag !== '#text';
export const has = (n: HNode, a: string): boolean => Object.prototype.hasOwnProperty.call(n.attrs, a);
export const elChildren = (n: HNode): HNode[] => n.children.filter(isEl);

export function walk(n: HNode, fn: (x: HNode) => void): void {
  fn(n);
  for (const c of n.children) walk(c, fn);
}
export function findAll(n: HNode, pred: (x: HNode) => boolean): HNode[] {
  const out: HNode[] = [];
  walk(n, (x) => {
    if (x !== n && isEl(x) && pred(x)) out.push(x);
  });
  return out;
}
export const byAttr = (n: HNode, a: string, v?: string): HNode[] => findAll(n, (x) => has(x, a) && (v === undefined || x.attrs[a] === v));
export const byTag = (n: HNode, t: string): HNode[] => findAll(n, (x) => x.tag === t);
export function ancestors(n: HNode): HNode[] {
  const out: HNode[] = [];
  for (let p = n.parent; p; p = p.parent) out.push(p);
  return out;
}
export const contains = (a: HNode, b: HNode): boolean => ancestors(b).includes(a);
export function textOfNode(n: HNode): string {
  if (n.tag === '#text') return n.text;
  if (n.tag === 'script' || n.tag === 'style') return ' ';
  // Comme visibleText : chaque balise compte pour un blanc.
  return ' ' + n.children.map(textOfNode).join('') + ' ';
}
export const textOf = (n: HNode): string => textOfNode(n).replace(/\s+/g, ' ').trim();
// Nœuds dans l'ordre du document.
export function docOrder(root: HNode): HNode[] {
  const out: HNode[] = [];
  walk(root, (x) => {
    if (x !== root && isEl(x)) out.push(x);
  });
  return out;
}

const docCache = new Map<string, HNode>();
export function homeDoc(route: string): HNode {
  const key = distDir + route;
  let d = docCache.get(key);
  if (!d) {
    d = parseHtml(pageHtml(route));
    docCache.set(key, d);
  }
  return d;
}
export function bodyOf(doc: HNode): HNode {
  const b = byTag(doc, 'body')[0];
  if (!b) throw new Error('<body> absent');
  return b;
}
// Unique élément portant l'attribut, avec message clair (contrat lot 2a).
export function one(root: HNode, attr: string, where: string, v?: string): HNode {
  const xs = byAttr(root, attr, v);
  if (xs.length !== 1) throw new Error(`${where} : exactement un [${attr}${v === undefined ? '' : `="${v}"`}] attendu (contrat lot 2a), reçu ${xs.length}`);
  return xs[0] as HNode;
}
export const homeRoot = (route: string): HNode => one(homeDoc(route), 'data-home', route);

export const pageText = (route: string): string => visibleText(pageHtml(route));

// ---- CSS exporté (contrat-lot2a-tests §4.2) ----

export interface CssRule { selectors: string[]; selector: string; decls: Map<string, string>; declList: [string, string][]; media: string | null; file: string }
export interface FontFace { family: string; weight: string; display: string; urls: string[]; formats: string[]; src: string; unicodeRange: string; file: string }
export interface Css { files: string[]; rules: CssRule[]; fontFaces: FontFace[]; keyframes: string[]; raw: string }

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let d = 0;
  let q: string | null = null;
  let cur = '';
  for (const ch of s) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") q = ch;
    if (ch === '(' || ch === '[') d++;
    if (ch === ')' || ch === ']') d--;
    if (ch === sep && d === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export { splitTop };

function declsOf(body: string): [string, string][] {
  const out: [string, string][] = [];
  for (const d of splitTop(body, ';')) {
    const i = d.indexOf(':');
    if (i > 0) out.push([d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]);
  }
  return out;
}

// Blocs de premier niveau : [prélude, corps]. Accolades équilibrées, chaînes respectées.
function blocks(css: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    let prelude = css.slice(i, open).trim();
    // Instructions sans bloc (@import, @charset) avant le prélude.
    const semi = prelude.lastIndexOf(';');
    if (semi >= 0 && !/\(/.test(prelude.slice(semi))) prelude = prelude.slice(semi + 1).trim();
    let depth = 0;
    let j = open;
    let q: string | null = null;
    for (; j < css.length; j++) {
      const ch = css[j];
      if (q) {
        if (ch === q) q = null;
        continue;
      }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) break;
    }
    out.push([prelude, css.slice(open + 1, j)]);
    i = j + 1;
  }
  return out;
}

export function parseCss(text: string, file = ''): Omit<Css, 'files' | 'raw'> {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const fontFaces: FontFace[] = [];
  const keyframes: string[] = [];
  const visit = (src: string, media: string | null): void => {
    for (const [prelude, body] of blocks(src)) {
      if (/^@font-face\b/i.test(prelude)) {
        const d = new Map(declsOf(body));
        const srcv = d.get('src') ?? '';
        fontFaces.push({
          family: (d.get('font-family') ?? '').replace(/^["']|["']$/g, '').trim(),
          weight: (d.get('font-weight') ?? '400').trim(),
          display: (d.get('font-display') ?? '').trim(),
          urls: [...srcv.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1] ?? ''),
          formats: [...srcv.matchAll(/format\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1] ?? ''),
          src: srcv,
          unicodeRange: (d.get('unicode-range') ?? '').trim(),
          file,
        });
      } else if (/^@starting-style\b/i.test(prelude)) {
        // F14 (audit Fable) : @starting-style ne vaut qu'à la première image d'une transition, jamais au repos ; l'aplatir
        // en règle ordinaire faisait croire au test « aucune fiche rendue avant ready » que .tree-ui restait à opacity 0.
        continue;
      } else if (/^@(-\w+-)?keyframes\b/i.test(prelude)) {
        keyframes.push(prelude.replace(/^@(-\w+-)?keyframes\s+/i, '').trim());
      } else if (/^@(media|supports|layer|container|scope)\b/i.test(prelude) || (/^@/.test(prelude) && body.includes('{'))) {
        const m = /^@media\b/i.test(prelude) ? prelude.replace(/^@media\s*/i, '') : media;
        visit(body, media && m !== media ? `${media} and ${m}` : m);
      } else if (!prelude.startsWith('@')) {
        // CSS imbriqué éventuel : on ne garde que les déclarations de premier niveau.
        const flat = body.replace(/[^{};]*\{[^{}]*\}/g, '');
        const list = declsOf(flat);
        const selectors = splitTop(prelude, ',');
        rules.push({ selectors, selector: prelude, decls: new Map(list), declList: list, media, file });
        if (body.includes('{')) visit(body.replace(/^[^{}]*?(?=[^{};]*\{)/, ''), media);
      }
    }
  };
  visit(css, null);
  return { rules, fontFaces, keyframes };
}

let cssCache: Css | null = null;
export function exportCss(root: string = distDir): Css {
  requireDist(root);
  if (root === distDir && cssCache) return cssCache;
  const files = allFiles(root).filter((f) => f.endsWith('.css'));
  if (files.length === 0) throw new Error(`aucun .css dans ${root}`);
  const out: Css = { files: files.map((f) => '/' + relative(root, f).split('\\').join('/')), rules: [], fontFaces: [], keyframes: [], raw: '' };
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    out.raw += t + '\n';
    const p = parseCss(t, '/' + relative(root, f));
    out.rules.push(...p.rules);
    out.fontFaces.push(...p.fontFaces);
    out.keyframes.push(...p.keyframes);
  }
  if (root === distDir) cssCache = out;
  return out;
}

// Portée de l'accueil (E10.2, E12.10) : chaque sélecteur de la liste contient l'un des préfixes.
export const HOME_SCOPE = ['[data-home', '[data-site-', '[data-tree-', '.tree-'];
export const inHomeScope = (r: CssRule): boolean => r.selectors.length > 0 && r.selectors.every((s) => HOME_SCOPE.some((p) => s.includes(p)));

// Familles et graisses déclarées par @font-face.
export const familyOf = (decl: string): string => (decl.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');
export function weightRange(w: string): [number, number] {
  const ws = w.trim().split(/\s+/).map((x) => (x === 'normal' ? 400 : x === 'bold' ? 700 : Number(x)));
  return [ws[0] ?? 400, ws[1] ?? ws[0] ?? 400];
}

// unicode-range → liste d'intervalles [a, b].
export function parseUnicodeRange(s: string): [number, number][] {
  const out: [number, number][] = [];
  for (const part of s.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = /^U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?$/i.exec(part);
    if (!m) throw new Error(`unicode-range illisible : ${part}`);
    const a = m[1] ?? '';
    if (a.includes('?')) out.push([parseInt(a.replace(/\?/g, '0'), 16), parseInt(a.replace(/\?/g, 'F'), 16)]);
    else out.push([parseInt(a, 16), m[2] ? parseInt(m[2], 16) : parseInt(a, 16)]);
  }
  return out;
}
export const inRanges = (cp: number, rs: [number, number][]): boolean => rs.some(([a, b]) => cp >= a && cp <= b);

// ---- WOFF2 : table cmap (contrat-lot2a-tests §4.3) ----

function base128(buf: Buffer, at: number): [number, number] {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[at + i] ?? 0;
    if (i === 0 && b === 0x80) throw new Error('UIntBase128 : zéro de tête');
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) return [v, at + i + 1];
  }
  throw new Error('UIntBase128 trop long');
}

export function woff2Tables(buf: Buffer): Map<string, Buffer> {
  if (buf.readUInt32BE(0) !== 0x774f4632) throw new Error('signature wOF2 absente');
  if (buf.readUInt32BE(4) === 0x74746366) throw new Error('collection ttcf non attendue');
  const numTables = buf.readUInt16BE(12);
  const totalCompressed = buf.readUInt32BE(20);
  const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
  let at = 48;
  const dir: { tag: string; len: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at++] ?? 0;
    const idx = flags & 0x3f;
    const version = (flags >> 6) & 3;
    let tag: string;
    if (idx === 63) {
      tag = buf.toString('latin1', at, at + 4);
      at += 4;
    } else tag = KNOWN[idx] ?? `#${idx}`;
    const [orig, n1] = base128(buf, at);
    at = n1;
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    let len = orig;
    if (transformed) {
      const [tl, n2] = base128(buf, at);
      at = n2;
      len = tl;
    }
    dir.push({ tag, len });
  }
  const data = brotliDecompressSync(buf.subarray(at, at + totalCompressed));
  const out = new Map<string, Buffer>();
  let off = 0;
  for (const t of dir) {
    out.set(t.tag, data.subarray(off, off + t.len));
    off += t.len;
  }
  return out;
}

export function cmapCodepoints(buf: Buffer): Set<number> {
  const cmap = woff2Tables(buf).get('cmap');
  if (!cmap) throw new Error('table cmap absente');
  const n = cmap.readUInt16BE(2);
  const subs: { pid: number; eid: number; off: number; fmt: number }[] = [];
  for (let i = 0; i < n; i++) {
    const pid = cmap.readUInt16BE(4 + i * 8);
    const eid = cmap.readUInt16BE(6 + i * 8);
    const off = cmap.readUInt32BE(8 + i * 8);
    subs.push({ pid, eid, off, fmt: cmap.readUInt16BE(off) });
  }
  const pick = subs.find((s) => s.pid === 3 && s.eid === 10 && s.fmt === 12) ?? subs.find((s) => s.pid === 0 && s.fmt === 12) ?? subs.find((s) => s.pid === 3 && s.eid === 1 && s.fmt === 4) ?? subs.find((s) => s.pid === 0 && s.eid === 3 && s.fmt === 4) ?? subs.find((s) => s.fmt === 4);
  if (!pick) throw new Error(`aucune sous-table cmap (3,10) f12 ni (3,1)/(0,3) f4 : ${JSON.stringify(subs)}`);
  const cps = new Set<number>();
  const o = pick.off;
  if (pick.fmt === 12) {
    const groups = cmap.readUInt32BE(o + 12);
    for (let g = 0; g < groups; g++) {
      const a = cmap.readUInt32BE(o + 16 + g * 12);
      const b = cmap.readUInt32BE(o + 20 + g * 12);
      for (let c = a; c <= b; c++) cps.add(c);
    }
  } else {
    const segX2 = cmap.readUInt16BE(o + 6);
    const seg = segX2 / 2;
    const ends = o + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ros = deltas + segX2;
    for (let s = 0; s < seg; s++) {
      const end = cmap.readUInt16BE(ends + s * 2);
      const start = cmap.readUInt16BE(starts + s * 2);
      const delta = cmap.readInt16BE(deltas + s * 2);
      const ro = cmap.readUInt16BE(ros + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let gid: number;
        if (ro === 0) gid = (c + delta) & 0xffff;
        else {
          const at = ros + s * 2 + ro + (c - start) * 2;
          gid = cmap.readUInt16BE(at);
          if (gid !== 0) gid = (gid + delta) & 0xffff;
        }
        if (gid !== 0) cps.add(c);
      }
    }
  }
  return cps;
}

// ---- Référence de non-régression (contrat-lot2a-tests §4.4) ----

export const BASELINE_PATH = join(siteDir, 'tests', 'fixtures', 'baseline-4ed945b.json');
export const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
export const normStatic = (s: string): string => s.replace(/\/_next\/static\/[^"'\s)]+/g, '/_next/static/*');

export function normalizedBody(html: string): string {
  const m = /<body\b[\s\S]*<\/body>/i.exec(html);
  if (!m) throw new Error('<body> absent');
  return normStatic(m[0].replace(/<script\b[\s\S]*?<\/script>/gi, '')).replace(/\s+/g, ' ');
}
export function headPreloads(html: string): string[] {
  const head = /<head\b[\s\S]*?<\/head>/i.exec(html)?.[0] ?? '';
  const out: string[] = [];
  for (const m of head.matchAll(/<link\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1] ?? '');
    const rel = (a.rel ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('preload') || rel.includes('stylesheet')) out.push(normStatic(a.href ?? ''));
  }
  return out.sort();
}
export interface PageFingerprint { body: string; preloads: string[] }
export interface Baseline {
  commit: string;
  commande: string;
  pages: Record<ExportMode, Record<string, PageFingerprint>>;
  cv: Record<string, string>;
  images: string[];
  css?: Record<ExportMode, string[]>;
}
export function fingerprint(html: string): PageFingerprint {
  return { body: sha256(normalizedBody(html)), preloads: headPreloads(html) };
}
export function readBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) throw new Error(`référence absente : ${BASELINE_PATH}`);
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
}
export const secondaryRoutes = (): string[] => [...readManifest().paths.flatMap((p) => ['/' + p, '/fr/' + p]).filter((r) => !HOME_ROUTES.includes(r)), '/404.html'];

// Liste triée des fichiers d'un dossier de public/ (chemins relatifs).
export function listDir(rel: string): string[] {
  const root = join(siteDir, rel);
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(root, join(e.parentPath, e.name)))
    .sort();
}

// ---- Table name d'une police WOFF2 (audit du lot 2a, licence OFL) ----
export function fontNames(buf: Buffer): Map<number, string> {
  const name = woff2Tables(buf).get('name');
  if (!name) throw new Error('table name absente');
  const count = name.readUInt16BE(2);
  const strOff = name.readUInt16BE(4);
  const out = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12;
    const pid = name.readUInt16BE(at);
    const eid = name.readUInt16BE(at + 2);
    const nid = name.readUInt16BE(at + 6);
    const len = name.readUInt16BE(at + 8);
    const off = name.readUInt16BE(at + 10);
    if (!(pid === 3 && (eid === 1 || eid === 10))) continue;
    const raw = name.subarray(strOff + off, strOff + off + len);
    let s = '';
    for (let k = 0; k + 1 < raw.length; k += 2) s += String.fromCharCode(raw.readUInt16BE(k));
    if (!out.has(nid)) out.set(nid, s);
  }
  return out;
}

// ---- Règles CSS applicables aux pages secondaires (audit du lot 2a, « règle globale non préfixée ») ----
// Une liste de sélecteurs est propre à l'accueil si chacun de ses sélecteurs cite une marque de l'accueil.
export const HOME_MARKS = ['[data-home', '[data-site-', '[data-tree-', '.tree-', '[data-card', '[data-experience'];
export const homeOnlyRule = (r: CssRule): boolean => r.selectors.every((s) => HOME_MARKS.some((m) => s.includes(m)));
export const ruleSignature = (r: CssRule): string => `${r.media ?? ''}|${r.selectors.join(',')}|${r.declList.map(([k, v]) => `${k}:${v.replace(/\/_next\/static\/[^"'\s)]+/g, '/_next/static/*')}`).join(';')}`;
