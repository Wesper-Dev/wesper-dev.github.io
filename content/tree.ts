// Skill tree content (contract B8). Every public text is copied verbatim from
// deliverables/refonte-arbre/FAITS.md section 6 (nodes FAITS:366-378, links FAITS:382-404,
// answers FAITS:495-511) and must never be rephrased here.
import type { Locale } from './home.ts';
import type { Layer } from '../lib/tree/skeleton.ts';

export type SkillId = 'c' | 'unix' | 'tests' | 'python' | 'docker' | 'k8s' | 'obs' | 'llm' | 'rag' | 'agents' | 'front';
export type ExperienceId = 'bnp-paribas' | 'bpce' | 'croix-rouge' | 'ecole-42' | 'droit-de-retard';
export type AnswerId = 'A-02' | 'A-05' | 'A-06';
export type LinkCondition = 'always' | AnswerId | 'unconfirmed';
export type Answers = Readonly<Record<AnswerId, boolean>>;

// Arnaud's answers to the open questions of FAITS (A-02 FAITS:495-499, A-05 FAITS:504-508,
// A-06 FAITS:509-511), as recorded on 20 November 2026 (REPONSES-ARNAUD.md): A-02 yes,
// A-05 unanswered, A-06 yes. One line per answer: flip a value once an answer changes.
export const ANSWERS: Answers = Object.freeze({
  'A-02': true,
  'A-05': false,
  'A-06': true,
});

export const NO_ANSWERS: Answers = Object.freeze({ 'A-02': false, 'A-05': false, 'A-06': false });

export interface Localized {
  readonly fr: string;
  readonly en: string;
}

export type IconId =
  | 'cplusplus' | 'gnubash' | 'python' | 'docker' | 'kubernetes' | 'react'
  | 'obs' | 'llm' | 'rag' | 'agents' | 'neutral';

export interface SkillNode {
  readonly id: SkillId;
  readonly layer: Layer;
  readonly label: Localized;
  readonly icon: IconId;
  readonly ifYes?: { readonly answer: AnswerId; readonly label: Localized; readonly icon: IconId };
  readonly tip: readonly { readonly from: ExperienceId; readonly text: Localized }[];
}

export interface ExperienceNode {
  readonly id: ExperienceId;
  readonly name: Localized;
  readonly href: string;
  readonly links: readonly { readonly skill: SkillId; readonly condition: LinkCondition }[];
}

// Recursively freezes plain data so that no importer can alter the public content.
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

