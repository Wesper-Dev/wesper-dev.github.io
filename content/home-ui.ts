// Interface texts of the home page header and cards (contract lot 2a, E3.3): proposé au contrat du lot 2a,
// à valider par Arnaud. None of them is in FAITS; mainNav and storyLink are already used by the site.
import type { Locale } from './home.ts';

export interface HomeUiCopy {
  readonly cv: string; // visible text of the CV link of the header
  readonly menu: string; // menu button at phone width
  readonly mainNav: string; // aria-label of the main <nav>
  readonly close: string; // close button of a card
  readonly storyLink: string; // card link of the Red Cross and droit-de-retard stories
}

export const homeUi: Readonly<Record<Locale, HomeUiCopy>> = Object.freeze({
  fr: Object.freeze({ cv: 'CV', menu: 'Menu', mainNav: 'Navigation principale', close: 'Fermer', storyLink: 'Lire le récit' }),
  en: Object.freeze({ cv: 'CV', menu: 'Menu', mainNav: 'Main navigation', close: 'Close', storyLink: 'Read the story' }),
});
