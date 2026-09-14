import ProjectStory from '@/components/project-story';
import projects from '@/content/projects.json';
import {pageMetadata} from '@/lib/metadata';
const p=projects.find(p=>p.id==='droit-de-retard')!;
export const metadata=pageMetadata('en','projects/droit-de-retard/',p.name+' — Arnaud Durand',p.en.summary);
export default function Page(){return <ProjectStory locale="en" id="droit-de-retard"/>}
