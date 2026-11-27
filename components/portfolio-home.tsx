// Home page in the new art direction (contract lot 2a): header, tree block, short sections, footer, all inside
// one [data-home] root that carries the palette tokens. Header and footer are shared with the other pages
// (site-shell.tsx, lot 4). Texts: content/* (FAITS and texts reused by reference, E3); the few literals
// below are the existing ones of this file and of site-shell.tsx (E3.2).
import type { CSSProperties, ReactNode } from 'react';
import { availability } from '../content/experiences';
import faq from '../content/faq.json';
import events from '../content/hackathons.json';
import { home, type Locale } from '../content/home';
import { homeUi } from '../content/home-ui';
import { DEFAULT_PALETTE, PALETTES } from '../content/palettes';
import { GITHUB, LINKEDIN, MAIL, ORIGIN, jsonLdHtml, personNode } from '../lib/person';
import { cssVariables } from '../lib/tree/color';
import { SiteFooter, SiteHeader, pagePath } from './site-shell';
import TreeHero from './tree/TreeHero';

const palette = PALETTES[DEFAULT_PALETTE];
// Palette tokens of the whole home page (E10.1): the scene keeps [data-home] and the tree block equal.
const tokens = cssVariables(palette) as CSSProperties;
// Background of <html> and <body> on the home page only (E10.3): the CSS reads --home-bg, the workshop
// rewrites it with the palette; color-scheme stays in the CSS, never in an attribute.
const pageBackground = `:root{--home-bg:${palette.bg}}`;
const Arrow = () => <span aria-hidden="true">↗</span>;
const Next = () => <span aria-hidden="true">→</span>;

// FAQ (contract lot 6a, V1–V2): content/faq.json holds the text; an answer block may carry Markdown links [text](href).
type FaqItem = { id: string; question: string; answer: string[]; link: { text: string; href: string } | null };
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const plain = (block: string) => block.replace(LINK, '$1');
function inline(block: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of block.matchAll(LINK)) {
    out.push(block.slice(last, m.index));
    out.push(<a key={m.index} href={m[2]}>{m[1]}</a>);
    last = m.index + m[0].length;
  }
  out.push(block.slice(last));
  return out;
}

// Keeps hyphenated compounds of a question (droit-de-retard, Croix-Rouge) on one line: a heading never breaks after a hyphen.
const unbroken = (question: string): ReactNode[] =>
  question.split(/(\S+-\S+)/).map((part, i) => (i % 2 ? <span key={i} data-faq-nowrap="">{part}</span> : part));

// Structured data of a home page (lot 6a, X5): the profile page with its full Person (shared @id), and the FAQ,
// both with the page's url and language. Answers are the visible answer text (blocks joined by a newline, links
// reduced to their label, the "read more" line left out).
function homeJsonLd(locale: Locale) {
  const items: FaqItem[] = faq[locale].items;
  const url = ORIGIN + (locale === 'fr' ? '/fr/' : '/');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ProfilePage', url, inLanguage: locale, mainEntity: personNode(locale) },
      { '@type': 'FAQPage', url, inLanguage: locale, mainEntity: items.map((it) => ({ '@type': 'Question', name: it.question, acceptedAnswer: { '@type': 'Answer', text: it.answer.map(plain).join('\n') } })) },
    ],
  };
}

export default function PortfolioHome({ locale }: { locale: Locale }) {
  const t = home[locale];
  const ui = homeUi[locale];
  const fr = locale === 'fr';
  const other: Locale = fr ? 'en' : 'fr';
  const questions: FaqItem[] = faq[locale].items;
  return (
    <div data-home="" lang={locale} style={tokens}>
      {/* Fonts of the first screen (E9.5): Inter Tight (header, BNP sentence, fallback) and IBM Plex Mono (fallback skills). */}
      <link rel="preload" href="/fonts/inter-tight-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/ibm-plex-mono-regular-latin1.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <style>{pageBackground}</style>
      <a data-home-skip="" href="#main">{t.skip}</a>
      <SiteHeader locale={locale} langHref={pagePath(other)} isHome />
      <main id="main">
        <TreeHero locale={locale} />
        <section data-home-section="projects">
          <h2>{t.selected}</h2>
          <p data-home-intro="">{t.selectedNote}</p>
          <ul data-home-projects="">
            {t.projects.map((p) => (
              <li key={p.id}>
                <p data-home-tag="">{p.category}</p>
                <h3>{p.name}</h3>
                <p>{p.text}</p>
                <p data-home-muted="">{p.role}</p>
                <a data-home-more="" href={pagePath(locale, `projects/${p.id}/`)}>{ui.storyLink}</a>
              </li>
            ))}
          </ul>
          <a data-home-all="" href={pagePath(locale, 'projects/')}>{fr ? 'Tous les projets' : 'All projects'} <Next /></a>
        </section>
        <section data-home-section="hackathons">
          <h2>{t.hackTitle}</h2>
          <p data-home-intro="">{t.hackIntro}</p>
          <ul data-home-events="">
            {events.filter((e) => ['gemma', 'gcpu', 'ia-crise'].includes(e.id)).map((e) => (
              <li key={e.id}>
                <a href={pagePath(locale, `projects/${e.project}/`)}>
                  <span data-home-year="">{e.date?.slice(0, 4)}</span>
                  <span data-home-event="">
                    <strong>{e.name}</strong>
                    {e.rank ? <span data-home-rank="">{e.rank[locale]}</span> : null}
                  </span>
                  <span data-home-muted="">{e[locale].context}</span>
                  <Next />
                </a>
              </li>
            ))}
          </ul>
          <a data-home-all="" href={pagePath(locale, 'hackathons/')}>{fr ? 'Tous les hackathons' : 'All hackathons'} <Next /></a>
        </section>
        <section id="about" data-home-section="about">
          <h2>{t.aboutTitle}</h2>
          <p data-home-intro="">{t.aboutIntro}</p>
          <ul data-home-communities="">
            {t.communities.map((c) => (
              <li key={c.name}>
                <p data-home-tag="">{c.tag}</p>
                <h3>{c.url ? <a href={c.url}>{c.name} <Arrow /></a> : c.name}</h3>
                <p data-home-muted="">{c.text}</p>
              </li>
            ))}
          </ul>
        </section>
        <section data-home-section="contact">
          <h2>{t.endTitle}</h2>
          <p data-home-intro="">{t.endText}</p>
          <p data-home-available="">{availability[locale]}</p>
          <div data-home-links="">
            <a data-home-mail="" href={MAIL}>{t.mail} <Arrow /></a>
            <a href={GITHUB}>GitHub <Arrow /></a>
            <a href={LINKEDIN}>LinkedIn <Arrow /></a>
          </div>
        </section>
        {/* Fifth section (lot 6a): static, always open, no client code; nothing but faq.json inside. */}
        <section id="faq" data-home-section="faq">
          <h2>{faq[locale].title}</h2>
          {questions.map((it) => (
            <div key={it.id} data-faq-item={it.id}>
              <h3 data-faq-question="">{unbroken(it.question)}</h3>
              <div data-faq-answer="">
                {it.answer.map((block, i) => <p key={i}>{inline(block)}</p>)}
              </div>
              {it.link ? (
                <p data-faq-link="">
                  <a href={it.link.href}>{it.link.text} <span aria-hidden="true">→</span></a>
                </p>
              ) : null}
            </div>
          ))}
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(homeJsonLd(locale))} />
      <SiteFooter locale={locale} />
    </div>
  );
}
