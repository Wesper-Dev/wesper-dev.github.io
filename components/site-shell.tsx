import type { ReactNode } from 'react';
import { home, type Locale } from '../content/home';
export const pagePath = (locale: Locale, path = '') => `${locale === 'fr' ? '/fr/' : '/'}${path}`;
export const Arrow = () => <span aria-hidden="true">↗</span>;
export function Header({locale, path = ''}:{locale:Locale;path?:string}) {
 const t=home[locale], fr=locale==='fr';
 return <><a className="skip" href="#main">{t.skip}</a><header className="header wrap"><a className="wordmark" href={pagePath(locale)} aria-label={fr?'Arnaud Durand — accueil':'Arnaud Durand — home'}>ad<span>.</span></a><nav aria-label={fr?'Navigation principale':'Main navigation'}>{t.nav.map((name,i)=><a key={name} href={pagePath(locale,['projects/','hackathons/','#about'][i])} aria-current={(i===0&&path.startsWith('projects/'))||(i===1&&path==='hackathons/')?'page':undefined}>{name}</a>)}<a className="language" href={pagePath(fr?'en':'fr',path)} hrefLang={fr?'en':'fr'} lang={fr?'en':'fr'} aria-label={fr?'Read in English':'Lire en français'}>{fr?'EN':'FR'}</a></nav></header></>;
}
export function Footer({locale}:{locale:Locale}) {return <footer className="wrap"><span>© 2026 Arnaud Durand</span><span>{home[locale].footer}</span><a href="#main">{locale==='fr'?'En haut ↑':'Back to top ↑'}</a></footer>}
export function Contact({locale}:{locale:Locale}) {const t=home[locale];return <section className="contact"><p className="eyebrow">{locale==='fr'?'La suite ?':'What’s next?'}</p><h2>{t.endTitle}</h2><p>{t.endText}</p><a className="contact-link" href="mailto:arnaud.durand97@gmail.com">{t.mail} <Arrow/></a><div className="social"><a href="https://github.com/Wesper-Dev">GitHub <Arrow/></a><a href="https://www.linkedin.com/in/arnaud-durand42/">LinkedIn <Arrow/></a></div></section>}
export function SiteShell({locale,path,children}:{locale:Locale;path:string;children:ReactNode}) {return <div className="portfolio"><Header locale={locale} path={path}/><main id="main" className="wrap">{children}<Contact locale={locale}/></main><Footer locale={locale}/></div>}
