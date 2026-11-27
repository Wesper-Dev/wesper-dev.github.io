// Lot 4, corrections d'audit, R4 (tmp/refonte-arbre/arbitrage-audit-lot4.md ; audit C4) : impression des 19 pages et
// de l'accueil : texte foncé sur blanc (≥ 4,5:1 en média print), <main> entier imprimé, navigation et boutons
// simplifiés. Aucun JS.
// Partie statique : une règle @media print atteint chacune des 21 pages (CSS lié ou style de la page) et aucun JS de
// l'export ne traite l'impression. Les couleurs, le <main> entier, le menu et le lien d'évitement en média print sont
// mesurés dans tmp/refonte-arbre/verif-4/verif.mjs (R4.1, R4.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_PAGES, filesUnder, inlineStyles, linkedCss, readRoute, rel } from './helpers-4.ts';
import { assertDistExists, distDir } from './helpers.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (R4)`);
  return html;
};

// Blocs @media dont la requête vise l'impression (print, seule ou combinée), avec au moins une déclaration.
function printBlocks(css: string): string[] {
  const out: string[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/@media\s*([^{]*)\{/gi)) {
    if (!/(^|[\s,(])print\b/i.test(m[1] ?? '') || /\bnot\s+print\b/i.test(m[1] ?? '')) continue;
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    for (; i < clean.length && depth > 0; i++) depth += clean[i] === '{' ? 1 : clean[i] === '}' ? -1 : 0;
    const body = clean.slice(start, i - 1);
    if (/[\w-]+\s*:\s*[^;{}]+/.test(body)) out.push(body);
  }
  return out;
}
// Traitement de l'impression par script : événements, appel, requête média print.
const PRINT_JS = /\b(?:before|after)print\b|\bonbeforeprint\b|\bonafterprint\b|\bprint\s*\(\s*\)|matchMedia\(\s*["'`][^"'`]*\bprint\b/;

test('R4 : chacune des 21 pages (19 et l\'accueil FR et EN) reçoit au moins une règle @media print (CSS lié ou style de la page)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of ALL_PAGES) {
    const html = page(route);
    if (printBlocks(linkedCss(distDir, html) + '\n' + inlineStyles(html)).length === 0) errors.push(`${route} : aucune règle @media print`);
  }
  assert.deepEqual(errors, [], `lot 4, R4\n${errors.join('\n')}`);
});

test('R4 : aucun JS de l\'export ni script des pages ne traite l\'impression (beforeprint, afterprint, print(), matchMedia print)', () => {
  // Garde : « Aucun JS » (arbitrage R4).
  assertDistExists();
  const errors: string[] = [];
  for (const f of filesUnder(distDir).filter((x) => x.endsWith('.js'))) {
    const m = PRINT_JS.exec(readFileSync(f, 'utf8'));
    if (m) errors.push(`${rel(distDir, f)} : « ${m[0]} »`);
  }
  for (const route of ALL_PAGES) for (const s of page(route).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const m = PRINT_JS.exec(s[1] ?? '');
    if (m) errors.push(`${route} : script de la page « ${m[0]} »`);
  }
  assert.deepEqual(errors, [], `lot 4, R4 : impression traitée par script\n${errors.join('\n')}`);
});

test('R4 (témoins) : blocs print repérés (print, print and …, liste), refusés vides ou en not print ; scripts d\'impression repérés', () => {
  assert.equal(printBlocks('@media print{main{color:#000}}').length, 1);
  assert.equal(printBlocks('@media only print and (min-width:1px){a{b:c}}').length, 1);
  assert.equal(printBlocks('@media screen,print{a{b:c}}').length, 1);
  assert.equal(printBlocks('@media print{}').length, 0);
  assert.equal(printBlocks('@media not print{a{b:c}}').length, 0);
  assert.equal(printBlocks('@media (max-width:760px){a{b:c}}').length, 0);
  assert.equal(printBlocks('@media print{@page{margin:1cm}main{color:var(--night)}}').length, 1);
  for (const s of ['addEventListener("beforeprint",f)', 'window.onafterprint=f', 'window.print()', 'matchMedia("print")', "matchMedia('only print')"]) assert.ok(PRINT_JS.test(s), `« ${s} » non repéré`);
  for (const s of ['console.log(x)', 'printf', 'const fingerprint = 1', 'blueprint()']) assert.ok(!PRINT_JS.test(s), `« ${s} » repéré à tort`);
});
