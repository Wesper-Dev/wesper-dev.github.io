// Tour W (tmp/refonte-arbre/contrat-relecture-w.md ; décisions d'Arnaud des 25–26/11/2026) : textes attendus et textes
// retirés, point par point, FR et EN. Chaque garde nomme le point du contrat. Comparaisons par norm() (helpers-z.ts) :
// apostrophes, espaces insécables et entités indifférents ; la casse compte.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lang } from './helpers-4.ts';
import { readRoute } from './helpers-4.ts';
import { distDir, siteDir } from './helpers.ts';
import { exportedPdf, pdfText, repoDir } from './helpers-pdf.ts';
import { norm } from './helpers-z.ts';

const A = '’';

// Où lire : une page de l'export, llms.txt, le texte d'un CV public exporté, un fichier du dépôt complet.
export type Where = { route: string } | { llms: true } | { cv: Lang } | { repo: string };
export interface Guard { point: string; where: Where; present?: string[]; absent?: string[] }

const EN_CONTACT = ['/', '/projects/', '/hackathons/', '/skills/', '/projects/droit-de-retard/', '/projects/diary/', '/projects/croix-rouge/'];
const FR_CONTACT = EN_CONTACT.map((r) => (r === '/' ? '/fr/' : `/fr${r}`));
export const EN_PAGES = [...EN_CONTACT, '/experiences/bnp-paribas/', '/experiences/bpce/', '/experiences/ecole-42/'];
export const FAITS = 'deliverables/refonte-arbre/FAITS.md';
export const SPEC = 'deliverables/refonte-arbre/CV-PUBLIC-SPEC.md';
export const LINKEDIN = 'deliverables/linkedin-a-coller-2026-09-29.md';

export const CV_BNP: Record<Lang, string> = {
  fr: `Outil validé pour la production par le comité de pilotage, avec env. 95 % d${A}accord des analystes avec les commentaires de l${A}outil et un coût d${A}env. 0,30–0,40 € par rapport ; gain estimé par le chef des analystes à env. 300 jours-homme par an pour l${A}équipe.`,
  en: `Tool approved for production by the steering committee, with about 95% analyst agreement with the tool${A}s comments and a cost of about €0.30–0.40 per report; the lead analyst estimated annual savings of about 300 person-days for the team.`,
};

