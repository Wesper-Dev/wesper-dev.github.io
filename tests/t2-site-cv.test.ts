// Lot 5, T3 (tmp/refonte-arbre/contrat-lot5.md) : site aligné sur le CV public et sur FAITS.md.
// - Bouton CV de l'en-tête et bloc CV de Compétences pointés sur les PDF servis (mêmes URL, Q-R8) ;
// - jobTitle, descriptions et JSON-LD alignés sur « Ingénieur logiciel » / « Software Engineer » ; plus aucun
//   « Applied AI Engineer » dans l'export (HTML, .rsc, JS, JSON, PDF) ;
// - aucune disponibilité périmée dans l'export, dans site/content/* ni dans la copie de scripts/export-copy.mjs ;
// - BPCE au passé ; « déterministes » et « 120+ » retirés (K19) ; Fitness 42 et Croix-Rouge selon FAITS §6.3 et §3 ;
// - CI : Poppler installé avant npm test (t1 en dépend).
// Le téléchargement en navigateur (200, application/pdf, octets) est dans tmp/refonte-arbre/verif-5/verif.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { assertDistExists, distDir, readManifest, routesOf, siteDir, workflowPath } from './helpers.ts';
import { filesUnder, readRoute, rel } from './helpers-4.ts';
import { AVAILABILITY, CV_URL, LANGS, TITLE, type Lang, exportedPdf, pdfText, servedPdf } from './helpers-pdf.ts';

const tmp: string[] = [];
after(() => tmp.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const ROUTES = (): string[] => [...routesOf(readManifest().paths), '/404.html'];
const langOf = (r: string): Lang => (r.startsWith('/fr/') ? 'fr' : 'en');
const page = (r: string): string => {
  const h = readRoute(distDir, r);
  if (!h) throw new Error(`${r} : page absente de l'export (${distDir})`);
  return h;
};
const attrs = (tag: string): Record<string, string> => Object.fromEntries([...tag.matchAll(/([\w:-]+)(?:\s*=\s*"([^"]*)")?/g)].slice(1).map((m) => [m[1]!.toLowerCase(), m[2] ?? '']));
const anchors = (html: string): Record<string, string>[] => [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attrs(m[0]));
const decode = (s: string): string => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const metas = (html: string, key: string): string[] =>
  [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0])).filter((a) => a.name === key || a.property === key).map((a) => decode(a.content ?? ''));
const jsonLd = (html: string): unknown[] => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => JSON.parse(m[1]!));
const walk = (v: unknown, fn: (o: Record<string, unknown>) => void): void => {
  if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
  else if (v && typeof v === 'object') {
    fn(v as Record<string, unknown>);
    Object.values(v).forEach((x) => walk(x, fn));
  }
};
// Fichiers texte de l'export : tout ce qu'un visiteur, un robot ou un LLM peut lire.
const TEXT_EXT = new Set(['.html', '.rsc', '.js', '.mjs', '.json', '.txt', '.xml', '.css', '.md', '.webmanifest', '.svg']);
const exportTexts = (): [string, string][] => filesUnder(distDir).filter((f) => TEXT_EXT.has(extname(f))).map((f) => [rel(distDir, f), readFileSync(f, 'utf8')]);
const contentFiles = (): [string, string][] => filesUnder(join(siteDir, 'content')).map((f) => [rel(siteDir, f), readFileSync(f, 'utf8')]);
const jobTitles = async (): Promise<Record<Lang, string>> => (await import('../content/experiences.ts')).jobTitle as Record<Lang, string>;

// ---------------- Bouton CV et bloc CV ----------------

test('T3 (Q-R8, Q-R12) : chaque page (20 routes et 404) a un seul bouton CV d\'en-tête vers le PDF de sa langue (type application/pdf, hreflang), présent dans l\'export', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const r of ROUTES()) {
    const l = langOf(r);
    const cv = anchors(page(r)).filter((a) => 'data-site-cv' in a);
    if (cv.length !== 1) bad.push(`${r} : ${cv.length} bouton(s) CV d'en-tête`);
    for (const a of cv) {
      if (a.href !== CV_URL(l)) bad.push(`${r} : href ${a.href} (attendu ${CV_URL(l)})`);
      if (a.type !== 'application/pdf') bad.push(`${r} : type ${a.type}`);
      if ((a.hreflang ?? '') !== l) bad.push(`${r} : hreflang ${a.hreflang}`);
    }
  }
  for (const l of LANGS) if (!existsSync(exportedPdf(l)) || !existsSync(servedPdf(l))) bad.push(`${CV_URL(l)} absent de l'export ou de public/cv`);
  assert.deepEqual(bad, []);
});

