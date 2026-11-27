// Onglet Compétences: fiche identité du 17 septembre 2026, §5.
// Même liste que le CV (`deliverables/cv/source/facts.py`, SKILLS) : trois groupes, en texte et
// en HTML sémantique, jamais en image, chaque ligne reliée à sa preuve. Toute modification se
// fait des deux côtés à la fois, sinon le site et le CV se contredisent.
import { availability } from './experiences.ts';
import type { Locale } from './home';

export type Skill = { name: string; proof: string; href?: string };
export type Group = { id: string; title: string; items: Skill[] };

const repo = (name: string) => `https://github.com/Wesper-Dev/${name}`;

export const skills: Record<Locale, {
  eyebrow: string; title: string; intro: string; note: string;
  proofLabel: string; groups: Group[];
  cvTitle: string; cvText: string; cvNote: string;
  cvTracks: { id: string; label: string; fr: string; en: string }[];
}> = {
  en: {
    eyebrow: 'What I work with',
    title: 'Skills',
    intro: 'The skills from my CV, as text rather than an image, so both people and machines can read them. Each line says where it was actually used.',
    note: 'I have deliberately left out proficiency levels. What is written here is what I have used on a project or at work; where there is one, the link next to it is where you can check.',
    proofLabel: 'Where it was used',
    groups: [
      { id: 'languages', title: 'Languages', items: [
        { name: 'Python', proof: 'droit-de-retard: tool-call validation and more than 120 offline tests', href: 'projects/droit-de-retard/' },
        { name: 'C', proof: 'Minishell: processes, pipes and redirections at École 42', href: repo('Minishell') },
        { name: 'C++', proof: 'École 42 Paris: project-based curriculum, 2019–2026' },
        { name: 'Bash', proof: 'Inception: the Docker infrastructure of a WordPress stack', href: repo('Inception') },
        { name: 'SQL', proof: 'Inception: MariaDB behind a WordPress stack', href: repo('Inception') },
        { name: 'TypeScript', proof: 'Diary: a React front end over a FastAPI backend', href: 'projects/diary/' },
      ]},
      { id: 'platform', title: 'Platform', items: [
        { name: 'Linux', proof: 'BNP Paribas: administered the host of the team’s internal LLM tools, in staging' },
        { name: 'Docker', proof: 'BNP Paribas: the staging host for about 15 of the team’s LLM PoCs (75+ containers)' },
        { name: 'Kubernetes', proof: 'BPCE: contributed to the Kubernetes architecture of an internal agent runtime, with the infrastructure team' },
        { name: 'Git', proof: 'Every public repository linked here', href: repo('wesper-dev.github.io') },
        { name: 'CI/CD', proof: 'This site: main is deployed after a successful build', href: repo('wesper-dev.github.io') },
        { name: 'Langfuse', proof: 'BNP Paribas: on-premises LLM observability (traces, cost) and a tutorial for the team' },
      ]},
      { id: 'applied-ai', title: 'Applied AI', items: [
        { name: 'Function-calling agents', proof: 'droit-de-retard: the model extracts, an allow-list decides, Python computes', href: 'projects/droit-de-retard/' },
        { name: 'Offline evals and tests', proof: 'droit-de-retard: more than 120 offline tests, evaluation scope written down in the repository', href: 'projects/droit-de-retard/' },
        { name: 'RAG', proof: 'French Red Cross: a chatbot’s RAG over a 700-page manual, co-built at a hackathon' },
        { name: 'Ollama', proof: 'droit-de-retard: a local-first agent, tested with no network', href: 'projects/droit-de-retard/' },
        { name: 'FastAPI', proof: 'Diary: recording, FFmpeg conversion and the weekly-report workflow', href: 'projects/diary/' },
      ]},
    ],
    cvTitle: 'The same thing, on one page',
    cvText: 'My CV holds this list and the rest of the story. This is the public copy, without my phone number.',
    cvNote: `${availability.en}.`,
    cvTracks: [
      { id: 'platform', label: 'Software Engineer', fr: 'French (PDF)', en: 'English (PDF)' },
    ],
  },
  fr: {
    eyebrow: 'Ce avec quoi je travaille',
    title: 'Compétences',
    intro: 'Les compétences de mon CV, en texte plutôt qu’en image, pour qu’une personne comme une machine puisse les lire. Chaque ligne dit où cela a réellement servi.',
    note: 'Les niveaux sont volontairement absents. Ce qui est écrit ici, je m’en suis servi sur un projet ou au travail ; quand il existe, le lien à côté indique où le vérifier.',
    proofLabel: 'Où cela a servi',
    groups: [
      { id: 'langages', title: 'Langages', items: [
        { name: 'Python', proof: 'droit-de-retard : validation des appels d’outils et plus de 120 tests hors ligne', href: 'projects/droit-de-retard/' },
        { name: 'C', proof: 'Minishell : processus, pipes et redirections, à l’École 42', href: repo('Minishell') },
        { name: 'C++', proof: 'École 42 Paris : cursus par projets, 2019–2026' },
        { name: 'Bash', proof: 'Inception : l’infrastructure Docker d’une pile WordPress', href: repo('Inception') },
        { name: 'SQL', proof: 'Inception : MariaDB derrière une pile WordPress', href: repo('Inception') },
        { name: 'TypeScript', proof: 'Diary : une interface React devant une API FastAPI', href: 'projects/diary/' },
      ]},
      { id: 'plateforme', title: 'Plateforme', items: [
        { name: 'Linux', proof: 'BNP Paribas : administration, en staging, de l’hôte des outils LLM internes de l’équipe' },
        { name: 'Docker', proof: 'BNP Paribas : l’hôte de staging d’environ 15 POC LLM de l’équipe (plus de 75 conteneurs)' },
        { name: 'Kubernetes', proof: 'BPCE : contribution à l’architecture Kubernetes d’un runtime d’agents interne, avec l’équipe infra' },
        { name: 'Git', proof: 'Tous les dépôts publics cités ici', href: repo('wesper-dev.github.io') },
        { name: 'CI/CD', proof: 'Ce site : main est déployé après un build réussi', href: repo('wesper-dev.github.io') },
        { name: 'Langfuse', proof: 'BNP Paribas : observabilité LLM on-premise (traces, coûts) et un tutoriel pour l’équipe' },
      ]},
      { id: 'ia-appliquee', title: 'IA appliquée', items: [
        { name: 'Agents avec function calling', proof: 'droit-de-retard : le modèle extrait, une liste blanche décide, Python calcule', href: 'projects/droit-de-retard/' },
        { name: 'Tests et évaluations hors ligne', proof: 'droit-de-retard : plus de 120 tests hors ligne, périmètre d’évaluation écrit dans le dépôt', href: 'projects/droit-de-retard/' },
        { name: 'RAG', proof: 'Croix-Rouge française : le RAG d’un chatbot sur un manuel de 700 pages, co-construit au hackathon' },
        { name: 'Ollama', proof: 'droit-de-retard : un agent local-first, testé sans réseau', href: 'projects/droit-de-retard/' },
        { name: 'FastAPI', proof: 'Diary : enregistrement, conversion FFmpeg et parcours de rapport hebdomadaire', href: 'projects/diary/' },
      ]},
    ],
    cvTitle: 'La même chose, sur une page',
    cvText: 'Mon CV porte cette liste et le reste du parcours. C’est la version publique, sans mon numéro de téléphone.',
    cvNote: `${availability.fr}.`,
    cvTracks: [
      { id: 'platform', label: 'Ingénieur logiciel', fr: 'français (PDF)', en: 'anglais (PDF)' },
    ],
  },
};
