// Lot 5, U4 (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit C4) : second filet du téléphone, « neuf chiffres ou plus
// une fois les séparateurs retirés », dans le texte, les URI et les métadonnées des deux PDF servis, et dans l'export du
// site (texte visible, attributs href, content, alt, title, aria-label, JSON-LD de chaque page HTML). Le motif K8 de t1
// reste ; celui-ci voit en plus « (+33) 1 … », « 01/00/… », « +33 100 000 000 », « 0100 000 000 » et les numéros
// étrangers. Pas de faux positif sur les années et plages d'années, les plages chiffrées du CV, les dates ISO, ni sur
// les deux identifiants LinkedIn connus (et eux seuls : un autre identifiant long reste signalé).
// Témoin positif réel : les CV de candidature avec téléphone (dépôt complet seulement), messages masqués.
// Vert au 24/11 : c'est une garde ; la mutation « numero-entre-parentheses-puce-courte » de l'audit la fait rougir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { assertDistExists, distDir, readManifest, routesOf } from './helpers.ts';
import { readRoute } from './helpers-4.ts';
import { CV_NAME, LANGS, candidatePdfs, exportedPdf, pdfText, pdfUris, servedPdf } from './helpers-pdf.ts';
import { digitRuns, pdfInfoDict } from './helpers-u.ts';

test('U4 (témoins) : formes de l\'audit et numéros étrangers détectés (masqués) ; années, plages, dates ISO, mesures et identifiants LinkedIn connus non signalés', () => {
  const positives = ['(+33) 1 00 00 00 00', '01/00/00/00/00', '+33 100 000 000', '0100 000 000', '+44 20 0000 0000', '01 00 00 00 00', '0100000000', '+33 (0)1 00 00 00 00', '0033 1 00 00 00 00', '01 00 00\n00 00', 'Tél. 01 00 00 00 00', 'tel:+33100000000', '01–00–00–00–00'];
  for (const s of positives) {
    const hits = digitRuns(`Contact ${s} merci`);
    assert.equal(hits.length, 1, `témoin « ${s.replace(/\d/g, '0')} » : ${hits.length} détection(s)`);
    assert.ok(!/\d/.test(hits[0]!), 'message non masqué');
  }
  const negatives = [
    '2019–2026', 'École 42 Paris, 2019–2026\nsept. 2025 – mars 2026\navr. 2026 – oct. 2026', '2025–2026 2019–2026', '1 500 à 3 000 collaborateurs', '1,500–3,000 employees', '0,30–0,40 € par rapport', '€0.30–0.40 per report',
    'de 3–5 à 1–3 min', '10–15 captures', '75+ conteneurs Docker', '600 Go', '50+ séances, dont 20+ menées seul, 15 à 20 personnes', '2026-11-24T10:00:00Z', 'Sep 2025 – Mar 2026', '2 événements de 100+ personnes',
    'https://www.linkedin.com/feed/update/urn:li:activity:7348294640778797059/', 'https://www.linkedin.com/posts/arnaud-durand42_ai-deepmind-alphafold-activity-7250922511121416193-363Q/',
  ];
  for (const s of negatives) assert.deepEqual(digitRuns(s), [], `faux positif « ${s} »`);
  assert.equal(digitRuns('https://www.linkedin.com/feed/update/urn:li:activity:1234567890123456789/').length, 1, 'un identifiant long inconnu doit rester signalé (seuls les deux identifiants K9 sont connus)');
});

test('U4 : aucune suite de neuf chiffres dans le texte, les URI et les métadonnées des deux PDF servis (public/cv et export) ; témoins réels (CV de candidature, si présents) détectés', (t) => {
  assertDistExists();
  const bad: string[] = [];
  for (const l of LANGS)
    for (const [label, f] of [[`public/cv/${CV_NAME(l)}`, servedPdf(l)], [`export /cv/${CV_NAME(l)}`, exportedPdf(l)]] as const) {
      if (!existsSync(f)) {
        bad.push(`${label} : fichier absent`);
        continue;
      }
      for (const r of digitRuns(pdfText(f))) bad.push(`${label} : texte ${r}`);
      for (const u of pdfUris(f)) for (const r of digitRuns(u)) bad.push(`${label} : URI ${r}`);
      for (const [k, v] of Object.entries(pdfInfoDict(f))) if (k !== 'CreationDate' && k !== 'ModDate') for (const r of digitRuns(v)) bad.push(`${label} : /${k} ${r}`);
    }
  assert.deepEqual(bad, []);
  const cands = candidatePdfs();
  if (!cands.length) t.diagnostic('CV de candidature absents (dépôt limité à site/) : témoins synthétiques seulement');
  for (const f of cands) {
    assert.ok(digitRuns(pdfText(f)).length >= 1, `témoin réel ${f.split('/').pop()} : numéro du texte non détecté`);
    assert.ok(pdfUris(f).some((u) => digitRuns(u).length >= 1), `témoin réel ${f.split('/').pop()} : numéro de l'URI non détecté`);
  }
});

const decode = (s: string): string => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&');
test('U4 : aucune suite de neuf chiffres dans l\'export du site (texte visible, href, content, alt, title, aria-label et JSON-LD des 20 routes et de la 404)', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const r of [...routesOf(readManifest().paths), '/404.html']) {
    const html = readRoute(distDir, r);
    if (!html) {
      bad.push(`${r} : page absente`);
      continue;
    }
    const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!);
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const attrs = [...body.matchAll(/\s(?:href|content|alt|title|aria-label)="([^"]*)"/gi)].map((m) => m[1]!);
    for (const [part, text] of [['texte', body.replace(/<[^>]+>/g, ' ')], ['attributs', attrs.join('\n')], ['JSON-LD', ld.join('\n')]] as const) for (const x of digitRuns(decode(text))) bad.push(`${r} (${part}) : ${x}`);
  }
  assert.deepEqual(bad, []);
});
