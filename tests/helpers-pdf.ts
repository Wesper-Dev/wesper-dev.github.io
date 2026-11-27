// Lot 5, T2 (tmp/refonte-arbre/contrat-lot5.md ; deliverables/refonte-arbre/CV-PUBLIC-SPEC.md §5.1) : lecture des PDF
// servis, sans paquet npm ni réseau.
// - Texte, pages, images : Poppler (pdftotext, pdfinfo, pdfimages), les méthodes K1, K2 et K10 de la spec ; c'est
//   aussi ce que lit un ATS. Outil absent = erreur qui nomme le paquet (poppler-utils), jamais un test sauté (F12).
// - Liens : lecteur Node versionné ci-dessous (node:zlib), qui lit chaque objet et chaque flux Flate et décode toutes
//   les chaînes /URI, y compris en hexadécimal ou en UTF-16. Il ne dépend pas de Poppler.
// - Témoins : PDF minimaux écrits à l'exécution dans un dossier temporaire (writeTestPdf), jamais versionnés.
// Aucun numéro de téléphone réel n'est écrit ici : les témoins n'utilisent que des zéros (comme C3).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { distDir, siteDir } from './helpers.ts';

export type Lang = 'fr' | 'en';
export const LANGS: readonly Lang[] = ['fr', 'en'];
// Q-R8 : mêmes URL que les anciens CV « platform ».
export const CV_NAME = (l: Lang): string => `arnaud-durand-cv-platform-${l}.pdf`;
export const CV_URL = (l: Lang): string => `/cv/${CV_NAME(l)}`;
export const servedPdf = (l: Lang): string => join(siteDir, 'public', 'cv', CV_NAME(l));
export const exportedPdf = (l: Lang): string => join(distDir, 'cv', CV_NAME(l));
// Dépôt complet seulement (la CI de publication ne voit que site/) : PF/ et sa copie de deliverables/cv/.
export const repoDir: string = join(siteDir, '..');
export const pfPdf = (l: Lang): string => join(repoDir, 'deliverables', 'cv', 'source', `cv-public-platform-${l}.pdf`);
export const deliverablePdf = (l: Lang): string => join(repoDir, 'deliverables', 'cv', `cv-public-platform-${l}.pdf`);
// CV de candidature avec téléphone (P-04, non publiés) : témoins négatifs réels, lus seulement s'ils sont présents.
export const candidatePdfs = (): string[] => LANGS.map((l) => join(repoDir, 'deliverables', 'cv', 'source', `cv-arnaud-durand-platform-${l}.pdf`)).filter((f) => existsSync(f));

// ---------------- Poppler ----------------

export const POPPLER_HINT = 'installer poppler-utils (macOS : brew install poppler ; CI Ubuntu : sudo apt-get install -y poppler-utils, avant npm test)';

