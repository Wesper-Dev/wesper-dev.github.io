// Tour W (tmp/refonte-arbre/contrat-relecture-w.md ; décisions d'Arnaud des 25–26/11/2026) : exceptions nommées « W… »
// de fixtures/exceptions-s.json (générées et contrôlées contre a040fb0 par
// tmp/refonte-arbre/preuves-relecture-w/exceptions_w.py). Ce fichier prouve :
// - qu'elles sont en fin de fichier, après toutes les autres, et que chacune cite le tour W ;
// - que chaque valeur nouvelle est sur chacune de ses routes, l'ancienne n'y est plus (texte du <main>, alt ou
//   métadonnée), et que le fragment HTML nouveau, quand il est donné, est dans le HTML de la route ;
// - qu'une valeur nouvelle n'est jamais contenue dans l'ancienne (le retour la doublerait), sauf la seule enveloppe de
//   présentation de « co-construit » (W3 3.2), dont le texte ne change pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ROUTES_4, pageContent, readNamedExceptions, readRoute } from './helpers-4.ts';
import type { NamedException } from './helpers-4.ts';
import { assertDistExists, distDir } from './helpers.ts';
import { norm } from './helpers-z.ts';

const W = (): NamedException[] => readNamedExceptions().filter((e) => e.id.startsWith('W'));
const n = (s: string): string => norm(s).replace(/\s+/g, ' ').trim();
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir})`);
  return html;
};
const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const flexHtml = (s: string): RegExp => new RegExp(s.trim().split(/\s+/).map(esc).join('(?:\\s|&nbsp;|&#160;)+'));
const metas = (html: string, k: string): string[] =>
  k === 'title' ? [...html.matchAll(/<title\b[^>]*>([^<]*)<\/title>/g)].map((m) => n(m[1] as string)) : [...html.matchAll(new RegExp(`<meta\\b[^>]*(?:name|property)="${esc(k)}"[^>]*content="([^"]*)"`, 'g'))].map((m) => n(m[1] as string));
const PRESENTATION_ONLY = ['W3-3.2-coconstruit-fr'];

test('W (exceptions) : les exceptions W ferment le fichier, citent le tour W et ne contiennent jamais leur valeur nouvelle dans l\'ancienne', () => {
  const all = readNamedExceptions();
  const first = all.findIndex((e) => e.id.startsWith('W'));
  const errors: string[] = [];
  if (first < 0) errors.push('aucune exception W');
  if (all.slice(first).some((e) => !e.id.startsWith('W'))) errors.push('une exception non W suit les exceptions W');
  for (const e of W()) {
    if (!e.decision.startsWith('Tour W (tmp/refonte-arbre/contrat-relecture-w.md)')) errors.push(`${e.id} : décision sans renvoi au contrat W`);
    if (PRESENTATION_ONLY.includes(e.id)) {
      if (e.ancien !== e.nouveau || !e.html) errors.push(`${e.id} : enveloppe de présentation sans fragment html ou texte changé`);
      continue;
    }
    if (n(e.ancien) === n(e.nouveau) || (e.ancien !== '' && n(e.ancien).includes(n(e.nouveau)))) errors.push(`${e.id} : valeur nouvelle égale à l'ancienne ou contenue dedans`);
    if (e.ancien === '' && !e.html) errors.push(`${e.id} : insertion sans fragment html`);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('W (exceptions) : chaque valeur nouvelle est sur chacune de ses routes et l\'ancienne n\'y est plus (texte, alt, métadonnée, fragment html)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const e of W())
    for (const r of e.routes) {
      const html = page(r);
      if (e.html && !flexHtml(e.html.nouveau).test(html)) errors.push(`${e.id} : ${r} sans le fragment « ${e.html.nouveau} »`);
      if (e.champ === 'texte') {
        const t = HOME_ROUTES_4.includes(r) ? n(html) : pageContent(r, html).text.split('\n').map(n).join('\n');
        if (!t.includes(n(e.nouveau))) errors.push(`${e.id} : ${r} n'a pas « ${e.nouveau} »`);
        if (e.ancien !== '' && !PRESENTATION_ONLY.includes(e.id) && !e.html && t.includes(n(e.ancienV7 ?? e.ancien))) errors.push(`${e.id} : ${r} garde « ${e.ancienV7 ?? e.ancien} »`);
      } else if (e.champ === 'alt') {
        const alts = pageContent(r, html).images.map((i) => n(i.alt ?? ''));
        if (!alts.includes(n(e.nouveau)) || alts.includes(n(e.ancien))) errors.push(`${e.id} : ${r} alt = ${JSON.stringify(alts)}`);
      } else {
        const k = e.champ === 'description' ? 'description' : e.champ;
        if (JSON.stringify(metas(html, k)) !== JSON.stringify([n(e.nouveau)])) errors.push(`${e.id} : ${r} ${k} = ${JSON.stringify(metas(html, k))}`);
      }
    }
  assert.deepEqual(errors, [], `${errors.length} écart(s)\n${errors.join('\n')}`);
});
