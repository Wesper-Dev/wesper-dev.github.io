// Tour Z (tmp/refonte-arbre/contrat-textes-z.md ; décisions d'Arnaud du 25/11/2026) : textes du contrat, mot pour mot,
// formes interdites et corpus à balayer. Apostrophes : U+2019 sur le site (tour Y) ; les comparaisons passent par norm().
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { filesUnder } from './helpers-4.ts';
import type { Lang } from './helpers-4.ts';
import { distDir, siteDir } from './helpers.ts';
import { pdfText, repoDir } from './helpers-pdf.ts';

const A = '\u2019';

// ---- Z1 : BNP « validé pour la production par le comité de pilotage » ----
export const Z1 = {
  // Premier écran, FAQ, llms.txt (et méta-description de la page BNP, phrase du premier écran).
  sentence: {
    fr: `Chez BNP Paribas, j${A}ai développé en binôme un outil d${A}analyse de rapports, validé pour la production par le comité de pilotage ; le traitement d${A}un rapport est passé de 3–5 à 1–3 minutes.`,
    en: 'At BNP Paribas, I built a report-analysis tool with a colleague; it was approved for production by the steering committee, and processing a report went from 3–5 to 1–3 minutes.',
  },
  card: { fr: 'outil validé pour la production par le comité de pilotage', en: 'tool approved for production by the steering committee' },
  // Page de détail : début de phrase, suite inchangée.
  // Tour W (contrat-relecture-w.md, W4 A11) : la suite de la phrase anglaise devient « , and analysts agreed with about 95% ».
  detail: { fr: `L${A}outil a été validé pour la production par le comité de pilotage, avec environ 95 %`, en: 'The tool was approved for production by the steering committee, and analysts agreed with about 95%' },
  question: { fr: 'Quel outil a été validé pour la production ?', en: 'Which tool was approved for production?' },
  // CV public (texte des PDF, forme lisible) : résumé et puce BNP, suite inchangée.
  cvSummary: {
    fr: 'Un outil LLM développé en binôme et validé pour la production dans une banque par le comité de pilotage, avec une application React',
    en: 'An LLM tool built with a colleague and approved for production at a bank by the steering committee, with a React app',
  },
  // Tour W (W2) : la puce commence par « Outil validé… » / « Tool approved… » ; la formulation Z1 reste.
  cvBullet: { fr: 'Outil validé pour la production par le comité de pilotage, avec env. 95 %', en: 'Tool approved for production by the steering committee, with about 95%' },
} as const;
// Formes interdites (contrat Z1), quelles que soient la casse, les espaces (insécables comprises) et les accords.
export const Z1_FORBIDDEN: readonly RegExp[] = [
  /\bmis(?:e|es)?\s+en\s+production\b/iu,
  /\batteint\s+la\s+production\b/iu,
  /\breleased\s+(?:in)?to\s+production\b/iu,
  /\breached\s+production\b/iu,
];

// ---- Z2 : FAQ BPCE ----
export const Z2 = {
  removed: { fr: 'Ce POC ne tournait pas en production.', en: 'The PoC did not run in production.' },
  answer: {
    fr: `J${A}ai conçu la sandbox Docker d${A}un POC de runtime d${A}agents, selon les contraintes visées en production : exécution non root, réseau en liste blanche ; j${A}ai contribué avec l${A}équipe infra à son architecture Kubernetes.`,
    en: 'I designed the Docker sandbox for an agent-runtime PoC with future production security requirements in mind: non-root execution and allow-listed network access; I contributed to its Kubernetes design with the infrastructure team.',
  },
} as const;
export const Z2_REMOVED: readonly RegExp[] = [/\bce\s+poc\s+ne\s+tournait\s+pas\s+en\s+production\b/iu, /\bthe\s+poc\s+did\s+not\s+run\s+in\s+production\b/iu];

// ---- Z3 : libellés de lien de la FAQ (id de la question → libellé, adresse) ----
export const Z3: Record<Lang, Record<string, { text: string; href: string }>> = {
  fr: { bpce: { text: 'Lire le cas BPCE', href: '/fr/experiences/bpce/' }, formation: { text: 'Voir la formation', href: '/fr/experiences/ecole-42/' } },
  en: { bpce: { text: 'Read the BPCE case', href: '/experiences/bpce/' }, formation: { text: 'See the curriculum', href: '/experiences/ecole-42/' } },
};

// ---- Z4 : Compétences ----
export const Z4 = {
  removed: { fr: 'Écrivez-moi et je vous envoie la version avec un téléphone.', en: 'Write to me and I will send the version with a phone number.' },
  intro: {
    fr: `Les compétences de mon CV, en texte plutôt qu${A}en image, pour qu${A}une personne comme une machine puisse les lire. Chaque ligne dit où cela a réellement servi.`,
    // Tour W (W4 A19) : la phrase anglaise est réécrite ; « them » (Z4) reste.
    en: 'The skills from my CV, as text rather than an image, so both people and machines can read them. Each line says where it was actually used.',
  },
} as const;
export const Z4_REMOVED: readonly RegExp[] = [
  /[ée]crivez[\s-]*moi\s+et\s+je\s+vous\s+envoie\s+la\s+version\s+avec\s+un\s+t[ée]l[ée]phone/iu,
  /\bwrite\s+to\s+me\s+and\s+i\s+will\s+send\s+the\s+version\s+with\s+a\s+phone/iu,
];
export const Z4_OLD_INTRO: readonly RegExp[] = [/\bmachine\s+puisse\s+la\s+lire\b/iu, /\bmachine\s+can\s+read\s+it\b/iu];

