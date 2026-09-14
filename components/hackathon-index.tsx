import events from '../content/hackathons.json';
import indexes from '../content/indexes.json';
import type { Locale } from '../content/home';
import {SiteShell, pagePath, Arrow} from './site-shell';
function dateLabel(value:string|null,locale:Locale) {
 if(!value)return locale==='fr'?'Date à confirmer':'Date to confirm';
 if(value.length===4)return value;
 return value.split('/').map(v=>new Intl.DateTimeFormat(locale==='fr'?'fr-FR':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'))).join(' – ');
}
export default function HackathonIndex({locale}:{locale:Locale}) {const t=indexes[locale].hackathons;return <SiteShell locale={locale} path="hackathons/"><section className="page-intro"><p className="eyebrow">{locale==='fr'?'Rencontres et expériences':'People and experiments'}</p><h1>{t.title}<span>.</span></h1><p className="intro">{t.intro}</p><p className="date-note">{t.yearOnly}</p></section><ol className="timeline">{events.map(e=><li id={e.id} key={e.id}><div className="event-date">{dateLabel(e.date,locale)}</div><article><p className="eyebrow">{e[locale].context}</p><h2>{e.name}</h2><p>{e[locale].contribution}</p><p className="contribution">{e[locale].outcome}</p>{e.project?<a className="text-link" href={pagePath(locale,'projects/'+e.project+'/')}>{indexes[locale].projects.story} <Arrow/></a>:e.link?<a className="text-link" href={e.link.url}>{e.link[locale]} <Arrow/></a>:null}</article></li>)}</ol></SiteShell>}
