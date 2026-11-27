// Detail pages of the experience tree. Every visible sentence is copied verbatim from
// deliverables/refonte-arbre/FAITS.md (§1, §2, §4 "Formulation publique", §7); do not rephrase here.
import type { Locale } from './home';

// A block shown under its own heading, kept apart from the main paragraphs (FAITS §2, separate tool).
export interface ExperienceSection {
  heading: string;
  paragraphs: string[];
}

export interface ExperienceCopy {
  title: string;
  description: string;
  role?: string;
  dates?: string;
  cardFigure: string;
  cardSubtitle: string;
  paragraphs: string[];
  sections?: ExperienceSection[];
}

export interface Experience {
  name: string;
  en: ExperienceCopy;
  fr: ExperienceCopy;
}

export const experiences = {
  'bnp-paribas': {
    name: 'BNP Paribas',
    fr: {
      title: 'BNP Paribas',
      // FAITS §1, "Identité" (tour W, C1: role and dates above the title, as on the BPCE page; shared with the card).
      role: 'Data Scientist (stage)',
      dates: 'sept. 2025 – mars 2026',
      // FAITS §7, "Phrase BNP du premier écran".
      description:
        "Chez BNP Paribas, j’ai développé en binôme un outil d’analyse de rapports, validé pour la production par le comité de pilotage ; le traitement d’un rapport est passé de 3–5 à 1–3 minutes.",
      // FAITS §1, "Carte".
      cardFigure: '3–5 min → 1–3 min par rapport',
      cardSubtitle: 'outil validé pour la production par le comité de pilotage',
      // FAITS §1, "Page de détail", without the A-04 limit sentence (unanswered).
      paragraphs: [
        "Dans l’application React développée en binôme, le traitement d’un rapport Word de tests de performance est passé de 3–5 à 1–3 min, notamment grâce à l’envoi en parallèle de ses 10–15 captures au LLM.",
        "L’outil a été validé pour la production par le comité de pilotage, avec environ 95 % d’accord des analystes avec les commentaires de l’outil ; leur chef en estimait le gain à environ 300 jours-homme par an pour l’équipe. J’ai relevé dans Langfuse le coût de notre outil d’analyse : environ 0,30 à 0,40 € par rapport.",
        'Pendant le projet, nous présentions nos avancées chaque semaine au commanditaire.',
        "J’ai administré l’hôte de staging des outils LLM de l’équipe, utilisés chaque jour par des employés : environ 15 POC, 75+ conteneurs Docker ; j’ai remonté une perte de traces jusqu’au disque plein et récupéré 600 Go.",
        "J’ai déployé Langfuse on-premise, adopté par 5 POC, rédigé un tutoriel et présenté son fonctionnement à l’équipe.",
      ],
    },
    en: {
      title: 'BNP Paribas',
      role: 'Data Scientist Intern',
      dates: 'Sep 2025 – Mar 2026',
      description:
        'At BNP Paribas, I built a report-analysis tool with a colleague; it was approved for production by the steering committee, and processing a report went from 3–5 to 1–3 minutes.',
      cardFigure: '3–5 min → 1–3 min per report',
      cardSubtitle: 'tool approved for production by the steering committee',
      paragraphs: [
        'In the React app we built as a pair, processing a Word report on performance tests fell from 3–5 to 1–3 minutes, partly because we sent its 10–15 screenshots to the LLM in parallel.',
        "The tool was approved for production by the steering committee, and analysts agreed with about 95% of the tool’s comments; their lead estimated the saving at about 300 person-days a year for the team. Langfuse put the cost of our analysis tool at about €0.30–0.40 per report.",
        'During the project, we presented our progress to the sponsor every week.',
        "I managed the staging host for the team’s LLM tools, used daily by employees: around 15 PoCs, 75+ Docker containers; I traced a loss of Langfuse traces to a full disk and freed 600 GB.",
        'I deployed Langfuse on-premises, adopted by 5 PoCs, wrote a tutorial and walked the team through it.',
      ],
    },
  },
  bpce: {
    name: 'BPCE',
    fr: {
      title: 'BPCE',
      // FAITS §2, "Page, sandbox FR" (also the meta description).
      description:
        "J’ai conçu la sandbox Docker d’un POC de runtime d’agents, selon les contraintes visées en production : exécution non root, réseau en liste blanche ; j’ai contribué avec l’équipe infra à son architecture Kubernetes. Ce POC ne tournait pas en production.",
      // FAITS §2, "Identité".
      role: 'Ingénierie plateforme IA (stage)',
      dates: 'avr. 2026 – oct. 2026',
      // FAITS §2, "Carte, accroche" and "Carte, sous-titre".
      cardFigure: "Isolation des outils d’agents",
      cardSubtitle: 'Docker, exécution non root, réseau en liste blanche',
      paragraphs: [
        "J’ai conçu la sandbox Docker d’un POC de runtime d’agents, selon les contraintes visées en production : exécution non root, réseau en liste blanche ; j’ai contribué avec l’équipe infra à son architecture Kubernetes. Ce POC ne tournait pas en production.",
      ],
      // FAITS §2, separate block: never shown right after the sandbox without its heading.
      sections: [
        {
          heading: 'Un autre outil : la planification des formations',
          paragraphs: [
            "Avec un POC d’optimisation sous 20 règles métier, la planification des formations de 1 500 à 3 000 collaborateurs est passée de 1–2 jours à 1 h.",
          ],
        },
      ],
    },
    en: {
      title: 'BPCE',
      description:
        'I designed the Docker sandbox for an agent-runtime PoC with future production security requirements in mind: non-root execution and allow-listed network access; I contributed to its Kubernetes design with the infrastructure team. The PoC did not run in production.',
      role: 'AI Platform Engineering Intern',
      dates: 'Apr 2026 – Oct 2026',
      cardFigure: 'Isolating agent tools',
      cardSubtitle: 'Docker, non-root execution, allow-listed network',
      paragraphs: [
        'I designed the Docker sandbox for an agent-runtime PoC with future production security requirements in mind: non-root execution and allow-listed network access; I contributed to its Kubernetes design with the infrastructure team. The PoC did not run in production.',
      ],
      sections: [
        {
          heading: 'A separate tool: training scheduling',
          paragraphs: [
            'With an optimisation PoC covering 20 business rules, scheduling training for 1,500–3,000 employees went from 1–2 days to 1 hour.',
          ],
        },
      ],
    },
  },
  'ecole-42': {
    name: 'École 42 Paris',
    fr: {
      title: 'École 42 Paris',
      // FAITS §4, "Page de détail" (also the meta description).
      description:
        'Un cursus par projets : C/C++, UNIX/POSIX, concurrence. Minishell, un shell en C (pipes, redirections, processus) ; Inception, une infrastructure Docker (NGINX, WordPress, MariaDB).',
      // FAITS §4, training line (alone on its line) and card subtitle. No role, no separate dates.
      cardFigure: 'École 42 Paris, 2019–2026',
      cardSubtitle: 'Les fondations : C, UNIX, projets système',
      paragraphs: [
        'Un cursus par projets : C/C++, UNIX/POSIX, concurrence. Minishell, un shell en C (pipes, redirections, processus) ; Inception, une infrastructure Docker (NGINX, WordPress, MariaDB).',
      ],
    },
    en: {
      title: 'École 42 Paris',
      description:
        'A project-based curriculum: C/C++, UNIX/POSIX, concurrency. Minishell, a shell in C (pipes, redirections, processes); Inception, a Docker infrastructure (NGINX, WordPress, MariaDB).',
      cardFigure: 'École 42 Paris, 2019–2026',
      cardSubtitle: 'The foundations: C, UNIX, systems projects',
      paragraphs: [
        'A project-based curriculum: C/C++, UNIX/POSIX, concurrency. Minishell, a shell in C (pipes, redirections, processes); Inception, a Docker infrastructure (NGINX, WordPress, MariaDB).',
      ],
    },
  },
} satisfies Record<string, Experience>;

// FAITS §7 "Lien du premier écran": label of the link from the first-screen BNP sentence to the case page.
export const caseLink: Record<Locale, string> = {
  fr: 'Lire le cas BNP Paribas',
  en: 'Read the BNP Paribas case',
};

// FAITS §7 "Titre" (decision Q-R10): professional title of the home header.
export const jobTitle: Record<Locale, string> = {
  fr: 'Ingénieur logiciel',
  en: 'Software Engineer',
};

// FAITS §7 "Disponibilité" (decision Q-R7), shown in the contact block of the detail pages.
export const availability: Record<Locale, string> = {
  fr: 'Disponible immédiatement — CDI ; ouvert au freelance et aux projets open source',
  en: 'Available now — permanent role; open to freelance and open-source projects',
};

export type ExperienceSlug = keyof typeof experiences;

export const experienceSlugs = Object.keys(experiences) as ExperienceSlug[];

export function isExperienceSlug(slug: string): slug is ExperienceSlug {
  return Object.hasOwn(experiences, slug);
}

export const experiencePath = (slug: ExperienceSlug) => `experiences/${slug}/`;

export const experienceCopy = (slug: ExperienceSlug, locale: Locale): ExperienceCopy => experiences[slug][locale];
