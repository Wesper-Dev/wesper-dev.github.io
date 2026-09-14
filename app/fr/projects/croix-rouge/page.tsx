import ProjectStory from '@/components/project-story';
import projects from '@/content/projects.json';
import {pageMetadata} from '@/lib/metadata';
const p=projects.find(p=>p.id==='croix-rouge')!;
export const metadata=pageMetadata('fr','projects/croix-rouge/',p.name+' — Arnaud Durand',p.fr.summary);
export default function Page(){return <ProjectStory locale="fr" id="croix-rouge"/>}
