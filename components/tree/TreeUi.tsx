// Commands of the tree block, rendered on the server (contract lot 2a, E6.1, E6.2): the experience list and one
// card per experience, inside [data-tree-ui], hidden and inert until the scene is ready (E2.2, E5.4). The client
// island owns aria-pressed and hidden from then on; the skill card is built by the scene after the labels.
import { cardLink, EXPERIENCE_CARDS } from '../../content/cards';
import type { Locale } from '../../content/home';
import { homeUi } from '../../content/home-ui';
import { EXPERIENCES, litSkills, skillLabel } from '../../content/tree';
import { treeUi } from '../../content/tree-ui';
import NoBreak, { DateRange } from './NoBreak';

export default function TreeUi({ locale }: { locale: Locale }) {
  const close = homeUi[locale].close;
  return (
    <div data-tree-ui="" className="tree-ui" hidden inert>
      <div data-tree-experiences="" className="tree-experiences" role="group" aria-label={treeUi[locale].nav}>
        {EXPERIENCES.map((e) => (
          <button key={e.id} type="button" data-experience={e.id} aria-pressed="false">
            {e.name[locale]}
          </button>
        ))}
      </div>
      <div data-tree-card="" className="tree-card" aria-live="polite">
        {EXPERIENCES.map((e) => {
          const c = EXPERIENCE_CARDS[e.id][locale];
          const link = cardLink(e.id, locale);
          return (
            <article key={e.id} data-card={e.id} hidden>
              {c.role ? <p data-card-role="">{c.role}{c.dates ? <> · <DateRange text={c.dates} /></> : null}</p> : null}
              <h2 data-card-title="">{e.name[locale]}</h2>
              <p data-card-result=""><NoBreak text={c.result} /></p>
              <p data-card-subtitle="">{c.subtitle}</p>
              <ul data-card-skills="">
                {litSkills(e.id).map((s) => (
                  <li key={s}>{skillLabel(s, locale)}</li>
                ))}
              </ul>
              <div data-card-actions="">
                {link ? (
                  <a data-card-link="" href={link.href}>
                    {link.label}
                  </a>
                ) : null}
                <button type="button" data-card-close="">
                  {close}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
