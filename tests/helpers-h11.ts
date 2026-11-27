// Repérage du point H11 (audit astra n° 3 du lot 2a), partagé par h11-export-public.test.ts et, au lot 4, par
// q7-budgets.test.ts (Q7 : HTML et .rsc des pages Projets et Compétences). Déplacé tel quel depuis h11.
import { faitsTree } from './helpers-faits.ts';
import { treeMod } from './helpers-tree.ts';

export const LOCALES = ['fr', 'en'] as const;
export const QUESTION_ID = /\bA-0\d\b/g;
export const PENDING = /\bunconfirmed\b/g;

// Chaînes JS ramenées à leur texte : \uXXXX, \u{…}, \xXX, \', \", \\ (un minifieur peut échapper accents et apostrophes).
export function unescapeJs(src: string): string {
  return src
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(['"`\\])/g, '$1');
}

export interface Texts { retained: string[]; rejected: string[] }

// Textes de l'arbre : tous les candidats (FAITS §6 et tree.ts), ceux que le site affiche, et les écartés (candidats
// non affichés et qui ne sont pas une sous-chaîne d'un texte affiché).
export async function treeTexts(): Promise<Texts> {
  const mod = await treeMod();
  const faits = faitsTree();
  const ids = faits.nodes.map((n) => n.id);
  const candidates = new Set<string>();
  for (const n of faits.nodes) {
    for (const l of LOCALES) {
      candidates.add(n.label[l]);
      if (n.ifYes) candidates.add(n.ifYes.label[l]);
      if (n.noAnswerTooltip) candidates.add(n.noAnswerTooltip[l]);
      for (const f of n.fragments) candidates.add(f[l]);
    }
  }
  // tree.ts : mêmes champs s'ils y sont encore (le correctif peut les déplacer hors du module public).
  for (const s of (mod.SKILLS ?? []) as { label?: Record<string, string>; ifYes?: { label?: Record<string, string> }; tip?: { text?: Record<string, string> }[] }[]) {
    for (const l of LOCALES) {
      if (s.label?.[l]) candidates.add(s.label[l]);
      if (s.ifYes?.label?.[l]) candidates.add(s.ifYes.label[l]);
      for (const t of s.tip ?? []) if (t.text?.[l]) candidates.add(t.text[l]);
    }
  }
  const retained: string[] = [];
  for (const id of ids) for (const l of LOCALES) {
    retained.push(String(mod.skillLabel(id, l)));
    const tip = String(mod.skillTooltip(id, l));
    if (tip) retained.push(tip);
  }
  const rejected = [...candidates].filter((c) => c.trim().length >= 4 && !retained.some((r) => r.includes(c)));
  return { retained, rejected };
}

export function leaksIn(src: string, rejected: readonly string[]): string[] {
  const text = unescapeJs(src);
  const out: string[] = [];
  for (const m of new Set(text.match(QUESTION_ID) ?? [])) out.push(`identifiant de question ${m}`);
  if (PENDING.test(text)) out.push('marqueur unconfirmed');
  PENDING.lastIndex = 0;
  for (const r of rejected) if (text.includes(r)) out.push(`variante écartée « ${r} »`);
  return out;
}

