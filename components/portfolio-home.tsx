import { home, type Locale } from '../content/home';
import {Header, Footer, Contact, Arrow, pagePath} from './site-shell';
import events from '../content/hackathons.json';
export default function PortfolioHome({locale}:{locale:Locale}) {
 const t=home[locale]; const fr=locale==='fr';
 return <div lang={locale} className="portfolio">
  <Header locale={locale}/>
  <main id="main" className="wrap">
   <section className="hero"><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}<br/><span>{t.titleEnd}</span></h1><div className="hero-bottom"><p className="intro">{t.intro}</p><div className="hero-aside"><p className="role">{t.role}</p><a className="text-link" href="mailto:arnaud.durand97@gmail.com">{t.contact} <Arrow/></a><p className="availability"><span aria-hidden="true"/>{t.availability}</p></div></div></section>
   <section id="projects" className="section"><div className="section-heading"><span className="index">01 /</span><div><h2>{t.selected}</h2><p>{t.selectedNote}</p></div></div>
    <article className="featured"><div className="project-copy"><p className="eyebrow">{t.projects[0].category}</p><h3>{t.projects[0].name}</h3><p>{t.projects[0].text}</p><p className="contribution">{t.projects[0].role}</p><a className="text-link" href={pagePath(locale,'projects/'+t.projects[0].id+'/')}>{fr?'Lire le récit':'Read the story'} <Arrow/></a></div><figure><a href={pagePath(locale,'projects/droit-de-retard/')} aria-label={t.projects[0].name}><img src="/images/droit-de-retard.png" alt={fr?'Capture du prototype Droit de Retard : saisie du vol et résultat de l’analyse.':'Droit de Retard prototype screenshot: flight input and analysis result.'} width="1440" height="1180"/></a><figcaption>{t.screenshot}</figcaption></figure></article>
    <div className="project-pair">{t.projects.slice(1).map((p,i)=><article key={p.name}><span className="small-number">0{i+2}</span><p className="eyebrow">{p.category}</p><h3>{p.name}</h3><p>{p.text}</p><p className="contribution">{p.role}</p><a className="text-link" href={pagePath(locale,'projects/'+p.id+'/')}>{fr?'Lire le récit':'Read the story'} <Arrow/></a></article>)}</div>
    <div className="systems"><div><h3>{t.foundation}</h3><p>{t.foundationText}</p></div><ul>{t.systems.map(p=><li key={p.name}><a href={'https://github.com/Wesper-Dev/'+p.name}><strong>{p.name}</strong><span>{p.text}</span><Arrow/></a></li>)}</ul></div>
    <a className="text-link section-more" href={pagePath(locale,'projects/')}>{fr?'Tous les projets':'All projects'} <Arrow/></a>
   </section>
   <section id="hackathons" className="section hackathons"><div className="section-heading"><span className="index">02 /</span><div><h2>{t.hackTitle}</h2><p>{t.hackIntro}</p></div></div><p className="eyebrow">{t.hackMore}</p><div className="event-list">
    {events.filter(e=>['gemma','gcpu','ia-crise'].includes(e.id)).map(e=><a key={e.id} href={pagePath(locale,'projects/'+e.project+'/')}><span>{e.date?.slice(0,4) ?? '—'}</span><h3>{e.name}</h3><span className="event-topic">{e[locale].context}</span><Arrow/></a>)}
   </div><a className="text-link section-more" href={pagePath(locale,'hackathons/')}>{fr?'Tous les hackathons':'All hackathons'} <Arrow/></a></section>
   <section id="about" className="section"><div className="section-heading"><span className="index">03 /</span><div><h2>{t.aboutTitle}</h2><p>{t.aboutIntro}</p></div></div><div className="communities">{t.communities.map(c=><article key={c.name}><p className="eyebrow">{c.tag}</p><h3>{c.url?<a href={c.url}>{c.name} <Arrow/></a>:c.name}</h3><p>{c.text}</p></article>)}</div>
    <div className="experience"><h3>{t.path}</h3><div>{t.experiences.map(e=><div className="experience-row" key={e[1]}><span>{e[0]}</span><strong>{e[1]}</strong><p>{e[2]}</p></div>)}</div></div>
   </section>
   <Contact locale={locale}/>
  </main><Footer locale={locale}/>
 </div>
}
