// Contrat du lot 2b, P5 : non-régression. Les 16 routes du lot 2a et la 404 gardent leur HTML (document normalisé :
// scripts retirés, noms hachés remplacés) identique à la référence 6d9e441 du mode détecté, hors les seuls changements
// de P4 sur les deux accueils (neutralizeHome). Aucun numéro de téléphone sur les nouvelles pages ; data/profil.json
// jamais cité dans l'export ; la copie versionnée des textes publics couvre les nouveaux textes (§2, §4).
// Les budgets (E14) et la non-régression des pages secondaires face à 4ed945b (E15) restent dans leurs fichiers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BASELINE_2B, DETAIL_SPECS, HOME_NAMES, OLD_ROUTES, bodyHtml, headHtml, neutralizeHome, normalizedDocument, pageDigest, readPage, textLines } from './helpers-2b.ts';
import type { Baseline2b } from './helpers-2b.ts';
import { FAITS_FILE, bpceReference, ecole42Reference, faitsPresent, fixture, parseFaits42, parseFaitsBpce } from './helpers-faits.ts';
import { assertDistExists, distDir, siteDir } from './helpers.ts';
import { pageHtml } from './helpers-scene.ts';

function baseline(): Baseline2b {
  const file = join(siteDir, 'tests', 'fixtures', BASELINE_2B);
  if (!existsSync(file)) throw new Error(`référence absente : ${file}`);
  return JSON.parse(readFileSync(file, 'utf8')) as Baseline2b;
}

test('P5 : la référence 6d9e441 couvre les 16 routes du lot 2a et la 404, dans les deux modes', () => {
  const ref = baseline();
  assert.equal(ref.commit, '6d9e441');
  for (const mode of ['preview', 'public'] as const) assert.deepEqual(Object.keys(ref.pages[mode]).sort(), [...OLD_ROUTES, '/404.html'].sort(), `référence ${mode}`);
  assert.notDeepEqual(ref.pages.preview, ref.pages.public, 'les deux modes doivent différer (méta robots)');
});

// P5 « les 16 routes du lot 2a et la 404 ont le HTML de 6d9e441 » : remplacé au lot 4 par q3-contenu.test.ts (pages
// intérieures et 404 : contenu = a040fb0) et q2-coquille.test.ts (accueils = a040fb0 hors Q1 et Q6, HOME_CHANGES).
// Le passage de DEFAULT_PALETTE à foret (contrat lot 4, Q1) change les jetons écrits dans le HTML des accueils.

