import { Fragment } from 'react';
import type { Locale } from '../content/home';
import { availability, experienceCopy, experiencePath, type ExperienceSlug } from '../content/experiences';
import { Arrow, SiteShell } from './site-shell';
import { DateRange } from './tree/NoBreak';

// Contact block of the detail pages: only the availability of FAITS §7, then the contact addresses.
function ExperienceContact({ locale }: { locale: Locale }) {
  return (
    <section className="contact">
      <p>{availability[locale]}</p>
      <a className="contact-link" href="mailto:arnaud.durand97@gmail.com" style={{ overflowWrap: 'anywhere' }}>
        arnaud.durand97@gmail.com <Arrow />
      </a>
      <div className="social">
        <a href="https://github.com/Wesper-Dev">
          GitHub <Arrow />
        </a>
        <a href="https://www.linkedin.com/in/arnaud-durand42/">
          LinkedIn <Arrow />
        </a>
      </div>
    </section>
  );
}

// Detail page of an experience: the key figure of its card, then the text of FAITS.
export default function ExperiencePage({ locale, slug }: { locale: Locale; slug: ExperienceSlug }) {
  const t = experienceCopy(slug, locale);
  return (
    <SiteShell locale={locale} path={experiencePath(slug)} contact={<ExperienceContact locale={locale} />}>
      <article className="story">
        <header className="page-intro">
          {t.role && <p className="eyebrow">{t.dates ? <>{t.role} · <DateRange text={t.dates} /></> : t.role}</p>}
          <h1>{t.title}</h1>
          <p className="intro">
            <span className="intro-figure">{t.cardFigure}</span>
            <br />
            <span className="contribution">{t.cardSubtitle}</span>
          </p>
        </header>
        <div className="prose">
          {t.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {t.sections?.map((section) => (
            <Fragment key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Fragment>
          ))}
        </div>
      </article>
    </SiteShell>
  );
}
