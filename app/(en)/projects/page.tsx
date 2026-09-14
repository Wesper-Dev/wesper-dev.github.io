import ProjectIndex from '@/components/project-index';
import indexes from '@/content/indexes.json';
import {pageMetadata} from '@/lib/metadata';
const t=indexes.en.projects;
export const metadata=pageMetadata('en','projects/',t.title+' — Arnaud Durand',t.intro);
export default function Page(){return <ProjectIndex locale="en"/>}
