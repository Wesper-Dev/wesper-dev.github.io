import ProjectIndex from '@/components/project-index';
import indexes from '@/content/indexes.json';
import {pageMetadata} from '@/lib/metadata';
const t=indexes.fr.projects;
export const metadata=pageMetadata('fr','projects/',t.title+' — Arnaud Durand',t.intro);
export default function Page(){return <ProjectIndex locale="fr"/>}
