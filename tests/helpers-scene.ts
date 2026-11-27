// Utilitaires des tests du contrat lot 1c (rendu et scène de l'arbre). node:test + node:assert, aucune dépendance npm.
// Les modules du 1c sont importés dynamiquement : un module absent fait échouer chaque test avec un message clair.
// Les contrôles d'export lisent dist/client (mode détecté par robots.txt, comme C3) et lèvent une erreur claire s'il manque.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { assertDistExists, decodeEntities, dirIndexFor, distDir, exportModeOf, pageScriptUrls, readManifest, routesOf, siteDir, staticClosure } from './helpers.ts';
import type { ExportMode } from './helpers.ts';
import { untypoModule } from './helpers-typo.ts';

export { siteDir };

// Modules du 1c typés de façon lâche : ils n'existent pas encore et le contrat fixe leur forme.
// deno-lint-ignore no-explicit-any
export type Mod = any;

export async function load1c(rel: string): Promise<Mod> {
  const full = join(siteDir, rel);
  if (!existsSync(full)) throw new Error(`module absent : site/${rel} (contrat lot 1c)`);
  try {
    // Lot 4, R1 : chaînes de content/* sans blanc insécable pour ces tests (helpers-typo.ts).
    return untypoModule(rel, await import(pathToFileURL(full).href));
  } catch (e) {
    throw new Error(`module site/${rel} présent mais en erreur à l'import : ${(e as Error).message}`);
  }
}

export const buildMod = (): Promise<Mod> => load1c('lib/tree/build.ts');
export const shadersMod = (): Promise<Mod> => load1c('lib/tree/shaders.ts');
export const cameraMod = (): Promise<Mod> => load1c('lib/tree/camera.ts');
export const guardMod = (): Promise<Mod> => load1c('lib/tree/guard.ts');
export const backdropMod = (): Promise<Mod> => load1c('lib/tree/backdrop.ts');
export const leavesMod = (): Promise<Mod> => load1c('lib/tree/leaves.ts');
export const firefliesMod = (): Promise<Mod> => load1c('lib/tree/fireflies.ts');
export const asciiMod = (): Promise<Mod> => load1c('lib/tree/ascii.ts');

// Modules du 1b (existants), chargés de la même façon.
export const engine = {
  rng: (): Promise<Mod> => load1c('lib/tree/rng.ts'),
  skeleton: (): Promise<Mod> => load1c('lib/tree/skeleton.ts'),
  sap: (): Promise<Mod> => load1c('lib/tree/sap.ts'),
  cloud: (): Promise<Mod> => load1c('lib/tree/cloud.ts'),
  color: (): Promise<Mod> => load1c('lib/tree/color.ts'),
  labels: (): Promise<Mod> => load1c('lib/tree/labels.ts'),
  palettes: (): Promise<Mod> => load1c('content/palettes.ts'),
  tree: (): Promise<Mod> => load1c('content/tree.ts'),
  experiences: (): Promise<Mod> => load1c('content/experiences.ts'),
};

// Les huit modules purs du 1c (D0).
export const PURE_1C: readonly string[] = [
  'lib/tree/build.ts',
  'lib/tree/shaders.ts',
  'lib/tree/camera.ts',
  'lib/tree/guard.ts',
  'lib/tree/backdrop.ts',
  'lib/tree/leaves.ts',
  'lib/tree/fireflies.ts',
  'lib/tree/ascii.ts',
];

export const TREE_COMPONENTS: readonly string[] = [
  'components/tree/TreeHero.tsx',
  'components/tree/TreeIsland.tsx',
  'components/tree/TreeFallback.tsx',
  'components/tree/AtelierPanel.tsx',
];

// ---- Sources ----

export function readSrc(rel: string): string {
  const p = join(siteDir, rel);
  if (!existsSync(p)) throw new Error(`fichier absent : site/${rel} (contrat lot 1c)`);
  return readFileSync(p, 'utf8');
}

