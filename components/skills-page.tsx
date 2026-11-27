import { type Locale } from '../content/home';
import { skills } from '../content/skills';
import { jsonLdHtml, personNode } from '../lib/person';
import { SiteShell, pagePath, Arrow, Next } from './site-shell';

// Fiche identité §5 : en HTML sémantique et en texte, jamais en image, avec des données
// structurées, pour que le visiteur comme un LLM puissent lire la liste et remonter à sa preuve.
const isExternal = (href: string) => href.startsWith('http');

export default function SkillsPage({locale}:{locale:Locale}) {
 const t=skills[locale];
 const jsonLd={'@context':'https://schema.org',...personNode(locale)};
 return <SiteShell locale={locale} path="skills/">
  <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(jsonLd)}/>
  <section className="page-intro"><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}<span>.</span></h1><p className="intro">{t.intro}</p><p className="skills-note">{t.note}</p></section>
  <div className="skill-groups">
   {t.groups.map((g,i)=><section className="skill-group" key={g.id} id={g.id} aria-labelledby={g.id+'-title'}>
    <div className="section-heading"><span className="index">{String(i+1).padStart(2,'0')} /</span><div><h2 id={g.id+'-title'}>{g.title}</h2><p>{t.proofLabel}</p></div></div>
    {/* Proof links: text, no-break space and arrow in one span, so that the arrow stays on the last line (lot 4, R7). */}
    <ul className="skill-list">{g.items.map(s=><li key={s.name}>
     <span className="skill-name">{s.name}</span>
     <span className="skill-proof">{s.href
       ? (isExternal(s.href)
          ? <a href={s.href}><span>{s.proof}{"\u00a0"}<Arrow/></span></a>
          : <a href={pagePath(locale,s.href)}><span>{s.proof}{"\u00a0"}<Next/></span></a>)
       : s.proof}</span>
    </li>)}</ul>
   </section>)}
  </div>
  <section className="skills-cv"><h2>{t.cvTitle}</h2><p>{t.cvText}</p>
   <ul className="cv-tracks">{t.cvTracks.map(track=><li key={track.id}>
    <span className="cv-track-label">{track.label}</span>
    <span className="link-row">
     <a className="text-link" href={`/cv/arnaud-durand-cv-${track.id}-fr.pdf`} hrefLang="fr" type="application/pdf">{track.fr} <Next/></a>
     <a className="text-link" href={`/cv/arnaud-durand-cv-${track.id}-en.pdf`} hrefLang="en" type="application/pdf">{track.en} <Next/></a>
    </span>
   </li>)}</ul>
   <p className="skills-note">{t.cvNote}</p>
  </section>
 </SiteShell>;
}