// ---- Normalisation et balayage ----
// Entités et échappements courants, espaces insécables, U+2060 et U+200B, apostrophes, TeX (~, \\,), blancs réduits ;
// `tags` : balises retirées sans espace (un mot coupé par <span> reste un mot). hits() lit les deux formes : sans les
// balises, et telle quelle (un « < » de code JS ne peut pas cacher une phrase).
export function norm(s: string, tags = true): string {
  return (tags ? s.replace(/<[^>]*>/g, '') : s)
    .normalize('NFC')
    .replace(/&nbsp;|&#160;|&#xa0;|\\u00a0|\\u202f|\\u2009/gi, ' ')
    .replace(/&#x27;|&#39;|&apos;|&rsquo;|\\u2019/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/\\u2060|\\u200b|[\u2060\u200b\u00ad]/g, '')
    .replace(/[\u2019\u2018\u02bc]/g, "'")
    .replace(/~|\\,/g, ' ')
    .replace(/[\s\u00a0\u202f\u2009]+/g, ' ');
}
export function hits(text: string, res: readonly RegExp[]): string[] {
  const out = new Set<string>();
  for (const t of [norm(text), norm(text, false)])
    for (const re of res) {
      const m = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      for (const x of t.matchAll(m)) out.add(`« …${t.slice(Math.max(0, x.index - 40), x.index + x[0].length + 20)}… »`);
    }
  return [...out];
}

export interface Doc { name: string; text: string }
const TEXT_EXT = /\.(?:html|rsc|txt|js|mjs|json|xml|webmanifest|md)$/;
// Corpus public : tous les fichiers texte de l'export, site/public/llms.txt, les sources de contenu (site/content,
// app, components, lib), le texte des deux PDF publics servis (pdftotext) ; dans le dépôt complet seulement, les copies
// des contenus (deliverables/portfolio-etapes-3-4/CONTENUS-*.md), les .tex publics générés et les PDF publics de
// deliverables/cv. Jamais site/tests (fixtures et témoins), ni familles.py (sources du générateur, pas un texte servi ;
// sa clé de surcharge reprend le début de la puce de facts.py), ni verifier_cv.py (il nomme les formes qu'il refuse).
export function publicCorpus(root: string = distDir): { docs: Doc[]; missing: string[] } {
  const docs: Doc[] = [];
  const missing: string[] = [];
  for (const f of filesUnder(root)) if (TEXT_EXT.test(f)) docs.push({ name: 'export/' + relative(root, f), text: readFileSync(f, 'utf8') });
  docs.push({ name: 'site/public/llms.txt', text: readFileSync(join(siteDir, 'public', 'llms.txt'), 'utf8') });
  for (const d of ['content', 'app', 'components', 'lib']) {
    const dir = join(siteDir, d);
    if (!existsSync(dir)) continue;
    for (const f of filesUnder(dir)) if (['.ts', '.tsx', '.json', '.md', '.mjs'].includes(extname(f))) docs.push({ name: 'site/' + relative(siteDir, f), text: readFileSync(f, 'utf8') });
  }
  const pdfs = ['fr', 'en'].map((l) => join(siteDir, 'public', 'cv', `arnaud-durand-cv-platform-${l}.pdf`));
  const extra = [
    ...['FR', 'EN'].map((l) => join(repoDir, 'deliverables', 'portfolio-etapes-3-4', `CONTENUS-${l}.md`)),
    ...['fr', 'en'].map((l) => join(repoDir, 'deliverables', 'cv', 'source', `cv-public-platform-${l}.tex`)),
  ];
  const extraPdfs = ['fr', 'en'].flatMap((l) => [join(repoDir, 'deliverables', 'cv', `cv-public-platform-${l}.pdf`), join(repoDir, 'deliverables', 'cv', 'source', `cv-public-platform-${l}.pdf`)]);
  for (const f of pdfs) docs.push({ name: relative(repoDir, f) + ' (pdftotext)', text: pdfText(f) });
  for (const f of extra) {
    if (existsSync(f)) docs.push({ name: relative(repoDir, f), text: readFileSync(f, 'utf8') });
    else missing.push(relative(repoDir, f));
  }
  for (const f of extraPdfs) {
    if (existsSync(f)) docs.push({ name: relative(repoDir, f) + ' (pdftotext)', text: pdfText(f) });
    else missing.push(relative(repoDir, f));
  }
  return { docs, missing };
}
export const scan = (docs: Doc[], res: readonly RegExp[]): string[] => docs.flatMap((d) => hits(d.text, res).map((h) => `${d.name} : ${h}`));
