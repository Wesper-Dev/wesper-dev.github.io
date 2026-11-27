// Audit contradictoire Fable du lot 2a, point F13 (T3) : trous de la suite de texte. Adresse mailto: et lien LinkedIn
// comparés aux valeurs de référence du dépôt (BASE_DONNEES.md, ou sa copie versionnée : F12), <title> des accueils,
// logos glissés par image de fond CSS, <object>, <embed> ou <svg><image>.
// H13 (audit astra n° 3) : les trois titres sont jugés séparément sur les trois copies HTML des accueils.
// Survivantes de l'audit tuées ici : adresse mailto: fausse, LinkedIn vers un autre profil (P5), <title> « Senior AI
// Engineer » (T35), logo en image de fond data: (P12), logo en <object> (P13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contactReference, faitsCommons } from './helpers-faits.ts';
import { HOME_ROUTES, exportCss } from './helpers-home.ts';
import { decodeEntities, distDir } from './helpers.ts';
import { exportPages, pageHtml, requireDist } from './helpers-scene.ts';

const noScripts = (html: string): string => html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
const hrefs = (html: string): string[] => [...noScripts(html).matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => decodeEntities(m[1] ?? m[2] ?? ''));
const allHtml = (): { rel: string; html: string }[] => exportPages().map((p) => ({ rel: p.route, html: p.html }));

test('F13 : chaque lien mailto: de l\'export vaut l\'adresse de référence ; chaque accueil en a au moins un', () => {
  requireDist();
  const want = `mailto:${contactReference().mail}`;
  const bad: string[] = [];
  for (const { rel, html } of allHtml()) for (const h of hrefs(html)) if (/^mailto:/i.test(h) && h !== want) bad.push(`${rel} : ${h}`);
  assert.deepEqual(bad, [], `adresses mailto: différentes de la référence (${want})`);
  for (const route of HOME_ROUTES) assert.ok(hrefs(pageHtml(route)).includes(want), `${route} : aucun lien ${want}`);
});

test('F13 : chaque lien vers un profil LinkedIn (/in/) de l\'export vaut le profil de référence ; chaque accueil en a au moins un', () => {
  requireDist();
  const want = contactReference().linkedin;
  const bad: string[] = [];
  for (const { rel, html } of allHtml()) for (const h of hrefs(html)) if (/linkedin\.com\/in\//i.test(h) && h !== want) bad.push(`${rel} : ${h}`);
  assert.deepEqual(bad, [], `liens LinkedIn différents de la référence (${want})`);
  for (const route of HOME_ROUTES) assert.ok(hrefs(pageHtml(route)).includes(want), `${route} : aucun lien vers ${want}`);
});

// <title>, og:title et twitter:title : le nom, sans titre de poste autre que celui de FAITS §7, sans séniorité ni
// formule interdite (E16.2). La méta-description, reportée au lot 2b (C11 « Applied AI Engineer »), n'est pas jugée ici.
const SENIORITY = /\b(Senior|Sénior|Lead|Principal|Staff|Junior|Expert|Head|Chief|Confirmé|Confirmed)\b/i;
const JOB = /\b(Engineer|Ingénieure?|Developer|Développeur|Developpeur|Scientist|Architect|Architecte|Consultant|Manager)\b/i;
const FORBIDDEN = [/\bMaster\b/, /bac\+5/, /RNCP/, /Alumni/, /PyTorch/, /OpenShift/, /déterministe/i, /deterministic/i, /Applied AI Engineer/, /121 tests/];

// Copies HTML des accueils : index.html (EN), fr/index.html et fr.html (FR, copie servie sans barre finale).
const HOME_FILES: readonly { file: string; locale: 'fr' | 'en' }[] = [
  { file: 'index.html', locale: 'en' },
  { file: 'fr/index.html', locale: 'fr' },
  { file: 'fr.html', locale: 'fr' },
];

// H13 (audit astra n° 3) : <title>, og:title et twitter:title sont lus séparément dans <head>, et chacun doit être
// présent exactement une fois, non vide et conforme. Un titre manquant n'est plus masqué par les deux autres.
export function headTitles(html: string): { title: string[]; og: string[]; twitter: string[] } {
  const end = html.search(/<\/head>/i);
  const head = noScripts(end >= 0 ? html.slice(0, end) : html);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const content = (m: string): string => decodeEntities(/content\s*=\s*"([^"]*)"/i.exec(m)?.[1] ?? /content\s*=\s*'([^']*)'/i.exec(m)?.[1] ?? '').trim();
  const meta = (attr: 'property' | 'name', key: string): string[] => metas.filter((m) => new RegExp(`\\b${attr}\\s*=\\s*["']${key}["']`, 'i').test(m)).map(content);
  return {
    title: [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decodeEntities(m[1] ?? '').trim()),
    og: meta('property', 'og:title'),
    twitter: meta('name', 'twitter:title'),
  };
}

