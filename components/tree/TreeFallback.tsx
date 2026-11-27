// Drawn fallback of the tree block (contract D4.1, lot 2a E5.5): every experience in the order of EXPERIENCES,
// with its name (a link when its page is published, E7.1), the result of its card, then the skills it lights.
// Visible in the html and loading states, and the final view in the fallback state.
import { cardLink, EXPERIENCE_CARDS } from '../../content/cards';
import type { Locale } from '../../content/home';
import { EXPERIENCES, litSkills, skillLabel } from '../../content/tree';
import NoBreak from './NoBreak';

export default function TreeFallback({ locale }: { locale: Locale }) {
  return (
    <div data-tree-fallback="" className="tree-fallback">
      <ul className="tree-fallback-list">
        {EXPERIENCES.map((e) => {
          const link = cardLink(e.id, locale);
          return (
            <li key={e.id}>
              {link ? (
                <a className="tree-fallback-name" href={link.href}>
                  {e.name[locale]}
                </a>
              ) : (
                <span className="tree-fallback-name">{e.name[locale]}</span>
              )}
              <span className="tree-fallback-result"><NoBreak text={EXPERIENCE_CARDS[e.id][locale].result} /></span>
              <ul className="tree-fallback-skills">
                {litSkills(e.id).map((s) => (
                  <li key={s}>{skillLabel(s, locale)}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
