// Fige la référence de départ du tour Y (tmp/refonte-arbre/contrat-recette-y.md) au commit f43e1cf : par page (20 routes
// et la 404), les liens avec leur nombre de flèches (Y3 : aucun lien ne gagne ni ne perd de flèche), le nombre
// d'apostrophes entre deux lettres, droites et courbes confondues (Y4 : plancher, aucune apostrophe supprimée), et le
// nombre de plages de dates portant un blanc (Y5 : plancher du contrôle des coupures) ; plus les apostrophes de llms.txt.
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-recette-y.ts --export <dist/client de départ> --site <site/ de départ>
// L'export vient d'une copie de site/ au commit f43e1cf, hors dépôt (champ « commande »). Les mailto: sont masqués.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURLY_RE, DEPART_Y, STRAIGHT_RE, countRe, departSnapshot } from '../helpers-y.ts';
import type { DepartY } from '../helpers-y.ts';

const arg = (k: string): string => {
  const i = process.argv.indexOf(k);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || !existsSync(v)) {
    console.error(`${k} <dossier> requis et existant`);
    process.exit(2);
  }
  return v;
};
const root = arg('--export');
const llms = readFileSync(join(arg('--site'), 'public', 'llms.txt'), 'utf8');
const out: DepartY = {
  commit: 'f43e1cf',
  commande: 'copie de site/ à f43e1cf hors dépôt (rsync sans .git, data/, tmp/) ; cp -c -R site/node_modules <copie>/site/ ; cd <copie>/site ; npm run build ; depuis site/ du dépôt : node --experimental-strip-types tests/fixtures/figer-recette-y.ts --export <copie>/site/dist/client --site <copie>/site',
  ...departSnapshot(root),
  llmsApostrophes: countRe(llms, STRAIGHT_RE) + countRe(llms, CURLY_RE),
};
writeFileSync(DEPART_Y, JSON.stringify(out, null, 1) + '\n');
console.log(`écrit : ${DEPART_Y}`);