// Retire commentaires de bloc et de ligne sans toucher aux chaînes (scanner simple, suffisant pour du TS/JS/GLSL).
export function stripCode(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i] ?? '';
    const n = src[i + 1] ?? '';
    if (quote) {
      out += c;
      if (c === '\\') {
        out += n;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
      out += ' ';
      continue;
    }
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
    i++;
  }
  return out;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'work', '.next', 'tests', '.git', '.github', 'public']);
const CODE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx|py|css)$/;

// Fichiers de code du site (hors tests, dépendances, export et dossiers de travail), chemins relatifs à site/.
export function siteCodeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (CODE_EXT.test(entry.name)) out.push(relative(siteDir, join(dir, entry.name)));
    }
  };
  walk(siteDir);
  return out.sort();
}

export function filesUnder(rel: string, ext: RegExp = /\.(ts|tsx)$/): string[] {
  const root = join(siteDir, rel);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (ext.test(entry.name)) out.push(relative(siteDir, full));
    }
  };
  walk(root);
  return out.sort();
}

export interface ImportRef {
  spec: string;
  kind: 'static' | 'type' | 'dynamic';
  clause: string; // texte entre import et from (vide pour import "x" et import())
  index: number;
}

// Imports et réexports d'un source sans commentaires.
export function importsOf(src: string): ImportRef[] {
  const code = stripCode(src);
  const out: ImportRef[] = [];
  for (const m of code.matchAll(/\b(import|export)\s+(type\s+)?([^'";]*?)\bfrom\s*['"]([^'"]+)['"]/g)) {
    const clause = (m[3] ?? '').trim();
    const names = clause.replace(/[{}]/g, '').split(',').map((n) => n.trim()).filter(Boolean);
    const typeOnly = !!m[2] || (/^\{[^}]*\}$/.test(clause) && names.length > 0 && names.every((n) => /^type\s/.test(n)));
    out.push({ spec: m[4] ?? '', kind: typeOnly ? 'type' : 'static', clause: (m[3] ?? '').trim(), index: m.index ?? 0 });
  }
  for (const m of code.matchAll(/(^|[^\w$.])import\s*['"]([^'"]+)['"]/g)) out.push({ spec: m[2] ?? '', kind: 'static', clause: '', index: m.index ?? 0 });
  for (const m of code.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g)) out.push({ spec: m[1] ?? '', kind: 'dynamic', clause: '', index: m.index ?? 0 });
  for (const m of code.matchAll(/\brequire\s*\(\s*['"`]([^'"`]+)['"`]/g)) out.push({ spec: m[1] ?? '', kind: 'static', clause: '', index: m.index ?? 0 });
  return out;
}

// Résout un spécificateur relatif d'un fichier source (chemin relatif à site/), avec ou sans extension.
export function resolveSrc(fromRel: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = normalize(join(dirname(fromRel), spec));
  for (const cand of [base, base + '.ts', base + '.tsx', base + '.mts', base + '.cts', join(base, 'index.ts'), join(base, 'index.tsx')]) {
    const full = join(siteDir, cand);
    if (existsSync(full) && statSync(full).isFile()) return cand;
  }
  return base;
}

// Fermeture des imports statiques (hors import type) d'un fichier source. Les spécificateurs nus sont rapportés tels quels.
export function sourceStaticClosure(rel: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [rel];
  while (queue.length > 0) {
    const cur = queue.shift() ?? '';
    if (files.has(cur)) continue;
    files.add(cur);
    const full = join(siteDir, cur);
    if (!existsSync(full)) continue;
    for (const ref of importsOf(readFileSync(full, 'utf8'))) {
      if (ref.kind !== 'static') continue;
      const target = resolveSrc(cur, ref.spec);
      if (target === null) bare.add(ref.spec);
      else queue.push(target);
    }
  }
  return { files, bare };
}

export const importsThree = (src: string): boolean => importsOf(src).some((r) => r.kind !== 'type' && (r.spec === 'three' || r.spec.startsWith('three/')));

// ---- HTML ----

export function hasAttr(tagBody: string, attr: string): boolean {
  return new RegExp(`(?:^|\\s)${attr.replace(/[-]/g, '\\-')}(?=\\s*=|\\s|/|$)`, 'i').test(tagBody);
}

export function attrValue(tagBody: string, attr: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${attr.replace(/[-]/g, '\\-')}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tagBody);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? '') : undefined;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

export interface Element {
  tag: string;
  open: string; // corps de la balise ouvrante (attributs)
  outer: string;
  inner: string;
  start: number;
  end: number;
}

// Éléments dont la balise ouvrante porte l'attribut `attr` (outer HTML, imbrication du même nom de balise comptée).
export function elementsWithAttr(html: string, attr: string): Element[] {
  const out: Element[] = [];
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const tag = (m[1] ?? '').toLowerCase();
    const body = m[2] ?? '';
    if (!hasAttr(body, attr)) continue;
    const start = m.index ?? 0;
    const openEnd = start + m[0].length;
    if (VOID.has(tag) || body.trim().endsWith('/')) {
      out.push({ tag, open: body, outer: m[0], inner: '', start, end: openEnd });
      continue;
    }
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = openEnd;
    let depth = 1;
    let end = html.length;
    let innerEnd = html.length;
    for (let r = re.exec(html); r; r = re.exec(html)) {
      if (r[1] === '/') depth--;
      else if (!r[0].endsWith('/>')) depth++;
      if (depth === 0) {
        innerEnd = r.index;
        end = r.index + r[0].length;
        break;
      }
    }
    out.push({ tag, open: body, outer: html.slice(start, end), inner: html.slice(openEnd, innerEnd), start, end });
  }
  return out;
}

export function visibleText(fragment: string): string {
  return decodeEntities(fragment.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Anchor {
  href: string;
  text: string;
}

export function anchorsOf(fragment: string): Anchor[] {
  return [...fragment.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: attrValue(m[1] ?? '', 'href') ?? '', text: visibleText(m[2] ?? '') }));
}

// ---- Export ----

export const CHUNK_DIR = '_next/static/chunks';
export const HOME_ROUTES: readonly string[] = ['/', '/fr/'];

export interface ExportPage {
  route: string; // route du manifeste, ou '/404.html'
  file: string;
  html: string;
}

export function requireDist(root: string = distDir): ExportMode {
  if (root === distDir) assertDistExists();
  if (!existsSync(root)) throw new Error(`export absent : ${root} (lancer npm run build)`);
  return exportModeOf(root);
}

export function exportPages(root: string = distDir): ExportPage[] {
  requireDist(root);
  const routes = routesOf(readManifest().paths);
  const pages: ExportPage[] = routes.map((route) => {
    const file = join(root, dirIndexFor(route));
    if (!existsSync(file)) throw new Error(`page absente de l'export : ${dirIndexFor(route)}`);
    return { route, file, html: readFileSync(file, 'utf8') };
  });
  const nf = join(root, '404.html');
  if (!existsSync(nf)) throw new Error("404.html absent de l'export");
  pages.push({ route: '/404.html', file: nf, html: readFileSync(nf, 'utf8') });
  return pages;
}

export function pageHtml(route: string, root: string = distDir): string {
  const file = join(root, route === '/404.html' ? '404.html' : dirIndexFor(route));
  if (!existsSync(file)) throw new Error(`page absente de l'export : ${file}`);
  return readFileSync(file, 'utf8');
}

// Fichiers .js de l'export, en URL absolues du site (/_next/...).
export function jsUrls(root: string = distDir): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) out.push('/' + relative(root, full).split('\\').join('/'));
    }
  };
  walk(join(root, '_next'));
  return out.sort();
}

