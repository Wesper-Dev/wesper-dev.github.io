// Interface texts of the tree block (contract D4.3, lot 2a E3.3): proposé au contrat du lot 2a, à valider par Arnaud.
// Canvas label taken from the prototype (proto:181), label of the experience list from proto:201.
import type { Locale } from './home.ts';

export interface TreeUiCopy {
  canvas: string; // accessible label of the focusable canvas
  nav: string; // aria-label of the experience list [data-tree-experiences]
  atelier: string; // aria-label of the workshop panel (preview build only)
}

export const treeUi: Readonly<Record<Locale, TreeUiCopy>> = Object.freeze({
  fr: Object.freeze({
    canvas: "Arbre en nuage de points représentant les compétences d’Arnaud",
    nav: 'Expériences',
    atelier: 'Atelier',
  }),
  en: Object.freeze({
    canvas: "Point-cloud tree of Arnaud’s skills",
    nav: 'Experiences',
    atelier: 'Workshop',
  }),
});
