// Experience cards of the home tree (contract lot 2a, E3.1, E6.2, E7). Every visible string is copied
// verbatim from deliverables/refonte-arbre/FAITS.md; do not rephrase here. École 42 has neither a role nor
// separate dates in FAITS, so its card has no role line.
import { caseLink, experiences } from './experiences.ts';
import type { Locale } from './home.ts';
import { homeUi } from './home-ui.ts';
import routes from './routes.json' with { type: 'json' };
import { EXPERIENCES } from './tree.ts';
import type { ExperienceId } from './tree.ts';

export interface CardCopy {
  readonly role?: string;
  readonly dates?: string;
  readonly result: string;
  readonly subtitle: string;
}

const bnp = experiences['bnp-paribas'];
const bpce = experiences.bpce;
const ecole42 = experiences['ecole-42'];

const freezeDeep = <T>(v: T): T => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v as Record<string, unknown>)) freezeDeep(x);
  }
  return v;
};

export const EXPERIENCE_CARDS: Readonly<Record<ExperienceId, Readonly<Record<Locale, CardCopy>>>> = freezeDeep({
  // FAITS §1 › Identité (rôle, dates) ; Formulation publique › Carte (shared with the BNP page: role, dates since round W, cardFigure, cardSubtitle).
  'bnp-paribas': {
    fr: { role: bnp.fr.role, dates: bnp.fr.dates, result: bnp.fr.cardFigure, subtitle: bnp.fr.cardSubtitle },
    en: { role: bnp.en.role, dates: bnp.en.dates, result: bnp.en.cardFigure, subtitle: bnp.en.cardSubtitle },
  },
  // FAITS §2 › Identité (rôle, dates) ; Formulation publique › Carte, accroche et sous-titre (shared with the BPCE page).
  bpce: {
    fr: { role: bpce.fr.role, dates: bpce.fr.dates, result: bpce.fr.cardFigure, subtitle: bpce.fr.cardSubtitle },
    en: { role: bpce.en.role, dates: bpce.en.dates, result: bpce.en.cardFigure, subtitle: bpce.en.cardSubtitle },
  },
  // FAITS §3 › Identité (rôle, dates « 2025 ») ; Formulation publique › Carte.
  'croix-rouge': {
    fr: { role: 'Contribution IA bénévole', dates: '2025', result: 'Bénévole : front du chatbot et RAG co-construit', subtitle: "plateforme d’équipe testée auprès d’environ 50 secouristes" },
    en: { role: 'Volunteer AI Contributor', dates: '2025', result: 'Volunteer: chatbot front end and co-built RAG', subtitle: 'team platform tested with about 50 first-aiders' },
  },
  // FAITS §4 › Formulation publique › Carte ; §7 › Ligne 42 du site (shared with the École 42 page). No role, no separate dates.
  'ecole-42': {
    fr: { result: ecole42.fr.cardFigure, subtitle: ecole42.fr.cardSubtitle },
    en: { result: ecole42.en.cardFigure, subtitle: ecole42.en.cardSubtitle },
  },
  // FAITS §5 › Identité (rôle, date) ; Formulation publique › Carte.
  'droit-de-retard': {
    fr: { role: 'Projet personnel', dates: '2026', result: 'Plus de 120 tests hors ligne', subtitle: 'brouillon de réclamation pour vol retardé, prototype local-first' },
    en: { role: 'Personal project', dates: '2026', result: 'More than 120 offline tests', subtitle: 'draft flight-delay claim, local-first prototype' },
  },
});

const published = new Set<string>(routes.paths);
const pagePath = (l: Locale, path: string): string => `${l === 'fr' ? '/fr/' : '/'}${path}`;

// Round W (contrat-relecture-w.md, W2): the BPCE and École 42 cards use the labels of the FAQ links to the same pages
// (content/faq.json).
const faqLabel: Partial<Record<ExperienceId, Record<Locale, string>>> = {
  bpce: { fr: 'Lire le cas BPCE', en: 'Read the BPCE case' },
  'ecole-42': { fr: 'Voir la formation', en: 'See the curriculum' },
};

// Link of an experience (card and fallback, E7.1): only when its page is in routes.json. The BNP case keeps
// the label of FAITS §7; BPCE and École 42 the FAQ labels; story pages use homeUi.storyLink.
export function cardLink(id: ExperienceId, l: Locale): { href: string; label: string } | null {
  const e = EXPERIENCES.find((x) => x.id === id);
  if (!e || !published.has(e.href)) return null;
  return { href: pagePath(l, e.href), label: id === 'bnp-paribas' ? caseLink[l] : faqLabel[id]?.[l] ?? homeUi[l].storyLink };
}