export function titleTagProblems(html: string, jobTitle: string): string[] {
  const t = headTitles(html);
  const out: string[] = [];
  for (const [k, list] of [['<title>', t.title], ['og:title', t.og], ['twitter:title', t.twitter]] as const) {
    if (list.length === 0) { out.push(`${k} absent`); continue; }
    if (list.length > 1) out.push(`${k} présent ${list.length} fois`);
    const v = list[0] as string;
    if (!v) { out.push(`${k} vide`); continue; }
    for (const p of titleProblems(v, jobTitle)) out.push(`${k} « ${v} » : ${p}`);
  }
  if (t.title[0] && t.og[0] && t.og[0] !== t.title[0]) out.push(`og:title « ${t.og[0]} » ≠ <title> « ${t.title[0]} »`);
  if (t.title[0] && t.twitter[0] && t.twitter[0] !== t.title[0]) out.push(`twitter:title « ${t.twitter[0]} » ≠ <title> « ${t.title[0]} »`);
  return out;
}

export function titleProblems(title: string, jobTitle: string): string[] {
  const out: string[] = [];
  if (!/^Arnaud Durand\b/.test(title)) out.push('ne commence pas par « Arnaud Durand »');
  const rest = title.split(jobTitle).join(' ');
  if (SENIORITY.test(title)) out.push(`séniorité « ${SENIORITY.exec(title)?.[0]} »`);
  if (JOB.test(rest)) out.push(`titre de poste « ${JOB.exec(rest)?.[0]} » autre que « ${jobTitle} » (FAITS §7)`);
  for (const f of FORBIDDEN) if (f.test(title)) out.push(`formule interdite ${f}`);
  return out;
}

test('F13 / H13 : index.html, fr/index.html et fr.html : <title>, og:title et twitter:title chacun présent une fois dans <head>, non vide, le nom sans titre de poste hors FAITS §7 ni séniorité ni formule interdite', () => {
  requireDist();
  const job = faitsCommons().title;
  const bad: string[] = [];
  for (const { file, locale } of HOME_FILES) {
    const path = join(distDir, file);
    if (!existsSync(path)) { bad.push(`${file} : copie HTML de l'accueil absente`); continue; }
    for (const p of titleTagProblems(readFileSync(path, 'utf8'), job[locale])) bad.push(`${file} : ${p}`);
  }
  assert.deepEqual(bad, [], 'titres des accueils');
});

test('H13 (témoins négatifs) : sur les vraies pages, supprimer <title>, og:title ou twitter:title seul, le dupliquer, le vider ou y mettre « Senior » est refusé', () => {
  requireDist();
  const job = faitsCommons().title;
  for (const { file, locale } of HOME_FILES) {
    const html = readFileSync(join(distDir, file), 'utf8');
    assert.deepEqual(titleTagProblems(html, job[locale]), [], `${file} : précondition, la page réelle doit passer`);
    const muts: [string, RegExp, string][] = [
      ['sans <title> (mutation de l\'auditeur)', /<title\b[^>]*>[^<]*<\/title>/i, ''],
      ['sans twitter:title (mutation de l\'auditeur)', /<meta\b[^>]*name="twitter:title"[^>]*>/i, ''],
      ['sans og:title', /<meta\b[^>]*property="og:title"[^>]*>/i, ''],
      ['<title> en double', /(<title\b[^>]*>[^<]*<\/title>)/i, '$1$1'],
      ['<title> vide', /(<title\b[^>]*>)[^<]*(<\/title>)/i, '$1$2'],
      ['twitter:title « Senior »', /(<meta\b[^>]*name="twitter:title"[^>]*content=")([^"]*)"/i, '$1$2 · Senior AI Engineer"'],
    ];
    for (const [label, re, by] of muts) {
      const m = html.replace(re, by);
      assert.notEqual(m, html, `${file} : mutation « ${label} » sans effet`);
      assert.notDeepEqual(titleTagProblems(m, job[locale]), [], `${file} : mutation « ${label} » acceptée`);
    }
  }
});

