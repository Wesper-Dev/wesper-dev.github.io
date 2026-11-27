// Fige la référence de non-régression du lot 2b (contrat-lot2b P4 et P5) : empreinte du document normalisé des 16 routes
// du lot 2a et de la 404, en aperçu et en public, au commit 6d9e441. Sur les deux accueils, seuls les changements
// permis par P4 sont neutralisés (lien de fiche et nom du repli de BPCE et d'École 42 : neutralizeHome).
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-reference-6d9e441.ts --preview <export aperçu> --public <export public>
// Les deux exports viennent d'une copie de site/ au commit 6d9e441, hors dépôt : npm run build, puis SITE_PUBLIC=1 npm run build.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_2B, OLD_ROUTES, pageDigest } from '../helpers-2b.ts';
import type { Baseline2b } from '../helpers-2b.ts';
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
const digests = (dist: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const route of [...OLD_ROUTES, '/404.html']) {
    const file = route === '/404.html' ? join(dist, '404.html') : join(dist, route.slice(1), 'index.html');
    out[route] = pageDigest(route, readFileSync(file, 'utf8'));
  }
  return out;
};
const out: Baseline2b = {
  commit: '6d9e441',
  commande:
    'cp -c -R site <tmp>/ref/site (au commit 6d9e441, arbre propre) ; cd <tmp>/ref/site ; rm -rf dist ; npm run build ; cp -R dist/client <tmp>/ref/dist-preview ; SITE_PUBLIC=1 npm run build ; cp -R dist/client <tmp>/ref/dist-public ; depuis site/ du dépôt : node --experimental-strip-types tests/fixtures/figer-reference-6d9e441.ts --preview <tmp>/ref/dist-preview --public <tmp>/ref/dist-public. Normalisation : tests/helpers-2b.ts (normalizedDocument, neutralizeHome).',
  pages: { preview: digests(arg('--preview')), public: digests(arg('--public')) },
};
const file = join(siteDir, 'tests', 'fixtures', BASELINE_2B);
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log(`écrit : ${file}`);
