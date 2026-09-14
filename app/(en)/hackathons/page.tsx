import HackathonIndex from '@/components/hackathon-index';
import indexes from '@/content/indexes.json';
import {pageMetadata} from '@/lib/metadata';
const t=indexes.en.hackathons;
export const metadata=pageMetadata('en','hackathons/',t.title+' — Arnaud Durand',t.intro);
export default function Page(){return <HackathonIndex locale="en"/>}
