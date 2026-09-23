// Onglet Compétences — fiche identité du 17 septembre 2026, §5.
// Même liste que le CV (`deliverables/cv/source/facts.py`, SKILLS) : trois groupes, en texte et
// en HTML sémantique, jamais en image, chaque ligne reliée à sa preuve. Toute modification se
// fait des deux côtés à la fois, sinon le site et le CV se contredisent.
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
    intro: 'The same list as my CV, in text rather than in a picture, so a person or a machine can read it. Each line says where it was actually used.',
    note: 'Levels are deliberately absent. What is written here is what I have used on a project or at work; the link next to it is where you can check.',
    proofLabel: 'Where it was used',
    groups: [
      { id: 'languages', title: 'Languages', items: [
        { name: 'Python', proof: 'droit-de-retard — tool-call validation and 120+ deterministic tests', href: 'projects/droit-de-retard/' },
        { name: 'C', proof: 'Minishell — processes, pipes and redirections at École 42', href: repo('Minishell') },
        { name: 'C++', proof: 'École 42 Paris — project-based curriculum, 2019–2026' },
        { name: 'Bash', proof: 'Inception — the Docker infrastructure of a WordPress stack', href: repo('Inception') },
        { name: 'SQL', proof: 'Inception — MariaDB behind a WordPress stack', href: repo('Inception') },
        { name: 'TypeScript', proof: 'Diary — a React front end over a FastAPI backend', href: 'projects/diary/' },
      ]},
      { id: 'platform', title: 'Platform', items: [
        { name: 'Linux', proof: 'BNP Paribas — administered the host of the team’s internal LLM tools, in staging' },
        { name: 'Docker', proof: 'BNP Paribas — 75+ containers running the chat interface and inference gateway' },
        { name: 'Kubernetes', proof: 'BPCE — Kubernetes architecture for scaling an internal agent runtime' },
        { name: 'CI/CD', proof: 'This site — pull requests checked and main deployed after a successful build', href: repo('wesper-dev.github.io') },
        { name: 'Langfuse', proof: 'BNP Paribas — on-premise LLM observability: traces, cost, performance, and a tutorial for the team' },
      ]},
      { id: 'applied-ai', title: 'Applied AI', items: [
        { name: 'Function-calling agents', proof: 'droit-de-retard — the model extracts, an allow-list decides, Python computes', href: 'projects/droit-de-retard/' },
        { name: 'Offline evals and deterministic tests', proof: 'droit-de-retard — 120+ offline tests, evaluation scope written down in the repository', href: 'projects/droit-de-retard/' },
        { name: 'RAG (retrieval-augmented generation)', proof: 'French Red Cross — the AI layer of a first-aid training platform: retrieval over a 700-page manual and a Socratic coach; code kept inside the Red Cross' },
        { name: 'Ollama', proof: 'droit-de-retard — a local-first agent, tested with no network', href: 'projects/droit-de-retard/' },
        { name: 'FastAPI', proof: 'Diary — recording, FFmpeg conversion and the weekly-report workflow', href: 'projects/diary/' },
      ]},
    ],
    cvTitle: 'The same thing, on one page',
    cvText: 'My CV holds this list and the rest of the story. Two readings of the same facts — nothing changes but the order: one leads with the platform work, the other with the systems work. These are the public copies: identical wording, without my phone number.',
    cvNote: 'Written for a permanent role from 16 October 2026. Write to me and I will send the version with a phone number.',
    cvTracks: [
      { id: 'platform', label: 'AI Platform / Applied AI', fr: 'French (PDF)', en: 'English (PDF)' },
      { id: 'systems', label: 'Software & Systems', fr: 'French (PDF)', en: 'English (PDF)' },
    ],
  },
  fr: {
    eyebrow: 'Ce avec quoi je travaille',
    title: 'Compétences',
    intro: 'La même liste que mon CV, en texte plutôt qu’en image, pour qu’une personne comme une machine puisse la lire. Chaque ligne dit où cela a réellement servi.',
    note: 'Les niveaux sont volontairement absents. Ce qui est écrit ici, je m’en suis servi sur un projet ou au travail ; le lien à côté indique où le vérifier.',
    proofLabel: 'Où cela a servi',
    groups: [
      { id: 'langages', title: 'Langages', items: [
        { name: 'Python', proof: 'droit-de-retard — validation des appels d’outils et plus de 120 tests déterministes', href: 'projects/droit-de-retard/' },
        { name: 'C', proof: 'Minishell — processus, pipes et redirections, à l’École 42', href: repo('Minishell') },
        { name: 'C++', proof: 'École 42 Paris — cursus par projets, 2019–2026' },
        { name: 'Bash', proof: 'Inception — l’infrastructure Docker d’une pile WordPress', href: repo('Inception') },
        { name: 'SQL', proof: 'Inception — MariaDB derrière une pile WordPress', href: repo('Inception') },
        { name: 'TypeScript', proof: 'Diary — une interface React devant une API FastAPI', href: 'projects/diary/' },
      ]},
      { id: 'plateforme', title: 'Plateforme', items: [
        { name: 'Linux', proof: 'BNP Paribas — administration, en staging, de l’hôte des outils LLM internes de l’équipe' },
        { name: 'Docker', proof: 'BNP Paribas — plus de 75 conteneurs pour l’interface de chat et la passerelle d’inférence' },
        { name: 'Kubernetes', proof: 'BPCE — architecture Kubernetes pour le passage à l’échelle d’un runtime d’agents interne' },
        { name: 'CI/CD', proof: 'Ce site — les pull requests sont contrôlées et main déployé après un build réussi', href: repo('wesper-dev.github.io') },
        { name: 'Langfuse', proof: 'BNP Paribas — observabilité LLM on-premise : traces, coûts, performances, et un tutoriel pour l’équipe' },
      ]},
      { id: 'ia-appliquee', title: 'IA appliquée', items: [
        { name: 'Agents avec function calling', proof: 'droit-de-retard — le modèle extrait, une liste blanche décide, Python calcule', href: 'projects/droit-de-retard/' },
        { name: 'Évaluations hors ligne et tests déterministes', proof: 'droit-de-retard — plus de 120 tests hors ligne, périmètre d’évaluation écrit dans le dépôt', href: 'projects/droit-de-retard/' },
        { name: 'RAG (retrieval-augmented generation)', proof: 'Croix-Rouge française — la couche IA d’une plateforme de formation des secouristes : récupération sur un manuel de 700 pages et coach socratique ; code interne à la Croix-Rouge' },
        { name: 'Ollama', proof: 'droit-de-retard — un agent local-first, testé sans réseau', href: 'projects/droit-de-retard/' },
        { name: 'FastAPI', proof: 'Diary — enregistrement, conversion FFmpeg et parcours de rapport hebdomadaire', href: 'projects/diary/' },
      ]},
    ],
    cvTitle: 'La même chose, sur une page',
    cvText: 'Mon CV porte cette liste et le reste du parcours. Deux lectures des mêmes faits — seul l’ordre change : l’une met le travail plateforme en tête, l’autre le travail systèmes. Ce sont les versions publiques : mêmes formulations, sans mon numéro de téléphone.',
    cvNote: 'Écrit pour un CDI à partir du 16 octobre 2026. Écrivez-moi et je vous envoie la version avec un téléphone.',
    cvTracks: [
      { id: 'platform', label: 'IA plateforme / IA appliquée', fr: 'français (PDF)', en: 'anglais (PDF)' },
      { id: 'systems', label: 'Logiciel et systèmes', fr: 'français (PDF)', en: 'anglais (PDF)' },
    ],
  },
};
