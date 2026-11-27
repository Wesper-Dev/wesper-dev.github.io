// Contrat du lot 4, Q1 : un seul système de couleurs. Partie statique (sans navigateur) : palette par défaut foret ;
// aucune couleur de l'ancienne DA « Papier d'atelier » dans les CSS exportés ni dans les styles des pages ; jetons de
// l'accueil (--night, --bg2, --ink, --muted, --accent…) déclarés pour chaque page intérieure avec les valeurs de
// cssVariables(PALETTES[DEFAULT_PALETTE]) ; aucune déclaration color-scheme autre que dark ; theme-color égal au
// fond de la palette sur toutes les pages.
// Les couleurs CALCULÉES (fond et texte de chaque page = palette par défaut) et la preuve « changer DEFAULT_PALETTE
// change toutes les pages » (trois palettes, trois builds d'une copie) sont des scénarios navigateur :
// tmp/refonte-arbre/verif-4/verif.mjs (Q1.1, Q1.2) et trois-palettes.mjs. Ce fichier ne juge aucun sélecteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PALETTE, PALETTES } from '../content/palettes.ts';
import { cssVariables } from '../lib/tree/page-colors.ts';
import { evalColor } from './helpers-cascade.ts';
import { ALL_PAGES, LOT4_PAGES, OLD_DA_COLORS, customPropValues, filesUnder, inlineStyles, linkedCss, oldColorsIn, readRoute, rel } from './helpers-4.ts';
import { assertDistExists, distDir } from './helpers.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export : contrat lot 4, Q1`);
  return html;
};
// Couleur comparable (r, g, b, a sur 0–255), ou null si la valeur n'est pas une couleur lisible par le test.
function rgba(v: string): string | null {
  try {
    return evalColor(v, new Map())
      .map((x) => Math.round(x * 255))
      .join(',');
  } catch {
    return null;
  }
}
const cssFiles = (): string[] => filesUnder(distDir).filter((f) => f.endsWith('.css'));

test('Q1 : DEFAULT_PALETTE vaut foret (favorite provisoire du propriétaire)', () => {
  assert.equal(DEFAULT_PALETTE, 'foret', 'contrat lot 4, Q1 : DEFAULT_PALETTE doit devenir foret');
});

test('Q1 : aucune couleur de l\'ancienne DA « Papier d\'atelier » dans les CSS exportés ni dans les styles (attributs, <style>) des 21 pages', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const f of cssFiles()) for (const c of oldColorsIn(readFileSync(f, 'utf8'))) errors.push(`${rel(distDir, f)} : ${c}`);
  for (const route of ALL_PAGES) for (const c of oldColorsIn(inlineStyles(page(route)))) errors.push(`${route} : ${c} dans un style de la page`);
  assert.deepEqual(errors, [], `contrat lot 4, Q1 : couleurs de l'ancienne DA (${OLD_DA_COLORS.join(' ')})\n${errors.join('\n')}`);
});

test('Q1 : les jetons de l\'accueil sont déclarés pour chaque page intérieure et la 404 (HTML de la page ou CSS qu\'elle charge), aux valeurs de cssVariables(PALETTES[DEFAULT_PALETTE])', () => {
  assertDistExists();
  const want = cssVariables(PALETTES[DEFAULT_PALETTE]);
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    const html = page(route);
    const css = `${linkedCss(distDir, html)}\n${inlineStyles(html)}`;
    for (const [name, value] of Object.entries(want)) {
      const got = customPropValues(css, name);
      if (!got.some((g) => rgba(g) !== null && rgba(g) === rgba(value))) errors.push(`${route} : ${name} = ${value} attendu, déclarations trouvées : ${JSON.stringify(got)}`);
    }
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q1 (palette ${DEFAULT_PALETTE})\n${errors.slice(0, 40).join('\n')}${errors.length > 40 ? `\n… ${errors.length - 40} de plus` : ''}`);
});

test('Q1 : aucune déclaration color-scheme autre que dark (CSS exportés et styles des 21 pages) ; color-scheme: dark déclaré', () => {
  assertDistExists();
  const errors: string[] = [];
  let dark = 0;
  const scan = (where: string, text: string): void => {
    for (const m of text.matchAll(/color-scheme\s*:\s*([^;}"']+)/gi)) {
      const v = (m[1] ?? '').trim().replace(/\s*!important$/, '');
      if (/^(?:only\s+)?dark$/i.test(v)) dark++;
      else errors.push(`${where} : color-scheme: ${v}`);
    }
  };
  for (const f of cssFiles()) scan(rel(distDir, f), readFileSync(f, 'utf8'));
  for (const route of ALL_PAGES) scan(route, inlineStyles(page(route)));
  assert.deepEqual(errors, [], `contrat lot 4, Q1 : color-scheme: dark sur toutes les pages\n${errors.join('\n')}`);
  assert.ok(dark > 0, 'contrat lot 4, Q1 : aucune déclaration color-scheme: dark');
});

test('Q1 : chaque page (accueils compris) a une seule <meta name="theme-color">, sans media, égale au fond de la palette par défaut', () => {
  assertDistExists();
  const bg = PALETTES[DEFAULT_PALETTE].bg;
  const errors: string[] = [];
  for (const route of ALL_PAGES) {
    const head = /<head\b[\s\S]*?<\/head>/i.exec(page(route))?.[0] ?? '';
    const metas = [...head.matchAll(/<meta\b[^>]*name\s*=\s*["']theme-color["'][^>]*>/gi)].map((m) => m[0]);
    if (metas.length !== 1) {
      errors.push(`${route} : ${metas.length} <meta name="theme-color">`);
      continue;
    }
    const tag = metas[0] as string;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    if (/\smedia\s*=/.test(tag)) errors.push(`${route} : theme-color avec media`);
    if (rgba(content) === null || rgba(content) !== rgba(bg)) errors.push(`${route} : theme-color ${content} ≠ ${bg} (fond de ${DEFAULT_PALETTE})`);
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q1\n${errors.join('\n')}`);
});

test('Q1 (témoins) : repérage des couleurs de l\'ancienne DA (hex, majuscules, rgb), des jetons déclarés et des couleurs comparées', () => {
  assert.deepEqual(oldColorsIn('body{background:#F8F5ED}'), ['#f8f5ed']);
  assert.deepEqual(oldColorsIn('a{color:rgb(164 66 41)}'), ['#a44229']);
  assert.deepEqual(oldColorsIn('a{color:rgba(38,39,34,.04)}'), ['#262722', '#2627220a']);
  assert.deepEqual(oldColorsIn(':root{--night:#040C0A;--ink:#EAF0EA;--accent:#FFD27A}'), []);
  assert.deepEqual(oldColorsIn('x{color:#a442291}'), [], 'un hex plus long n\'est pas la couleur');
  assert.deepEqual(customPropValues(':root{--night:#040C0A;--bg2:#051912}', '--night'), ['#040c0a']);
  assert.deepEqual(customPropValues('<div style="--night:#040C0A;--ink:#EAF0EA">', '--ink'), ['#eaf0ea']);
  assert.deepEqual(customPropValues('a{color:var(--night)}', '--night'), [], 'un usage n\'est pas une déclaration');
  assert.equal(rgba('#040C0A'), rgba('rgb(4 12 10)'));
  assert.notEqual(rgba('#040C0A'), rgba('#050A08'));
  assert.equal(rgba('oklch(20% 0 0)'), null, 'valeur illisible : jamais égale');
});
