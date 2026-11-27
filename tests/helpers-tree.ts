// Utilitaires des tests du contrat lot 1b (moteur de l'arbre). node:test + node:assert, aucune dépendance npm.
// Les modules testés sont importés dynamiquement : un module absent fait échouer chaque test avec un message clair.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { typoApos, untypoModule } from './helpers-typo.ts';

export const siteDir: string = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoDir: string = resolve(siteDir, '..');
// SITE_TEST_FAITS surcharge le chemin (F12 : un chemin inexistant simule le dépôt publié limité à site/).
export const faitsPath: string = process.env.SITE_TEST_FAITS ?? join(repoDir, 'deliverables', 'refonte-arbre', 'FAITS.md');

// Les huit fichiers du contrat (chemins relatifs à site/).
export const CONTRACT_FILES: readonly string[] = [
  'lib/tree/rng.ts',
  'lib/tree/skeleton.ts',
  'lib/tree/sap.ts',
  'lib/tree/cloud.ts',
  'lib/tree/color.ts',
  'lib/tree/labels.ts',
  'content/palettes.ts',
  'content/tree.ts',
];

// Les modules sont typés de façon lâche : ils n'existent pas encore et le contrat fixe leur forme.
// deno-lint-ignore no-explicit-any
export type Mod = any;

export async function load(rel: string): Promise<Mod> {
  const full = join(siteDir, rel);
  if (!existsSync(full)) throw new Error(`module absent : site/${rel} (contrat lot 1b)`);
  try {
    // Lot 4, R1 : chaînes de content/* sans blanc insécable pour ces tests (helpers-typo.ts).
    return untypoModule(rel, await import(pathToFileURL(full).href));
  } catch (e) {
    throw new Error(`module site/${rel} présent mais en erreur à l'import : ${(e as Error).message}`);
  }
}

export const rngMod = (): Promise<Mod> => load('lib/tree/rng.ts');
export const skeletonMod = (): Promise<Mod> => load('lib/tree/skeleton.ts');
export const sapMod = (): Promise<Mod> => load('lib/tree/sap.ts');
export const cloudMod = (): Promise<Mod> => load('lib/tree/cloud.ts');
export const colorMod = (): Promise<Mod> => load('lib/tree/color.ts');
export const labelsMod = (): Promise<Mod> => load('lib/tree/labels.ts');
export const palettesMod = (): Promise<Mod> => load('content/palettes.ts');
export const treeMod = (): Promise<Mod> => load('content/tree.ts');

// Mémoïsation d'un calcul asynchrone coûteux (squelettes, nuages) partagé par les tests d'un fichier.
export function memo<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) p = fn();
    return p;
  };
}

// Graines exigées par le contrat : 7 et 1 à 20.
export const SEEDS: readonly number[] = [7, ...Array.from({ length: 20 }, (_, i) => i + 1)];
export const MODES: readonly ('simple' | 'natural')[] = ['simple', 'natural'];

export const KIND = { TRUNK: 0, BRANCH: 1, ROOT: 2 } as const;
export const ROLE = { BARK: 0, ROOT: 1, LEAF: 2 } as const;

export type V3 = [number, number, number];

// ---- Vecteurs ----
export function vec(arr: ArrayLike<number>, i: number): V3 {
  return [arr[3 * i] as number, arr[3 * i + 1] as number, arr[3 * i + 2] as number];
}
export const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: readonly number[], b: readonly number[]): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: readonly number[], s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: readonly number[]): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: readonly number[], b: readonly number[]): number => norm(sub(a, b));
export const lerp3 = (a: readonly number[], b: readonly number[], t: number): V3 => add(a, scale(sub(b, a), t));
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

// Projection bornée de p sur le segment [a, b] (t dans [0, 1]).
export function projT(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  const d = sub(b, a);
  const l2 = dot(d, d);
  if (l2 === 0) return 1;
  return clamp(dot(sub(p, a), d) / l2, 0, 1);
}

// Distance du point p à la droite portée par [a, b], et paramètre non borné de la projection.
export function axisDistance(p: readonly number[], a: readonly number[], b: readonly number[]): { t: number; d: number } {
  const d = sub(b, a);
  const l2 = dot(d, d);
  const t = dot(sub(p, a), d) / l2;
  return { t, d: dist(p, lerp3(a, b, t)) };
}

// Chaîne recalculée de la base au segment, depuis le tableau parent.
export function chainOf(parent: ArrayLike<number>, seg: number): number[] {
  const out: number[] = [];
  let i = seg;
  let guard = 0;
  while (i >= 0) {
    out.push(i);
    i = parent[i] as number;
    if (++guard > parent.length + 1) throw new Error('cycle dans parent');
  }
  return out.reverse();
}

