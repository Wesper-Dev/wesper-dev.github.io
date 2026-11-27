// Audit contradictoire Fable du lot 2a, point F12 : les tests de texte ne sautent plus quand FAITS.md est absent
// (dépôt publié limité à site/, CI de publication). Ils lisent alors une copie versionnée des seuls textes publics
// qu'ils comparent : tests/fixtures/textes-publics.json. La copie est produite par un extracteur unique
// (extractPublicTexts) appliqué à FAITS.md et à BASE_DONNEES.md ; f12-copie-faits.test.ts vérifie, quand ces fichiers
// sont présents, que l'extracteur redonne la copie à l'identique.
// Régénération : node --experimental-strip-types tests/fixtures/regenerer-textes-publics.ts (depuis site/).
// Chemins surchargés par SITE_TEST_FAITS et SITE_TEST_BASE (un chemin inexistant simule leur absence).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BnpReference } from './helpers.ts';
import { cells, parseFaits } from './helpers-tree.ts';
import { typoApos, typoAposDeep } from './helpers-typo.ts';
import type { FaitsTree } from './helpers-tree.ts';

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FAITS_FILE: string = process.env.SITE_TEST_FAITS ?? join(siteDir, '..', 'deliverables', 'refonte-arbre', 'FAITS.md');
export const BASE_FILE: string = process.env.SITE_TEST_BASE ?? join(siteDir, '..', 'BASE_DONNEES.md');
export const FIXTURE_FILE: string = join(siteDir, 'tests', 'fixtures', 'textes-publics.json');

type Pair = { fr: string; en: string };
export interface FaitsCommons { title: Pair; availability: Pair; line42: Pair; bnpSentence: Pair; caseLink: Pair }
export interface ContactReference { mail: string; github: string; linkedin: string }
// Lot 2b (contrat-lot2b P2, P3) : textes des pages de détail BPCE (§2) et École 42 (§4).
export interface BpceReference { name: string; role: Pair; dates: Pair; cardHook: Pair; cardSubtitle: Pair; sandbox: Pair; trainingTitle: Pair; training: Pair }
export interface Ecole42Reference { name: string; line: string; cardSubtitle: Pair; paragraph: Pair }
export interface FaitsTexts { tree: FaitsTree; bnp: BnpReference; commons: FaitsCommons; e31: string[]; bpce: BpceReference; ecole42: Ecole42Reference }
export interface PublicTexts { faits: FaitsTexts; contact: ContactReference }

export const faitsPresent = (): boolean => existsSync(FAITS_FILE);
export const basePresent = (): boolean => existsSync(BASE_FILE);

let fixtureCache: PublicTexts | null = null;
export function fixture(): PublicTexts {
  if (fixtureCache === null) {
    if (!existsSync(FIXTURE_FILE)) throw new Error(`copie versionnée absente : ${FIXTURE_FILE}`);
    const raw = JSON.parse(readFileSync(FIXTURE_FILE, 'utf8')) as PublicTexts & Record<string, unknown>;
    fixtureCache = { faits: raw.faits, contact: raw.contact };
  }
  return fixtureCache;
}
let faitsCache: string | null = null;
const faitsRaw = (): string => (faitsCache ??= readFileSync(FAITS_FILE, 'utf8'));

// ---- Extraction depuis FAITS.md ----

const normalizeMd = (s: string): string => s.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
function between(text: string, start: string, end: string): string {
  const i = text.indexOf(start);
  if (i < 0) throw new Error(`FAITS.md : repère introuvable « ${start} »`);
  const j = text.indexOf(end, i + start.length);
  if (j < 0) throw new Error(`FAITS.md : repère de fin introuvable « ${end} »`);
  return text.slice(i, j);
}

// §1 (carte, page de détail) et §7 (phrase du premier écran) : lecture inchangée depuis le lot 1c (C4).
export function parseFaitsBnp(text: string): BnpReference {
  const section = between(text, '## 1. BNP Paribas', '## 2. BPCE');
  const formulation = between(section, '### Formulation publique', 'Liens vers les compétences');
  const card = between(formulation, '- **Carte**', '- **Page de détail**');
  const detail = formulation.slice(formulation.indexOf('- **Page de détail**'));
  const quotes = (segment: string): string[] => [...segment.matchAll(/«\s*([^»]*?)\s*»/g)].map((m) => normalizeMd(m[1] ?? ''));
  const cardQuotes = quotes(card); // FR chiffre, FR sous-titre, EN chiffre, EN sous-titre
  const detailQuotes = quotes(detail); // FR1, EN1, ..., FR5, EN5, puis la limite A-04 (FR, EN) : exclue
  if (cardQuotes.length !== 4) throw new Error(`FAITS.md : carte, 4 citations attendues, reçu ${cardQuotes.length}`);
  if (detailQuotes.length !== 12) throw new Error(`FAITS.md : page de détail, 12 citations attendues, reçu ${detailQuotes.length}`);
  const line = text.split('\n').find((l) => l.startsWith('| Phrase BNP du premier écran |'));
  if (!line) throw new Error('FAITS.md : ligne « Phrase BNP du premier écran » introuvable (§7)');
  const c = line.split('|').map((x) => x.trim());
  return {
    paragraphs: { fr: [0, 2, 4, 6, 8].map((i) => detailQuotes[i] ?? ''), en: [1, 3, 5, 7, 9].map((i) => detailQuotes[i] ?? '') },
    card: { fr: [cardQuotes[0] ?? '', cardQuotes[1] ?? ''], en: [cardQuotes[2] ?? '', cardQuotes[3] ?? ''] },
    meta: { fr: normalizeMd(c[2] ?? ''), en: normalizeMd(c[3] ?? '') },
  };
}

