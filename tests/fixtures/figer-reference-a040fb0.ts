// Fige la référence du lot 4 (contrat-lot4 Q3, et mesures de départ de Q2, Q5, Q6, Q7) au commit a040fb0 : pour les
// 18 routes intérieures et la 404, en aperçu et en public, le contenu du <main> (texte, liens, images, titres) et les
// métadonnées, EN CLAIR (tests/helpers-4.ts, pageContent) ; puis les mesures de l'export (CSS, JS par page, polices,
// image de partage par défaut, @keyframes) et l'empreinte des deux accueils (homeDigest).
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-reference-a040fb0.ts --preview <export aperçu> --public <export public>
// Les deux exports viennent d'une copie de site/ au commit a040fb0, hors dépôt (commande ci-dessous, champ « commande »).
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_4, HOME_ROUTES_4, LOT4_PAGES, homeDigest, measures, pageContent, readRoute } from '../helpers-4.ts';
import type { Baseline4, Mode, PageContent } from '../helpers-4.ts';
import { siteDir } from '../helpers.ts';

const arg = (k: string): string => {
  const i = process.argv.indexOf(k);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || !existsSync(v)) {
    console.error(`${k} <export> requis et existant`);
    process.exit(2);
  }
  return v;
};
const pages = (root: string): Record<string, PageContent> => {
  const out: Record<string, PageContent> = {};
  for (const route of LOT4_PAGES) {
    const html = readRoute(root, route);
    if (!html) throw new Error(`${route} absente de ${root}`);
    out[route] = pageContent(route, html);
  }
  return out;
};
const homes = (root: string): Record<string, string> => Object.fromEntries(HOME_ROUTES_4.map((r) => [r, homeDigest(readRoute(root, r) ?? '')]));
const roots: Record<Mode, string> = { preview: arg('--preview'), public: arg('--public') };
const out: Baseline4 = {
  commit: 'a040fb0',
  commande:
    'git archive a040fb0 site | tar -x -C <tmp>/ref ; cp -c -R site/node_modules <tmp>/ref/site/ ; cd <tmp>/ref/site ; npm run build ; cp -R dist/client <tmp>/ref/dist-preview ; SITE_PUBLIC=1 npm run build ; cp -R dist/client <tmp>/ref/dist-public ; depuis site/ du dépôt : node --experimental-strip-types tests/fixtures/figer-reference-a040fb0.ts --preview <tmp>/ref/dist-preview --public <tmp>/ref/dist-public. Copie des deux exports : tmp/refonte-arbre/verif-4/ref-a040fb0/. Extraction : tests/helpers-4.ts (pageContent, measures).',
  pages: { preview: pages(roots.preview), public: pages(roots.public) },
  homes: { preview: homes(roots.preview), public: homes(roots.public) },
  mesures: { preview: measures(roots.preview), public: measures(roots.public) },
};
const file = join(siteDir, 'tests', 'fixtures', BASELINE_4);
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`écrit : ${file}`);
