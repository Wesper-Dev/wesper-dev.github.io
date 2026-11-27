// Fige, pour R1 (lot 4, corrections d'audit), le nombre de signes français espacés de chaque page exportée : signes
// « : ; ? ! » » précédés d'un blanc et « « » suivis d'un blanc (tests/helpers-r.ts, spacedSigns), sur les 21 pages.
// R1 ne change que le TYPE de ces blancs : une espace retirée fait baisser le compte (r1-typographie.test.ts).
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-r1-signes.ts <export> <commit>
// L'export est celui de 5afd274 (contenu des pages = a040fb0, Q3), avant toute correction R1.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_PAGES, readRoute } from '../helpers-4.ts';
import { spacedSigns } from '../helpers-r.ts';
import { siteDir } from '../helpers.ts';

const root = process.argv[2];
const commit = process.argv[3];
if (!root || !existsSync(root) || !commit) {
  console.error('usage : figer-r1-signes.ts <export dist/client> <commit>');
  process.exit(2);
}
const pages: Record<string, number> = {};
for (const route of ALL_PAGES) {
  const html = readRoute(root, route);
  if (!html) throw new Error(`${route} absente de ${root}`);
  pages[route] = spacedSigns(html);
}
const out = { commit, commande: `depuis site/ : npm run build, puis node --experimental-strip-types tests/fixtures/figer-r1-signes.ts dist/client ${commit}`, pages };
writeFileSync(join(siteDir, 'tests', 'fixtures', 'r1-signes.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(pages));
