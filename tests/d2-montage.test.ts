// Contrat D2 (lot 1c) : montage de TreeHero sur l'accueil, contenu HTML lisible sans JavaScript, couleurs, retrait de client-proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkScriptPath, distDir, h1Count, htmlFiles, modeFlags, parseReport, readManifest, routesOf, runPython } from './helpers.ts';
import { faitsCommons } from './helpers-faits.ts';
import {
  HOME_ROUTES,
  anchorsOf,
  attrValue,
  elementsWithAttr,
  engine,
  exportPages,
  jsUrls,
  pageHtml,
  readSrc,
  readUrl,
  requireDist,
  siteCodeFiles,
  siteDir,
  stripCode,
  visibleText,
} from './helpers-scene.ts';

const localeOf = (route: string): 'fr' | 'en' => (route.startsWith('/fr/') ? 'fr' : 'en');

function heroOf(route: string): { open: string; inner: string; outer: string } {
  const heroes = elementsWithAttr(pageHtml(route), 'data-tree-hero');
  assert.equal(heroes.length, 1, `${route} : exactement un élément [data-tree-hero] attendu, reçu ${heroes.length}`);
  const h = heroes[0];
  assert.ok(h);
  return h;
}

// Ligne « Lien du premier écran » de FAITS §7 (FAITS.md, ou sa copie versionnée : F12, audit Fable).
function faitsCaseLink(): { fr: string; en: string } {
  const { caseLink } = faitsCommons();
  return { fr: caseLink.fr, en: caseLink.en };
}

test('D2.1 (mis à jour au lot 2b, P1) : le manifeste compte 20 routes et check-export compte 20 routes sans erreur', () => {
  // D2.1 : aucune nouvelle route au 1c ; le lot 2b ajoute experiences/bpce/ et experiences/ecole-42/ (20 routes).
  requireDist();
  assert.equal(routesOf(readManifest().paths).length, 20, 'le manifeste doit compter 20 routes (lot 2b)');
  const r = runPython([checkScriptPath, ...modeFlags(distDir)]);
  const report = parseReport(r.stdout);
  assert.equal(report.routes, 20, `report.routes attendu 20, reçu ${String(report.routes)}`);
  assert.deepEqual(report.errors, []);
  // Le bloc de l'arbre doit exister pour que ce contrôle porte sur l'export du 1c.
  heroOf('/');
});