// Nodes, in the order of FAITS:368-378. This order fixes the trunk anchors
// (python, docker, k8s, obs at 0.28, 0.5, 0.72, 0.94 of the trunk height).
// Tooltip fragments follow the order of their FAITS cell.
export const SKILLS: readonly SkillNode[] = deepFreeze<readonly SkillNode[]>([
  {
    id: 'c', layer: 'root', label: { fr: 'C · C++', en: 'C · C++' }, icon: 'cplusplus',
    tip: [{ from: 'ecole-42', text: { fr: 'Minishell en C ; C++ au cursus de 42', en: 'Minishell in C; C++ in the 42 curriculum' } }],
  },
  {
    id: 'unix', layer: 'root', label: { fr: 'Unix · shell', en: 'Unix · shell' }, icon: 'gnubash',
    tip: [{ from: 'ecole-42', text: { fr: 'Minishell : pipes, redirections, processus', en: 'Minishell: pipes, redirections, processes' } }],
  },
  {
    id: 'tests', layer: 'root', label: { fr: 'Tests automatisés', en: 'Automated tests' }, icon: 'neutral',
    tip: [{ from: 'droit-de-retard', text: { fr: 'droit-de-retard : plus de 120 tests hors ligne', en: 'droit-de-retard: more than 120 offline tests' } }],
  },
  {
    id: 'python', layer: 'trunk', label: { fr: 'Python', en: 'Python' }, icon: 'python',
    tip: [
      { from: 'bnp-paribas', text: { fr: 'BNP : file Python des appels au LLM', en: 'BNP: Python queue for LLM calls' } },
      { from: 'droit-de-retard', text: { fr: 'droit-de-retard : règles et calculs', en: 'droit-de-retard: rules and calculations' } },
    ],
  },
  {
    id: 'docker', layer: 'trunk', label: { fr: 'Docker', en: 'Docker' }, icon: 'docker',
    tip: [
      { from: 'bnp-paribas', text: { fr: 'BNP : hôte de staging, 75+ conteneurs', en: 'BNP: staging host, 75+ containers' } },
      { from: 'bpce', text: { fr: 'BPCE : sandbox Docker', en: 'BPCE: Docker sandbox' } },
      { from: 'ecole-42', text: { fr: '42 : Inception', en: '42: Inception' } },
    ],
  },
  {
    id: 'k8s', layer: 'trunk', label: { fr: 'Kubernetes (contribution)', en: 'Kubernetes (contribution)' }, icon: 'kubernetes',
    tip: [{ from: 'bpce', text: { fr: "BPCE : contribution à la conception de l’architecture", en: 'BPCE: contribution to the architecture design' } }],
  },
  {
    id: 'obs', layer: 'trunk', label: { fr: 'Observabilité · Langfuse', en: 'Observability · Langfuse' }, icon: 'obs',
    tip: [{ from: 'bnp-paribas', text: { fr: 'BNP : Langfuse on-premise, adopté par 5 POC', en: 'BNP: on-premises Langfuse, adopted by 5 PoCs' } }],
  },
  {
    id: 'llm', layer: 'canopy', label: { fr: 'Pipelines LLM', en: 'LLM pipelines' }, icon: 'llm',
    tip: [
      { from: 'bnp-paribas', text: { fr: 'BNP : captures analysées en parallèle par un LLM', en: 'BNP: screenshots analysed in parallel by an LLM' } },
      { from: 'droit-de-retard', text: { fr: 'droit-de-retard : Gemma lit et rédige', en: 'droit-de-retard: Gemma reads and drafts' } },
      {
        from: 'croix-rouge',
        text: {
          fr: "Croix-Rouge : chatbot d’équipe avec un modèle Mistral, dont j’ai fait les fonctionnalités et co-construit le RAG",
          en: 'French Red Cross: team chatbot using a Mistral model; I built its features and co-built its RAG',
        },
      },
    ],
  },
  {
    id: 'rag', layer: 'canopy', label: { fr: 'RAG', en: 'RAG' }, icon: 'rag',
    tip: [{ from: 'croix-rouge', text: { fr: 'Croix-Rouge : RAG co-construit sur un manuel de 700 pages', en: 'French Red Cross: co-built RAG over a 700-page manual' } }],
  },
  {
    id: 'agents', layer: 'canopy', label: { fr: "Sandbox d’agents", en: 'Agent sandbox' }, icon: 'agents',
    tip: [{ from: 'bpce', text: { fr: "BPCE : isolation des outils d’agents (POC)", en: 'BPCE: isolating agent tools (PoC)' } }],
  },
  {
    id: 'front', layer: 'canopy', label: { fr: 'React · front', en: 'React · front-end' }, icon: 'react',
    ifYes: { answer: 'A-05', label: { fr: 'Front-end', en: 'Front-end' }, icon: 'neutral' },
    tip: [
      { from: 'bnp-paribas', text: { fr: 'BNP : application React faite en binôme', en: 'BNP: React app built as a pair' } },
      { from: 'croix-rouge', text: { fr: "Croix-Rouge : front d’une application d’équipe", en: 'French Red Cross: front end of a team app' } },
      { from: 'droit-de-retard', text: { fr: 'droit-de-retard : interface en JavaScript natif', en: 'droit-de-retard: plain-JavaScript interface' } },
    ],
  },
]);

