import ProjectStory from '@/components/project-story';
import projects from '@/content/projects.json';
import {pageMetadata} from '@/lib/metadata';
import {projectName} from '@/content/project-name';
const p=projects.find(p=>p.id==='droit-de-retard')!;
export const metadata=pageMetadata('en','projects/droit-de-retard/',projectName(p,'en')+' | Arnaud Durand',p.en.summary);
export default function Page(){return <ProjectStory locale="en" id="droit-de-retard"/>}
