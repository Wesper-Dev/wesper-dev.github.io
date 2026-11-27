import ProjectStory from '@/components/project-story';
import projects from '@/content/projects.json';
import {pageMetadata} from '@/lib/metadata';
import {projectName} from '@/content/project-name';
const p=projects.find(p=>p.id==='diary')!;
export const metadata=pageMetadata('en','projects/diary/',projectName(p,'en')+' | Arnaud Durand',p.en.summary);
export default function Page(){return <ProjectStory locale="en" id="diary"/>}
