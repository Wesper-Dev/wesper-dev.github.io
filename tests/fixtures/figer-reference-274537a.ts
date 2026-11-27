// Fige la référence de départ du lot 6a (contrat-lot6a.md, V6 et V7) au commit 274537a, en aperçu et en public :
// document normalisé (tour X : normalizedDocument6, seuls le JSON-LD et la charge RSC retirés) des 18 routes intérieures et
// de la 404 ; accueils (même empreinte, section FAQ retirée s'il y en a une) ; gzip -9 du HTML des accueils ; Σ gzip -9 des CSS ; JS de chaque page (21 pages) ;
// sitemap.xml ; liste des fichiers de l'export (hachages ramenés à *) ; fichiers de site/public.
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-reference-274537a.ts --preview <export aperçu> --public <export public> --site <copie>/site
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_6_FILE, snapshot6 } from '../helpers-6.ts';
import type { Baseline6 } from '../helpers-6.ts';

const arg = (k: string): string => {
  const i = process.argv.indexOf(k);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || !existsSync(v)) {
    console.error(`${k} <dossier> requis et existant`);
    process.exit(2);
  }
  return v;
};
const pub = join(arg('--site'), 'public');
const out: Baseline6 = {
  commit: '274537a',
  commande:
    'git archive 274537a site | tar -x -C <tmp>/ref274 ; cp -c -R site/node_modules <tmp>/ref274/site/ ; cd <tmp>/ref274/site ; npm run build ; cp -R dist/client ../dist-preview ; SITE_PUBLIC=1 npm run build ; cp -R dist/client ../dist-public ; depuis site/ du dépôt : node --experimental-strip-types tests/fixtures/figer-reference-274537a.ts --preview <tmp>/ref274/dist-preview --public <tmp>/ref274/dist-public --site <tmp>/ref274/site. Extraction : tests/helpers-6.ts (snapshot6).',
  modes: { preview: snapshot6(arg('--preview'), pub), public: snapshot6(arg('--public'), pub) },
};
writeFileSync(BASELINE_6_FILE, JSON.stringify(out, null, 1) + '\n');
console.log(`écrit : ${BASELINE_6_FILE}`);