// §7 « Textes communs » : colonnes FR et EN des lignes lues par les tests (la colonne Source n'est pas copiée).
export function parseFaitsCommons(text: string): FaitsCommons {
  const at = text.indexOf('## 7. Textes communs');
  if (at < 0) throw new Error('FAITS.md : section « 7. Textes communs » introuvable');
  const lines = text.slice(at).split('\n');
  const row = (label: string): Pair => {
    const line = lines.find((l) => l.startsWith(`| ${label} |`));
    if (!line) throw new Error(`FAITS.md §7 : ligne « ${label} » introuvable`);
    const c = cells(line);
    return { fr: c[1] ?? '', en: c[2] ?? '' };
  };
  return { title: row('Titre'), availability: row('Disponibilité'), line42: row('Ligne 42 du site'), bnpSentence: row('Phrase BNP du premier écran'), caseLink: row('Lien du premier écran') };
}

// ---- Lot 2b : §2 BPCE et §4 École 42 (pages de détail) ----

const quotesIn = (segment: string): string[] => [...segment.matchAll(/«\s*([^»]*?)\s*»/g)].map((m) => normalizeMd(m[1] ?? ''));
// Nom de l'expérience : titre de section « ## n. Nom ».
function sectionName(section: string, n: number): string {
  const m = new RegExp(`^## ${n}\\. (.+)$`, 'm').exec(section);
  if (!m) throw new Error(`FAITS.md : titre de la section ${n} introuvable`);
  return (m[1] ?? '').trim();
}
// Ligne « | Libellé | FR / EN | … » d'un tableau : deux valeurs séparées par « / ».
function slashPair(section: string, label: string): Pair {
  const line = section.split('\n').find((l) => l.startsWith(`| ${label} |`));
  if (!line) throw new Error(`FAITS.md : ligne « ${label} » introuvable`);
  const parts = (cells(line)[1] ?? '').split(' / ');
  if (parts.length !== 2) throw new Error(`FAITS.md : « ${label} » : deux valeurs séparées par « / » attendues`);
  return { fr: normalizeMd(parts[0] ?? ''), en: normalizeMd(parts[1] ?? '') };
}
// Ligne de tableau dont la cellule de texte porte des citations « … ».
function rowQuotes(section: string, label: string, n: number): string[] {
  const line = section.split('\n').find((l) => l.startsWith(`| ${label} |`));
  if (!line) throw new Error(`FAITS.md : ligne « ${label} » introuvable`);
  const q = quotesIn(cells(line)[1] ?? '');
  if (q.length !== n) throw new Error(`FAITS.md : « ${label} » : ${n} citation(s) attendue(s), reçu ${q.length}`);
  return q;
}

export function parseFaitsBpce(text: string): BpceReference {
  const section = between(text, '## 2. BPCE', '## 3. ');
  const formulation = section.slice(section.indexOf('### Formulation publique'));
  if (formulation.length === 0) throw new Error('FAITS.md §2 : « Formulation publique » introuvable');
  const hook = rowQuotes(formulation, 'Carte, accroche', 2);
  const sub = rowQuotes(formulation, 'Carte, sous-titre', 2);
  const [sandboxFr] = rowQuotes(formulation, 'Page, sandbox FR', 1);
  const [sandboxEn] = rowQuotes(formulation, 'Page, sandbox EN', 1);
  // « Bloc séparé, titre « FR » / « EN » — FR : « … » EN : « … » (… sans « mieux optimisé » …) » : quatre premières citations.
  const block = quotesIn(between(formulation, 'Bloc séparé', 'Les deux blocs ne se suivent'));
  if (block.length < 4) throw new Error(`FAITS.md §2 : bloc séparé, 4 citations attendues (titre FR/EN, texte FR/EN), reçu ${block.length}`);
  return {
    name: sectionName(section, 2),
    role: slashPair(section, 'Rôle FR / EN'),
    dates: slashPair(section, 'Dates FR / EN'),
    cardHook: { fr: hook[0] ?? '', en: hook[1] ?? '' },
    cardSubtitle: { fr: sub[0] ?? '', en: sub[1] ?? '' },
    sandbox: { fr: sandboxFr ?? '', en: sandboxEn ?? '' },
    trainingTitle: { fr: block[0] ?? '', en: block[1] ?? '' },
    training: { fr: block[2] ?? '', en: block[3] ?? '' },
  };
}

