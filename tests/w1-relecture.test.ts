// Tour W (tmp/refonte-arbre/contrat-relecture-w.md ; décisions d'Arnaud des 25–26/11/2026) : au moins une garde par
// point du contrat, FR et EN (texte attendu présent, texte retiré absent), sur les pages exportées, llms.txt, le texte
// des CV publics exportés et, dans le dépôt complet, FAITS.md, CV-PUBLIC-SPEC.md et le fichier LinkedIn
// (helpers-w.ts, GUARDS). Puis les points de structure : surtitre BNP au gabarit BPCE (C1), libellés des fiches de
// l'arbre (W2), « French Red Cross » sur les pages anglaises (W2), og:locale (A15), espaces insécables (W3 3.1),
// « co-construit » insécable (W3 3.2), et ce que le contrat garde tel quel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRoute } from './helpers-4.ts';
import { assertDistExists, distDir } from './helpers.ts';
import { EN_PAGES, GUARDS, guardErrors, readWhere, whereName } from './helpers-w.ts';
import { norm } from './helpers-z.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir})`);
  return html;
};
const FR_PAGES = EN_PAGES.map((r) => (r === '/' ? '/fr/' : `/fr${r}`));

test('W (gardes) : chaque point du contrat W, FR et EN : texte attendu présent, texte retiré absent', (t) => {
  assertDistExists();
  const errors: string[] = [];
  for (const g of GUARDS) {
    const text = readWhere(g.where);
    if (text === null) {
      t.diagnostic(`absent ici (dépôt partiel ?) : ${whereName(g.where)}`);
      continue;
    }
    errors.push(...guardErrors(g, text));
  }
  assert.deepEqual(errors, [], `${errors.length} écart(s)\n${errors.join('\n')}`);
});

test('W (gardes, témoins) : une garde rougit sur l\'ancien texte et sur un texte sans l\'attendu', () => {
  const g = { point: 'témoin', where: { llms: true as const }, present: ['Prepares a draft'], absent: ['up to May 2025'] };
  assert.equal(guardErrors(g, 'Prepares a draft claim.').length, 0);
  assert.equal(guardErrors(g, 'Prepare a draft claim.').length, 1);
  assert.equal(guardErrors(g, 'Prepares a draft claim, up to May 2025.').length, 1);
});

