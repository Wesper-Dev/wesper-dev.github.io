// Lot 5, U2 (tmp/refonte-arbre/arbitrage-audit-lot5.md) : fige le texte complet extrait de chaque PDF public servi
// (public/cv) dans tests/fixtures/cv-public-texte-{fr,en}.txt, sortie brute de `pdftotext -enc UTF-8`.
// Usage, depuis site/ : node --experimental-strip-types tests/fixtures/figer-cv-texte.ts
// À lancer seulement pour une modification de texte décidée et relue par le propriétaire : le diff de ces deux fichiers
// est la liste avant → après du CV. u2-cv-texte-fige.test.ts et deliverables/cv/source/verifier_cv.py comparent ensuite
// chaque PDF à cette référence (forme compacte de helpers-u.ts : coupures de ligne et césures ignorées, mots non).
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { siteDir } from '../helpers.ts';

for (const l of ['fr', 'en']) {
  const pdf = join(siteDir, 'public', 'cv', `arnaud-durand-cv-platform-${l}.pdf`);
  const r = spawnSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`pdftotext ${pdf} : code ${r.status} ${r.stderr}`);
  const out = join(siteDir, 'tests', 'fixtures', `cv-public-texte-${l}.txt`);
  writeFileSync(out, r.stdout);
  console.log(`écrit ${out} (${r.stdout.split(/\s+/).filter(Boolean).length} mots)`);
}
