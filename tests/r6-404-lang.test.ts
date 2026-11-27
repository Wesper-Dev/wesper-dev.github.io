// Lot 4, corrections d'audit, R6 (tmp/refonte-arbre/arbitrage-audit-lot4.md ; audit C7) : le lang="fr" du bloc
// français de la 404 est contrôlé pour de bon (avant, seul le témoin de Q3 rougissait, par hasard).
// La 404 est bilingue, en anglais par son <html lang="en"> : chaque texte français de son <main> est sous un lang="fr",
// chaque texte anglais sous l'anglais. Les textes français sont ceux de la 404 figés par Q3 (baseline a040fb0).
// Les deux autres volets de R6 (texte rendu du <main> à toutes les largeurs et en média print ; plancher de taille
// de texte) sont des scénarios navigateur : tmp/refonte-arbre/verif-4/verif.mjs (R6.1, R6.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOT_FOUND, readBaseline4, readRoute } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf } from './helpers.ts';
import { byTag, parseHtml } from './helpers-home.ts';
import { foldRecetteY } from './helpers-typo.ts';
import type { HNode } from './helpers-home.ts';

// Textes français du <main> de la 404 (Q3 les fige ; un texte changé y rougit déjà).
const FR_404 = ['Une page introuvable.', 'Retrouve le fil depuis l’accueil ou les projets.', 'Accueil · Français ↗'];
// Tour Y (contrat-recette-y.md, Y3) : flèche repliée (« ↗ » et « → » confondues, helpers-typo.ts) ; y3-fleches.test.ts
// exige « → » sur ces liens internes.
const squash = (s: string): string => foldRecetteY(s.replace(/\s+/g, ' ').trim());

// Texte de chaque feuille de texte du <main>, avec la langue héritée.
function mainTexts(html: string): { text: string; lang: string }[] {
  const doc = parseHtml(html);
  const htmlEl = doc.children.find((c) => c.tag === 'html');
  const main = byTag(doc, 'main')[0];
  if (!main) return [];
  const langOf = (n: HNode): string => {
    for (let p: HNode | null = n; p; p = p.parent) if (p.attrs.lang !== undefined) return p.attrs.lang.toLowerCase();
    return (htmlEl?.attrs.lang ?? '').toLowerCase();
  };
  const out: { text: string; lang: string }[] = [];
  // Un élément dont tout le texte partage une langue est lu d'un bloc (« Accueil · Français ↗ » est dans un seul <a>).
  const visit = (n: HNode): void => {
    if (n.tag === '#text' || n.tag === 'script' || n.tag === 'style') return;
    const own = n.children.filter((c) => c.tag === '#text' && c.text.trim());
    if (own.length) out.push({ text: squash(textDeep(n)), lang: langOf(n) });
    else n.children.forEach(visit);
  };
  const textDeep = (n: HNode): string => (n.tag === '#text' ? n.text : n.tag === 'script' || n.tag === 'style' ? '' : n.children.map(textDeep).join(''));
  visit(main);
  return out;
}

function langErrors(html: string): string[] {
  const errors: string[] = [];
  const htmlLang = /<html\b[^>]*\blang="([^"]*)"/i.exec(html)?.[1];
  if (htmlLang !== 'en') errors.push(`<html lang="${htmlLang}"> (en attendu : la 404 est en anglais, avec un bloc français)`);
  const texts = mainTexts(html);
  for (const fr of FR_404) {
    const hit = texts.find((t) => t.text === squash(fr));
    if (!hit) errors.push(`texte français « ${fr} » introuvable dans le <main>`);
    else if (!hit.lang.startsWith('fr')) errors.push(`« ${fr} » est en lang « ${hit.lang} » (fr attendu)`);
  }
  for (const t of texts.filter((x) => !FR_404.map(squash).includes(x.text))) if (!t.lang.startsWith('en') && t.text !== '404') errors.push(`« ${t.text} » est en lang « ${t.lang} » (en attendu)`);
  return errors;
}

test('R6 : 404 : <html lang="en"> ; chaque texte français du <main> sous un lang="fr", chaque texte anglais en anglais', () => {
  assertDistExists();
  const html = readRoute(distDir, NOT_FOUND);
  assert.ok(html, '404.html absente de l\'export');
  const errors = langErrors(html);
  assert.deepEqual(errors, [], `lot 4, R6\n${errors.join('\n')}`);
});

test('R6 : les textes français contrôlés sont bien ceux de la 404 figée par Q3 (référence a040fb0)', () => {
  // Garde contre une liste FR_404 périmée : chaque texte français est dans le texte du <main> de référence.
  const ref = readBaseline4().pages[exportModeOf(distDir)][NOT_FOUND]?.text ?? '';
  for (const fr of FR_404) assert.ok(squash(ref).includes(squash(fr)), `« ${fr} » absent de la 404 de référence`);
});

test('R6 (témoins) : lang="fr" retiré, déplacé sur le texte anglais, posé sur un seul titre, <html lang="fr"> : rougissent', () => {
  assertDistExists();
  const html = readRoute(distDir, NOT_FOUND) ?? '';
  assert.deepEqual(langErrors(html), [], 'la 404 exportée doit être conforme pour servir de base aux témoins');
  const muts: [string, string][] = [
    ['lang="fr" retiré', html.replace(/(<main\b[\s\S]*?)<div lang="fr">/, '$1<div>')],
    ['lang="fr" passé au texte anglais', html.replace(/(<main\b[\s\S]*?)<div lang="fr">/, '$1<div>').replace(/(<main\b[^>]*>[\s\S]*?)<p>This page/, '$1<p lang="fr">This page')],
    ['lang="fr" sur le seul titre', html.replace(/(<main\b[\s\S]*?)<div lang="fr"><h2>/, '$1<div><h2 lang="fr">')],
    ['<html lang="fr">', html.replace(/<html\b([^>]*)lang="en"/, '<html$1lang="fr"')],
    ['lien « Accueil · Français » sans lang', html.replace(/(<a\b[^>]*href="\/fr\/")\s+lang="fr"/, '$1')],
  ];
  for (const [label, m] of muts) {
    assert.notEqual(m, html, `mutation « ${label} » sans effet`);
    assert.ok(langErrors(m).length > 0, `« ${label} » non détecté`);
  }
});