export const GUARDS: Guard[] = [
  // ---- W1 ----
  { point: 'W1 B1', where: { route: '/skills/' }, present: ['Every public repository linked here', 'This site: main is deployed after a successful build'], absent: ['goes through pull requests', 'pull requests checked'] },
  { point: 'W1 B1', where: { route: '/fr/skills/' }, present: ['Tous les dépôts publics cités ici', 'Ce site : main est déployé après un build réussi'], absent: ['passe par des pull requests', 'les pull requests sont contrôlées'] },
  { point: 'W1 C1', where: { route: '/experiences/bnp-paribas/' }, present: ['Data Scientist Intern · Sep 2025 – Mar 2026'] },
  { point: 'W1 C1', where: { route: '/fr/experiences/bnp-paribas/' }, present: ['Data Scientist (stage) · sept. 2025 – mars 2026'] },
  ...['/', '/projects/', '/projects/croix-rouge/'].map((route): Guard => ({ point: 'W1 C2', where: { route }, present: [`The public repository shows part of the team${A}s code; the rest stayed inside the Red Cross.`], absent: ['up to May 2025'] })),
  ...['/fr/', '/fr/projects/', '/fr/projects/croix-rouge/'].map((route): Guard => ({ point: 'W1 C2', where: { route }, present: [`Le dépôt public montre une partie du code de l${A}équipe ; le reste est resté interne à la Croix-Rouge.`], absent: [`jusqu${A}en mai 2025`] })),
  { point: 'W1 C2', where: { route: '/projects/croix-rouge/' }, present: [`My public fork shows part of the team${A}s code, committed from a shared machine`] },
  { point: 'W1 C2', where: { route: '/fr/projects/croix-rouge/' }, present: [`Mon fork public montre une partie du code de l${A}équipe, commité depuis un poste partagé`] },
  { point: 'W1 C2', where: { llms: true }, absent: ['up to May 2025', `jusqu${A}en mai 2025`] },
  { point: 'W1 C2', where: { repo: FAITS }, present: [`le fork public montre **une partie** du code de l${A}équipe ; **aucun résultat`], absent: [`jusqu${A}en mai 2025`, 'up to May 2025'] },
  { point: 'W1 C3, D4', where: { cv: 'en' }, present: ['contributed to its Kubernetes design with the infrastructure team.', 'with an optimisation PoC covering 20 business rules.'], absent: ['constraint-based', 'Kubernetes deployment design'] },
  { point: 'W1 C4', where: { cv: 'fr' }, present: [`flashcards et contribution au coach socratique ; plateforme d${A}équipe testée auprès d${A}env. 50 secouristes.`], absent: ['ChangeNOW', 'AI for Good'] },
  { point: 'W1 C4', where: { cv: 'en' }, present: ['flashcards and a contribution to the Socratic coach; team platform tested with about 50 first-aiders.'], absent: ['ChangeNOW', 'AI for Good'] },
  { point: 'W1 C4', where: { repo: SPEC }, present: [`plateforme d${A}équipe testée auprès d${A}env.~50 secouristes.`, 'team platform tested with about 50 first-aiders.'], absent: ['présentée à ChangeNOW et AI for Good', 'shown at ChangeNOW and AI for Good', 'lien AI for Good conservé'] },
  { point: 'W1 D3, W2 puce BNP', where: { cv: 'fr' }, present: [CV_BNP.fr] },
  { point: 'W1 D3, W2 puce BNP', where: { cv: 'en' }, present: [CV_BNP.en] },
  { point: 'W1 D8, W4 A16', where: { route: '/skills/' }, present: ['on-premises LLM observability (traces, cost) and'], absent: ['performance)', 'on-premise LLM'] },
  { point: 'W1 D8', where: { route: '/fr/skills/' }, present: ['observabilité LLM on-premise (traces, coûts) et'], absent: ['performances)'] },
  // ---- W2 ----
  { point: 'W2 récit droit-de-retard (A4)', where: { route: '/projects/droit-de-retard/' }, present: ['I link to that versioned evaluation: its scope changes alongside the code.'], absent: ['freezing a test count'] },
  { point: 'W2 récit droit-de-retard (2.1)', where: { route: '/fr/projects/droit-de-retard/' }, present: ['Je renvoie à cette évaluation versionnée : son périmètre évolue avec le code.'], absent: ['figer un nombre de tests'] },
  { point: 'W2 A3', where: { route: '/projects/droit-de-retard/' }, present: ['explicit enough to examine.'], absent: ['The public repository is the place to inspect those choices'] },
  { point: 'W2 Science inFuZe', where: { cv: 'fr' }, present: ['Science inFuZe (2025), track Académie de Versailles'], absent: ['track éducation'] },
  { point: 'W2 Science inFuZe', where: { cv: 'en' }, present: ['Science inFuZe (2025), Académie de Versailles track'], absent: ['education track'] },
  { point: 'W2 page BNP', where: { route: '/fr/experiences/bnp-paribas/' }, present: [`le coût de notre outil d${A}analyse`], absent: [`POC d${A}analyse`] },
  { point: 'W2 page BNP, W4 A11', where: { route: '/experiences/bnp-paribas/' }, present: ['Langfuse put the cost of our analysis tool at about €0.30–0.40 per report.', `and analysts agreed with about 95% of the tool${A}s comments;`], absent: ['analysis PoC', 'I read the cost'] },
  { point: 'W2 page BNP', where: { repo: FAITS }, present: [`le coût de notre outil d${A}analyse`, 'Langfuse put the cost of our analysis tool at'], absent: [`dans Langfuse le coût de notre POC d${A}analyse`, 'cost of our analysis PoC in Langfuse'] },
  { point: 'W2 puce BNP (LinkedIn)', where: { repo: LINKEDIN }, present: [CV_BNP.fr, CV_BNP.en], absent: ['Released to production after steering-committee approval', 'Mis en production après comité de pilotage'] },
  { point: 'W2 droit-de-retard', where: { llms: true }, present: ['[droit-de-retard](https://wesper-dev.github.io/projects/droit-de-retard/)', '[droit-de-retard](https://wesper-dev.github.io/fr/projects/droit-de-retard/)'], absent: ['Droit de Retard'] },
  ...[...EN_PAGES, ...FR_CONTACT, '/fr/experiences/bnp-paribas/', '/fr/experiences/bpce/', '/fr/experiences/ecole-42/'].map((route): Guard => ({ point: 'W2 graphie droit-de-retard', where: { route }, absent: ['Droit de Retard'] })),
  { point: 'W2 graphie droit-de-retard', where: { route: '/projects/droit-de-retard/' }, present: ['droit-de-retard: keeping decisions explicit', 'droit-de-retard demo interface: flight document and analysis trace.', 'droit-de-retard: prototype preview', 'droit-de-retard | Arnaud Durand'] },
  { point: 'W2 graphie droit-de-retard', where: { route: '/fr/projects/droit-de-retard/' }, present: ['droit-de-retard : garder les décisions explicites', 'Interface de démonstration droit-de-retard : document de vol', 'droit-de-retard : aperçu du prototype', 'droit-de-retard | Arnaud Durand'] },
  { point: 'W2 French Red Cross', where: { route: '/projects/croix-rouge/' }, present: ['French Red Cross | Arnaud Durand'] },
  // ---- W3 ----
  { point: 'W3 2.5', where: { route: '/fr/skills/' }, present: ['au travail ; quand il existe, le lien à côté indique où le vérifier.'] },
  ...FR_CONTACT.map((route): Guard => ({ point: 'W3 2.7', where: { route }, present: ['Je cherche un CDI en IA appliquée ou en plateforme IA,'], absent: ['en IA appliquée ou plateforme IA'] })),
  // ---- W4 ----
  { point: 'W4 A1, A2, A12', where: { route: '/hackathons/' },
    present: ['Team hardware experiment, described in a public write-up.', 'My write-up on LinkedIn', 'The project has been offline since its cloud environment was shut down.', 'Where no exact date is known, only the year is shown.', 'Took part in the original team project, then continued it on my own as droit-de-retard.', 'Worked on the team prototype; my contributions are in the team repository.', 'Team prototype; not a separate project.', 'we did not get the robot to play a complete game.', 'at ChangeNOW, talked with visitors at the Red Cross stand.', 'with first-hand accounts from women scientists'],
    absent: ['my public account', 'My account on LinkedIn', 'is offline since', 'Year shown when', 'Participation in', 'does not represent a second', 'was not finalised', 'conversations with visitors', 'testimonies'] },
  ...['/', '/projects/', '/projects/droit-de-retard/'].map((route): Guard => ({ point: 'W4 A5', where: { route }, present: ['My own follow-up to a team project'], absent: ['Personal continuation of a team project'] })),
  { point: 'W4 A5, A8', where: { route: '/projects/droit-de-retard/' },
    present: ['A team idea, then my own follow-up', 'droit-de-retard continues a project', 'Eligibility rules and calculations stay in Python.', 'not a service that represents passengers', 'my grounding in systems', `The repository keeps the history of the team${A}s work and of AI-assisted contributions.`],
    absent: ['followed by a personal continuation', 'Qualification rules', 'passenger-representation', 'my systems foundation', 'preserves the history'] },
  { point: 'W4 A5', where: { route: '/projects/diary/' }, present: ['Two hackathons, then my own follow-up', 'Diary is where I took it further on my own:'], absent: ['then a continuation', 'Diary is my personal continuation'] },
  ...['/', '/projects/'].map((route): Guard => ({ point: 'W4 A6', where: { route }, present: ['flashcards, contributions to the Socratic coach.'], absent: ['help on the Socratic coach'] })),
  { point: 'W4 A6, A9', where: { route: '/projects/croix-rouge/' },
    present: ['contributions to the Socratic coach, which puts first-aiders in a scenario and', 'flashcards and contributions to the Socratic coach over six months', 'I was at the stand with the team', 'with the people it is for.', 'as part of IA & Crise.', 'The project came first out of 12 teams'],
    absent: ['help on the Socratic coach', 'in a situation', 'realistic scenario', 'I stayed with the team', 'people concerned', 'in the context of', 'finished 1st of 12'] },
  { point: 'W4 A7', where: { route: '/' }, present: [`I worked on the app${A}s front and back end and the flashcards, and contributed to the Socratic coach.`], absent: ['and a contribution to the Socratic coach'] },
  ...EN_CONTACT.map((route): Guard => ({ point: 'W4 A13', where: { route }, present: ['Native French, fluent English, Spanish (B1).'], absent: ['French native; English fluent'] })),
  { point: 'W4 A13', where: { cv: 'en' }, present: ['Languages: Native French, fluent English, Spanish (B1).'], absent: ['French native'] },
  ...['/', '/projects/'].map((route): Guard => ({ point: 'W4 A14', where: { route }, present: ['Prepares a draft flight-delay compensation claim from documents', 'Connects browser voice recordings'], absent: ['Prepare a draft flight claim', 'Connect browser voice'] })),
  { point: 'W4 A14', where: { route: '/projects/droit-de-retard/' }, present: ['Prepares a draft flight-delay compensation claim from documents, with explicit validation and calculations in Python.'] },
  { point: 'W4 A14', where: { route: '/projects/diary/' }, present: ['Connects browser voice recordings to audio processing, storage and weekly reports.'] },
  { point: 'W4 A14, A19', where: { llms: true }, present: ['Prepares a draft flight-delay compensation claim from documents', 'Connects browser voice recordings', 'The skills from my CV, as text rather than an image, so both people and machines can read them.'], absent: ['Prepare a draft flight claim', 'Connect browser voice', 'in text rather than in a picture'] },
  { point: 'W4 A19, W3 2.5 (EN)', where: { route: '/skills/' },
    present: ['The skills from my CV, as text rather than an image, so both people and machines can read them.', 'I have deliberately left out proficiency levels. What is written here is what I have used on a project or at work; where there is one, the link next to it is where you can check.'],
    absent: ['in text rather than in a picture', 'Levels are deliberately absent'] },
];

