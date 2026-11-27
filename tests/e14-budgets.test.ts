// Contrat E14.4 (lot 2a) : budgets d'octets de l'accueil (HTML et CSS, gzip -9). Le budget JS tout compris reste
// celui de D11.3 (audit), non dupliqué ici ; CLS, premier texte et cadence : scénarios [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSize } from './helpers-scene.ts';
import { HOME_ROUTES, distDir, homeRoot } from './helpers-home.ts';

test('E14.4 : HTML de chaque accueil ≤ 16 000 octets gzip -9', (t) => {
  // E14.4 : mutation « icônes SVG de toutes les compétences rendues deux fois dans le HTML ».
  for (const route of HOME_ROUTES) {
    homeRoot(route);
    const n = gzipSize(readFileSync(join(distDir, route === '/' ? 'index.html' : 'fr/index.html')));
    t.diagnostic(`${route} : ${n} octets gzip -9`);
    assert.ok(n <= 16000, `${route} : ${n} octets gzip -9 > 16 000`);
  }
});

// E14.4 « Σ des CSS de l'export ≤ 9 000 octets gzip -9 » : remplacé au lot 4 par q5-q7-budgets.test.ts
// (contrat lot 4, Q7 : Σ CSS gzip -9 ≤ a040fb0 + 2 Ko, soit 8 057 + 2 048 octets).
