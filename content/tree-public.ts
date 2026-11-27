// Public texts of the tree, resolved with the answers in force (ANSWERS of content/tree.ts): label, tooltip and icon of
// each skill, skills lit by each experience. Question ids, link conditions and discarded variants stay in
// content/tree.ts, for the sources and the tests: the bundles receive this module replaced at build time by its
// evaluated value (plugin tree-public of vite.config.ts), so that the public JS carries the retained texts only
// (audit astra H11).
import { EXPERIENCES, ICONS, litSkills, SKILLS, skillIcon, skillLabel, skillTooltip } from './tree.ts';
import type { ExperienceId, Localized, SkillId } from './tree.ts';

export interface SkillText {
  readonly label: Localized;
  readonly tooltip: Localized;
  readonly icon: string; // monochrome SVG (currentColor)
}

export const SKILL_TEXT: Readonly<Record<SkillId, SkillText>> = Object.fromEntries(
  SKILLS.map((s) => [s.id, {
    label: { fr: skillLabel(s.id, 'fr'), en: skillLabel(s.id, 'en') },
    tooltip: { fr: skillTooltip(s.id, 'fr'), en: skillTooltip(s.id, 'en') },
    icon: ICONS[skillIcon(s.id)],
  }]),
) as Record<SkillId, SkillText>;

export const LIT: Readonly<Record<ExperienceId, readonly SkillId[]>> = Object.fromEntries(
  EXPERIENCES.map((e) => [e.id, litSkills(e.id)]),
) as Record<ExperienceId, SkillId[]>;