// Segments ayant au moins un enfant.
export function hasChild(parent: ArrayLike<number>): Uint8Array {
  const m = new Uint8Array(parent.length);
  for (let i = 0; i < parent.length; i++) {
    const p = parent[i] as number;
    if (p >= 0) m[p] = 1;
  }
  return m;
}

// Générateur déterministe des tests (LCG), distinct du module testé.
export function testRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function bytesEqual(a: ArrayBufferView, b: ArrayBufferView): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

// ---- Couleurs : oracles indépendants ----
export function hex3(h: string): V3 {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as V3;
}
const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function wcagLuminance(c: readonly number[]): number {
  return 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2]);
}
export function wcagContrast(a: readonly number[], b: readonly number[]): number {
  const x = wcagLuminance(a);
  const y = wcagLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Color.getHSL / setHSL / offsetHSL de three r147 (gestion des couleurs en mode hérité : aucune conversion).
function getHSL(c: readonly number[]): { h: number; s: number; l: number } {
  const [r, g, b] = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const l = (min + max) / 2;
  if (min !== max) {
    const delta = max - min;
    sat = l <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  return { h: hue, s: sat, l };
}
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}
function setHSL(h: number, s: number, l: number): V3 {
  h = ((h % 1) + 1) % 1;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  if (s === 0) return [l, l, l];
  const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const q = 2 * l - p;
  return [hue2rgb(q, p, h + 1 / 3), hue2rgb(q, p, h), hue2rgb(q, p, h - 1 / 3)];
}
export function refOffsetHSL(c: readonly number[], dh: number, ds: number, dl: number): V3 {
  const x = getHSL(c);
  return setHSL(x.h + dh, x.s + ds, x.l + dl);
}
export const refMix = (a: readonly number[], b: readonly number[], t: number): V3 => lerp3(a, b, t);

// Couleur de point attendue (proto:499–503), recalculée indépendamment.
export function refPointColor(role: number, rand: number, h: number, p: Record<string, unknown>): V3 {
  const P = p as { bark: string[]; barkAcc: string; root: string[]; leaf: string[]; leafAcc: string };
  let c: V3;
  if (role === ROLE.LEAF) {
    c = rand < 0.07 ? hex3(P.leafAcc) : refMix(hex3(P.leaf[0]), hex3(P.leaf[1]), clamp((h - 0.35) * 1.4 + (rand - 0.5) * 0.7, 0, 1));
  } else if (role === ROLE.ROOT) {
    c = refMix(hex3(P.root[1]), hex3(P.root[0]), rand);
  } else {
    c = rand < 0.1 ? hex3(P.barkAcc) : refMix(hex3(P.bark[1]), hex3(P.bark[0]), (rand - 0.1) / 0.9);
  }
  return refOffsetHSL(c, (((rand * 3.7) % 1) - 0.5) * 0.03, 0.08, (((rand * 7.31) % 1) - 0.5) * 0.08);
}

// ---- FAITS.md : lu une seule fois, tableaux trouvés par titre de section et en-tête de colonnes ----
export function faitsAvailable(): boolean {
  return existsSync(faitsPath);
}
let faitsCache: string | null = null;
export function faitsText(): string {
  if (faitsCache === null) faitsCache = typoApos(readFileSync(faitsPath, 'utf8')); // tour Y, Y4 : helpers-typo.ts
  return faitsCache;
}
// Cellules d'une ligne de tableau Markdown (sans les bords).
export function cells(line: string): string[] {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}
// Contenus entre « et », dans l'ordre.
export function quotes(text: string): string[] {
  return [...text.matchAll(/« (.*?) »/g)].map((m) => m[1] ?? '');
}

export type Cond = 'always' | 'A-02' | 'A-05' | 'A-06' | 'unconfirmed';
export interface FaitsFragment { from: string; fr: string; en: string }
export interface FaitsNode {
  id: string; layer: string; label: { fr: string; en: string }; icon: string;
  ifYes: { answer: string; label: { fr: string; en: string }; icon: string } | null;
  fragments: FaitsFragment[];
  // Infobulle « Sans réponse » écrite telle quelle dans la cellule (nœud à variante seulement).
  noAnswerTooltip: { fr: string; en: string } | null;
}
export interface FaitsLink { exp: string; skill: string; condition: Cond }
export interface FaitsExperience { id: string; short: string; name: { fr: string; en: string }; href: string }
export interface FaitsTree { nodes: FaitsNode[]; links: FaitsLink[]; experiences: FaitsExperience[] }

const headingText = (line: string): string | null => /^#{1,6}\s+(.*)$/.exec(line.trim())?.[1]?.trim() ?? null;

// Tableau situé sous le titre `title` (premier tableau de la section), colonnes indexées par en-tête.
function tableUnder(lines: string[], title: string): { header: string[]; rows: string[][] } {
  const at = lines.findIndex((l) => headingText(l) === title);
  if (at < 0) throw new Error(`FAITS.md : section « ${title} » introuvable`);
  let i = at + 1;
  while (i < lines.length && !lines[i].trim().startsWith('|')) {
    if (headingText(lines[i]) !== null) throw new Error(`FAITS.md : pas de tableau sous « ${title} »`);
    i++;
  }
  const header = cells(lines[i]);
  if (!/^\|[\s|:-]+\|$/.test(lines[i + 1]?.trim() ?? '')) throw new Error(`FAITS.md : séparateur d'en-tête absent sous « ${title} »`);
  const rows: string[][] = [];
  for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) rows.push(cells(lines[j]));
  return { header, rows };
}
function column(header: string[], name: string): number {
  const k = header.findIndex((h) => h === name || h.startsWith(name));
  if (k < 0) throw new Error(`FAITS.md : colonne « ${name} » absente (${JSON.stringify(header)})`);
  return k;
}
const ICON_WORD: Record<string, string> = { neutre: 'neutral' };
const LAYER_WORD: Record<string, string> = { racines: 'root', tronc: 'trunk', 'canopée': 'canopy' };

