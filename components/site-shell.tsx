// Shell shared by every page (contract lot 4, Q1 and Q2): the header and footer of the home page, and the root of
// the interior pages, which carries the tokens of the default palette (same source as the home page, so that changing
// DEFAULT_PALETTE changes every page). Texts: content/* and the literals of the home page only (no new text).
import type { ReactNode } from 'react';
import { jobTitle } from '../content/experiences';
import { home, type Locale } from '../content/home';
import { homeUi } from '../content/home-ui';
import { DEFAULT_PALETTE, PALETTES } from '../content/palettes';
import { cssVariables } from '../lib/tree/page-colors';

export const pagePath = (locale: Locale, path = '') => `${locale === 'fr' ? '/fr/' : '/'}${path}`;
// ↗ marks a link that leaves the site, → a link to another page of the site (recette Y3).
export const Arrow = () => <span aria-hidden="true">↗</span>;
export const Next = () => <span aria-hidden="true">→</span>;
const GITHUB = 'https://github.com/Wesper-Dev';

const palette = PALETTES[DEFAULT_PALETTE];
// Palette tokens of an interior page, on :root, with the background of <html> and <body> (read by the CSS as
// --home-bg, as on the home page).
const pageTokens = `:root{${Object.entries(cssVariables(palette)).map(([k, v]) => `${k}:${v};`).join('')}--home-bg:${palette.bg}}`;

// Header of the home page. On the home page the name and title are its <h1> and the name is the current page; on
// the other pages they sit in a <div> (each page keeps its own <h1>) and the language link leads to the same page
// in the other language. `current` is the path of the page: the rubric link that leads to it carries aria-current
// (Projects, Hackathons, Skills; audit Fable C3). A story under projects/ marks Projects as its parent rubric with
// aria-current="true" (recette Y6); the experience pages have no parent rubric.
export function SiteHeader({ locale, langHref, isHome = false, current }: { locale: Locale; langHref: string; isHome?: boolean; current?: string }) {
  const t = home[locale];
  const ui = homeUi[locale];
  const fr = locale === 'fr';
  const other: Locale = fr ? 'en' : 'fr';
  const Id = isHome ? 'h1' : 'div';
  const nav: [string, string, string][] = [
    ['projects', pagePath(locale, 'projects/'), t.nav[0]],
    ['hackathons', pagePath(locale, 'hackathons/'), t.nav[1]],
    ['skills', pagePath(locale, 'skills/'), t.nav[2]],
  ];
  return (
    <header data-site-header="">
      <Id data-site-id="">
        <a data-site-name="" href={pagePath(locale)} aria-current={isHome ? 'page' : undefined}>Arnaud Durand</a>
        <span data-site-title="">{jobTitle[locale]}</span>
      </Id>
      <div data-site-actions="">
        <a data-site-cv="" href={`/cv/arnaud-durand-cv-platform-${locale}.pdf`} type="application/pdf" hrefLang={locale}>{ui.cv}</a>
        <nav data-site-nav="" aria-label={ui.mainNav}>
          <button type="button" data-site-menu="" popoverTarget="site-menu">{ui.menu}</button>
          <div id="site-menu" data-site-panel="" popover="auto">
            {nav.map(([id, href, label]) => <a key={id} data-site-link={id} href={href} aria-current={href === current ? 'page' : current?.startsWith(href) ? 'true' : undefined}>{label}</a>)}
            <a data-site-link="github" href={GITHUB}>GitHub</a>
            <a data-site-link="lang" href={langHref} hrefLang={other} lang={other} aria-label={fr ? 'Read in English' : 'Lire en français'}>{fr ? 'EN' : 'FR'}</a>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer data-site-footer="">
      <span>© 2026 Arnaud Durand</span>
      <span>{home[locale].footer}</span>
      <a href="#main">{locale === 'fr' ? 'En haut ↑' : 'Back to top ↑'}</a>
    </footer>
  );
}

export function Contact({ locale }: { locale: Locale }) {
  const t = home[locale];
  return (
    <section className="contact">
      {/* U+00A0, not U+202F: this line is set in IBM Plex Mono, which lacks U+202F (lot 4, R1). */}
      <p className="eyebrow">{locale === 'fr' ? 'La suite\u00a0?' : 'What’s next?'}</p>
      <h2>{t.endTitle}</h2>
      <p>{t.endText}</p>
      <a className="contact-link" href="mailto:arnaud.durand97@gmail.com">{t.mail} <Arrow /></a>
      <div className="social">
        <a href={GITHUB}>GitHub <Arrow /></a>
        <a href="https://www.linkedin.com/in/arnaud-durand42/">LinkedIn <Arrow /></a>
      </div>
    </section>
  );
}

// Interior page: palette tokens, skip link, header, <main>, footer, inside one [data-site-page] root.
// `langHref` defaults to the same path in the other language; `mainClass` styles the <main> (404).
export function SitePage({ locale, langHref, mainClass, current, children }: { locale: Locale; langHref: string; mainClass?: string; current?: string; children: ReactNode }) {
  return (
    <div data-site-page="">
      <style>{pageTokens}</style>
      <a data-site-skip="" href="#main">{home[locale].skip}</a>
      <SiteHeader locale={locale} langHref={langHref} current={current} />
      <main id="main" className={mainClass}>{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}

// `contact` replaces the default contact block (pages whose copy comes from another source).
export function SiteShell({ locale, path, children, contact }: { locale: Locale; path: string; children: ReactNode; contact?: ReactNode }) {
  return (
    <SitePage locale={locale} langHref={pagePath(locale === 'fr' ? 'en' : 'fr', path)} current={pagePath(locale, path)}>
      {children}
      {contact ?? <Contact locale={locale} />}
    </SitePage>
  );
}
