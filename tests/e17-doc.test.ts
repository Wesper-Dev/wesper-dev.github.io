// Contrat E17.1 (lot 2a) : site/README.md documente l'accueil, les polices, l'atelier, l'essai sur téléphone et le
// changement de DEFAULT_PALETTE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { siteDir } from './helpers-home.ts';

test('E17.1 : site/README.md cite data-home, Inter Tight, IBM Plex Mono, --lan, ?atelier, palette= et DEFAULT_PALETTE', () => {
  // E17.1 : présence des mots exigés.
  const readme = readFileSync(join(siteDir, 'README.md'), 'utf8');
  const missing = ['data-home', 'Inter Tight', 'IBM Plex Mono', '--lan', '?atelier', 'palette=', 'DEFAULT_PALETTE'].filter((w) => !readme.includes(w));
  assert.deepEqual(missing, [], `mots absents de site/README.md : ${missing.join(', ')}`);
});