test('T3 : bloc CV de Compétences (FR et EN) vers les deux PDF ; plus de « mêmes formulations » / « identical wording » ni de libellé « IA appliquée » / « Applied AI » pour le CV', () => {
  const bad: string[] = [];
  for (const r of ['/skills/', '/fr/skills/']) {
    const html = page(r);
    const block = /<section[^>]*class="skills-cv"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
    if (!block) {
      bad.push(`${r} : section .skills-cv absente`);
      continue;
    }
    for (const l of LANGS) {
      const a = anchors(block).find((x) => x.href === CV_URL(l));
      if (!a) bad.push(`${r} : lien ${CV_URL(l)} absent du bloc CV`);
      else if (a.type !== 'application/pdf' || a.hreflang !== l) bad.push(`${r} : lien ${CV_URL(l)} sans type application/pdf ou hreflang ${l}`);
    }
    const text = decode(block.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    if (/identical wording|mêmes formulations/i.test(text)) bad.push(`${r} : « identical wording / mêmes formulations » (le CV public diffère des CV de candidature, spec §4.7)`);
    const labels = [...block.matchAll(/class="cv-track-label"[^>]*>([^<]*)</g)].map((m) => decode(m[1]!).trim());
    for (const x of labels) if (/^(?:applied ai|ia appliquée)$/i.test(x)) bad.push(`${r} : libellé du CV « ${x} » (spec §4.7, :53,91)`);
  }
  assert.deepEqual(bad, []);
});

// ---------------- Titre et métadonnées ----------------

test('T3 (Q-R10) : tout jobTitle du JSON-LD de l\'export = jobTitle de content/experiences.ts dans la langue de la page ; les pages Compétences en portent un', async () => {
  const jt = await jobTitles();
  assert.deepEqual(jt, TITLE, 'content/experiences.ts jobTitle ≠ FAITS §7');
  const bad: string[] = [];
  for (const r of ROUTES()) {
    const found: unknown[] = [];
    for (const d of jsonLd(page(r))) walk(d, (o) => 'jobTitle' in o && found.push(o.jobTitle));
    for (const v of found) if (v !== jt[langOf(r)]) bad.push(`${r} : JSON-LD jobTitle ${JSON.stringify(v)} (attendu « ${jt[langOf(r)]} »)`);
    if (r.endsWith('/skills/') && !found.length) bad.push(`${r} : JSON-LD Person sans jobTitle`);
  }
  assert.deepEqual(bad, []);
});

test('T3 (Q-R10) : descriptions des accueils (description, og:description, twitter:description) au titre « Software Engineer » / « ingénieur logiciel » ; aucun <title> ni description de l\'export ne porte un ancien titre', async () => {
  const jt = await jobTitles();
  const bad: string[] = [];
  for (const r of ROUTES()) {
    const html = page(r);
    const values = [...['description', 'og:description', 'twitter:description', 'og:title', 'twitter:title'].flatMap((k) => metas(html, k)), ...[...html.matchAll(/<title>([^<]*)<\/title>/gi)].map((m) => decode(m[1]!))];
    for (const v of values) if (/applied ai engineer|ai platform engineer|python developer|développeur python/i.test(v)) bad.push(`${r} : ancien titre dans « ${v} »`);
    if (r === '/' || r === '/fr/') {
      for (const k of ['description', 'og:description', 'twitter:description']) {
        const v = metas(html, k);
        if (!v.length) bad.push(`${r} : ${k} absente`);
        for (const x of v) if (!x.toLowerCase().includes(jt[langOf(r)].toLowerCase())) bad.push(`${r} : ${k} « ${x} » sans « ${jt[langOf(r)]} »`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('T3 : plus aucun « Applied AI Engineer » dans l\'export (HTML, .rsc, JS, JSON, texte) ni dans le texte des deux PDF', () => {
  assertDistExists();
  const bad = exportTexts().filter(([, t]) => /applied\s+ai\s+engineer/i.test(t)).map(([f]) => f);
  for (const l of LANGS) if (/applied\s+ai\s+engineer/i.test(pdfText(exportedPdf(l)))) bad.push(CV_URL(l));
  assert.deepEqual(bad, []);
});

// ---------------- Disponibilité ----------------

const STALE: RegExp = /16\s*(?:octobre|oct\.|october)|(?:october|oct\.)\s*16\b|à\s+partir\s+du\s+16|from\s+16\s+oct|après\s+le\s+16|after\s+16\s+oct|recherche\s+d.un\s+CDI\s+à\s+partir|looking\s+for\s+a\s+permanent\s+role\s+from/i;
const staleHits = (files: [string, string][]): string[] =>
  files.flatMap(([f, t]) => {
    const m = STALE.exec(t.replace(/[  ]/g, ' '));
    return m ? [`${f} : « …${t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).replace(/\s+/g, ' ')}… »`] : [];
  });

test('T3 (Q-R7, témoins) : le motif de disponibilité périmée prend les formes FR/EN connues et laisse passer la disponibilité nouvelle et les dates de stage', () => {
  for (const s of ['À la recherche d’un CDI à partir du 16 octobre 2026', 'Looking for a permanent role from 16 October 2026', 'Available from October 16, 2026', 'Disponible à partir du 16 octobre', 'après le 16 octobre 2026']) assert.ok(STALE.test(s), s);
  for (const s of [AVAILABILITY.fr, AVAILABILITY.en, 'avr. 2026 – oct. 2026', 'Apr 2026 – Oct 2026', 'Sep 2025 – Mar 2026']) assert.ok(!STALE.test(s), s);
});

test('T3 (Q-R7) : aucune disponibilité périmée dans l\'export ni dans site/content/* (dont le champ non rendu de content/home.ts)', () => {
  assertDistExists();
  assert.deepEqual([...staleHits(exportTexts()), ...staleHits(contentFiles())], []);
});

test('T3 (Q-R7) : la copie de scripts/export-copy.mjs (rejouée dans un bac à sable) ne porte ni disponibilité périmée ni champ « undefined » ; les copies CONTENUS-*.md du dépôt non plus quand elles sont présentes', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lot5-export-copy-'));
  tmp.push(root);
  cpSync(join(siteDir, 'content'), join(root, 'site', 'content'), { recursive: true });
  mkdirSync(join(root, 'site', 'scripts'), { recursive: true });
  cpSync(join(siteDir, 'scripts', 'export-copy.mjs'), join(root, 'site', 'scripts', 'export-copy.mjs'));
  const out = join(root, 'deliverables', 'portfolio-etapes-3-4');
  mkdirSync(out, { recursive: true });
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(root, 'site', 'scripts', 'export-copy.mjs')], { cwd: join(root, 'site'), encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, `export-copy.mjs : code ${r.status} ${r.stderr.slice(0, 400)}`);
  const files = readdirSync(out).map((f): [string, string] => [`export-copy → ${f}`, readFileSync(join(out, f), 'utf8')]);
  assert.equal(files.length, 2, 'deux copies attendues (FR, EN)');
  const bad = [...staleHits(files), ...files.filter(([, x]) => /\bundefined\b/.test(x)).map(([f]) => `${f} : « undefined »`)];
  const repo = ['FR', 'EN'].map((x) => join(siteDir, '..', 'deliverables', 'portfolio-etapes-3-4', `CONTENUS-${x}.md`)).filter((f) => existsSync(f));
  if (!repo.length) t.diagnostic('CONTENUS-*.md absents (dépôt limité à site/)');
  bad.push(...staleHits(repo.map((f): [string, string] => [rel(join(siteDir, '..'), f), readFileSync(f, 'utf8')])));
  assert.deepEqual(bad, []);
});

// ---------------- BPCE, tests de droit-de-retard, Fitness 42, Croix-Rouge, K16 ----------------

const MODULES = ['skills.ts', 'tree.ts', 'home.ts', 'experiences.ts', 'cards.ts', 'projects.json', 'hackathons.json', 'indexes.json'];
const modules = (): [string, string][] => MODULES.map((m) => join(siteDir, 'content', m)).filter((f) => existsSync(f)).map((f) => [rel(siteDir, f), readFileSync(f, 'utf8')]);

test('T3 (FAITS §2, §9.3) : BPCE au passé partout — ni « contributing » ni « je contribue » dans les modules de contenu, les pages Compétences, BPCE et les accueils', () => {
  const re = /\bcontributing\b|\bje contribue\b|\bI am contributing\b|\bI(?:'|’)m contributing\b/i;
  const bad = modules().filter(([, x]) => re.test(x)).map(([f]) => f);
  for (const r of ['/', '/fr/', '/skills/', '/fr/skills/', '/experiences/bpce/', '/fr/experiences/bpce/']) if (re.test(page(r).replace(/<script[\s\S]*?<\/script>/gi, ''))) bad.push(r);
  assert.deepEqual(bad, []);
});

test('T3 (K19, FAITS §5 A-09) : ni « déterministes » / « deterministic » ni « 120+ » dans l\'export ni dans site/content/* ; JSON-LD knowsAbout compris', () => {
  const re = /d[ée]terminist|\b120\s*\+/i;
  const bad = [...exportTexts(), ...contentFiles()].filter(([, x]) => re.test(x)).map(([f, x]) => `${f} : « ${re.exec(x)![0]} »`);
  for (const r of ['/skills/', '/fr/skills/']) for (const d of jsonLd(page(r))) walk(d, (o) => Array.isArray(o.knowsAbout) && o.knowsAbout.some((k) => re.test(String(k))) && bad.push(`${r} : knowsAbout`));
  assert.deepEqual(bad, []);
});

const FITNESS: Record<Lang, string> = {
  fr: 'Coach depuis plus de 3 ans : plus de 50 séances, dont plus de 20 menées seul, 15 à 20 personnes par séance.',
  en: 'Coach for 3+ years: 50+ sessions, 20+ of them solo-led, 15–20 participants each.',
};
test('T3 (FAITS §6.3) : Fitness 42 = formulation du 5 octobre (50+ séances), sans « 300+ » ni « 15+ séances », dans home.ts et sur l\'accueil', async () => {
  const { home } = (await import('../content/home.ts')) as { home: Record<Lang, { communities: { name: string; text: string }[] }> };
  const bad: string[] = [];
  const sp = (s: string): string => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
  for (const l of LANGS) {
    const c = home[l].communities.find((x) => x.name === 'Fitness 42');
    if (!c) bad.push(`home.${l} : Fitness 42 absent`);
    else if (sp(c.text) !== sp(FITNESS[l])) bad.push(`home.${l} Fitness 42 : « ${c.text} »`);
    const body = sp(decode(page(l === 'fr' ? '/fr/' : '/').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ')));
    if (!body.includes(sp(FITNESS[l]))) bad.push(`accueil ${l} : texte Fitness 42 non rendu`);
    if (/300\+|15\+ (?:séances|sessions)/.test(c?.text ?? '')) bad.push(`home.${l} : 300+ ou 15+`);
  }
  assert.deepEqual(bad, []);
});

test('T3 (FAITS §3) : rôle Croix-Rouge de projects.json « front du chatbot et RAG co-construit » / « the chatbot’s front end and co-built RAG », rendu sur Projets, la page Croix-Rouge et l\'accueil', () => {
  const projects = JSON.parse(readFileSync(join(siteDir, 'content', 'projects.json'), 'utf8')) as { id?: string; story?: string; fr: { role: string }; en: { role: string } }[];
  const cr = projects.find((p) => p.story === 'croix-rouge' || p.id === 'croix-rouge');
  assert.ok(cr, 'projet Croix-Rouge absent de projects.json');
  const want: Record<Lang, string> = { fr: 'front du chatbot et RAG co-construit', en: 'the chatbot’s front end and co-built RAG' };
  const old: Record<Lang, RegExp> = { fr: /front et RAG du chatbot/, en: /front end and RAG\b/ };
  const bad: string[] = [];
  for (const l of LANGS) {
    if (!cr![l].role.includes(want[l])) bad.push(`projects.json ${l}.role : « ${cr![l].role.slice(0, 80)}… »`);
    if (old[l].test(cr![l].role)) bad.push(`projects.json ${l}.role : ancienne formulation`);
    for (const r of l === 'fr' ? ['/fr/', '/fr/projects/', '/fr/projects/croix-rouge/'] : ['/', '/projects/', '/projects/croix-rouge/']) {
      const text = decode(page(r).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/[  ]/g, ' ');
      if (!text.includes(want[l])) bad.push(`${r} : « ${want[l]} » non rendu`);
    }
  }
  assert.deepEqual(bad, []);
});

test('T3 (K16) : aucune revendication de PyTorch ou LeRobot (skills.ts, tree.ts, knowsAbout) ; témoin : le hackathon LeRobot reste sur la page Hackathons', () => {
  const re = /pytorch|le\s*robot/i;
  const bad = modules().filter(([f, x]) => /skills\.ts|tree\.ts/.test(f) && re.test(x)).map(([f]) => f);
  for (const r of ['/skills/', '/fr/skills/']) for (const d of jsonLd(page(r))) walk(d, (o) => Array.isArray(o.knowsAbout) && o.knowsAbout.some((k) => re.test(String(k))) && bad.push(`${r} : knowsAbout`));
  assert.deepEqual(bad, []);
  assert.ok(/LeRobot/.test(page('/hackathons/')) && /LeRobot/.test(page('/fr/hackathons/')), 'témoin : LeRobot Hackathon attendu sur Hackathons FR/EN');
});

// ---------------- CI ----------------

test('T2 (CI) : le workflow installe poppler-utils dans une étape antérieure à npm test, sans continue-on-error', () => {
  const yml = readFileSync(workflowPath, 'utf8');
  const steps = yml.split(/\n\s*- (?=name:|uses:|run:)/);
  const poppler = steps.findIndex((s) => /apt-get\s+install[^\n]*poppler-utils|apt\s+install[^\n]*poppler-utils/.test(s));
  const npmTest = steps.findIndex((s) => /run:\s*npm test\b|npm test\b/.test(s));
  assert.ok(poppler >= 0, 'aucune étape n\'installe poppler-utils (pdftotext, pdfinfo, pdfimages) : t1 rougirait en CI');
  assert.ok(npmTest > poppler, 'poppler-utils doit être installé avant npm test');
  assert.ok(!/continue-on-error:\s*true/.test(steps[poppler] ?? ''), 'installation de poppler-utils non bloquante');
});