export function readUrl(root: string, url: string): string {
  return readFileSync(join(root, url.replace(/^\//, '')), 'utf8');
}

export function urlExists(root: string, url: string): boolean {
  return existsSync(join(root, url.replace(/^\//, '')));
}

// Cibles des import("./x.js") d'un chunk, en URL absolues.
export function dynamicTargets(root: string, url: string): string[] {
  if (!urlExists(root, url)) return [];
  const src = readUrl(root, url);
  const out = new Set<string>();
  for (const m of src.matchAll(/\bimport\s*\(\s*["'`]([^"'`]+\.js)["'`]\s*\)/g)) out.add(new URL(m[1] ?? '', 'http://site' + url).pathname);
  return [...out];
}

export const basename = (url: string): string => url.slice(url.lastIndexOf('/') + 1);

export interface TreeChunks {
  mode: ExportMode;
  island: string; // URL du chunk de l'îlot
  scene: string[]; // cibles d'import() de l'îlot dont la fermeture statique atteint three
  three: string[]; // chunks qui contiennent __THREE__
  atelier: string[]; // chunks qui contiennent data-tree-atelier
  islandDynamic: string[]; // toutes les cibles d'import() de l'îlot
}

// Repère le chunk de l'îlot : script référencé par / et /fr/, pas par /projects/, qui charge par import()
// un module dont la fermeture statique contient __THREE__. Erreur claire si absent ou ambigu.
export function treeChunks(root: string = distDir): TreeChunks {
  const mode = requireDist(root);
  const all = jsUrls(root);
  const three = all.filter((u) => readUrl(root, u).includes('__THREE__'));
  if (three.length === 0) throw new Error("aucun chunk de l'export ne contient __THREE__ (three absent : jalon 1c non construit)");
  const atelier = all.filter((u) => readUrl(root, u).includes('data-tree-atelier'));
  const refs = (route: string): Set<string> => new Set(pageScriptUrls(pageHtml(route, root)));
  const en = refs('/');
  const fr = refs('/fr/');
  const projects = refs('/projects/');
  const threeSet = new Set(three);
  const reachesThree = (u: string): boolean => [...staticClosure(root, [u])].some((x) => threeSet.has(x));
  const candidates = [...en].filter((u) => fr.has(u) && !projects.has(u) && dynamicTargets(root, u).some(reachesThree));
  if (candidates.length === 0) {
    throw new Error("chunk de l'îlot introuvable : aucun script de / et /fr/ (absent de /projects/) ne charge par import() un module qui atteint __THREE__");
  }
  if (candidates.length > 1) throw new Error(`chunk de l'îlot ambigu : ${candidates.join(', ')}`);
  const island = candidates[0] ?? '';
  const islandDynamic = dynamicTargets(root, island);
  return { mode, island, scene: islandDynamic.filter(reachesThree), three, atelier, islandDynamic };
}

export const gzipSize = (buf: Buffer | string): number => gzipSync(typeof buf === 'string' ? Buffer.from(buf) : buf, { level: 9 }).length;

export function fileSize(root: string, url: string): number {
  return gzipSize(readFileSync(join(root, url.replace(/^\//, ''))));
}

// ---- Nombres et couleurs ----

export function close(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

export function typedArraysOf(obj: unknown, seen: Set<unknown> = new Set()): ArrayBufferView[] {
  const out: ArrayBufferView[] = [];
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (ArrayBuffer.isView(v)) {
      out.push(v);
      return;
    }
    for (const key of Object.keys(v as Record<string, unknown>)) walk((v as Record<string, unknown>)[key]);
  };
  walk(obj);
  return out;
}

// Typed arrays propres d'un objet (premier niveau, propriétés énumérables ou accesseurs), avec leur nom.
export function ownTypedArrays(obj: Record<string, unknown>): Map<string, ArrayBufferView> {
  const out = new Map<string, ArrayBufferView>();
  const keys = new Set<string>([...Object.keys(obj)]);
  let proto = Object.getPrototypeOf(obj) as object | null;
  while (proto && proto !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(proto)) if (k !== 'constructor') keys.add(k);
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  for (const k of keys) {
    let v: unknown;
    try {
      v = obj[k];
    } catch {
      continue;
    }
    if (ArrayBuffer.isView(v)) out.set(k, v);
  }
  return out;
}

// Couleur CSS (#rgb, #rrggbb, #rrggbbaa, rgb(), rgba()) → [r, g, b, a] en [0, 1].
export function parseCssColor(s: string): [number, number, number, number] | null {
  const t = s.trim();
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(t);
  if (m) {
    const h = m[1] ?? '';
    const a = m[2] === undefined ? 1 : parseInt(m[2], 16) / 255;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, a];
  }
  m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(t);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, a];
  }
  return null;
}

// Faux contexte 2D : journal des appels de méthode et des affectations de propriétés.
export interface FakeCtx {
  ctx: Record<string, unknown>;
  calls: { name: string; args: unknown[]; state: Record<string, unknown> }[];
  sets: { name: string; value: unknown }[];
  gradients: { args: unknown[]; stops: [number, string][] }[];
}

export function fakeContext2d(): FakeCtx {
  const calls: FakeCtx['calls'] = [];
  const sets: FakeCtx['sets'] = [];
  const gradients: FakeCtx['gradients'] = [];
  const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000000' };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key) {
      if (typeof key !== 'string') return undefined;
      if (key in state) return state[key];
      if (key === 'canvas') return { width: 64, height: 64 };
      return (...args: unknown[]) => {
        calls.push({ name: key, args, state: { ...state } });
        if (key === 'createRadialGradient' || key === 'createLinearGradient') {
          const g = { args, stops: [] as [number, string][] };
          gradients.push(g);
          return { addColorStop: (o: number, c: string) => g.stops.push([o, c]) };
        }
        if (key === 'measureText') return { width: 1 };
        if (key === 'getImageData' || key === 'createImageData') return { data: new Uint8ClampedArray(4 * 64 * 64), width: 64, height: 64 };
        return undefined;
      };
    },
    set(_t, key, value) {
      if (typeof key !== 'string') return false;
      state[key] = value;
      sets.push({ name: key, value });
      return true;
    },
  });
  return { ctx: ctx as Record<string, unknown>, calls, sets, gradients };
}

// Fabrique de faux canvas (width, height, getContext('2d')) : chaque canvas garde son faux contexte.
export interface FakeCanvas {
  width: number;
  height: number;
  getContext: (kind: string) => Record<string, unknown> | null;
  fake: FakeCtx;
}

export function fakeCanvasFactory(): { make: (w?: number, h?: number) => FakeCanvas; made: FakeCanvas[] } {
  const made: FakeCanvas[] = [];
  const make = (w = 0, h = 0): FakeCanvas => {
    const fake = fakeContext2d();
    const c: FakeCanvas = { width: w, height: h, getContext: (kind: string) => (kind === '2d' ? fake.ctx : null), fake };
    made.push(c);
    return c;
  };
  return { make, made };
}

// Tous les fichiers d'un dossier, récursivement (chemins absolus).
export function allFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}

// ---- Après audit : Worker, référence client de l'îlot, fermetures ----

// Fichiers du Worker livrés sous la forme réellement émise : /_next/static/build.worker-<hash>.js.
export function workerUrls(root: string = distDir): string[] {
  return jsUrls(root).filter((u) => /^\/_next\/static\/build\.worker-[\w-]+\.js$/.test(u));
}

// Chunks qui citent une URL donnée (littéral absolu ou relatif), en URL du site.
export function chunksCiting(root: string, target: string): string[] {
  const name = basename(target);
  return jsUrls(root).filter((u) => u !== target && readUrl(root, u).includes(name));
}

// Identifiant de référence client de l'îlot dans le routeur : clé ("…": …) la plus proche avant l'import() de l'îlot.
// Indépendant de la forme de la fonction (flèche ou function) : seule la clé chaînée qui précède compte.
export function islandClientIds(root: string, island: string): string[] {
  const name = basename(island);
  const ids = new Set<string>();
  for (const u of jsUrls(root)) {
    if (u === island) continue;
    const src = readUrl(root, u);
    let at = src.indexOf(name);
    while (at >= 0) {
      const before = src.slice(Math.max(0, at - 400), at);
      const keys = [...before.matchAll(/["'`]([\w$/.:#-]{4,})["'`]\s*:/g)];
      const last = keys[keys.length - 1];
      if (last && /import\s*\(/.test(src.slice(Math.max(0, at - 400) + (last.index ?? 0), at + 2))) ids.add(last[1] ?? '');
      at = src.indexOf(name, at + name.length);
    }
  }
  return [...ids].filter(Boolean);
}
