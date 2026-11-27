// Lot 5, U2, second filet (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit C2 et motifs-site-faibles.txt) : listes
// noires étendues, gardées même avec la référence figée, sur les deux PDF servis ET côté site (export complet et
// site/content/*) : « niveau », « graduated », « diplômé », « bac+N », « level N » ; formes de disponibilité périmées
// (16/10, mi-octobre, « Available from October 2026 », « dès le 16 », « stage en cours »…) ; formes de titre périmées
// (« Applied AI & Platform Engineer », « AI Platform Engineer », « Ingénieur IA appliquée »…).
// Chaque motif a ses témoins positifs (exemples de l'audit) et négatifs (textes permis du CV et du site).
// Vert au 24/11 sur les PDF et l'export : c'est une garde ; les mutations de l'audit la font rougir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { assertDistExists, distDir, siteDir } from './helpers.ts';
import { filesUnder, rel } from './helpers-4.ts';
import { AVAILABILITY, CV_NAME, LANGS, LINE_42, exportedPdf, pdfText, servedPdf } from './helpers-pdf.ts';
import { DEGREE_FORMS, EXTENDED, STALE_FORMS, TITLE_FORMS, extendedHits } from './helpers-u.ts';

const POSITIVE: [readonly [string, RegExp][], string[]][] = [
  [DEGREE_FORMS, ['Niveau 7', 'niveau 6 (bac+3)', 'Graduated 2026', 'graduate of École 42', 'Diplômé en 2026', 'diplôme obtenu', 'Bac +5', 'Level 7 qualification']],
  [STALE_FORMS, ['Disponible le 16/10/2026', 'Disponible à partir de mi-octobre 2026', 'Disponible dès le 16 oct 2026', 'Available from mid-October 2026', 'Available from October 2026', 'Available 2026-10-16', 'Stage en cours jusqu’au 16 oct 2026', 'I am currently interning at BPCE', 'Disponible à partir du 16 octobre 2026', 'available starting November']],
  [TITLE_FORMS, ['Applied AI Engineer', 'Applied-AI Engineer', 'Applied AI & Platform Engineer', 'AI Engineer', 'AI Platform Engineer', 'Ingénieur IA appliquée', 'Ingénieur en IA appliquée', 'Ingénieur plateforme IA']],
];
const NEGATIVE = [
  AVAILABILITY.fr, AVAILABILITY.en, LINE_42.fr, LINE_42.en, 'avr. 2026 – oct. 2026', 'Apr 2026 – Oct 2026', 'Sep 2025 – Mar 2026',
  'AI Platform Engineering Intern', 'Ingénierie plateforme IA (stage)', 'IA appliquée : RAG, agents avec function calling', 'Applied AI: RAG, agents with function calling',
  'Ingénieur logiciel', 'Software Engineer', 'GDG on Campus 42 Paris – Co-Lead Organizer depuis mai 2026', 'talk sur Gemini (juillet 2026)', 'Spanish B1',
];

test('U2 (second filet, témoins) : chaque forme de niveau, de disponibilité et de titre citée par l\'audit est vue ; les textes permis du CV et du site ne le sont pas', () => {
  for (const [list, samples] of POSITIVE) for (const s of samples) assert.ok(list.some(([, re]) => re.test(s)), `témoin « ${s} » non détecté`);
  for (const s of NEGATIVE) assert.deepEqual(extendedHits(s), [], `faux positif sur « ${s} »`);
  assert.equal(EXTENDED.length, STALE_FORMS.length + TITLE_FORMS.length + DEGREE_FORMS.length);
});

test('U2 (second filet, PDF) : aucune forme de niveau, de disponibilité ou de titre périmée dans le texte des deux PDF servis (public/cv et export)', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const l of LANGS)
    for (const [label, f] of [[`public/cv/${CV_NAME(l)}`, servedPdf(l)], [`export /cv/${CV_NAME(l)}`, exportedPdf(l)]] as const) {
      if (!existsSync(f)) bad.push(`${label} : fichier absent`);
      else for (const n of extendedHits(pdfText(f))) bad.push(`${label} : ${n}`);
    }
  assert.deepEqual(bad, []);
});

// Fichiers texte de l'export (comme t2) et de site/content.
const TEXT_EXT = new Set(['.html', '.rsc', '.js', '.mjs', '.json', '.txt', '.xml', '.css', '.md', '.webmanifest', '.svg']);
test('U2 (second filet, site) : aucune de ces formes dans l\'export (HTML, .rsc, JS, JSON, texte) ni dans site/content/*', () => {
  assertDistExists();
  const files: [string, string][] = [
    ...filesUnder(distDir).filter((f) => TEXT_EXT.has(extname(f))).map((f): [string, string] => [`export ${rel(distDir, f)}`, readFileSync(f, 'utf8')]),
    ...filesUnder(join(siteDir, 'content')).map((f): [string, string] => [rel(siteDir, f), readFileSync(f, 'utf8')]),
  ];
  const bad: string[] = [];
  for (const [f, t] of files) for (const [name, re] of EXTENDED) {
    const m = re.exec(t.replace(/[  ]/g, ' '));
    if (m) bad.push(`${f} : ${name} (« …${t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).replace(/\s+/g, ' ')}… »)`);
  }
  assert.deepEqual(bad, []);
});