// Experiences in the order of FAITS:384-404; links carry the lit state (single source).
// Names: FAITS:54, 141, 206 (EN FAITS:375), 265, 303. href in routes.json format: FAITS:56, 143,
// 208, 267, 305 (bpce and ecole-42 pages are pending lot 2b, A-01).
export const EXPERIENCES: readonly ExperienceNode[] = deepFreeze<readonly ExperienceNode[]>([
  {
    id: 'bnp-paribas', name: { fr: 'BNP Paribas', en: 'BNP Paribas' }, href: 'experiences/bnp-paribas/',
    links: [
      { skill: 'llm', condition: 'always' },
      { skill: 'python', condition: 'always' },
      { skill: 'obs', condition: 'always' },
      { skill: 'docker', condition: 'always' },
      { skill: 'front', condition: 'always' },
    ],
  },
  {
    id: 'bpce', name: { fr: 'BPCE', en: 'BPCE' }, href: 'experiences/bpce/',
    links: [
      { skill: 'agents', condition: 'always' },
      { skill: 'k8s', condition: 'always' },
      { skill: 'docker', condition: 'A-02' },
      { skill: 'python', condition: 'unconfirmed' },
    ],
  },
  {
    id: 'croix-rouge', name: { fr: 'Croix-Rouge française', en: 'French Red Cross' }, href: 'projects/croix-rouge/',
    links: [
      { skill: 'rag', condition: 'always' },
      { skill: 'front', condition: 'A-05' },
      { skill: 'llm', condition: 'A-06' },
      { skill: 'python', condition: 'unconfirmed' },
    ],
  },
  {
    id: 'ecole-42', name: { fr: 'École 42 Paris', en: 'École 42 Paris' }, href: 'experiences/ecole-42/',
    links: [
      { skill: 'c', condition: 'always' },
      { skill: 'unix', condition: 'always' },
      { skill: 'docker', condition: 'A-05' },
      { skill: 'tests', condition: 'unconfirmed' },
    ],
  },
  {
    id: 'droit-de-retard', name: { fr: 'droit-de-retard', en: 'droit-de-retard' }, href: 'projects/droit-de-retard/',
    links: [
      { skill: 'tests', condition: 'always' },
      { skill: 'python', condition: 'always' },
      { skill: 'llm', condition: 'A-05' },
      { skill: 'front', condition: 'A-05' },
    ],
  },
]);

