// Lot 5, corrections d'audit U1–U8 (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit tmp/refonte-arbre/audit-lot5-fable.md,
// C2 à C4, C6, C7, C9) : outils partagés des tests u2 à u8. Aucun paquet npm, aucun réseau. Poppler seulement (pdftotext,
// pdfinfo, pdftoppm : paquet poppler-utils, déjà installé par la CI avant npm test, voir t2).
// Aucun numéro de téléphone réel n'est écrit ici : les témoins n'utilisent que des zéros, les messages masquent les chiffres.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteDir } from './helpers.ts';
import { FORBIDDEN, POPPLER_HINT, TITLE, flat, mask, segments, type Lang } from './helpers-pdf.ts';

function run(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error && (r.error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`${cmd} introuvable : ${POPPLER_HINT} (lot 5, U2 à U8)`);
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} : code ${r.status} ${(r.stderr ?? '').slice(0, 300)}`);
  return r.stdout ?? '';
}

// ---------------- U2 : texte complet figé ----------------

// Référence versionnée : sortie brute de `pdftotext -enc UTF-8` de chaque PDF public, figée le 24/11/2026 sur les PDF
// servis du commit 734c3e0 (identiques à deliverables/cv/source). Elle est dans site/ pour que la CI la lise, et
// verifier_cv.py la lit au même endroit. Mise à jour explicite, après relecture par le propriétaire :
//   cd site && node --experimental-strip-types tests/fixtures/figer-cv-texte.ts
export const referenceFile = (l: Lang): string => join(siteDir, 'tests', 'fixtures', `cv-public-texte-${l}.txt`);
export const FIGER_CV = 'cd site && node --experimental-strip-types tests/fixtures/figer-cv-texte.ts';
export function readReference(l: Lang): string {
  const f = referenceFile(l);
  if (!existsSync(f)) throw new Error(`référence U2 absente : ${f} (la produire avec « ${FIGER_CV} »)`);
  return readFileSync(f, 'utf8');
}
// Forme de comparaison : NFC, sans aucun blanc (espaces, insécables, fines, sauts de ligne et de page) et sans trait
// d'union ASCII, conditionnel (U+00AD) ni U+2010/U+2011 : une coupure de ligne ou une césure de LaTeX ne compte pas
// (U8 déplace des coupures sans changer un mot). Tout le reste compte : lettres, chiffres, ponctuation, tirets
// demi-cadratin et cadratin (« 3–5 » ≠ « 35 »), ◦, |, •. Aucune plage chiffrée du CV n'utilise le trait d'union ASCII.
export const cvCompact = (t: string): string => t.normalize('NFC').replace(/[\s­‐‑-]+/gu, '');
// Premier écart entre deux textes (formes compactes), avec 40 signes de contexte de part et d'autre, chiffres masqués.
export function firstDiff(got: string, want: string): string {
  const a = cvCompact(got);
  const b = cvCompact(want);
  if (a === b) return '';
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ctx = (s: string): string => mask(s.slice(Math.max(0, i - 40), i + 40));
  return `écart au signe ${i} (forme compacte) : reçu « …${ctx(a)}… », référence « …${ctx(b)}… »`;
}

// ---------------- Listes noires étendues (second filet, PDF et site) ----------------

// Formes de date de disponibilité périmées (audit, motifs-site-faibles.txt) : aucune n'est dans les PDF ni l'export au
// 24/11. Les dates de stage (« avr. 2026 – oct. 2026 », « Apr 2026 – Oct 2026 ») restent permises.
export const STALE_FORMS: readonly [string, RegExp][] = [
  ['16/10', /\b16\s*\/\s*10\b/],
  ['16 octobre / 16 October', /\b16\s*(?:octobre|oct\.?|october)(?![a-z])|\b(?:october|oct\.?)\s*16\b/i],
  ['mi-octobre / mid-October', /\bmi[-\s]?octobre\b|\bmid[-\s]?october\b/i],
  ['available from / starting / as of', /\bavailable\s+(?:from|starting|as\s+of)\b/i],
  ['disponible à partir / dès / le', /\bdisponible\s+(?:à\s+partir|dès|le\s+\d)/i],
  ['à partir du', /\bà\s+partir\s+du\b/i],
  ['2026-10-16', /\b2026-10-16\b/],
  ['octobre 2026 / October 2026', /\boctobre\s+2026\b|\boctober\s+2026\b/i],
  ['stage en cours / currently interning', /\bstage\s+en\s+cours\b|\bcurrently\s+(?:interning|an?\s+intern)\b/i],
];
// Formes de titre périmées (audit). « AI Platform Engineering Intern » (intitulé du stage BPCE) et « Ingénierie
// plateforme IA (stage) » restent permis.
export const TITLE_FORMS: readonly [string, RegExp][] = [
  ['Applied AI … Engineer', /\bapplied[\s-]+ai\b[^.\n|]{0,24}?\bengineer\b/i],
  ['AI Platform Engineer', /\bai\s+platform\s+engineer\b/i],
  ['AI Engineer', /\bai\s+engineer\b/i],
  ['Ingénieur (en) IA', /\bing[ée]nieur\s+(?:en\s+)?(?:ia|intelligence\s+artificielle)\b/i],
  ['Ingénieur plateforme', /\bing[ée]nieur\s+plateforme\b/i],
];
// Mots de titre ou de niveau (décision du 24/11, FAITS) que la liste K5 de t1 ne couvrait pas : « niveau », « graduated »,
// « diplômé » ; plus « bac+N » et « level N ». Aucun n'est dans les PDF, l'export ni site/content au 24/11.
export const DEGREE_FORMS: readonly [string, RegExp][] = [
  ['niveau', /\bniveau\b/i],
  ['graduated', /graduat/i],
  ['diplôme / diplômé', /dipl[ôo]m/i],
  ['bac+N', /\bbac\s*\+\s*\d/i],
  ['level N', /\blevel\s*\d/i],
];
export const EXTENDED: readonly [string, RegExp][] = [...STALE_FORMS, ...TITLE_FORMS, ...DEGREE_FORMS];
export const extendedHits = (text: string): string[] => EXTENDED.filter(([, re]) => re.test(flat(text))).map(([name]) => name);

// ---------------- U4 : suites de neuf chiffres ou plus ----------------

// Identifiants connus et publics : les deux activités LinkedIn des liens K9 (post AI for Good, post Datacenter).
export const KNOWN_IDS: readonly string[] = ['7348294640778797059', '7250922511121416193'];
// Séparateurs retirés : blancs, point, trait d'union, barre oblique, parenthèses, plus, tirets U+2010–U+2015 (au plus
// trois de suite). Les années 2000–2039 isolées sont neutralisées d'abord : « 2019–2026 » et deux plages d'années sur
// des lignes voisines ne font pas un numéro. « 1 500 à 3 000 », « 0,30–0,40 € » ou « 3–5 à 1–3 min » sont coupés par
// une lettre ou une virgule.
const YEAR = /(?<!\d)20[0-3]\d(?!\d)/g;
const RUN = /\d(?:[\s.\-/()+‐-―]{0,3}\d)+/g;
export const MIN_DIGITS = 9;
export function digitRuns(text: string): string[] {
  let t = text.normalize('NFKC');
  for (const id of KNOWN_IDS) t = t.split(id).join(' ');
  t = t.replace(YEAR, 'A');
  return [...t.matchAll(RUN)].map((m) => m[0]).filter((r) => r.replace(/\D/g, '').length >= MIN_DIGITS).map(mask);
}

// ---------------- U3 : métadonnées et catalogue ----------------

// Champs permis dans le dictionnaire /Info : Title et Author (exigés), Creator, Producer, dates. Rien d'autre (ni
// Subject, ni Keywords, ni champ maison), et aucun flux XMP (/Metadata) qui échapperait à ce contrôle.
export const INFO_ALLOWED: readonly string[] = ['Title', 'Author', 'Creator', 'Producer', 'CreationDate', 'ModDate'];
export const LANG_RE: Record<Lang, RegExp> = { fr: /^fr(?:-FR)?$/i, en: /^en(?:-[A-Z]{2})?$/i };
// pdfinfo -custom : tout le dictionnaire /Info (champs maison compris), une ligne « Clé: valeur » par champ.
export function pdfInfoDict(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of run('pdfinfo', ['-custom', file]).split('\n')) {
    const m = /^([^:]+):\s?(.*)$/.exec(line);
    if (m) out[m[1]!.trim()] = m[2]!.trim();
  }
  return out;
}
export function pdfInfoStd(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of run('pdfinfo', [file]).split('\n')) {
    const m = /^([^:]+):\s+(.*)$/.exec(line);
    if (m) out[m[1]!.trim()] = m[2]!.trim();
  }
  return out;
}
// /Lang et /PageMode, lus dans le fichier brut et dans chaque flux décompressé (catalogue éventuellement en /ObjStm).
export function pdfCatalog(file: string): { langs: string[]; pageModes: string[] } {
  const langs: string[] = [];
  const pageModes: string[] = [];
  for (const s of segments(readFileSync(file))) {
    for (const m of s.matchAll(/\/Lang\s*(?:\(([^)]*)\)|<([0-9a-fA-F\s]*)>)/g)) {
      if (m[1] !== undefined) langs.push(m[1]);
      else langs.push(Buffer.from(m[2]!.replace(/\s+/g, ''), 'hex').toString('latin1').replace(/^\xfe\xff/, '').replace(/\0/g, ''));
    }
    for (const m of s.matchAll(/\/PageMode\s*\/(\w+)/g)) pageModes.push(m[1]!);
  }
  return { langs, pageModes };
}
export function checkMetadata(file: string, l: Lang): string[] {
  const info = pdfInfoDict(file);
  const std = pdfInfoStd(file);
  const { langs, pageModes } = pdfCatalog(file);
  const out: string[] = [];
  for (const k of Object.keys(info)) if (!INFO_ALLOWED.includes(k)) out.push(`U3 : champ /Info « ${k} » non attendu (permis : ${INFO_ALLOWED.join(', ')})`);
  const title = info.Title ?? '';
  if (!title) out.push('U3 : /Title absent');
  else if (!/arnaud\s+durand/i.test(title) || !title.toLowerCase().includes(TITLE[l].toLowerCase())) out.push(`U3 : /Title « ${mask(title)} » sans « Arnaud Durand » et « ${TITLE[l]} »`);
  if (!/^arnaud\s+durand$/i.test(info.Author ?? '')) out.push(`U3 : /Author « ${mask(info.Author ?? '')} » (attendu « Arnaud Durand »)`);
  if ((std['Metadata Stream'] ?? 'no') !== 'no') out.push('U3 : flux de métadonnées XMP présent (non contrôlé, à retirer)');
  if (langs.length !== 1 || !LANG_RE[l].test(langs[0] ?? '')) out.push(`U3 : /Lang du catalogue = ${JSON.stringify(langs)} (attendu une valeur ${LANG_RE[l]})`);
  if (pageModes.includes('UseOutlines')) out.push('U3 : /PageMode /UseOutlines (panneau des signets ouvert sur un document sans signet)');
  for (const [k, v] of Object.entries(info)) {
    if (k === 'CreationDate' || k === 'ModDate') continue;
    for (const [name, re] of FORBIDDEN) if (re.test(flat(v))) out.push(`U3 : /${k} porte un interdit (${name})`);
    for (const name of extendedHits(v)) out.push(`U3 : /${k} porte une forme périmée (${name})`);
    for (const r of digitRuns(v)) out.push(`U4 : /${k} porte une suite de chiffres ${r}`);
  }
  return out;
}

// ---------------- U3 : texte invisible ----------------

// Rendu Poppler de la page 1 (pdftoppm, gris, 144 ppp), puis, pour chaque mot que pdftotext extrait (-bbox), le pixel
// le plus sombre de sa boîte. Un mot est signalé s'il est hors de la page, si sa boîte fait moins de 4 pt de haut, ou
// si son pixel le plus sombre dépasse 200/255 (blanc, gris très clair, mode de rendu 3, mot recouvert). Le texte le plus
// clair du CV (gris 120) donne 140 au plus au 24/11.
export const DPI = 144;
export const MIN_PT = 4;
export const MAX_DARKEST = 200;
export interface Word { x0: number; y0: number; x1: number; y1: number; text: string }
const unescape = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
export function pdfWords(file: string): { width: number; height: number; words: Word[] } {
  const x = run('pdftotext', ['-f', '1', '-l', '1', '-bbox', file, '-']);
  const page = /<page width="([\d.]+)" height="([\d.]+)">/.exec(x);
  if (!page) throw new Error(`pdftotext -bbox ${file} : page illisible`);
  const words = [...x.matchAll(/<word xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">([^<]*)<\/word>/g)].map((m) => ({ x0: +m[1]!, y0: +m[2]!, x1: +m[3]!, y1: +m[4]!, text: unescape(m[5]!) }));
  return { width: +page[1]!, height: +page[2]!, words };
}
export function invisibleWords(file: string): string[] {
  const { width, height, words } = pdfWords(file);
  const dir = mkdtempSync(join(tmpdir(), 'lot5-u3-'));
  try {
    run('pdftoppm', ['-gray', '-r', String(DPI), '-f', '1', '-l', '1', '-singlefile', file, join(dir, 'r')]);
    const pgm = readFileSync(join(dir, 'r.pgm'));
    const head = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(pgm.subarray(0, 64).toString('latin1'));
    if (!head) throw new Error('pdftoppm : PGM illisible');
    const W = +head[1]!;
    const H = +head[2]!;
    const px = pgm.subarray(head[0].length);
    const s = DPI / 72;
    const out: string[] = [];
    for (const w of words) {
      const label = `« ${mask(w.text).slice(0, 30)} »`;
      if (w.x1 <= 0 || w.y1 <= 0 || w.x0 >= width || w.y0 >= height) {
        out.push(`U3 : mot hors de la page ${label}`);
        continue;
      }
      if (w.y1 - w.y0 < MIN_PT) out.push(`U3 : mot de moins de ${MIN_PT} pt ${label} (${(w.y1 - w.y0).toFixed(1)} pt)`);
      let darkest = 255;
      for (let y = Math.max(0, Math.floor(w.y0 * s)); y < Math.min(H, Math.max(Math.ceil(w.y1 * s), Math.floor(w.y0 * s) + 1)); y++)
        for (let x = Math.max(0, Math.floor(w.x0 * s)); x < Math.min(W, Math.max(Math.ceil(w.x1 * s), Math.floor(w.x0 * s) + 1)); x++) darkest = Math.min(darkest, px[y * W + x]!);
      if (darkest > MAX_DARKEST) out.push(`U3 : mot invisible ou presque ${label} (pixel le plus sombre ${darkest}/255)`);
    }
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------- U8 : espacement des titres de section ----------------

export const SECTION_TITLES: Record<Lang, string[]> = {
  fr: ['Expérience professionnelle', 'Projets', 'Hackathons', 'Compétences techniques', 'Formation, communauté & langues'],
  en: ['Professional Experience', 'Projects', 'Hackathons', 'Technical Skills', 'Education, Community & Languages'],
};
export interface Line { y0: number; y1: number; text: string }
export function pdfLines(file: string): Line[] {
  const x = run('pdftotext', ['-f', '1', '-l', '1', '-bbox-layout', file, '-']);
  return [...x.matchAll(/<line xMin="[-\d.]+" yMin="([-\d.]+)" xMax="[-\d.]+" yMax="([-\d.]+)">([\s\S]*?)<\/line>/g)].map((m) => ({
    y0: +m[1]!,
    y1: +m[2]!,
    text: [...m[3]!.matchAll(/>([^<]*)<\/word>/g)].map((w) => unescape(w[1]!)).join(' '),
  }));
}
// Blanc au-dessus d'un titre (jusqu'à la ligne de texte précédente) et au-dessous (jusqu'à la suivante), en points.
export function sectionGaps(lines: Line[], l: Lang): Record<string, { above: number; below: number } | string> {
  const out: Record<string, { above: number; below: number } | string> = {};
  for (const t of SECTION_TITLES[l]) {
    const hits = lines.filter((x) => x.text === t);
    if (hits.length !== 1) {
      out[t] = `titre trouvé ${hits.length} fois`;
      continue;
    }
    const h = hits[0]!;
    const above = Math.max(...lines.filter((x) => x !== h && x.y1 <= h.y0 + 0.01).map((x) => x.y1));
    const below = Math.min(...lines.filter((x) => x !== h && x.y0 >= h.y1 - 0.01).map((x) => x.y0));
    out[t] = { above: h.y0 - above, below: below - h.y1 };
  }
  return out;
}
// U8 : le dernier titre (« Formation, communauté & langues ») a le même blanc au-dessus que son voisin de même
// structure (« Compétences techniques », lui aussi après un paragraphe sans puces) et le même blanc au-dessous que les
// autres titres, à 0,6 pt près. Mesures du 24/11 : 1,4 pt au-dessus (8,4 attendus), 24,5 au-dessous (18,5 attendus).
export const GAP_TOLERANCE = 0.6;
export function checkU8(lines: Line[], l: Lang): string[] {
  const g = sectionGaps(lines, l);
  const out: string[] = [];
  for (const [t, v] of Object.entries(g)) if (typeof v === 'string') out.push(`U8 : « ${t} » : ${v}`);
  if (out.length) return out;
  const [, , , skills, last] = SECTION_TITLES[l].map((t) => g[t] as { above: number; below: number });
  if (Math.abs(last!.above - skills!.above) > GAP_TOLERANCE) out.push(`U8 : « ${SECTION_TITLES[l][4]} » à ${last!.above.toFixed(1)} pt de la ligne précédente, « ${SECTION_TITLES[l][3]} » à ${skills!.above.toFixed(1)} pt`);
  const others = SECTION_TITLES[l].slice(0, 4).map((t) => (g[t] as { below: number }).below);
  for (const [i, b] of others.entries()) if (Math.abs(last!.below - b) > GAP_TOLERANCE) out.push(`U8 : sous « ${SECTION_TITLES[l][4]} » ${last!.below.toFixed(1)} pt, sous « ${SECTION_TITLES[l][i]} » ${b.toFixed(1)} pt`);
  return out;
}
// Fins de puce orphelines (un seul mot sur la dernière ligne) : diagnostic seulement, l'arbitrage les corrige « si cela
// tient sans changer un mot ».
export const orphans = (lines: Line[]): string[] => lines.filter((x, i) => i > 0 && /^\S+[.;]$/.test(x.text) && !/^\d/.test(x.text)).map((x) => x.text);