function poppler(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  if (r.error && (r.error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`${cmd} introuvable : ${POPPLER_HINT} (contrat lot 5, T2)`);
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} : code ${r.status} ${(r.stderr ?? '').slice(0, 300)}`);
  return r.stdout ?? '';
}
const cache = new Map<string, unknown>();
const memo = <T>(key: string, f: () => T): T => {
  if (!cache.has(key)) cache.set(key, f());
  return cache.get(key) as T;
};
// Texte brut tel que pdftotext le rend (ordre de lecture par défaut, UTF-8), AVANT toute normalisation (K2).
export const pdfText = (file: string): string => memo(`t:${file}`, () => poppler('pdftotext', ['-enc', 'UTF-8', file, '-']));
export const pdfPages = (file: string): number =>
  memo(`p:${file}`, () => {
    const m = /^Pages:\s+(\d+)/m.exec(poppler('pdfinfo', [file]));
    if (!m) throw new Error(`pdfinfo ${file} : nombre de pages illisible`);
    return Number(m[1]);
  });
// pdfimages -list : deux lignes d'en-tête puis une ligne par image matricielle (K10).
export const pdfImageCount = (file: string): number => memo(`i:${file}`, () => poppler('pdfimages', ['-list', file]).split('\n').slice(2).filter((l) => l.trim()).length);

// ---------------- Lecteur Node : URI et objets image ----------------

// Morceaux à fouiller : le fichier brut, puis chaque flux décompressé (flux de contenu, flux d'objets /ObjStm).
// Exporté pour U3 (helpers-u.ts : /Lang et /PageMode du catalogue).
export function segments(buf: Buffer): string[] {
  const out = [buf.toString('latin1')];
  const raw = out[0] as string;
  const re = /(?<!end)stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const dictStart = raw.lastIndexOf('obj', m.index);
    const dict = raw.slice(Math.max(0, dictStart), m.index);
    if (/\/FlateDecode/.test(dict)) {
      let body = buf.subarray(start, end);
      for (let k = 0; k < 2; k++) if (body.length && (body[body.length - 1] === 0x0a || body[body.length - 1] === 0x0d)) body = body.subarray(0, body.length - 1);
      try {
        out.push(inflateSync(body).toString('latin1'));
      } catch {
        try {
          out.push(inflateSync(buf.subarray(start, end), { finishFlush: 2 }).toString('latin1'));
        } catch {
          // flux illisible : ignoré (les compteurs de contrôle ci-dessous le verraient s'il portait un lien attendu)
        }
      }
    }
    re.lastIndex = end + 'endstream'.length;
  }
  return out;
}

// Chaîne littérale PDF (§7.3.4.2) : parenthèses équilibrées, échappements, octal.
function literalAt(s: string, i: number): { value: string; end: number } {
  let depth = 1;
  let out = '';
  let k = i + 1;
  while (k < s.length && depth > 0) {
    const c = s[k] as string;
    if (c === '\\') {
      const n = s[k + 1] ?? '';
      const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      if (n in map) {
        out += map[n];
        k += 2;
      } else if (/[0-7]/.test(n)) {
        const oct = /^[0-7]{1,3}/.exec(s.slice(k + 1))![0];
        out += String.fromCharCode(parseInt(oct, 8));
        k += 1 + oct.length;
      } else if (n === '\r' || n === '\n') {
        k += n === '\r' && s[k + 2] === '\n' ? 3 : 2;
      } else {
        out += n;
        k += 2;
      }
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (depth > 0) out += c;
    k++;
  }
  return { value: out, end: k };
}
const bytesToText = (latin: string): string => {
  if (latin.charCodeAt(0) === 0xfe && latin.charCodeAt(1) === 0xff) {
    let t = '';
    for (let k = 2; k + 1 < latin.length; k += 2) t += String.fromCharCode((latin.charCodeAt(k) << 8) | latin.charCodeAt(k + 1));
    return t;
  }
  return Buffer.from(latin, 'latin1').toString('utf8');
};

// Toutes les cibles /URI du fichier, dans l'ordre de lecture des morceaux (doublons gardés).
export function pdfUris(file: string): string[] {
  return memo(`u:${file}`, () => {
    const uris: string[] = [];
    for (const s of segments(readFileSync(file))) {
      const re = /\/URI\s*([(<])/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        const at = m.index + m[0].length - 1;
        if (m[1] === '(') {
          const { value, end } = literalAt(s, at);
          uris.push(bytesToText(value));
          re.lastIndex = end;
        } else {
          const close = s.indexOf('>', at);
          const hex = s.slice(at + 1, close).replace(/\s+/g, '');
          const bytes = (hex.length % 2 ? hex + '0' : hex).match(/../g) ?? [];
          uris.push(bytesToText(bytes.map((h) => String.fromCharCode(parseInt(h, 16))).join('')));
          re.lastIndex = close + 1;
        }
      }
    }
    return uris;
  });
}
// Objets image (/Subtype /Image) et images en ligne (BI … ID) : complément de pdfimages, pour un logo glissé autrement.
export function pdfImageObjects(file: string): number {
  return memo(`o:${file}`, () => segments(readFileSync(file)).reduce((n, s) => n + (s.match(/\/Subtype\s*\/Image\b/g) ?? []).length + (s.match(/(?:^|\s)BI\s+\/\w+[\s\S]{0,400}?\sID\s/g) ?? []).length, 0));
}

// ---------------- Normalisation du texte extrait ----------------

// Forme plate : NFC, espaces insécables et fines -> espace, apostrophes -> ', tirets -> -. Sert aux recherches de mots.
export const flat = (t: string): string =>
  t
    .normalize('NFC')
    .replace(/[     ]/g, ' ')
    .replace(/[’‘ʼ′`]/g, "'")
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/­/g, '');
// Forme compacte : plate, en minuscules, sans blancs ni tirets. Absorbe les coupures de ligne et les césures de LaTeX
// (« plani-\nfication ») : une phrase attendue est présente si sa forme compacte l'est.
export const loose = (t: string): string => flat(t).toLowerCase().replace(/[\s-]+/g, '');
export const has = (text: string, phrase: string): boolean => loose(text).includes(loose(phrase));
export function count(text: string, phrase: string): number {
  const a = loose(text);
  const b = loose(phrase);
  if (!b) return 0;
  let n = 0;
  for (let i = a.indexOf(b); i >= 0; i = a.indexOf(b, i + b.length)) n++;
  return n;
}

