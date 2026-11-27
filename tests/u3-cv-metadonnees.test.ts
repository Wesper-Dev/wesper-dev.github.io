// Lot 5, U3 (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit C3) : métadonnées et texte caché des deux PDF servis.
// - /Info : Title (nom et titre de la langue) et Author (« Arnaud Durand ») présents ; seuls Title, Author, Creator,
//   Producer et les dates sont permis (ni Subject, ni Keywords, ni champ maison, ni flux XMP) ; aucune valeur ne porte
//   un interdit de t1, une forme périmée (U2) ni une suite de neuf chiffres (U4) ;
// - catalogue : une seule /Lang de la langue du PDF, pas de /PageMode /UseOutlines ;
// - texte invisible : aucun mot blanc ou presque, en mode de rendu 3, de moins de 4 pt ou hors de la page (rendu Poppler
//   pdftoppm + boîtes de pdftotext, helpers-u.ts).
// Rouge attendu avant le code : les PDF du 24/11 n'ont ni Title, ni Author, ni /Lang, et portent /PageMode /UseOutlines.
// Le texte invisible est déjà absent : c'est une garde (mutation de l'audit « texte-blanc-invisible-en-tete »).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { assertDistExists } from './helpers.ts';
import { CV_NAME, LANGS, TITLE, cleanLines, cleanupPdfs, exportedPdf, servedPdf, writeTestPdf, type Lang } from './helpers-pdf.ts';
import { checkMetadata, invisibleWords } from './helpers-u.ts';

after(cleanupPdfs);
const copies = (l: Lang): [string, string][] => [[`public/cv/${CV_NAME(l)}`, servedPdf(l)], [`export /cv/${CV_NAME(l)}`, exportedPdf(l)]];
const GOOD_INFO = (l: Lang): Record<string, string> => ({ Title: `Arnaud Durand, ${TITLE[l]}`, Author: 'Arnaud Durand', Creator: 'LaTeX with hyperref', Producer: 'xdvipdfmx (0.1)' });
const GOOD_LANG: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };
const meta = (l: Lang, over: { info?: Record<string, string>; lang?: string; pageMode?: string }): string[] =>
  checkMetadata(writeTestPdf(`meta-${l}.pdf`, { lines: cleanLines(l), info: over.info ?? GOOD_INFO(l), lang: 'lang' in over ? over.lang : GOOD_LANG[l], pageMode: over.pageMode }), l);

test('U3 (métadonnées, témoins) : un PDF propre passe ; Subject, Keywords, champ maison, ancien titre, titre de l\'autre langue, Author absent, /Lang absente ou fausse, /UseOutlines, numéro dans une métadonnée rougissent', () => {
  for (const l of LANGS) {
    assert.deepEqual(meta(l, {}), [], `témoin propre ${l}`);
    assert.deepEqual(meta(l, { pageMode: 'UseNone' }), [], `témoin /PageMode /UseNone ${l}`);
    const other: Lang = l === 'fr' ? 'en' : 'fr';
    const cases: [string, { info?: Record<string, string>; lang?: string; pageMode?: string }, RegExp][] = [
      ['Subject', { info: { ...GOOD_INFO(l), Subject: 'CV' } }, /champ \/Info « Subject »/],
      ['Keywords interdits', { info: { ...GOOD_INFO(l), Keywords: 'PyTorch, LangChain, RNCP 7' } }, /champ \/Info « Keywords »/],
      ['champ maison', { info: { ...GOOD_INFO(l), Phone: 'x' } }, /champ \/Info « Phone »/],
      ['ancien titre', { info: { ...GOOD_INFO(l), Title: 'Arnaud Durand - Applied AI Engineer' } }, /\/Title/],
      ['titre de l\'autre langue', { info: { ...GOOD_INFO(l), Title: `Arnaud Durand, ${TITLE[other]}` } }, /\/Title/],
      ['Author absent', { info: { Title: GOOD_INFO(l).Title } }, /\/Author/],
      ['/Lang absente', { lang: undefined }, /\/Lang/],
      ['/Lang de l\'autre langue', { lang: GOOD_LANG[other] }, /\/Lang/],
      ['/UseOutlines', { pageMode: 'UseOutlines' }, /UseOutlines/],
      ['numéro dans Subject', { info: { ...GOOD_INFO(l), Subject: 'Tel 01 00 00 00 00' } }, /U4 : \/Subject porte une suite de chiffres/],
      ['numéro dans Title', { info: { ...GOOD_INFO(l), Title: `Arnaud Durand, ${TITLE[l]}, +33 1 00 00 00 00` } }, /U4 : \/Title/],
    ];
    for (const [name, over, want] of cases) {
      const got = meta(l, over);
      assert.ok(got.some((m) => want.test(m)), `témoin « ${name} » (${l}) : ${JSON.stringify(got)}`);
      assert.ok(got.every((m) => !/\d{2}\s?\d{2}\s?\d{2}/.test(m)), `témoin « ${name} » : chiffres non masqués dans ${JSON.stringify(got)}`);
    }
  }
});

test('U3 (texte invisible, témoins) : un PDF propre passe ; un mot blanc, gris 0,93, en mode de rendu 3, en corps 2 pt est signalé ; hors de la page, pdftotext ne le voit pas (limite)', () => {
  for (const l of LANGS) assert.deepEqual(invisibleWords(writeTestPdf(`vis-${l}.pdf`, { lines: cleanLines(l) })), [], `témoin propre ${l}`);
  const cases: ['blanc' | 'presque-blanc' | 'tr3' | 'minuscule', RegExp][] = [
    ['blanc', /invisible ou presque « Terraform »/],
    ['presque-blanc', /invisible ou presque « Terraform »/],
    ['tr3', /invisible ou presque « Terraform »/],
    ['minuscule', /moins de 4 pt « Terraform »/],
  ];
  // Hors de la page : pdftotext ne l'extrait pas (ni un ATS fondé sur Poppler) ; le contrôle reste dans invisibleWords
  // pour une boîte qui déborde, mais ce cas n'a pas de témoin rouge (limite notée au rapport).
  assert.deepEqual(invisibleWords(writeTestPdf('cache-hors-page.pdf', { lines: cleanLines('en'), hidden: [{ text: 'Terraform', how: 'hors-page' }] })), []);
  for (const [how, want] of cases) {
    const got = invisibleWords(writeTestPdf(`cache-${how}.pdf`, { lines: cleanLines('en'), hidden: [{ text: 'Terraform AWS Rust Go', how }] }));
    assert.ok(got.some((m) => want.test(m)), `témoin ${how} : ${JSON.stringify(got)}`);
  }
});

test('U3 : les deux PDF servis (public/cv et export) ont Title, Author, /Lang de leur langue, aucun autre champ, pas de /UseOutlines, aucune valeur interdite', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const l of LANGS) for (const [label, f] of copies(l)) {
    if (!existsSync(f)) bad.push(`${label} : fichier absent`);
    else for (const m of checkMetadata(f, l)) bad.push(`${label} : ${m}`);
  }
  assert.deepEqual(bad, []);
});

test('U3 : aucun mot invisible, presque blanc, de moins de 4 pt ou hors de la page dans les deux PDF servis (public/cv et export)', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const l of LANGS) for (const [label, f] of copies(l)) {
    if (!existsSync(f)) bad.push(`${label} : fichier absent`);
    else for (const m of invisibleWords(f)) bad.push(`${label} : ${m}`);
  }
  assert.deepEqual(bad, []);
});
