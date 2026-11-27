// A review copy generated from the site content; do not edit the output manually.
// Audit of lot 5 (U7): it writes only texts the site renders, and no hard-coded date.
import {readFile,writeFile} from 'node:fs/promises';
import {home} from '../content/home.ts';
import {jobTitle,availability} from '../content/experiences.ts';
const projects=JSON.parse(await readFile(new URL('../content/projects.json',import.meta.url),'utf8'));
const events=JSON.parse(await readFile(new URL('../content/hackathons.json',import.meta.url),'utf8'));
const indexes=JSON.parse(await readFile(new URL('../content/indexes.json',import.meta.url),'utf8'));
for(const locale of ['fr','en']){
 const t=home[locale];
 const lines=['# '+(locale==='fr'?'Textes du site — français':'Site copy — English'),'','Copie de relecture générée depuis site/content/ par site/scripts/export-copy.mjs.','',jobTitle[locale],'',availability[locale],'',t.selected,'',t.selectedNote];
 for(const p of t.projects)lines.push('', '### '+p.name,'',p.text,'',p.role);
 lines.push('',t.hackTitle,'',t.hackIntro,'',t.aboutTitle,'',t.aboutIntro);
 for(const c of t.communities)lines.push('',c.name+' — '+c.tag,'',c.text);
 lines.push('',t.endTitle,'',t.endText,'','## '+indexes[locale].projects.title,'',indexes[locale].projects.intro);
 // Round W (W2): project name in the page language, as content/project-name.ts.
 for(const p of projects)lines.push('','### '+(p[locale].name??p.name),'',p[locale].summary,'',p[locale].role,'',p[locale].status,'',p.repo);
 lines.push('','## '+indexes[locale].hackathons.title,'',indexes[locale].hackathons.intro);
 for(const e of events)lines.push('','### '+e.name+' · '+e.date,'',e[locale].context,'',e[locale].contribution,'',e[locale].outcome,'',e.project?'/projects/'+e.project+'/':e.link?.url??'');
 for(const id of ['droit-de-retard','diary','croix-rouge'])lines.push('','---','',await readFile(new URL('../content/stories/'+locale+'/'+id+'.md',import.meta.url),'utf8'));
 await writeFile(new URL('../../deliverables/portfolio-etapes-3-4/CONTENUS-'+locale.toUpperCase()+'.md',import.meta.url),lines.join('\n')+'\n');
}
