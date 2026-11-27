// Lot 5, U8 (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit C9) : dans les deux PDF servis, le titre « Formation,
// communauté & langues » / « Education, Community & Languages » est espacé comme les autres (\par avant \sect) ; le
// PDF tient toujours sur une page (K1 de t1). Mesure : boîtes de lignes de `pdftotext -bbox-layout` (helpers-u.ts).
// Les fins de puce orphelines (« Good. », « règles métier. ») ne sont corrigées que « si cela tient sans changer un
// mot » : elles sont listées en diagnostic, jamais en rouge.
// Rouge attendu avant le code : 1,4 pt au-dessus du titre (8,4 pour « Compétences techniques ») et 24,5 pt au-dessous
// (18,5 pour les autres titres).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { assertDistExists } from './helpers.ts';
import { CV_NAME, LANGS, exportedPdf, servedPdf } from './helpers-pdf.ts';
import { SECTION_TITLES, checkU8, orphans, pdfLines, type Line } from './helpers-u.ts';

// Page témoin : cinq titres, chacun précédé d'une ligne ; `gap` = blanc au-dessus du dernier titre.
const page = (l: 'fr' | 'en', gap: number, below = 18.5): Line[] => {
  const out: Line[] = [{ y0: 10, y1: 20, text: 'Arnaud DURAND' }];
  let y = 20;
  for (const [i, t] of SECTION_TITLES[l].entries()) {
    const above = i === 4 ? gap : i === 1 || i === 2 ? 14.3 : 8.4;
    out.push({ y0: y + above, y1: y + above + 12, text: t });
    y += above + 12;
    out.push({ y0: y + (i === 4 ? below : 18.5), y1: y + (i === 4 ? below : 18.5) + 10, text: 'ligne de texte' });
    y += (i === 4 ? below : 18.5) + 10;
  }
  return out;
};

test('U8 (témoins) : titre collé (1,4 pt) ou blanc dessous trop grand (24,5 pt) rougissent ; espacement égal au voisin (8,4 pt, 18,5 pt) passe ; titre absent signalé', () => {
  for (const l of LANGS) {
    assert.deepEqual(checkU8(page(l, 8.4), l), [], `témoin propre ${l}`);
    assert.ok(checkU8(page(l, 1.4), l).some((m) => m.includes('de la ligne précédente')), `témoin titre collé ${l}`);
    assert.ok(checkU8(page(l, 8.4, 24.5), l).some((m) => m.includes('sous')), `témoin blanc dessous ${l}`);
    assert.ok(checkU8(page(l, 8.4).filter((x) => x.text !== SECTION_TITLES[l][4]), l).some((m) => m.includes('trouvé 0 fois')), `témoin titre absent ${l}`);
  }
});

test('U8 : dans chaque PDF servi (public/cv et export), « Formation, communauté & langues » / « Education, Community & Languages » est espacé comme « Compétences techniques » au-dessus et comme les autres titres au-dessous (0,6 pt près) ; fins de puce orphelines en diagnostic', (t) => {
  assertDistExists();
  const bad: string[] = [];
  for (const l of LANGS)
    for (const [label, f] of [[`public/cv/${CV_NAME(l)}`, servedPdf(l)], [`export /cv/${CV_NAME(l)}`, exportedPdf(l)]] as const) {
      if (!existsSync(f)) {
        bad.push(`${label} : fichier absent`);
        continue;
      }
      const lines = pdfLines(f);
      for (const m of checkU8(lines, l)) bad.push(`${label} : ${m}`);
      const o = orphans(lines);
      if (o.length) t.diagnostic(`${label} : fin(s) de puce seule(s) sur leur ligne (U8, à corriger si cela tient sans changer un mot) : ${o.join(' | ')}`);
    }
  assert.deepEqual(bad, []);
});