// Embedded monochrome icons (currentColor, no external URL). Brand marks: path data of
// Simple Icons 13.21.0 (CC0-1.0), the version referenced by proto:940. House glyphs: proto:933-936,
// plus a plain dot glyph in the same stroke style for the neutral icon.
const brand = (d: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
const glyph = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS: Readonly<Record<IconId, string>> = Object.freeze({
  cplusplus: brand(
    'M22.394 6c-.167-.29-.398-.543-.652-.69L12.926.22c-.509-.294-1.34-.294-1.848 0L2.26 5.31c-.508.293-.923 1.013-.923 1.6v10.18c0 .294.104.62.271.91.167.29.398.543.652.69l8.816 5.09c.508.293 1.34.293 1.848 0l8.816-5.09c.254-.147.485-.4.652-.69.167-.29.27-.616.27-.91V6.91c.003-.294-.1-.62-.268-.91zM12 19.11c-3.92 0-7.109-3.19-7.109-7.11 0-3.92 3.19-7.11 7.11-7.11a7.133 7.133 0 016.156 3.553l-3.076 1.78a3.567 3.567 0 00-3.08-1.78A3.56 3.56 0 008.444 12 3.56 3.56 0 0012 15.555a3.57 3.57 0 003.08-1.778l3.078 1.78A7.135 7.135 0 0112 19.11zm7.11-6.715h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79zm2.962 0h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79z',
  ),
  gnubash: brand(
    'M21.038,4.9l-7.577-4.498C13.009,0.134,12.505,0,12,0c-0.505,0-1.009,0.134-1.462,0.403L2.961,4.9 C2.057,5.437,1.5,6.429,1.5,7.503v8.995c0,1.073,0.557,2.066,1.462,2.603l7.577,4.497C10.991,23.866,11.495,24,12,24 c0.505,0,1.009-0.134,1.461-0.402l7.577-4.497c0.904-0.537,1.462-1.529,1.462-2.603V7.503C22.5,6.429,21.943,5.437,21.038,4.9z M15.17,18.946l0.013,0.646c0.001,0.078-0.05,0.167-0.111,0.198l-0.383,0.22c-0.061,0.031-0.111-0.007-0.112-0.085L14.57,19.29 c-0.328,0.136-0.66,0.169-0.872,0.084c-0.04-0.016-0.057-0.075-0.041-0.142l0.139-0.584c0.011-0.046,0.036-0.092,0.069-0.121 c0.012-0.011,0.024-0.02,0.036-0.026c0.022-0.011,0.043-0.014,0.062-0.006c0.229,0.077,0.521,0.041,0.802-0.101 c0.357-0.181,0.596-0.545,0.592-0.907c-0.003-0.328-0.181-0.465-0.613-0.468c-0.55,0.001-1.064-0.107-1.072-0.917 c-0.007-0.667,0.34-1.361,0.889-1.8l-0.007-0.652c-0.001-0.08,0.048-0.168,0.111-0.2l0.37-0.236 c0.061-0.031,0.111,0.007,0.112,0.087l0.006,0.653c0.273-0.109,0.511-0.138,0.726-0.088c0.047,0.012,0.067,0.076,0.048,0.151 l-0.144,0.578c-0.011,0.044-0.036,0.088-0.065,0.116c-0.012,0.012-0.025,0.021-0.038,0.028c-0.019,0.01-0.038,0.013-0.057,0.009 c-0.098-0.022-0.332-0.073-0.699,0.113c-0.385,0.195-0.52,0.53-0.517,0.778c0.003,0.297,0.155,0.387,0.681,0.396 c0.7,0.012,1.003,0.318,1.01,1.023C16.105,17.747,15.736,18.491,15.17,18.946z M19.143,17.859c0,0.06-0.008,0.116-0.058,0.145 l-1.916,1.164c-0.05,0.029-0.09,0.004-0.09-0.056v-0.494c0-0.06,0.037-0.093,0.087-0.122l1.887-1.129 c0.05-0.029,0.09-0.004,0.09,0.056V17.859z M20.459,6.797l-7.168,4.427c-0.894,0.523-1.553,1.109-1.553,2.187v8.833 c0,0.645,0.26,1.063,0.66,1.184c-0.131,0.023-0.264,0.039-0.398,0.039c-0.42,0-0.833-0.114-1.197-0.33L3.226,18.64 c-0.741-0.44-1.201-1.261-1.201-2.142V7.503c0-0.881,0.46-1.702,1.201-2.142l7.577-4.498c0.363-0.216,0.777-0.33,1.197-0.33 c0.419,0,0.833,0.114,1.197,0.33l7.577,4.498c0.624,0.371,1.046,1.013,1.164,1.732C21.686,6.557,21.12,6.411,20.459,6.797z',
  ),
  python: brand(
    'M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z',
  ),
  docker: brand(
    'M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z',
  ),
  kubernetes: brand(
    'M10.204 14.35l.007.01-.999 2.413a5.171 5.171 0 0 1-2.075-2.597l2.578-.437.004.005a.44.44 0 0 1 .484.606zm-.833-2.129a.44.44 0 0 0 .173-.756l.002-.011L7.585 9.7a5.143 5.143 0 0 0-.73 3.255l2.514-.725.002-.009zm1.145-1.98a.44.44 0 0 0 .699-.337l.01-.005.15-2.62a5.144 5.144 0 0 0-3.01 1.442l2.147 1.523.004-.002zm.76 2.75l.723.349.722-.347.18-.78-.5-.623h-.804l-.5.623.179.779zm1.5-3.095a.44.44 0 0 0 .7.336l.008.003 2.134-1.513a5.188 5.188 0 0 0-2.992-1.442l.148 2.615.002.001zm10.876 5.97l-5.773 7.181a1.6 1.6 0 0 1-1.248.594l-9.261.003a1.6 1.6 0 0 1-1.247-.596l-5.776-7.18a1.583 1.583 0 0 1-.307-1.34L2.1 5.573c.108-.47.425-.864.863-1.073L11.305.513a1.606 1.606 0 0 1 1.385 0l8.345 3.985c.438.209.755.604.863 1.073l2.062 8.955c.108.47-.005.963-.308 1.34zm-3.289-2.057c-.042-.01-.103-.026-.145-.034-.174-.033-.315-.025-.479-.038-.35-.037-.638-.067-.895-.148-.105-.04-.18-.165-.216-.216l-.201-.059a6.45 6.45 0 0 0-.105-2.332 6.465 6.465 0 0 0-.936-2.163c.052-.047.15-.133.177-.159.008-.09.001-.183.094-.282.197-.185.444-.338.743-.522.142-.084.273-.137.415-.242.032-.024.076-.062.11-.089.24-.191.295-.52.123-.736-.172-.216-.506-.236-.745-.045-.034.027-.08.062-.111.088-.134.116-.217.23-.33.35-.246.25-.45.458-.673.609-.097.056-.239.037-.303.033l-.19.135a6.545 6.545 0 0 0-4.146-2.003l-.012-.223c-.065-.062-.143-.115-.163-.25-.022-.268.015-.557.057-.905.023-.163.061-.298.068-.475.001-.04-.001-.099-.001-.142 0-.306-.224-.555-.5-.555-.275 0-.499.249-.499.555l.001.014c0 .041-.002.092 0 .128.006.177.044.312.067.475.042.348.078.637.056.906a.545.545 0 0 1-.162.258l-.012.211a6.424 6.424 0 0 0-4.166 2.003 8.373 8.373 0 0 1-.18-.128c-.09.012-.18.04-.297-.029-.223-.15-.427-.358-.673-.608-.113-.12-.195-.234-.329-.349-.03-.026-.077-.062-.111-.088a.594.594 0 0 0-.348-.132.481.481 0 0 0-.398.176c-.172.216-.117.546.123.737l.007.005.104.083c.142.105.272.159.414.242.299.185.546.338.743.522.076.082.09.226.1.288l.16.143a6.462 6.462 0 0 0-1.02 4.506l-.208.06c-.055.072-.133.184-.215.217-.257.081-.546.11-.895.147-.164.014-.305.006-.48.039-.037.007-.09.02-.133.03l-.004.002-.007.002c-.295.071-.484.342-.423.608.061.267.349.429.645.365l.007-.001.01-.003.129-.029c.17-.046.294-.113.448-.172.33-.118.604-.217.87-.256.112-.009.23.069.288.101l.217-.037a6.5 6.5 0 0 0 2.88 3.596l-.09.218c.033.084.069.199.044.282-.097.252-.263.517-.452.813-.091.136-.185.242-.268.399-.02.037-.045.095-.064.134-.128.275-.034.591.213.71.248.12.556-.007.69-.282v-.002c.02-.039.046-.09.062-.127.07-.162.094-.301.144-.458.132-.332.205-.68.387-.897.05-.06.13-.082.215-.105l.113-.205a6.453 6.453 0 0 0 4.609.012l.106.192c.086.028.18.042.256.155.136.232.229.507.342.84.05.156.074.295.145.457.016.037.043.09.062.129.133.276.442.402.69.282.247-.118.341-.435.213-.71-.02-.039-.045-.096-.065-.134-.083-.156-.177-.261-.268-.398-.19-.296-.346-.541-.443-.793-.04-.13.007-.21.038-.294-.018-.022-.059-.144-.083-.202a6.499 6.499 0 0 0 2.88-3.622c.064.01.176.03.213.038.075-.05.144-.114.28-.104.266.039.54.138.87.256.154.06.277.128.448.173.036.01.088.019.13.028l.009.003.007.001c.297.064.584-.098.645-.365.06-.266-.128-.537-.423-.608zM16.4 9.701l-1.95 1.746v.005a.44.44 0 0 0 .173.757l.003.01 2.526.728a5.199 5.199 0 0 0-.108-1.674A5.208 5.208 0 0 0 16.4 9.7zm-4.013 5.325a.437.437 0 0 0-.404-.232.44.44 0 0 0-.372.233h-.002l-1.268 2.292a5.164 5.164 0 0 0 3.326.003l-1.27-2.296h-.01zm1.888-1.293a.44.44 0 0 0-.27.036.44.44 0 0 0-.214.572l-.003.004 1.01 2.438a5.15 5.15 0 0 0 2.081-2.615l-2.6-.44-.004.005z',
  ),
  react: brand(
    'M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z',
  ),
  obs: glyph('<rect x="3" y="5" width="26" height="22" rx="3"/><path d="M6 19h5l3-7 4 11 3-6h5"/>'),
  llm: glyph('<path d="M5 7h22v14H14l-6 5v-5H5z"/><path d="M10 12h12M10 16h8"/>'),
  rag: glyph(
    '<path d="M4 6h9a3 3 0 0 1 3 3v17a2 2 0 0 0-2-2H4zM28 6h-9a3 3 0 0 0-3 3v17a2 2 0 0 1 2-2h4"/><circle cx="24" cy="21" r="3.5"/><path d="M26.5 23.5 29 26"/>',
  ),
  agents: glyph(
    '<path d="M16 3 28 9.5v13L16 29 4 22.5v-13z"/><path d="M4 9.5 16 16l12-6.5M16 16v13"/><circle cx="16" cy="9.5" r="1.6" fill="currentColor"/>',
  ),
  neutral: glyph('<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="3" fill="currentColor"/>'),
});

const skillById = new Map(SKILLS.map((s) => [s.id, s]));
const experienceById = new Map(EXPERIENCES.map((e) => [e.id, e]));

function skillOf(s: SkillId): SkillNode {
  const node = skillById.get(s);
  if (!node) throw new Error(`unknown skill ${String(s)}`);
  return node;
}

// 'always' is lit, A-xx follows the answer, 'unconfirmed' stays off (FAITS:382-404).
export function isLit(c: LinkCondition, answers: Answers = ANSWERS): boolean {
  if (c === 'always') return true;
  if (c === 'unconfirmed') return false;
  return answers[c] === true;
}

function linkCondition(e: ExperienceId, s: SkillId): LinkCondition | undefined {
  return experienceById.get(e)?.links.find((l) => l.skill === s)?.condition;
}

// Skills lit by an experience, in link order.
export function litSkills(e: ExperienceId, answers: Answers = ANSWERS): SkillId[] {
  const exp = experienceById.get(e);
  if (!exp) throw new Error(`unknown experience ${String(e)}`);
  return exp.links.filter((l) => isLit(l.condition, answers)).map((l) => l.skill);
}

// Experiences whose link to the skill is lit, in EXPERIENCES order.
export function experiencesUsing(s: SkillId, answers: Answers = ANSWERS): ExperienceId[] {
  skillOf(s);
  return EXPERIENCES.filter((e) => e.links.some((l) => l.skill === s && isLit(l.condition, answers))).map((e) => e.id);
}

export function skillLabel(s: SkillId, l: Locale, answers: Answers = ANSWERS): string {
  const node = skillOf(s);
  return node.ifYes && isLit(node.ifYes.answer, answers) ? node.ifYes.label[l] : node.label[l];
}

export function skillIcon(s: SkillId, answers: Answers = ANSWERS): IconId {
  const node = skillOf(s);
  return node.ifYes && isLit(node.ifYes.answer, answers) ? node.ifYes.icon : node.icon;
}

// Fragments whose (experience, skill) link is lit, joined with the punctuation of FAITS:371, 378.
export function skillTooltip(s: SkillId, l: Locale, answers: Answers = ANSWERS): string {
  const parts = skillOf(s).tip.filter((t) => isLit(linkCondition(t.from, s) ?? 'unconfirmed', answers)).map((t) => t.text[l]);
  return parts.join(l === 'fr' ? ' ; ' : '; ');
}