test('W1 C1 : la page BNP porte, au-dessus du titre, le surtitre rôle · dates au gabarit de la page BPCE', () => {
  assertDistExists();
  const want: Record<string, [string, string]> = {
    '/experiences/bnp-paribas/': ['Data Scientist Intern', 'Sep 2025 – Mar 2026'],
    '/fr/experiences/bnp-paribas/': ['Data Scientist (stage)', 'sept. 2025 – mars 2026'],
  };
  const errors: string[] = [];
  const gabarit = /<header class="page-intro"><p class="eyebrow">([^<]*)<!-- --> · <span class="tree-nowrap">([^<]*)<\/span><\/p><h1>/;
  for (const [route, [role, dates]] of Object.entries(want)) {
    const m = gabarit.exec(page(route));
    if (!m) errors.push(`${route} : pas de surtitre au gabarit BPCE avant le h1`);
    else if (norm(m[1] as string) !== norm(role) || norm(m[2] as string) !== norm(dates)) errors.push(`${route} : surtitre « ${m[1]} · ${m[2]} »`);
  }
  for (const route of ['/experiences/bpce/', '/fr/experiences/bpce/']) if (!gabarit.test(page(route))) errors.push(`${route} : gabarit de référence introuvable`);
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('W2 : fiches BPCE et École 42 de l\'arbre au libellé de la FAQ ; les autres fiches gardent le leur', () => {
  assertDistExists();
  const want: Record<string, Record<string, string>> = {
    '/': { '/experiences/bpce/': 'Read the BPCE case', '/experiences/ecole-42/': 'See the curriculum', '/experiences/bnp-paribas/': 'Read the BNP Paribas case', '/projects/croix-rouge/': 'Read the story', '/projects/droit-de-retard/': 'Read the story' },
    '/fr/': { '/fr/experiences/bpce/': 'Lire le cas BPCE', '/fr/experiences/ecole-42/': 'Voir la formation', '/fr/experiences/bnp-paribas/': 'Lire le cas BNP Paribas', '/fr/projects/croix-rouge/': 'Lire le récit', '/fr/projects/droit-de-retard/': 'Lire le récit' },
  };
  const errors: string[] = [];
  for (const [route, links] of Object.entries(want)) {
    const html = page(route);
    for (const [href, text] of Object.entries(links)) {
      const got = [...html.matchAll(new RegExp(`<a data-card-link="" href="${href}">([^<]*)</a>`, 'g'))].map((m) => norm(m[1] as string));
      if (got.length === 0 || got.some((x) => x !== norm(text))) errors.push(`${route} : fiche ${href} → ${JSON.stringify(got)}, « ${text} » attendu`);
    }
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('W2 : sur les pages anglaises, « Croix-Rouge » seulement dans le nom de l\'événement « IA & Crise · Croix-Rouge / Simplon »', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of EN_PAGES) {
    // The RSC payload escapes « & » as \u0026.
    const left = norm((readWhere({ route }) as string).replace(/\\u0026/g, '&')).split('IA & Crise · Croix-Rouge / Simplon').join('');
    const i = left.indexOf('Croix-Rouge');
    if (i >= 0) errors.push(`${route} : « …${left.slice(Math.max(0, i - 50), i + 30)}… »`);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('W4 A15 : og:locale en_GB sur les dix pages anglaises, fr_FR inchangé sur les pages françaises', () => {
  assertDistExists();
  const locale = (html: string): string[] => [...html.matchAll(/<meta\b[^>]*property="og:locale"[^>]*content="([^"]*)"/g)].map((m) => m[1] as string);
  const errors: string[] = [];
  for (const r of EN_PAGES) if (JSON.stringify(locale(page(r))) !== '["en_GB"]') errors.push(`${r} : ${JSON.stringify(locale(page(r)))}`);
  for (const r of FR_PAGES) if (JSON.stringify(locale(page(r))) !== '["fr_FR"]') errors.push(`${r} : ${JSON.stringify(locale(page(r)))}`);
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('W3 3.1 : espace insécable entre le nombre et son unité ou ses milliers (BPCE, BNP, Diary, alt de partage droit-de-retard)', () => {
  assertDistExists();
  const NB = '[\\u00a0\\u202f]|&nbsp;|&#160;';
  const want: Record<string, string[]> = {
    '/fr/experiences/bpce/': ['1(?:NB)500', '3(?:NB)000', 'à 1(?:NB)h'],
    '/fr/experiences/bnp-paribas/': ['95(?:NB)%', '0,40(?:NB)€', '600(?:NB)Go', '3–5(?:NB)min', '1–3(?:NB)min'],
    '/fr/projects/diary/': ['16(?:NB)kHz'],
    '/fr/projects/droit-de-retard/': ['og:image:alt" content="droit-de-retard(?:NB): aperçu'],
  };
  const errors: string[] = [];
  for (const [route, pats] of Object.entries(want)) {
    const html = page(route);
    const main = /<main\b[\s\S]*?<\/main>/.exec(html)?.[0] ?? '';
    for (const p of pats) {
      const re = new RegExp(p.replaceAll('NB', NB), 'g');
      const where = p.startsWith('og:') ? html : main;
      if (!re.test(where)) errors.push(`${route} : « ${p.replaceAll('(?:NB)', '⍽')} » sans espace insécable`);
      const loose = new RegExp(p.replaceAll('(?:NB)', ' '), 'g');
      if (loose.test(where)) errors.push(`${route} : « ${p.replaceAll('(?:NB)', ' ')} » avec une espace sécable`);
    }
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('W3 3.2 : « co-construit » ne se coupe pas dans la fiche Croix-Rouge de l\'arbre (/fr/)', () => {
  assertDistExists();
  const html = page('/fr/');
  const wrapped = html.split('RAG <span class="tree-nowrap">co-construit</span>').length - 1;
  const bare = html.split('RAG co-construit</').length - 1;
  assert.ok(wrapped >= 2, `fiche Croix-Rouge : « co-construit » enveloppé ${wrapped} fois (rendu interactif et repli attendus)`);
  assert.equal(bare, 0, 'fiche Croix-Rouge : « co-construit » encore sécable');
});

test('W (inchangé) : BNP « validé pour la production par le comité de pilotage », BPCE « Ce POC ne tournait pas en production. », École 42 sans titre', () => {
  assertDistExists();
  const has = (route: string, s: string): boolean => norm(page(route)).includes(norm(s));
  const errors: string[] = [];
  if (!has('/fr/experiences/bnp-paribas/', 'a été validé pour la production par le comité de pilotage')) errors.push('BNP FR');
  if (!has('/experiences/bnp-paribas/', 'The tool was approved for production by the steering committee')) errors.push('BNP EN');
  if (!has('/fr/experiences/bpce/', 'Ce POC ne tournait pas en production.')) errors.push('BPCE FR');
  for (const r of ['/experiences/ecole-42/', '/fr/experiences/ecole-42/']) if (/RNCP|bac\s*\+\s*5|master/i.test(norm(page(r)))) errors.push(`${r} : titre`);
  assert.deepEqual(errors, [], errors.join('\n'));
});