// ---------------- Téléphone (K8) ----------------

// Séparateurs de chiffres : espace, point, tiret, espace insécable ou fine, saut de ligne (jusqu'à trois signes).
const SEP = '(?:[\\s.\\-\\u00a0\\u202f\\u2009]{0,3})';
const PAIR = `(?:${SEP}\\d{2}){4}`;
export const PHONE_RE = new RegExp(`(?<![\\d+])(?:(?:\\+|00)${SEP}33${SEP}(?:\\(0\\)${SEP})?[1-9]${PAIR}|0[1-9]${PAIR})(?!\\d)`, 'g');
// Masque : un message d'échec ne doit jamais recopier un numéro réel (journaux, preuves, rapport).
export const mask = (s: string): string => s.replace(/\d/g, '•');
export const phoneHits = (text: string): string[] => [...text.normalize('NFKC').matchAll(PHONE_RE)].map((m) => mask(m[0]));
export const telUris = (uris: string[]): string[] => uris.filter((u) => /^\s*tel:/i.test(u)).map(mask);

// ---------------- Textes attendus (spec §3.2 à §3.5, FAITS §7) ----------------

export const TITLE: Record<Lang, string> = { fr: 'Ingénieur logiciel', en: 'Software Engineer' };
export const AVAILABILITY: Record<Lang, string> = {
  fr: 'Disponible immédiatement — CDI ; ouvert au freelance et aux projets open source',
  en: 'Available now — permanent role; open to freelance and open-source projects',
};
export const SUMMARY: Record<Lang, string> = {
  fr: 'Un outil LLM développé en binôme et validé pour la production dans une banque par le comité de pilotage, avec une application React ; un agent couvert par plus de 120 tests hors ligne ; des bases systèmes en C acquises à 42.',
  en: 'An LLM tool built with a colleague and approved for production at a bank by the steering committee, with a React app; an agent covered by more than 120 offline tests; systems foundations in C from 42.',
};
// Décision du propriétaire du 24/11 (remplace Q-R11 et le §3.5 pour le CV public) : la ligne dit seulement que l'École
// 42 a été suivie, sans titre ni attente de titre.
export const LINE_42: Record<Lang, string> = {
  fr: 'École 42 Paris, 2019–2026 : projets en C/C++, UNIX/POSIX, concurrence.',
  en: 'École 42 Paris, 2019–2026: C/C++, POSIX, concurrency.',
};
// Ancienne ligne (Q-R11), gardée seulement comme témoin « titre dit attendu ».
export const OLD_LINE_42: Record<Lang, string> = {
  fr: 'École 42 Paris, 2019–2026 : projets en C/C++, UNIX/POSIX, concurrence ; titre RNCP 7 (bac+5) attendu au T1 2027.',
  en: 'École 42 Paris, 2019–2026: C/C++, POSIX, concurrency; master’s-level qualification (RNCP 7) expected Q1 2027.',
};
// Puces publiques du §3.4 (texte exact, sans les commandes LaTeX). Tour W (contrat-relecture-w.md, 26/11) : puce BNP
// « Outil validé… » / « Tool approved… » avec « avec les commentaires de l’outil » (W2, D3) ; BPCE EN sans
// « constraint-based » et « its Kubernetes design » (C3, D4) ; Croix-Rouge 2 finit sur la plateforme d’équipe (C4).
export const BULLETS: Record<Lang, Record<string, string>> = {
  fr: {
    'BNP 2': 'Outil validé pour la production par le comité de pilotage, avec env. 95 % d’accord des analystes avec les commentaires de l’outil',
    'BPCE 2': 'Ramené de 1–2 jours à 1 h la planification des formations de 1 500 à 3 000 collaborateurs : POC d’optimisation sous 20 règles métier.',
    'droit-de-retard 2': 'Plus de 120 tests hors ligne ; périmètre d’évaluation documenté dans le dépôt.',
    'Croix-Rouge 2': 'Sur six mois, co-développé l’application (front, back) : scénarios de jeu de rôle plus réalistes avec les équipes métier, flashcards et contribution au coach socratique ; plateforme d’équipe testée auprès d’env. 50 secouristes.',
    Minishell: 'Minishell',
    'Fitness 42': 'Fitness 42',
  },
  en: {
    'BNP 2': 'Tool approved for production by the steering committee, with about 95% analyst agreement with the tool’s comments',
    'BPCE 1': 'contributed to its Kubernetes design with the infrastructure team.',
    'BPCE 2': 'Cut the time needed to schedule training for 1,500–3,000 employees from 1–2 days to 1 hour with an optimisation PoC covering 20 business rules.',
    'droit-de-retard 2': 'More than 120 offline tests; evaluation scope documented in the repository.',
    'Croix-Rouge 2': 'Over six months, co-developed the app (front and back end): more realistic role-play scenarios with domain experts, flashcards and a contribution to the Socratic coach; team platform tested with about 50 first-aiders.',
    Minishell: 'Minishell',
    'Fitness 42': 'Fitness 42',
  },
};
// Liens actifs attendus (K9), comparés sans tenir compte de la casse. Famille software : droit-de-retard et Minishell ;
// hackathons IA & Crise, Datacenter, LCL. Tour W (C4) : le post AI for Good quitte la puce Croix-Rouge, donc le CV.
export const EXPECTED_URIS: readonly string[] = [
  'mailto:arnaud.durand97@gmail.com',
  'https://wesper-dev.github.io/',
  'https://linkedin.com/in/arnaud-durand42',
  'https://github.com/Wesper-Dev',
  'https://github.com/Wesper-Dev/droit-de-retard',
  'https://github.com/Wesper-Dev/Minishell',
  'https://github.com/Wesper-Dev/CroixRouge-Hackathon',
  'https://www.linkedin.com/posts/arnaud-durand42_ai-deepmind-alphafold-activity-7250922511121416193-363Q/',
  'https://github.com/Wesper-Dev/My-BankBot',
];