test('P5 (témoins) : la neutralisation efface les seuls ajouts de P4 ; tout autre changement d\'un accueil ou d\'une page change l\'empreinte', () => {
  assertDistExists();
  const names = HOME_NAMES();
  for (const route of ['/', '/fr/']) {
    const html = pageHtml(route);
    const p = route === '/fr/' ? '/fr/' : '/';
    // Ajouts de P4 simulés sur l'export actuel : lien de fiche BPCE et École 42, noms du repli en liens.
    let withP4 = html;
    for (const id of ['bpce', 'ecole-42']) {
      withP4 = withP4.replace(new RegExp(`(<article data-card="${id}"[\\s\\S]*?<div data-card-actions="">)`), `$1<a data-card-link="" href="${p}experiences/${id}/">Lire</a>`);
    }
    for (const name of names) withP4 = withP4.replace(`<span class="tree-fallback-name">${name}</span>`, `<a class="tree-fallback-name" href="${p}experiences/x/">${name}</a>`);
    if (!html.includes('<span class="tree-fallback-name">BPCE</span>')) {
      // Export déjà modifié par le lot 2b : le témoin porte alors sur l'export lui-même.
      assert.equal(normalizedDocument(neutralizeHome(html, names)), normalizedDocument(neutralizeHome(withP4, names)));
    } else {
      assert.notEqual(withP4, html, `${route} : les ajouts simulés de P4 n'ont pas pris`);
      assert.equal(pageDigest(route, withP4), pageDigest(route, html), `${route} : la neutralisation doit effacer les ajouts de P4`);
    }
    const mutations: [string, string][] = [
      ['lien de fiche BNP modifié', html.replace(/(<article data-card="bnp-paribas"[\s\S]*?<a data-card-link="" href=")[^"]*/, '$1/ailleurs/')],
      ['texte d\'une fiche', html.replace(/(<article data-card="bpce"[\s\S]*?<p data-card-result="">)/, '$1x')],
      ['lien ajouté dans la fiche Croix-Rouge', html.replace(/(<article data-card="croix-rouge"[\s\S]*?<div data-card-actions="">)/, '$1<a href="/x/">x</a>')],
      ['lien de navigation ajouté', html.replace(/(<nav\b[^>]*>)/, '$1<a href="/experiences/bpce/">BPCE</a>')],
      ['méta-description changée', html.replace(/(<meta name="description" content=")/, '$1x')],
    ];
    for (const [label, m] of mutations) {
      assert.notEqual(m, html, `${route} : mutation « ${label} » sans effet`);
      assert.notEqual(pageDigest(route, m), pageDigest(route, html), `${route} : « ${label} » doit changer l'empreinte`);
    }
  }
  const bnp = pageHtml('/experiences/bnp-paribas/');
  const nav = bnp.replace(/(<nav\b[^>]*>)/, '$1<a href="/experiences/bpce/">BPCE</a>');
  assert.notEqual(pageDigest('/experiences/bnp-paribas/', nav), pageDigest('/experiences/bnp-paribas/', bnp), 'un lien ajouté à la page BNP doit changer l\'empreinte');
});

// ---- Confidentialité ----

const PHONE = /(?:\+33|\b0)\s*[1-9](?:[\s.-]*\d{2}){4}\b/;

test('P5 : aucun numéro de téléphone ni lien tel: sur les quatre nouvelles pages (texte, <head>, liens)', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const s of DETAIL_SPECS) {
    const html = readPage(distDir, s.dir);
    if (!html) {
      bad.push(`${s.route} : page absente`);
      continue;
    }
    if (/href\s*=\s*["']\s*(tel|callto|sms):/i.test(html)) bad.push(`${s.route} : lien téléphonique`);
    const text = [...textLines(bodyHtml(html)), headHtml(html)].join('\n');
    if (PHONE.test(text)) bad.push(`${s.route} : numéro « ${PHONE.exec(text)?.[0]} »`);
  }
  assert.deepEqual(bad, []);
});

test('P5 (témoin) : le motif de téléphone repère 06 12 34 56 78 et +33 6 12 34 56 78, pas 1 500 à 3 000 ni 2019–2026', () => {
  for (const x of ['06 12 34 56 78', '+33 6 12 34 56 78', '06.12.34.56.78']) assert.ok(PHONE.test(x), x);
  for (const x of ['1 500 à 3 000 collaborateurs', 'École 42 Paris, 2019–2026', '1,500–3,000 employees', '3–5 à 1–3 min']) assert.ok(!PHONE.test(x), x);
});

test('P5 : data/profil.json n\'est cité dans aucun fichier texte de l\'export', () => {
  assertDistExists();
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(html|rsc|js|mjs|css|json|txt|xml|svg)$/.test(e.name) && /profil\.json|data\/profil/.test(readFileSync(full, 'utf8'))) hits.push(relative(distDir, full));
    }
  };
  walk(distDir);
  assert.deepEqual(hits, []);
});

// ---- Copie versionnée des textes publics (F12) ----

test('P5 : la copie versionnée des textes publics couvre les textes des pages BPCE (§2) et École 42 (§4), synchronisés avec FAITS.md', (t) => {
  const { bpce, ecole42 } = fixture().faits;
  assert.ok(bpce && ecole42, 'copie : sections bpce et ecole42 absentes (régénérer tests/fixtures/textes-publics.json)');
  for (const l of ['fr', 'en'] as const) {
    for (const [k, v] of Object.entries({ role: bpce.role[l], dates: bpce.dates[l], sandbox: bpce.sandbox[l], trainingTitle: bpce.trainingTitle[l], training: bpce.training[l], paragraph: ecole42.paragraph[l] })) {
      assert.ok(v && v.length > 0, `copie : ${k} (${l}) vide`);
    }
  }
  assert.equal(ecole42.line, 'École 42 Paris, 2019–2026', 'copie : ligne de formation');
  assert.deepEqual([bpce.name, ecole42.name], ['BPCE', 'École 42 Paris'], 'copie : noms (h1)');
  assert.deepEqual(HOME_NAMES(), [bpceReference().name, ecole42Reference().name]);
  if (!faitsPresent()) {
    t.diagnostic(`FAITS.md absent (${FAITS_FILE}) : seule la forme de la copie est vérifiée`);
    return;
  }
  const text = readFileSync(FAITS_FILE, 'utf8');
  assert.deepEqual(bpce, parseFaitsBpce(text), 'copie §2 désynchronisée de FAITS.md');
  assert.deepEqual(ecole42, parseFaits42(text), 'copie §4 désynchronisée de FAITS.md');
});