export function parseFaits42(text: string): Ecole42Reference {
  const section = between(text, '## 4. École 42', '## 5. ');
  const [line] = rowQuotes(section, 'Ligne de formation (FR et EN)', 1);
  const formulation = section.slice(section.indexOf('### Formulation publique'));
  const card = quotesIn(between(formulation, '- **Carte**', '- **Page de détail**')); // FR ligne, FR sous-titre, EN ligne, EN sous-titre
  if (card.length !== 4) throw new Error(`FAITS.md §4 : carte, 4 citations attendues, reçu ${card.length}`);
  const detail = quotesIn(formulation.slice(formulation.indexOf('- **Page de détail**')));
  if (detail.length !== 2) throw new Error(`FAITS.md §4 : page de détail, 2 citations attendues (FR, EN), reçu ${detail.length}`);
  return {
    name: sectionName(section, 4),
    line: line ?? '',
    cardSubtitle: { fr: card[1] ?? '', en: card[3] ?? '' },
    paragraph: { fr: detail[0] ?? '', en: detail[1] ?? '' },
  };
}

// BASE_DONNEES.md, tableau des profils : adresse, GitHub, LinkedIn (valeurs de référence du dépôt, F13).
export function parseContact(text: string): ContactReference {
  // Première ligne du libellé dont la deuxième cellule a la forme attendue (le libellé revient dans d'autres tableaux).
  const rows = (label: string): string[] => text.split('\n').filter((l) => l.startsWith(`| ${label} |`)).map((l) => cells(l)[1] ?? '');
  const url = (label: string): string => {
    for (const c of rows(label)) {
      const m = /^\[[^\]]*\]\((https:\/\/[^)\s]+)\)$/.exec(c);
      if (m) return m[1] as string;
    }
    throw new Error(`BASE_DONNEES.md : ligne « ${label} » avec un lien introuvable`);
  };
  const mail = rows('Email').find((c) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c));
  if (!mail) throw new Error('BASE_DONNEES.md : ligne « Email » avec une adresse introuvable');
  return { mail, github: url('GitHub'), linkedin: url('LinkedIn') };
}

export const squashWs = (s: string): string => s.replace(/[ \t\r\n]+/g, ' ').trim();

// Extracteur unique : FAITS.md (et BASE_DONNEES.md) → textes publics lus par les tests. `e31` : chaînes de la table
// E3.1 (helpers-home.ts) attestées mot pour mot dans FAITS.md, blancs réduits.
export function extractFaitsTexts(faits: string, e31Candidates: readonly string[]): FaitsTexts {
  const flat = squashWs(faits);
  return {
    tree: parseFaits(faits),
    bnp: parseFaitsBnp(faits),
    commons: parseFaitsCommons(faits),
    e31: [...new Set(e31Candidates.filter((s) => flat.includes(s)))].sort(),
    bpce: parseFaitsBpce(faits),
    ecole42: parseFaits42(faits),
  };
}

// ---- Lecture : FAITS.md s'il est présent, sinon la copie (jamais de saut) ----

export const faitsSource = (): string => (faitsPresent() ? FAITS_FILE : `${FIXTURE_FILE} (FAITS.md absent)`);
// Tour Y (Y4) : références typographiées (U+0027 entre deux lettres → U+2019), voir helpers-typo.ts.
export const faitsTree = (): FaitsTree => typoAposDeep(faitsPresent() ? parseFaits(faitsRaw()) : fixture().faits.tree);
export const bnpReference = (): BnpReference => typoAposDeep(faitsPresent() ? parseFaitsBnp(faitsRaw()) : fixture().faits.bnp);
export const faitsCommons = (): FaitsCommons => typoAposDeep(faitsPresent() ? parseFaitsCommons(faitsRaw()) : fixture().faits.commons);
export const bpceReference = (): BpceReference => typoAposDeep(faitsPresent() ? parseFaitsBpce(faitsRaw()) : fixture().faits.bpce);
export const ecole42Reference = (): Ecole42Reference => typoAposDeep(faitsPresent() ? parseFaits42(faitsRaw()) : fixture().faits.ecole42);
export const contactReference = (): ContactReference => (basePresent() ? parseContact(readFileSync(BASE_FILE, 'utf8')) : fixture().contact);

// Chaînes de la copie, une par ligne : corpus des tests « texte mot pour mot dans FAITS » quand FAITS.md manque.
function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const v of x) strings(v, out);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) strings(v, out);
  return out;
}
export const faitsCorpus = (): string => typoApos(faitsPresent() ? faitsRaw() : strings(fixture().faits).join('\n'));
