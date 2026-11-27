// Outils des tests du lot 4 (tmp/refonte-arbre/contrat-lot4.md, Q1 à Q8) : le reste du site accordé au style sombre.
// Les 18 routes intérieures et la 404 sont écrites en dur (elles ne se déduisent pas de routes.json). La référence Q3
// (baseline-a040fb0.json) garde EN CLAIR, page par page, ce que le lot 4 ne doit pas changer : texte du <main>,
// liens, images, titres et métadonnées. Le lot 4 réécrit l'en-tête, le pied, les classes, les enveloppes et les
// préchargements : une empreinte du document entier (façon P5) rougirait au premier changement légitime.
// Aucune lecture de l'export au chargement du module.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { headMeta, normalizedDocument } from './helpers-2b.ts';
import { ORIGIN, pageScriptUrls, siteDir, staticClosure } from './helpers.ts';
import { byTag, parseHtml } from './helpers-home.ts';
import { foldRecetteY, foldRecetteYHtml } from './helpers-typo.ts';
import type { HNode } from './helpers-home.ts';

export type Lang = 'fr' | 'en';
export type Mode = 'preview' | 'public';

// ---- Pages du périmètre ----

// Les neuf chemins hors accueil du manifeste (lots 1a et 2b), en anglais et en français, et la 404 bilingue.
export const INTERIOR_PATHS: readonly string[] = ['projects/', 'hackathons/', 'skills/', 'projects/droit-de-retard/', 'projects/diary/', 'projects/croix-rouge/', 'experiences/bnp-paribas/', 'experiences/bpce/', 'experiences/ecole-42/'];
export const INTERIOR_ROUTES: readonly string[] = INTERIOR_PATHS.flatMap((p) => ['/' + p, '/fr/' + p]);
export const NOT_FOUND = '/404.html';
export const LOT4_PAGES: readonly string[] = [...INTERIOR_ROUTES, NOT_FOUND];
export const HOME_ROUTES_4: readonly string[] = ['/', '/fr/'];
export const ALL_PAGES: readonly string[] = [...HOME_ROUTES_4, ...LOT4_PAGES];
// Pages qui gardent leur propre image de partage (Q6 : la carte du récit droit-de-retard est conservée).
export const OWN_SHARE_IMAGE: readonly string[] = ['/projects/droit-de-retard/', '/fr/projects/droit-de-retard/'];
// Pages Projets et Compétences (Q7 : ni identifiant de question, ni unconfirmed, ni variante écartée).
export const Q7_TEXT_PAGES: readonly string[] = ['/projects/', '/fr/projects/', '/skills/', '/fr/skills/'];

export const langOf = (route: string): Lang => (route.startsWith('/fr/') ? 'fr' : 'en');
export const homeOf = (l: Lang): string => (l === 'fr' ? '/fr/' : '/');
// Page équivalente dans l'autre langue (bascule de langue, Q2). La 404 est bilingue, en anglais par son <html lang> :
// lecture retenue, sa bascule mène à l'accueil français.
export function equivalentRoute(route: string): string {
  if (route === NOT_FOUND) return '/fr/';
  return route.startsWith('/fr/') ? route.slice(3) : '/fr' + route;
}

export function pageFile(root: string, route: string): string {
  return route === NOT_FOUND ? join(root, '404.html') : join(root, route.replace(/^\//, ''), 'index.html');
}
export function readRoute(root: string, route: string): string | null {
  const f = pageFile(root, route);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}

// ---- Q3 : contenu figé d'une page ----

export interface LinkRef { href: string; text: string }
export interface ImageRef { src: string; alt: string | null; width: string | null; height: string | null }
export interface HeadingRef { level: number; text: string }
export interface PageContent {
  mains: number; // nombre d'éléments <main>
  text: string; // texte du <main>, une ligne par bloc
  links: LinkRef[];
  images: ImageRef[];
  headings: HeadingRef[];
  meta: Record<string, string[]>; // title, description, canonical, alternate:<hreflang>, og:*, twitter:*
}

const SKIP = new Set(['script', 'style', 'template', 'noscript']);
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'td', 'th', 'tr', 'ul', 'caption', 'details', 'summary']);
const hiddenAttr = (n: HNode): boolean => Object.prototype.hasOwnProperty.call(n.attrs, 'hidden');
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

