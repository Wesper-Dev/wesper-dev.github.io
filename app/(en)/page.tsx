import PortfolioHome from '@/components/portfolio-home';
import {pageMetadata} from '@/lib/metadata';
export const metadata=pageMetadata('en','','Arnaud Durand — AI, systems & things built together','AI tools, systems projects and hackathons. Arnaud Durand, developer based in Paris.');
export default function Page(){return <PortfolioHome locale="en"/>}
