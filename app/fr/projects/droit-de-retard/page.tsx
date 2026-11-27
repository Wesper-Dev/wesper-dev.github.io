import ProjectStory from '@/components/project-story';
import projects from '@/content/projects.json';
import {pageMetadata} from '@/lib/metadata';
import {projectName} from '@/content/project-name';
const p=projects.find(p=>p.id==='droit-de-retard')!;
export const metadata=pageMetadata('fr','projects/droit-de-retard/',projectName(p,'fr')+' | Arnaud Durand',p.fr.summary);
export default function Page(){return <ProjectStory locale="fr" id="droit-de-retard"/>}