// Frontière d'élément en ligne (<span>, <a>, <strong>…) : marquée par une espace sans chasse (U+200B), invisible,
// pour que deux mots de deux éléments voisins (« Python » puis « droit-de-retard » dans deux <span> collés) restent
// deux mots, que l'élément soit en ligne ou devienne un bloc.
export const SEAM = '\u200b';
// Texte d'un nœud : blocs séparés par un retour à la ligne, éléments hidden et scripts ignorés.
export function blockText(n: HNode): string {
  const parts: string[] = [];
  const walk = (x: HNode): void => {
    if (x.tag === '#text') {
      parts.push(x.text);
      return;
    }
    if (SKIP.has(x.tag) || hiddenAttr(x)) return;
    const edge = BLOCK.has(x.tag) ? '\n' : SEAM;
    parts.push(edge);
    for (const c of x.children) walk(c);
    parts.push(edge);
  };
  walk(n);
  return parts
    .join('')
    .split('\n')
    .map((l) => squash(l.replace(/\u200b+/g, SEAM)).replace(/^\u200b+|\u200b+$/g, '').replace(/\s*\u200b\s*/g, (m) => (/\s/.test(m) ? ' ' : SEAM)))
    .filter((l) => l.replace(/[\s\u200b]/g, '').length > 0)
    .join('\n');
}
const inline = (n: HNode): string => squash(blockText(n).replace(/\n/g, ' '));

