import SkillsPage from '@/components/skills-page';
import {skills} from '@/content/skills';
import {pageMetadata} from '@/lib/metadata';
const t=skills.en;
export const metadata=pageMetadata('en','skills/',t.title+' — Arnaud Durand',t.intro);
export default function Page(){return <SkillsPage locale="en"/>}