// ---------------- Contrôles purs (texte -> écarts), partagés par les tests et leurs témoins ----------------

// K5 (décision du 24/11) : exactement une ligne 42 de la langue, et nulle part dans le PDF un mot de diplôme ou d'attente
// de titre. Les mots sont comparés en forme compacte (loose), comme le texte : « T1 2027 » devient « t12027 », et une
// césure ou un retour à la ligne ne les cache pas. « diplôm » couvre diplôme et diplômé. « titre » est cherché tel quel :
// le CV public n'en a aucun autre emploi au 24/11 (un « à titre de » futur serait signalé).
export const DEGREE_WORDS: readonly string[] = ['rncp', 'master', 'bac+5', 'attendu', 'expected', 'alumni', 'diplôm', 'degree', 'titre', 'obtenu', 'awarded', 'T1 2027', 'Q1 2027'];
export function check42(text: string, l: Lang): string[] {
  const out: string[] = [];
  const n = count(text, LINE_42[l]);
  if (n !== 1) out.push(`K5 : ligne 42 trouvée ${n} fois (1 attendue)`);
  const all = loose(text);
  for (const w of DEGREE_WORDS) if (all.includes(loose(w))) out.push(`K5 : « ${w} » dans le PDF public`);
  return out;
}

// K6 : résumé présent ; « production » seulement dans les contextes validés. Tour Z (Z1, 25/11) : FR « validé pour la
// production » (résumé, puce BNP 2), « contraintes visées en production » (puce BPCE 1, validée A-02) ; EN « approved for
// production » (deux fois), « future production security requirements » (BPCE 1). Toute autre occurrence (« mis en
// production », « released to production », présent, « outil LLM en production », « in production ») est un écart.
const PRODUCTION_OK: Record<Lang, string[]> = {
  fr: ['validépourlaproduction', 'contraintesviséesenproduction'],
  en: ['approvedforproduction', 'futureproductionsecurityrequirements'],
};
export function checkProduction(text: string, l: Lang): string[] {
  const out: string[] = [];
  if (!has(text, SUMMARY[l])) out.push('K6 : résumé du §3.3 absent (aucune version sans résumé)');
  if (!has(text, BULLETS[l]['BNP 2'] as string)) out.push('K6 : puce BNP « validé pour la production par le comité de pilotage » absente');
  let rest = loose(text);
  for (const ok of PRODUCTION_OK[l]) rest = rest.split(ok).join(' | ');
  const at = rest.indexOf('production');
  if (at >= 0) out.push(`K6 : « production » hors contexte validé près de « …${rest.slice(Math.max(0, at - 40), at + 20)}… »`);
  return out;
}