// Chemin d'actif sans hachage (/_next/static/… : remplacé), URL du site ramenée au chemin.
export const normAsset = (u: string | undefined): string => (u ?? '').replace(/\/_next\/static\/[^"'\s)]+/g, '/_next/static/*');

const IMAGE_META = /^(?:og:image(?::(?:url|secure_url|type|width|height))?|twitter:image(?::src)?)$/;

export function pageContent(route: string, html: string): PageContent {
  const doc = parseHtml(html);
  const mains = byTag(doc, 'main');
  const main = mains[0];
  const meta: Record<string, string[]> = {};
  const m = headMeta(html);
  meta.title = m.titles;
  for (const [k, v] of m.metas) {
    if (k !== 'description' && !k.startsWith('og:') && !k.startsWith('twitter:')) continue;
    // Q6 : l'image de partage par défaut change ; celle du récit droit-de-retard est conservée.
    if (IMAGE_META.test(k) && !OWN_SHARE_IMAGE.includes(route)) continue;
    meta[k] = v;
  }
  meta.canonical = m.links.filter((l) => l.rel === 'canonical').map((l) => l.href);
  for (const l of m.links.filter((x) => x.rel === 'alternate' && x.hreflang)) (meta[`alternate:${l.hreflang}`] ??= []).push(l.href);
  if (!main) return { mains: 0, text: '', links: [], images: [], headings: [], meta };
  const all: HNode[] = [];
  const collect = (x: HNode): void => {
    if (x.tag === '#text' || SKIP.has(x.tag) || hiddenAttr(x)) return;
    all.push(x);
    for (const c of x.children) collect(c);
  };
  collect(main);
  return {
    mains: mains.length,
    text: blockText(main),
    links: all.filter((x) => x.tag === 'a').map((a) => ({ href: a.attrs.href ?? '', text: inline(a) })),
    images: all.filter((x) => x.tag === 'img').map((i) => ({ src: normAsset(i.attrs.src), alt: i.attrs.alt ?? null, width: i.attrs.width ?? null, height: i.attrs.height ?? null })),
    headings: all.filter((x) => /^h[1-6]$/.test(x.tag)).map((h) => ({ level: Number(h.tag[1]), text: inline(h) })),
    meta,
  };
}

// Mots du texte : suites de lettres et de chiffres ; et texte sans aucun blanc. Les deux ensemble attrapent un mot
// changé, retiré, ajouté ou déplacé, et deux mots soudés, sans dépendre des coupures de blocs (une balise <span>
// devenue <div> ne change ni l'un ni l'autre).
export const wordsOf = (t: string): string[] => t.match(/[\p{L}\p{N}]+/gu) ?? [];
export const compact = (t: string): string => t.replace(/[\s\u200b]+/g, '');

function firstWordDiff(a: string[], b: string[]): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ctx = (x: string[]): string => x.slice(Math.max(0, i - 6), i + 6).join(' ');
  return `mot n° ${i + 1} : attendu « …${ctx(a)}… », reçu « …${ctx(b)}… »`;
}

// Écarts entre la référence et une page (Q3). Chaque message nomme la clause du contrat.
const foldPageY = (p: PageContent): PageContent => ({
  ...p,
  text: foldRecetteY(p.text),
  links: p.links.map((l) => ({ href: foldRecetteYHtml(l.href), text: foldRecetteY(l.text) })),
  images: p.images.map((i) => ({ ...i, src: foldRecetteYHtml(i.src), alt: i.alt === null ? null : foldRecetteY(i.alt) })),
  headings: p.headings.map((h) => ({ ...h, text: foldRecetteY(h.text) })),
  meta: Object.fromEntries(Object.entries(p.meta).map(([k, v]) => [k, v.map(foldRecetteY)])),
});
export function contentDiffs(route: string, want: PageContent, gotRaw: PageContent): string[] {
  const out: string[] = [];
  // Lot 4, S1 et S3 : les valeurs nouvelles exactes des exceptions nommées sont ramenées à a040fb0 (voir plus bas).
  // Tour Y (contrat-recette-y.md, Y3 et Y4) : apostrophes et flèches repliées des deux côtés (helpers-typo.ts,
  // foldRecetteY) ; la page l'est avant le retour des exceptions nommées, dont les valeurs le sont aussi.
  const got = foldPageY(revertNamedExceptions(route, foldPageY(gotRaw), readNamedExceptions().map((e) => ({ ...e, ancien: foldRecetteY(e.ancien), nouveau: foldRecetteY(e.nouveau) }))));
  want = foldPageY(want);
  const say = (m: string): void => {
    out.push(`${route} : ${m} (contrat lot 4, Q3)`);
  };
  if (got.mains !== 1) say(`un seul <main> attendu, reçu ${got.mains}`);
  const wa = wordsOf(want.text);
  const wb = wordsOf(got.text);
  if (JSON.stringify(wa) !== JSON.stringify(wb)) say(`texte du <main> différent, ${firstWordDiff(wa, wb)}`);
  else if (compact(want.text) !== compact(got.text)) {
    const a = compact(want.text);
    const b = compact(got.text);
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    say(`ponctuation ou signes du <main> différents près de « ${a.slice(Math.max(0, i - 25), i + 25)} » (reçu « ${b.slice(Math.max(0, i - 25), i + 25)} »)`);
  }
  const link = (l: LinkRef): string => `${l.href} « ${compact(l.text)} »`;
  const la = want.links.map(link);
  const lb = got.links.map(link);
  if (JSON.stringify(la) !== JSON.stringify(lb)) {
    const missing = la.filter((x) => !lb.includes(x));
    const extra = lb.filter((x) => !la.includes(x));
    say(`liens du <main> différents (ordre, href ou texte) ; absents : ${JSON.stringify(missing)} ; en trop : ${JSON.stringify(extra)}`);
  }
  // Lot 4, R1 : alt et métadonnées comparés blancs réduits (U+00A0 et U+202F comptent comme une espace) : seuls les
  // blancs peuvent changer, un mot ou un signe changé, une espace retirée ou ajoutée rougissent toujours.
  const wsImg = (xs: ImageRef[]): ImageRef[] => xs.map((i) => ({ ...i, alt: i.alt === null ? null : i.alt.replace(/\s+/g, ' ') }));
  if (JSON.stringify(wsImg(want.images)) !== JSON.stringify(wsImg(got.images))) say(`images du <main> différentes : attendu ${JSON.stringify(want.images)}, reçu ${JSON.stringify(got.images)}`);
  const h = (x: HeadingRef): string => `h${x.level} ${compact(x.text)}`;
  const ha = want.headings.map(h);
  const hb = got.headings.map(h);
  if (JSON.stringify(ha) !== JSON.stringify(hb)) say(`titres du <main> différents (niveau, texte ou ordre) : attendu ${JSON.stringify(ha)}, reçu ${JSON.stringify(hb)}`);
  const keys = [...new Set([...Object.keys(want.meta), ...Object.keys(got.meta)])].sort();
  for (const k of keys) {
    const a = JSON.stringify((want.meta[k] ?? []).map((v) => v.replace(/\s+/g, ' ')));
    const b = JSON.stringify((got.meta[k] ?? []).map((v) => v.replace(/\s+/g, ' ')));
    if (a !== b) say(`métadonnée ${k} : attendu ${a}, reçu ${b}`);
  }
  return out;
}

// ---- Lot 4, décisions S1 à S3 (tmp/refonte-arbre/contrat-lot4-s.md) : exceptions nommées à Q3 ----
// Q3 garde tout le reste figé sur a040fb0. Les seuls changements admis sont listés un à un dans
// fixtures/exceptions-s.json : pour une route listée, la valeur NOUVELLE exacte (blancs réduits, U+00A0 et U+202F
// comptent comme une espace) est ramenée à sa valeur a040fb0 avant la comparaison. La référence n'est pas modifiée :
// Q3 est vert avant et après le code ; une troisième formulation, la valeur nouvelle sur une autre route ou dans un
// autre champ restent des écarts. Ce sont les tests s* qui exigent la valeur nouvelle.

// Lot 5 (contrat-lot5.md, T3 et T4) : exceptions « T3-… » ajoutées au même fichier, avec deux formes de plus :
// - champ « texte » : la valeur nouvelle est aussi ramenée dans le texte des liens du <main> (les preuves de Compétences
//   sont des liens) et, sur les accueils (Q2), dans le HTML entier, toutes occurrences (rendu et charge RSC en ligne) ;
// - champ « description » : description, og:description et twitter:description.
// « requis » : fragments que la valeur nouvelle doit contenir (tirés de FAITS.md ou de la spec), contrôlés par
// t0-exceptions-lot5.test.ts.
// Tour Z (contrat-textes-z.md) : exceptions « Z… » ; « ancienV7 » = valeur de 274537a quand elle diffère de celle de
// a040fb0 (note de Compétences, Z4-note-*), lue par v7-rien-d-autre.test.ts.
// Tour W (contrat-relecture-w.md, 26/11) : trois formes de plus, au plus juste.
// - champ « alt » : texte alternatif d'une image du <main> (Q3) et attribut alt de <img> (HTML) ;
// - champ « title », « og:title », « twitter:title », « og:locale » : une métadonnée nommée, comme « og:image:alt »
//   (Q3 : branche générique ; HTML : <title> ou la balise <meta> de ce nom) ;
// - « html » (facultatif, champ « texte ») : le fragment HTML exact que le retour sur le HTML (accueils Q2, V7)
//   remplace à la place du texte, quand le texte seul toucherait aussi une adresse (« droit-de-retard » est aussi un
//   chemin) ou une autre occurrence (« French Red Cross » est aussi dans l'arbre). « ancien » vide = insertion (W1 C1,
//   surtitre de la page BNP) : la valeur nouvelle est retirée, une fois dans le texte, partout dans le HTML.
export type NamedField = 'texte' | 'og:image:alt' | 'description' | 'alt' | 'title' | 'og:title' | 'twitter:title' | 'og:locale';
export interface NamedException { id: string; decision: string; champ: NamedField; routes: string[]; ancien: string; nouveau: string; requis?: string[]; ancienV7?: string; html?: { ancien: string; nouveau: string } }
export function readNamedExceptions(): NamedException[] {
  const f = join(siteDir, 'tests', 'fixtures', 'exceptions-s.json');
  return (JSON.parse(readFileSync(f, 'utf8')) as { exceptions: NamedException[] }).exceptions;
}
const ws = (s: string): string => s.replace(/\s+/g, ' ');
const DESCRIPTION_META = ['description', 'og:description', 'twitter:description'];
// Lot 5 : par sûreté, on ne remplace jamais à l'intérieur d'une occurrence de l'ancienne valeur (une valeur nouvelle
// contenue dans l'ancienne y serait doublée ; t0-exceptions-lot5 refuse ce cas, que verif-4 ne sait pas traiter).
function replaceOutside(text: string, nouveau: string, ancien: string): string {
  if (ancien === '') {
    // Tour W : insertion nommée, retirée une fois.
    const i = text.indexOf(nouveau);
    return i < 0 || nouveau === '' ? text : text.slice(0, i) + text.slice(i + nouveau.length);
  }
  const parts = text.split(ancien);
  const i = parts.findIndex((x) => x.includes(nouveau));
  if (i < 0) return text;
  parts[i] = (parts[i] as string).replace(nouveau, ancien);
  return parts.join(ancien);
}
export function revertNamedExceptions(route: string, got: PageContent, list: NamedException[] = readNamedExceptions()): PageContent {
  let text = got.text;
  let links = got.links;
  let images = got.images;
  let headings = got.headings;
  const meta = { ...got.meta };
  for (const e of list) {
    if (!e.routes.includes(route)) continue;
    if (e.champ === 'texte') {
      // Une seule occurrence ramenée : une deuxième resterait un écart.
      text = replaceOutside(text.split('\n').map((l) => ws(l)).join('\n'), ws(e.nouveau), ws(e.ancien));
      // Lot 5 : même retour dans le texte des liens (une occurrence par lien).
      links = links.map((l) => ({ ...l, text: replaceOutside(ws(l.text), ws(e.nouveau), ws(e.ancien)) }));
      // Tour W : même retour dans le texte des titres, pour les seules exceptions W (une occurrence par titre ;
      // « droit-de-retard », « French Red Cross » et les h2 des récits sont des titres). S, T3, U6 et Z inchangées.
      if (e.id.startsWith('W')) headings = headings.map((h) => ({ ...h, text: replaceOutside(ws(h.text), ws(e.nouveau), ws(e.ancien)) }));
    } else if (e.champ === 'description') {
      for (const k of DESCRIPTION_META) {
        const v = meta[k];
        if (v) meta[k] = v.map((x) => (ws(x) === ws(e.nouveau) ? e.ancien : x));
      }
    } else if (e.champ === 'alt') {
      images = images.map((i) => (i.alt !== null && ws(i.alt) === ws(e.nouveau) ? { ...i, alt: e.ancien } : i));
    } else {
      const v = meta[e.champ];
      if (v) meta[e.champ] = v.map((x) => (ws(x) === ws(e.nouveau) ? e.ancien : x));
    }
  }
  return { ...got, text, links, images, headings, meta };
}
// Accueils (Q2, empreinte homeDigest) : même retour, sur le HTML, pour la métadonnée og:image:alt (lot 4) et, au lot 5,
// pour les champs « texte » et « description » : chaque occurrence de la valeur nouvelle (blancs souples : espace,
// U+00A0, U+202F, &nbsp;) redevient la valeur a040fb0 exacte, dans le rendu comme dans la charge RSC en ligne.
export function revertNamedExceptionsHtml(route: string, html: string, list: NamedException[] = readNamedExceptions()): string {
  let out = html;
  for (const e of list) {
    if (!e.routes.includes(route)) continue;
    if (e.html) {
      // Tour W : fragment HTML exact (blancs souples), toutes occurrences.
      const exact = e.html.nouveau.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:\\s|&nbsp;|&#160;)+');
      const back = e.html.ancien;
      out = out.replace(new RegExp(exact, 'g'), () => back);
      continue;
    }
    if (e.champ === 'texte' || e.champ === 'description') {
      const pattern = e.nouveau.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:\\s|&nbsp;|&#160;)+');
      out = out.split(e.ancien).map((x) => x.replace(new RegExp(pattern, 'g'), () => e.ancien)).join(e.ancien);
      continue;
    }
    const same = (v: string): boolean => ws(v.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&')) === ws(e.nouveau);
    if (e.champ === 'title') {
      // Tour W : le <title> du document.
      out = out.replace(/(<title\b[^>]*>)([^<]*)(<\/title>)/gi, (m, a: string, v: string, b: string) => (same(v) ? a + e.ancien + b : m));
      continue;
    }
    if (e.champ === 'alt') {
      // Tour W : attribut alt d'une image.
      out = out.replace(/(<img\b[^>]*\salt\s*=\s*")([^"]*)/gi, (m, a: string, v: string) => (same(v) ? a + e.ancien : m));
      continue;
    }
    // og:image:alt (lot 4) et, au tour W, toute autre métadonnée nommée (og:title, twitter:title, og:locale).
    const key = e.champ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, 'gi'), (tag) =>
      tag.replace(/(content\s*=\s*["'])([^"']*)/i, (m, a: string, v: string) => (same(v) ? a + e.ancien : m)),
    );
  }
  return out;
}

// ---- Mesures de départ (Q2, Q5, Q6, Q7) ----

export const gz = (b: Buffer | string): number => gzipSync(b, { level: 9 }).length;
export const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

export function filesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f);
      else out.push(f);
    }
  };
  walk(root);
  return out.sort();
}
export const rel = (root: string, f: string): string => '/' + relative(root, f).split('\\').join('/');

