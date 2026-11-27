// Skill ids and layers of the tree, in the order of content/tree.ts: everything the data Worker and the geometry need,
// and nothing of the texts or of the answers they depend on (audit astra H11). In the bundles, this module is replaced
// at build time by its evaluated value (plugin tree-public of vite.config.ts).
import { SKILLS } from './tree.ts';
import type { SkillId } from './tree.ts';
import type { Layer } from '../lib/tree/skeleton.ts';

export const SKILL_LAYOUT: readonly { readonly id: SkillId; readonly layer: Layer }[] = SKILLS.map((s) => ({ id: s.id, layer: s.layer }));