// K7 : bloc BPCE (du nom de BPCE à « BNP Paribas ») au passé, POC jamais dit terminé, « mieux optimisé » absent.
export function bpceBlock(text: string): string {
  const t = flat(text);
  const a = t.search(/\bBPCE\b/);
  const b = t.search(/\bBNP Paribas\b/);
  return a >= 0 && b > a ? t.slice(a, b) : '';
}
export function checkBpce(text: string, l: Lang): string[] {
  const out: string[] = [];
  const block = bpceBlock(text);
  if (!block) return ['K7 : bloc BPCE introuvable (BPCE puis BNP Paribas)'];
  if (/\bcontributing\b/i.test(text)) out.push('K7 : « contributing » (présent) dans le PDF');
  if (l === 'en' && !has(block, BULLETS.en['BPCE 1'] as string)) out.push('K7 : « contributed to its Kubernetes design with the infrastructure team. » absent du bloc BPCE');
  if (l === 'en' && !has(block, BULLETS.en['BPCE 2'] as string)) out.push('K7 : puce BPCE 2 (tour W, C3 : « an optimisation PoC ») absente du bloc BPCE');
  if (l === 'fr' && !has(block, BULLETS.fr['BPCE 2'] as string)) out.push('K7 : puce BPCE 2 du §3.4 absente');
  const hit = /\b(termin\w*|livr\w*|abouti\w*|achev\w*|finalis\w*|complet(?:ed|e)\b|deliver\w*|finish\w*|shipped|launched|went live)/i.exec(block);
  if (hit) out.push(`K7 : POC dit terminé ou livré (« ${hit[0]} ») dans le bloc BPCE`);
  if (/mieux optimis|better optimi[sz]|qu.à la main|than (?:by|done by) hand|manually optimi/i.test(flat(text))) out.push('K7 : « mieux optimisé qu’à la main » ou son équivalent présent');
  return out;
}

