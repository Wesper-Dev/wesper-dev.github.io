// Tree block of the home page (contract D2, lot 2a E1.3, E5): server component. In reading order: the stage, which
// holds the drawn fallback (readable without JavaScript) and the client island, then the BNP sentence and its link,
// so that the keyboard meets the experiences on the left before the BNP link on the right (recette Y10). The island
// receives the experience list and the cards, rendered here on the server and hidden (hidden + inert) until the scene
// is ready. Palette tokens live on [data-home] (E10.1); the block only carries the halo backdrop of both profiles,
// which the CSS picks with the media query of the profile (proto:210).
import type { CSSProperties } from 'react';
import { caseLink, experiencePath, experiences } from '../../content/experiences';
import type { Locale } from '../../content/home';
import { DEFAULT_PALETTE, PALETTES } from '../../content/palettes';
import { treeUi } from '../../content/tree-ui';
import { backdropCss } from '../../lib/tree/backdrop';
import { pagePath } from '../site-shell';
import TreeFallback from './TreeFallback';
import TreeIsland from './TreeIsland';
import TreeUi from './TreeUi';
import NoBreak from './NoBreak';

const palette = PALETTES[DEFAULT_PALETTE];

const style = {
  '--tree-halo-desktop': backdropCss('halo', palette, 'desktop'),
  '--tree-halo-phone': backdropCss('halo', palette, 'phone'),
} as CSSProperties;

// elementtiming is not typed by @types/react: spread as a plain attribute.
const timing = { elementtiming: 'bnp-sentence' } as Record<string, string>;

export default function TreeHero({ locale }: { locale: Locale }) {
  const bnp = experiences['bnp-paribas'][locale];
  return (
    <section data-tree-hero="" data-tree-state="html" style={style}>
      <div data-tree-stage="" className="tree-stage">
        <TreeFallback locale={locale} />
        <TreeIsland locale={locale} ui={treeUi[locale]}>
          <TreeUi locale={locale} />
        </TreeIsland>
      </div>
      <div data-tree-copy="" className="tree-copy">
        <p data-tree-bnp="" {...timing}>
          <NoBreak text={bnp.description} />
        </p>
        <a data-tree-case="" className="tree-case-link" href={pagePath(locale, experiencePath('bnp-paribas'))}>
          {caseLink[locale]}
        </a>
      </div>
    </section>
  );
}