test('D2.1 (réécrit au 2a, E15.3) : / et /fr/ contiennent exactement un [data-tree-hero], premier enfant de <main>, suivi des sections de E8 dans l\'ordre de Q-R4', () => {
  // D2.1 : lieu du montage ; « avant la section .hero » devient l'ordre de E1.2 (projects, hackathons, about, contact ;
  // faq depuis le lot 6a, V1 et Q-R4).
  for (const route of HOME_ROUTES) {
    const html = pageHtml(route);
    const hero = heroOf(route);
    const main = /<main\b[^>]*>/i.exec(html);
    assert.ok(main, `${route} : <main> absent`);
    const afterMain = html.slice((main.index ?? 0) + main[0].length).trimStart();
    const heroOpen = /^<([a-zA-Z][\w-]*)\b([^>]*)>/.exec(afterMain);
    assert.ok(heroOpen && /(?:^|\s)data-tree-hero(?=[\s=/>]|$)/i.test(heroOpen[2] ?? ''), `${route} : [data-tree-hero] doit être le premier enfant de <main>`);
    const heroEnd = html.indexOf(hero.outer) + hero.outer.length;
    const rest = html.slice(heroEnd, html.search(/<\/main>/i));
    const order = [...rest.matchAll(/<section\b[^>]*\sdata-home-section="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(order, ['projects', 'hackathons', 'about', 'contact', 'faq'], `${route} : sections attendues après le bloc, dans <main>`);
    assert.doesNotMatch(html, /<section\b[^>]*class="[^"]*\bhero\b[^"]*"/, `${route} : l'ancienne section .hero ne doit plus exister`);
    assert.equal(elementsWithAttr(hero.inner, 'data-home-section').length, 0, `${route} : aucune section dans le bloc`);
  }
});

test('D2.1 : aucune autre page exportée (18 routes et la 404, lot 2b) ne contient [data-tree-hero]', () => {
  // D2.1 : TreeHero seulement sur l'accueil.
  const others = exportPages().filter((p) => !HOME_ROUTES.includes(p.route));
  assert.equal(others.length, 19, '18 routes et la 404 attendues (lot 2b)');
  const bad = others.filter((p) => /(?:\s)data-tree-hero(?=[\s=/>])/i.test(p.html)).map((p) => p.route);
  assert.deepEqual(bad, [], `pages hors accueil avec [data-tree-hero] : ${bad.join(', ')}`);
  heroOf('/');
});

test('D2.2 (complété au 2a, E15.3) : TreeHero n\'ajoute aucun h1 (un seul h1 par page d\'accueil, aucun dans le bloc, celui de l\'en-tête)', () => {
  // D2.2 : un seul h1 par page.
  for (const route of HOME_ROUTES) {
    const hero = heroOf(route);
    assert.equal(h1Count(hero.inner), 0, `${route} : le bloc de l'arbre ne doit contenir aucun h1`);
    assert.equal(h1Count(pageHtml(route)), 1, `${route} : exactement un h1`);
    // E1.4 (complément du 2a) : le h1 est dans l'en-tête de l'accueil.
    const headers = elementsWithAttr(pageHtml(route), 'data-site-header');
    assert.equal(headers.length, 1, `${route} : exactement un [data-site-header]`);
    assert.equal(h1Count(headers[0]?.inner ?? ''), 1, `${route} : le h1 doit être dans [data-site-header]`);
  }
});

test('D2.3 (réécrit F14) : la phrase BNP est dans <p data-tree-bnp elementtiming="bnp-sentence">, texte exact de FAITS §7 (et de experiences[bnp-paribas][locale].description)', async () => {
  // D2.3 : phrase du premier écran, lisible sans JavaScript.
  const { experiences } = await engine.experiences();
  for (const route of HOME_ROUTES) {
    const hero = heroOf(route);
    const ps = elementsWithAttr(hero.inner, 'data-tree-bnp');
    assert.equal(ps.length, 1, `${route} : exactement un [data-tree-bnp] dans le bloc`);
    const p = ps[0];
    assert.ok(p);
    assert.equal(p.tag, 'p', `${route} : [data-tree-bnp] doit être un <p>`);
    assert.equal(attrValue(p.open, 'elementtiming'), 'bnp-sentence', `${route} : elementtiming="bnp-sentence" attendu`);
    // F14 (audit Fable) : la référence est FAITS §7 (ou sa copie versionnée), plus la source qui produit la phrase.
    const want = faitsCommons().bnpSentence[localeOf(route)].replace(/\s+/g, ' ').trim();
    assert.equal(visibleText(p.inner), want, `${route} : phrase BNP ≠ FAITS §7 « Phrase BNP du premier écran »`);
    assert.equal(experiences['bnp-paribas'][localeOf(route)].description, want, `${route} : experiences.ts description ≠ FAITS §7`);
  }
});

test('D2.3 (réécrit au 2a, E15.3) : le lien « Lire le cas BNP Paribas » / « Read the BNP Paribas case » est unique dans [data-tree-copy], mène à la page BNP de la langue ; un éventuel second dans la fiche BNP a la même cible', async () => {
  // D2.3 : libellé ajouté à content/experiences.ts sous le nom caseLink (FAITS §7).
  const mod = await engine.experiences();
  const caseLink = (mod.caseLink ?? mod.experiences?.['bnp-paribas']?.caseLink) as Record<string, string> | undefined;
  assert.ok(caseLink, 'content/experiences.ts : caseLink absent');
  assert.deepEqual({ fr: caseLink.fr, en: caseLink.en }, { fr: 'Lire le cas BNP Paribas', en: 'Read the BNP Paribas case' });
  const faits = faitsCaseLink();
  assert.deepEqual({ fr: caseLink.fr, en: caseLink.en }, faits, 'caseLink diffère de FAITS §7');
  assert.match(readSrc('content/experiences.ts'), /caseLink[\s\S]{0,400}FAITS\s*§\s*7|FAITS\s*§\s*7[\s\S]{0,400}caseLink/, 'commentaire de source FAITS §7 attendu près de caseLink');
  for (const route of HOME_ROUTES) {
    const loc = localeOf(route);
    const want = loc === 'fr' ? '/fr/experiences/bnp-paribas/' : '/experiences/bnp-paribas/';
    const label: string = caseLink[loc] ?? '';
    // Décision de l'orchestrateur : unique dans la phrase BNP du premier écran ([data-tree-copy]).
    const copies = elementsWithAttr(heroOf(route).inner, 'data-tree-copy');
    assert.equal(copies.length, 1, `${route} : exactement un [data-tree-copy] dans le bloc`);
    const links = anchorsOf(copies[0]?.inner ?? '').filter((a) => a.text === label);
    assert.equal(links.length, 1, `${route} : un seul lien « ${label} » attendu dans [data-tree-copy]`);
    assert.equal(links[0]?.href, want, `${route} : cible du lien BNP`);
    // Ailleurs dans le bloc, seule la fiche BNP peut porter ce libellé, vers la même adresse.
    const outside = anchorsOf(heroOf(route).inner).filter((a) => a.text === label).length - 1;
    const cards = elementsWithAttr(heroOf(route).inner, 'data-card').filter((c) => attrValue(c.open, 'data-card') === 'bnp-paribas');
    const inCard = anchorsOf(cards[0]?.inner ?? '').filter((a) => a.text === label);
    assert.equal(outside, inCard.length, `${route} : « ${label} » hors de [data-tree-copy] ailleurs que dans la fiche BNP`);
    assert.ok(inCard.length <= 1, `${route} : au plus un lien « ${label} » dans la fiche BNP`);
    for (const a of inCard) assert.equal(a.href, links[0]?.href, `${route} : le lien de la fiche BNP doit avoir la même cible que celui de la phrase`);
  }
});

test('D2.3 : [data-tree-stage] contient [data-tree-fallback] et [data-tree-island], et aucun <canvas> n\'est exporté', () => {
  // D2.3 : structure du bloc ; la toile n'existe qu'après JavaScript.
  for (const route of HOME_ROUTES) {
    const stages = elementsWithAttr(heroOf(route).inner, 'data-tree-stage');
    assert.equal(stages.length, 1, `${route} : exactement un [data-tree-stage] dans le bloc`);
    const stage = stages[0]?.inner ?? '';
    assert.equal(elementsWithAttr(stage, 'data-tree-fallback').length, 1, `${route} : [data-tree-fallback] dans [data-tree-stage]`);
    assert.equal(elementsWithAttr(stage, 'data-tree-island').length, 1, `${route} : [data-tree-island] dans [data-tree-stage]`);
  }
  const withCanvas = htmlFiles(distDir).filter((f) => /<canvas\b/i.test(readFileSync(f, 'utf8')));
  assert.deepEqual(withCanvas, [], 'aucun <canvas> dans le HTML exporté');
});

test('D2.4 : [data-tree-hero] porte data-tree-state="html", sans data-tree-reason, et un éventuel data-tree-profile ∈ {phone, desktop}', () => {
  // D2.4 : valeur exportée des attributs d'état.
  for (const route of HOME_ROUTES) {
    const hero = heroOf(route);
    assert.equal(attrValue(hero.open, 'data-tree-state'), 'html', `${route} : data-tree-state="html" attendu`);
    assert.equal(attrValue(hero.open, 'data-tree-reason'), undefined, `${route} : data-tree-reason absent hors repli`);
    const profile = attrValue(hero.open, 'data-tree-profile');
    if (profile !== undefined) assert.ok(['phone', 'desktop'].includes(profile), `${route} : data-tree-profile invalide « ${profile} »`);
  }
});

test('D2.6 (réécrit au 2a, E15.3) : le style en ligne de [data-home] porte toutes les variables de cssVariables(PALETTES[DEFAULT_PALETTE])', async () => {
  // D2.6 / E10.1 : variables posées côté serveur sur [data-home] ; la valeur de DEFAULT_PALETTE n'est pas supposée (E10.5).
  const { cssVariables } = await engine.color();
  const { PALETTES, DEFAULT_PALETTE } = await engine.palettes();
  const vars = cssVariables(PALETTES[DEFAULT_PALETTE]) as Record<string, string>;
  for (const route of HOME_ROUTES) {
    const homes = elementsWithAttr(pageHtml(route), 'data-home');
    assert.equal(homes.length, 1, `${route} : exactement un [data-home]`);
    const style = (attrValue(homes[0]?.open ?? '', 'style') ?? '').replace(/\s+/g, '');
    const decl = new Map(style.split(';').filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)] as [string, string]));
    for (const [k, v] of Object.entries(vars)) {
      assert.equal(decl.get(k)?.toLowerCase(), v.toLowerCase(), `${route} : ${k}:${v} attendu dans le style de [data-home], reçu « ${style} »`);
    }
    assert.equal(decl.get('--night')?.toLowerCase(), String(PALETTES[DEFAULT_PALETTE].bg).toLowerCase());
    assert.equal(decl.get('--ink')?.toLowerCase(), String(PALETTES[DEFAULT_PALETTE].ink).toLowerCase());
  }
});

