import enDroit from '../content/stories/en/droit-de-retard.md?raw';
import frDroit from '../content/stories/fr/droit-de-retard.md?raw';
import enDiary from '../content/stories/en/diary.md?raw';
import frDiary from '../content/stories/fr/diary.md?raw';
import enCroix from '../content/stories/en/croix-rouge.md?raw';
import frCroix from '../content/stories/fr/croix-rouge.md?raw';
export const stories={en:{'droit-de-retard':enDroit,diary:enDiary,'croix-rouge':enCroix},fr:{'droit-de-retard':frDroit,diary:frDiary,'croix-rouge':frCroix}};
export type StoryId=keyof typeof stories.en;