export function cssGzipTotal(root: string): number {
  return filesUnder(root)
    .filter((f) => f.endsWith('.css'))
    .reduce((s, f) => s + gz(readFileSync(f)), 0);
}

// JS d'une page : modules référencés par la page (script src, modulepreload) et leur fermeture d'imports statiques.
export function pageJs(root: string, html: string): string[] {
  return [...staticClosure(root, pageScriptUrls(html))].filter((u) => u.endsWith('.js') && existsSync(join(root, u.replace(/^\//, '')))).sort();
}
export function pageJsGzip(root: string, html: string): number {
  return pageJs(root, html).reduce((s, u) => s + gz(readFileSync(join(root, u.replace(/^\//, '')))), 0);
}
// Nom d'un module sans son hachage : /_next/static/chunks/layout-segment-context-DLtDdCPt.js → layout-segment-context.
export const moduleName = (u: string): string => (u.split('/').pop() ?? u).replace(/-[A-Za-z0-9_-]{8}\.js$/, '').replace(/\.js$/, '');

export const woff2Files = (root: string): string[] => filesUnder(root).filter((f) => f.endsWith('.woff2'));
// Polices que l'accueil charge : préchargements as=font de son <head> (Inter Tight et IBM Plex Mono à a040fb0).
export function homeFontBytes(root: string, homeHtml: string): { files: string[]; bytes: number } {
  const files = [...homeHtml.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((t) => /\brel\s*=\s*["']?preload/i.test(t) && /\bas\s*=\s*["']?font/i.test(t))
    .map((t) => /\bhref\s*=\s*["']([^"']+)["']/i.exec(t)?.[1] ?? '')
    .filter(Boolean);
  return { files, bytes: files.reduce((s, u) => s + statSync(join(root, u.replace(/^\//, ''))).size, 0) };
}

// ---- Q1 : couleurs de l'ancienne DA (« Papier d'atelier ») ----

// Couleurs littérales des règles de l'ancienne DA à a040fb0 (globals.css, lignes hors [data-home]) : fond, texte,
// gris, accent brique, filets, panneau, et deux teintes secondaires. Une seule d'entre elles appliquée = ancienne DA.
export const OLD_DA_COLORS: readonly string[] = ['#f8f5ed', '#262722', '#63635a', '#a44229', '#d9d5c9', '#eee9dc', '#d6d7cf', '#2627220a'];

const hexToRgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Toutes les écritures d'une couleur : #rrggbb, #rgb si possible, rgb()/rgba() avec ou sans virgules.
export function colorPatterns(hex: string): RegExp[] {
  const h = hex.toLowerCase();
  const [r, g, b] = hexToRgb(h);
  const out = [new RegExp(`#${h.slice(1, 7)}(?:[0-9a-f]{2})?(?![0-9a-f])`, 'i')];
  if (h.length === 7 && h[1] === h[2] && h[3] === h[4] && h[5] === h[6]) out.push(new RegExp(`#${h[1]}${h[3]}${h[5]}(?:[0-9a-f])?(?![0-9a-f])`, 'i'));
  out.push(new RegExp(`rgba?\\(\\s*${r}[\\s,]+${g}[\\s,]+${b}(?![0-9])`, 'i'));
  return out;
}
export function oldColorsIn(text: string): string[] {
  return OLD_DA_COLORS.filter((c) => colorPatterns(c).some((p) => p.test(text)));
}

// Styles d'une page : attributs style et éléments <style>.
export function inlineStyles(html: string): string {
  const attrs = [...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => m[1] ?? m[2] ?? '');
  const els = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? '');
  return [...attrs, ...els].join('\n');
}
// CSS liés par une page (<link rel=stylesheet>), contenu concaténé.
export function linkedCss(root: string, html: string): string {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((t) => /\brel\s*=\s*["']?stylesheet/i.test(t))
    .map((t) => /\bhref\s*=\s*["']([^"']+)["']/i.exec(t)?.[1] ?? '')
    .map((u) => join(root, u.replace(/^\//, '')))
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}
// Déclarations d'une propriété personnalisée (--x: valeur) dans un texte CSS.
export function customPropValues(css: string, name: string): string[] {
  const esc = name.replace(/[-]/g, '\\-');
  return [...css.matchAll(new RegExp(`(?:^|[;{\\s"'])${esc}\\s*:\\s*([^;}"']+)`, 'g'))].map((m) => (m[1] ?? '').trim().toLowerCase());
}

// ---- Q6 : dimensions d'une image (PNG, JPEG, WebP) lues dans l'en-tête ----

export function imageSize(b: Buffer): { format: string; width: number; height: number } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1] as number;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = b.readUInt16BE(i + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { format: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { format: 'webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { format: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}
export const urlToPath = (u: string): string => (u.startsWith(ORIGIN) ? u.slice(ORIGIN.length) : u);

// ---- Référence a040fb0 ----

export const BASELINE_4 = 'baseline-a040fb0.json';
export interface Baseline4 {
  commit: string;
  commande: string;
  pages: Record<Mode, Record<string, PageContent>>;
  homes: Record<Mode, Record<string, string>>; // empreinte homeDigest des deux accueils
  mesures: Record<
    Mode,
    {
      cssGzip: number; // Σ gzip -9 des .css de l'export
      jsGzip: Record<string, number>; // par page du périmètre : Σ gzip -9 de ses modules (fermeture statique)
      jsModules: Record<string, string[]>; // par page : noms de modules sans hachage
      homeFonts: { files: string[]; bytes: number }; // polices préchargées par l'accueil anglais
      woff2Total: number; // Σ des WOFF2 de l'export
      defaultShareImage: { url: string; sha256: string; bytes: number }; // og:image par défaut (/og.jpg)
      keyframes: string[]; // noms des @keyframes des CSS exportés
    }
  >;
}
export function readBaseline4(): Baseline4 {
  const f = join(siteDir, 'tests', 'fixtures', BASELINE_4);
  if (!existsSync(f)) throw new Error(`référence du lot 4 absente : ${f}`);
  return JSON.parse(readFileSync(f, 'utf8')) as Baseline4;
}

// ---- Q2 : l'accueil ne change pas, hors ce que le contrat impose ----

// Empreinte d'un accueil (règle de P5 : document normalisé, scripts et commentaires retirés, actifs hachés
// remplacés), après neutralisation des seuls changements que le contrat du lot 4 impose à l'accueil :
// - Q1 : DEFAULT_PALETTE devient foret : les couleurs écrites dans les attributs style et les éléments <style>
//   (jetons de [data-home], halo de [data-tree-hero], --home-bg) sont remplacées par #C ;
// - Q1 : <meta name="theme-color"> ajoutée ;
// - Q6 : image de partage par défaut (og:image, og:image:type, twitter:image).
// Tout autre changement d'un accueil change l'empreinte et doit être listé (HOME_CHANGES, q2-coquille.test.ts).
// Tour Y : foldRecetteYHtml (helpers-typo.ts) appliqué d’abord, des deux côtés (référence recalculée : fixtures/figer-references-recette-y.ts).
export function homeDigest(html: string, recetteY = true): string {
  const neutral = (recetteY ? foldRecetteYHtml(html) : html)
    .replace(/(\sstyle\s*=\s*")([^"]*)(")/gi, (_m, a: string, v: string, b: string) => a + v.replace(/#[0-9a-fA-F]{3,8}\b/g, '#C') + b)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, a: string, v: string, b: string) => a + v.replace(/#[0-9a-fA-F]{3,8}\b/g, '#C') + b)
    .replace(/<meta\b[^>]*name\s*=\s*["']theme-color["'][^>]*>/gi, '')
    .replace(/(<meta\b[^>]*(?:property|name)\s*=\s*["'](?:og:image|og:image:url|og:image:secure_url|og:image:type|twitter:image)["'][^>]*content\s*=\s*["'])[^"']*/gi, '$1*')
    .replace(/<meta\b[^>]*property\s*=\s*["']og:image:type["'][^>]*>/gi, '');
  return sha256(normalizedDocument(neutral));
}

export const keyframeNames = (css: string): string[] => [...new Set([...css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)].map((m) => m[1] as string))].sort();

export function measures(root: string): Baseline4['mesures'][Mode] {
  const jsGzip: Record<string, number> = {};
  const jsModules: Record<string, string[]> = {};
  for (const r of LOT4_PAGES) {
    const html = readRoute(root, r);
    if (!html) throw new Error(`page absente : ${r}`);
    jsGzip[r] = pageJsGzip(root, html);
    jsModules[r] = [...new Set(pageJs(root, html).map(moduleName))].sort();
  }
  const home = readRoute(root, '/') ?? '';
  const og = readFileSync(join(root, 'og.jpg'));
  const css = filesUnder(root)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  return {
    cssGzip: cssGzipTotal(root),
    jsGzip,
    jsModules,
    homeFonts: homeFontBytes(root, home),
    woff2Total: woff2Files(root).reduce((s, f) => s + statSync(f).size, 0),
    defaultShareImage: { url: ORIGIN + '/og.jpg', sha256: sha256(og), bytes: og.length },
    keyframes: keyframeNames(css),
  };
}