test('D2.6 : color-scheme: dark n\'est posé ni par l\'attribut de <html> ni par celui de <body>, ni par une meta (E10.3 : le fond sombre de l\'accueil passe par le CSS)', () => {
  // D2.6 : inchangé au 2a (E15.3) ; color-scheme de <html> et <body> vient du CSS, pas d'un attribut.
  for (const route of HOME_ROUTES) {
    const html = pageHtml(route);
    heroOf(route);
    for (const tag of ['html', 'body']) {
      const open = new RegExp(`<${tag}\\b([^>]*)>`, 'i').exec(html)?.[1] ?? '';
      assert.doesNotMatch(open, /color-scheme\s*:\s*dark/i, `${route} : color-scheme: dark ne doit pas être posé sur <${tag}>`);
    }
    assert.doesNotMatch(html, /<meta[^>]*name="color-scheme"[^>]*content="[^"]*dark/i, `${route} : meta color-scheme dark interdite`);
  }
});

test('D2.7 : client-proof.tsx et client-proof-mark.ts sont supprimés, aucune référence client-proof dans les sources, experience-page rend un <p className="intro">', () => {
  // D2.7 [S-a] : retrait du composant de preuve du 1a.
  for (const rel of ['components/client-proof.tsx', 'components/client-proof-mark.ts']) {
    assert.equal(existsSync(join(siteDir, rel)), false, `${rel} doit être supprimé`);
  }
  const refs = siteCodeFiles().filter((rel) => /client-proof|ClientProof|clientProof/.test(readFileSync(join(siteDir, rel), 'utf8')));
  assert.deepEqual(refs, [], `références client-proof restantes : ${refs.join(', ')}`);
  const page = stripCode(readSrc('components/experience-page.tsx'));
  assert.match(page, /<p\s+className=["']intro["']\s*>/, 'experience-page.tsx doit rendre un <p className="intro"> ordinaire');
});

test('D2.7 : aucune occurrence de client-proof dans l\'export, et les pages BNP ne chargent aucun script de plus que /projects/', () => {
  // D2.7 [S-b] : les pages BNP n'embarquent plus aucun composant client propre à l'application.
  requireDist();
  const hits = [...htmlFiles(distDir).filter((f) => readFileSync(f, 'utf8').includes('client-proof')), ...jsUrls().filter((u) => u.includes('client-proof') || readUrl(distDir, u).includes('client-proof'))];
  assert.deepEqual(hits, [], `client-proof présent dans l'export : ${hits.join(', ')}`);
  const scripts = (route: string): Set<string> =>
    new Set([...pageHtml(route).matchAll(/(?:src|href)="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1] ?? ''));
  const base = scripts('/projects/');
  for (const route of ['/experiences/bnp-paribas/', '/fr/experiences/bnp-paribas/']) {
    const extra = [...scripts(route)].filter((u) => !base.has(u));
    assert.deepEqual(extra, [], `${route} : scripts propres à la page (composant client) : ${extra.join(', ')}`);
    assert.match(pageHtml(route), /<p class="intro">/, `${route} : <p class="intro"> ordinaire attendu`);
  }
});