export function readWhere(w: Where): string | null {
  if ('route' in w) {
    const html = readRoute(distDir, w.route);
    if (!html) throw new Error(`${w.route} : page absente de l'export (${distDir})`);
    // Texte sans balises, puis les valeurs d'attributs lisibles (méta, alt, title) : un texte retiré ne doit survivre ni
    // dans le rendu, ni dans la charge RSC, ni dans une métadonnée.
    const attrs = [...html.matchAll(/\s(?:content|alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]);
    return `${html}\n${attrs.join('\n')}`;
  }
  if ('llms' in w) return readFileSync(join(siteDir, 'public', 'llms.txt'), 'utf8');
  if ('cv' in w) return pdfText(exportedPdf(w.cv));
  const f = join(repoDir, w.repo);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}
export const whereName = (w: Where): string => ('route' in w ? w.route : 'llms' in w ? 'llms.txt' : 'cv' in w ? `CV public ${w.cv} (export)` : w.repo);
const n = (s: string): string => norm(s).replace(/\s+/g, ' ');
// Un PDF coupe ses lignes : retour à la ligne et césure de fin de ligne comptent comme une espace.
const flat = (s: string): string => n(s.replace(/-\n(?=\S)/g, '-').replace(/\n/g, ' '));

export function guardErrors(g: Guard, text: string): string[] {
  const t = 'cv' in g.where ? flat(text) : n(text);
  const out: string[] = [];
  for (const s of g.present ?? []) if (!t.includes(n(s))) out.push(`${g.point} · ${whereName(g.where)} : « ${s} » absent`);
  for (const s of g.absent ?? []) if (t.includes(n(s))) out.push(`${g.point} · ${whereName(g.where)} : « ${s} » encore présent`);
  return out;
}