// K12 (partie publique) et interdits du contrat T2. Les deux termes privés BPCE de K12 restent au vérificateur de
// deliverables/cv/source (le site est publié) ; « RNCP », « Master », « Alumni » et les autres mots de diplôme sont traités par K5.
export const FORBIDDEN: readonly [string, RegExp][] = [
  ['Applied AI Engineer', /applied\s+ai\s+engineer/i],
  ['16 octobre / 16 October', /16\s*(?:octobre|oct\.?\b|october)|(?:october|oct\.?)\s*16\b/i],
  ['à partir du / available from', /à\s+partir\s+du|available\s+from/i],
  ['PyTorch', /pytorch/i],
  ['LeRobot', /le\s*robot/i],
  ['LangChain', /lang\s*chain/i],
  ['LangGraph', /lang\s*graph/i],
  ['OpenShift', /open\s*shift/i],
  ['multi-thread', /multi-?\s*thread/i],
  ['vLLM', /\bvllm\b/i],
  ['Kata', /\bkata\b/i],
  ['gVisor', /g\s*visor/i],
  ['Podman', /podman/i],
  ['déterministe / deterministic', /d[ée]terminist/i],
  ['121 (forme datée du nombre de tests)', /\b121\b/],
  ['120+', /\b120\s*\+/],
  ['Pokémon (hors CV public, P-02)', /pok[ée]mon/i],
  ['Développeur Python / Python developer', /d[ée]veloppeur\s+python|python\s+developer/i],
  ['Alumni', /\balumni\b/i],
];
export const forbiddenHits = (text: string): string[] => FORBIDDEN.filter(([, re]) => re.test(flat(text))).map(([name]) => name);

// ---------------- Témoins : PDF minimaux écrits à l'exécution ----------------