// Lecture complète et indépendante de FAITS §1–§6 ; toute incohérence lève une erreur explicite.
export function parseFaits(text: string): FaitsTree {
  const lines = text.split('\n');

  // Expériences : sections « ## N. Nom » qui ont une ligne « Page ouverte » avec une adresse /fr/….
  const experiences: FaitsExperience[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^##\s+\d+\.\s+(.+)$/.exec(lines[i].trim());
    if (!m) continue;
    let j = i + 1;
    let href: string | null = null;
    for (; j < lines.length && !/^##\s/.test(lines[j].trim()); j++) {
      if (href === null && lines[j].includes('Page ouverte')) {
        const r = /`\/fr\/([^`]+\/)`/.exec(lines[j] + ' ' + (lines[j + 1] ?? ''));
        if (r) href = r[1];
      }
    }
    if (href) experiences.push({ id: href.split('/').filter(Boolean).pop() as string, short: '', name: { fr: m[1].trim(), en: m[1].trim() }, href });
  }

  // Liens : tableau 6.2, condition tirée des colonnes « Si oui » et « Sans réponse ».
  const t2 = tableUnder(lines, '6.2 Liens expérience → compétence');
  const cLink = column(t2.header, 'Expérience → nœud');
  const cYes = column(t2.header, 'Si oui');
  const cNo = column(t2.header, 'Sans réponse');
  const byShort = new Map<string, FaitsExperience>();
  const links: FaitsLink[] = t2.rows.map((r) => {
    const m = /^(.+?)\s+→\s+`(\w+)`$/.exec(r[cLink]);
    if (!m) throw new Error(`FAITS.md 6.2 : cellule illisible « ${r[cLink]} »`);
    const short = m[1];
    if (!byShort.has(short)) {
      const found = experiences.filter((e) => e.name.fr.includes(short));
      if (found.length !== 1) throw new Error(`FAITS.md 6.2 : « ${short} » ne désigne pas une seule section d'expérience`);
      found[0].short = short;
      byShort.set(short, found[0]);
    }
    const yes = /^(A-\d{2})\s*:\s*\*\*allumé\*\*/.exec(r[cYes]);
    let condition: Cond;
    if (yes) condition = yes[1] as Cond;
    else if (r[cYes] !== '—') throw new Error(`FAITS.md 6.2 : « Si oui » illisible pour ${r[cLink]}`);
    else if (r[cNo].startsWith('**allumé**')) condition = 'always';
    else if (r[cNo].includes('À confirmer')) condition = 'unconfirmed';
    else throw new Error(`FAITS.md 6.2 : condition indéterminée pour ${r[cLink]}`);
    return { exp: byShort.get(short)!.id, skill: m[2], condition };
  });
  const expOf = (short: string): FaitsExperience | undefined => byShort.get(short);

  // Nœuds : tableau 6.1.
  const t1 = tableUnder(lines, '6.1 Nœuds');
  const cId = column(t1.header, 'Nœud');
  const cLayer = column(t1.header, 'Couche');
  const cLabel = column(t1.header, 'Libellé FR / EN');
  const cIcon = column(t1.header, 'Icône');
  const cTip = column(t1.header, 'Infobulle');
  const nodes: FaitsNode[] = t1.rows.map((r) => {
    const id = r[cId].replace(/`/g, '');
    const layer = LAYER_WORD[r[cLayer]];
    if (!layer) throw new Error(`FAITS.md 6.1 : couche inconnue « ${r[cLayer]} » pour ${id}`);
    const confirmed = links.filter((l) => l.skill === id && l.condition !== 'unconfirmed');
    let label: { fr: string; en: string };
    let icon: string;
    let ifYes: FaitsNode['ifYes'] = null;
    let tipCell = r[cTip];
    let noAnswerTooltip: FaitsNode['noAnswerTooltip'] = null;
    const variant = /\*\*(A-\d{2}) = oui\*\*/.exec(r[cLabel]);
    if (variant) {
      // Nœud à deux états : « A-xx = oui » : « L » (FR et EN), icône **x**. « Sans réponse » : « FR » / « EN », icône **y**.
      const q = quotes(r[cLabel]);
      const icons = [...r[cLabel].matchAll(/icône \*\*(\w+)\*\*/g)].map((m) => ICON_WORD[m[1]] ?? m[1]);
      if (q.length !== 3 || icons.length !== 2) throw new Error(`FAITS.md 6.1 : variante de ${id} illisible`);
      ifYes = { answer: variant[1], label: { fr: q[0], en: q[0] }, icon: icons[0] };
      label = { fr: q[1], en: q[2] };
      icon = icons[1];
      const yesAt = tipCell.indexOf(`${variant[1]} = oui :`);
      const noAt = tipCell.indexOf('Sans réponse :');
      if (yesAt < 0 || noAt < yesAt) throw new Error(`FAITS.md 6.1 : infobulles de ${id} illisibles`);
      const qn = quotes(tipCell.slice(noAt));
      noAnswerTooltip = { fr: qn[0], en: qn[1] };
      tipCell = tipCell.slice(yesAt, noAt);
    } else {
      const parts = r[cLabel].split(' / ');
      label = { fr: parts[0], en: parts[1] ?? parts[0] };
      const w = r[cIcon].replace(/\*\*/g, '').trim();
      icon = w === 'SVG maison' ? id : (ICON_WORD[w.split(/\s/)[0]] ?? w.split(/\s/)[0]);
    }
    const q = quotes(tipCell);
    let fr: string[];
    let en: string[];
    if (q.length === 2 * confirmed.length) {
      fr = q.slice(0, confirmed.length);
      en = q.slice(confirmed.length);
    } else if (q.length === 2) {
      fr = q[0].split(' ; ');
      en = q[1].split('; ');
    } else throw new Error(`FAITS.md 6.1 : ${q.length} chaînes pour ${confirmed.length} liens de ${id}`);
    if (fr.length !== confirmed.length || en.length !== confirmed.length) throw new Error(`FAITS.md 6.1 : fragments de ${id} mal découpés`);
    const fragments = fr.map((f, k) => {
      const e = expOf(/^(.+?) : /.exec(f)?.[1] ?? '') ?? (confirmed.length === 1 ? experiences.find((x) => x.id === confirmed[0].exp) : undefined);
      if (!e) throw new Error(`FAITS.md 6.1 : fragment « ${f} » de ${id} sans expérience`);
      // Nom anglais : préfixe EN du fragment s'il diffère du nom court (« French Red Cross »).
      const enPrefix = /^(.+?): /.exec(en[k])?.[1];
      if (enPrefix && e.short && enPrefix !== e.short && /^(.+?) : /.exec(f)?.[1] === e.short) e.name.en = enPrefix;
      return { from: e.id, fr: f, en: en[k] };
    });
    const froms = fragments.map((x) => x.from).sort();
    if (JSON.stringify(froms) !== JSON.stringify(confirmed.map((l) => l.exp).sort())) throw new Error(`FAITS.md : fragments de ${id} ≠ liens confirmés`);
    return { id, layer, label, icon, ifYes, fragments, noAnswerTooltip };
  });

  const used = new Set(links.map((l) => l.exp));
  return { nodes, links, experiences: experiences.filter((e) => used.has(e.id)) };
}

// Retire les commentaires d'un source TypeScript (approximation suffisante pour un contrôle statique).
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

export function fmt(x: unknown): string {
  return JSON.stringify(x, (_k, v) => (ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>).slice(0, 12) : v));
}