test('F13 (témoins) : le contrôle du <title> refuse « Senior AI Engineer », « Lead Developer », « Applied AI Engineer » ; il accepte le titre de FAITS §7', () => {
  const job = faitsCommons().title;
  for (const bad of ['Arnaud Durand | Senior AI Engineer', 'Arnaud Durand | Lead Developer', 'Arnaud Durand | Applied AI Engineer', 'Arnaud Durand | AI Engineer', 'Senior AI Engineer']) {
    assert.notDeepEqual(titleProblems(bad, job.en), [], `« ${bad} » accepté`);
  }
  assert.deepEqual(titleProblems(`Arnaud Durand | ${job.fr}`, job.fr), []);
  assert.deepEqual(titleProblems(`Arnaud Durand | ${job.en}, Paris`, job.en), []);
  assert.deepEqual(titleProblems('Arnaud Durand | IA, systèmes et projets collectifs', job.fr), []);
});

// Logos et emblèmes (E16.3) par d'autres voies que <img> : image de fond CSS, <object>, <embed>, <iframe>,
// <svg><image>, <picture>/<source>, <input type=image>, style en ligne.
const URL_IN_VALUE = /url\(|image-set\(|element\(/i;

export function cssImageProblems(rules: { selector: string; declList: [string, string][]; file: string }[]): string[] {
  const out: string[] = [];
  for (const r of rules) for (const [k, v] of r.declList) if (URL_IN_VALUE.test(v) && k !== 'src') out.push(`${r.selector} { ${k}: ${v.slice(0, 80)} }`);
  return out;
}

test('F13 : aucune image par CSS dans l\'export (background, content, mask, border-image, list-style : url(), image-set()) ; les polices seules ont des url()', () => {
  requireDist();
  assert.deepEqual(cssImageProblems(exportCss().rules), [], 'images CSS dans l\'export');
});

test('F13 (témoin) : le contrôle CSS repère un logo en image de fond data: (mutation P12 de l\'audit)', () => {
  const p12 = { selector: '[data-home-links]::after', declList: [['content', '""'], ['background', `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E")`]] as [string, string][], file: 'mutation' };
  assert.equal(cssImageProblems([...exportCss().rules, p12]).length, cssImageProblems(exportCss().rules).length + 1);
  assert.equal(cssImageProblems([{ selector: 'x', declList: [['background', 'radial-gradient(circle,#fff 0,transparent 4px)']], file: 'x' }]).length, 0, 'un dégradé n\'est pas une image');
});

export function embeddedImageProblems(html: string): string[] {
  const h = noScripts(html);
  const out: string[] = [];
  for (const tag of ['object', 'embed', 'iframe', 'picture', 'source', 'image', 'frame', 'applet']) {
    const n = [...h.matchAll(new RegExp(`<${tag}\\b`, 'gi'))].length;
    if (n) out.push(`${n} <${tag}>`);
  }
  if (/<input\b[^>]*\stype\s*=\s*["']?image/i.test(h)) out.push('<input type="image">');
  if (/<img\b[^>]*\ssrcset\s*=/i.test(h)) out.push('<img srcset>');
  if (/<use\b[^>]*\s(xlink:)?href\s*=\s*["'](?!#)/i.test(h)) out.push('<use href> externe');
  for (const m of h.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) if (URL_IN_VALUE.test(decodeEntities(m[1] ?? m[2] ?? ''))) out.push(`style en ligne avec image : ${(m[1] ?? m[2] ?? '').slice(0, 60)}`);
  return out;
}

test('F13 : le HTML des accueils ne contient ni <object>, <embed>, <iframe>, <svg><image>, <picture>, <source>, ni style en ligne avec image', () => {
  requireDist();
  for (const route of HOME_ROUTES) assert.deepEqual(embeddedImageProblems(pageHtml(route)), [], `${route} : images glissées hors de <img>`);
});

test('F13 (témoins) : le contrôle HTML repère <object> (mutation P13), <embed>, <svg><image>, un style en ligne avec url()', () => {
  for (const add of ['<object data="https://example.com/logo.svg" type="image/svg+xml" aria-label="BNP Paribas"></object>', '<embed src="/logo.svg">', '<svg aria-hidden="true"><image href="data:image/png;base64,AAAA"/></svg>', '<span style="background:url(/l.png)"></span>']) {
    const html = pageHtml('/fr/').replace('</main>', `${add}</main>`);
    assert.notDeepEqual(embeddedImageProblems(html), [], `non repéré : ${add}`);
  }
});