// Windows-1252 (WinAnsiEncoding) : Helvetica standard, lue par pdftotext sans police embarquée.
const CP1252: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c };
function winAnsi(s: string): string {
  let out = '';
  for (const ch of s.replace(/[  ]/g, ' ')) {
    const c = ch.codePointAt(0) as number;
    const b = CP1252[ch] ?? (c < 256 ? c : 0x3f);
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += '\\' + String.fromCharCode(b);
    else if (b < 0x20 || b > 0x7e) out += '\\' + b.toString(8).padStart(3, '0');
    else out += String.fromCharCode(b);
  }
  return out;
}
export interface TestPdf {
  lines: string[];
  links?: { label: string; uri: string }[];
  image?: boolean;
  pages?: number;
  hexUri?: boolean; // écrit les URI en chaîne hexadécimale (contrôle du lecteur)
  // Lot 5, U3 (témoins) : dictionnaire /Info (chaînes UTF-16BE), /Lang et /PageMode du catalogue, et lignes cachées
  // écrites après les lignes visibles : blanc pur, gris 0,93, mode de rendu 3, corps de 2 pt, hors de la page.
  info?: Record<string, string>;
  lang?: string;
  pageMode?: string;
  hidden?: { text: string; how: 'blanc' | 'presque-blanc' | 'tr3' | 'minuscule' | 'hors-page' }[];
}
const utf16Hex = (s: string): string => `<feff${[...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}>`;
// Écrit un PDF valide (table xref exacte) et renvoie son chemin ; dossier temporaire à effacer par cleanupPdfs().
const pdfDirs: string[] = [];
export function cleanupPdfs(): void {
  for (const d of pdfDirs.splice(0)) rmSync(d, { recursive: true, force: true });
}
// Lignes de 100 signes au plus : un texte hors de la page serait coupé par pdftotext.
function wrap(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of line.split(' ')) {
    if (cur && (cur + ' ' + w).length > 100) {
      out.push(cur);
      cur = w;
    } else cur = cur ? cur + ' ' + w : w;
  }
  return [...out, cur];
}
export function writeTestPdf(name: string, spec: TestPdf): string {
  const dir = mkdtempSync(join(tmpdir(), 'lot5-pdf-'));
  pdfDirs.push(dir);
  const pages = spec.pages ?? 1;
  const objs: string[] = [];
  const add = (s: string): number => objs.push(s);
  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const img = spec.image ? add('<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\x80\nendstream') : 0;
  const kids: number[] = [];
  for (let p = 0; p < pages; p++) {
    const lines = p === 0 ? spec.lines.flatMap(wrap) : [`page ${p + 1}`];
    let y = 800;
    const ops = ['BT', '/F1 7 Tf', '9 TL', `40 ${y} Td`, ...lines.map((l) => `(${winAnsi(l)}) Tj T*`), 'ET'];
    if (spec.image && p === 0) ops.push('q 20 0 0 20 500 780 cm /Im1 Do Q');
    if (p === 0)
      for (const [i, h] of (spec.hidden ?? []).entries()) {
        const at = h.how === 'hors-page' ? '40 900 Td' : `40 ${120 - 12 * i} Td`;
        const style = { blanc: '1 1 1 rg', 'presque-blanc': '0.93 g', tr3: '3 Tr', minuscule: '', 'hors-page': '' }[h.how];
        ops.push('q', 'BT', `/F1 ${h.how === 'minuscule' ? 2 : 7} Tf`, style, at, `(${winAnsi(h.text)}) Tj`, 'ET', 'Q');
      }
    const body = ops.join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`);
    const annots: number[] = [];
    if (p === 0)
      for (const [i, link] of (spec.links ?? []).entries()) {
        const row = spec.lines.flatMap(wrap).indexOf(link.label);
        y = 800 - 9 * (row >= 0 ? row : i);
        const uri = spec.hexUri ? `<${Buffer.from(link.uri, 'latin1').toString('hex')}>` : `(${winAnsi(link.uri)})`;
        annots.push(add(`<< /Type /Annot /Subtype /Link /Rect [40 ${y - 2} 300 ${y + 9}] /Border [0 0 0] /A << /S /URI /URI ${uri} >> >>`));
      }
    const res = `<< /Font << /F1 ${font} 0 R >>${img ? ` /XObject << /Im1 ${img} 0 R >>` : ''} >>`;
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources ${res} /Contents ${content} 0 R${annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(' ')}]` : ''} >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R${spec.lang ? ` /Lang (${spec.lang})` : ''}${spec.pageMode ? ` /PageMode /${spec.pageMode}` : ''} >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${pages} >>`;
  const info = spec.info ? add(`<< ${Object.entries(spec.info).map(([k, v]) => `/${k} ${utf16Hex(v)}`).join(' ')} >>`) : 0;
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${xref}\n%%EOF\n`;
  const file = join(dir, name);
  writeFileSync(file, Buffer.from(out, 'latin1'));
  return file;
}

// Texte d'un CV propre pour les témoins : en-tête, résumé, puces du §3.4 et ligne 42 de la langue, sans défaut.
export function cleanLines(l: Lang): string[] {
  const b = BULLETS[l];
  return [
    `Arnaud DURAND | ${TITLE[l]}`,
    'Paris, France',
    AVAILABILITY[l],
    SUMMARY[l],
    'BPCE',
    l === 'fr' ? 'Conçu une sandbox Docker de POC selon les contraintes visées en production : exécution non root.' : `Designed a Docker sandbox with future production security requirements in mind; ${b['BPCE 1']}`,
    b['BPCE 2'] as string,
    'BNP Paribas',
    b['BNP 2'] as string,
    b['droit-de-retard 2'] as string,
    b['Croix-Rouge 2'] as string,
    'Minishell',
    LINE_42[l],
    'Fitness 42',
  ];
}
