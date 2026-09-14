import HackathonIndex from '@/components/hackathon-index';
import indexes from '@/content/indexes.json';
import {pageMetadata} from '@/lib/metadata';
const t=indexes.fr.hackathons;
export const metadata=pageMetadata('fr','hackathons/',t.title+' — Arnaud Durand',t.intro);
export default function Page(){return <HackathonIndex locale="fr"/>}
