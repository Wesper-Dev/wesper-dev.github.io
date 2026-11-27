// Outils des tests du lot 2b (tmp/refonte-arbre/contrat-lot2b.md, P1 à P5) : pages de détail BPCE et École 42.
// Les attentes de route sont écrites en dur (elles ne se déduisent pas de routes.json, sinon un manifeste inchangé
// les rendrait vertes à vide). Les textes attendus viennent de FAITS.md §2, §4 et §7, ou de la copie versionnée (F12).
// Aucune lecture de l'export au chargement du module : une page absente donne une erreur nommée dans chaque test.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bnpReference, bpceReference, ecole42Reference, faitsCommons } from './helpers-faits.ts';
import { ORIGIN, decodeEntities, pageScriptUrls, staticClosure } from './helpers.ts';
import { byTag, docOrder, parseHtml } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';
import { elementsWithAttr } from './helpers-scene.ts';

export type Lang = 'fr' | 'en';
export type DetailId = 'bpce' | 'ecole-42';

// ---- P1 : routes attendues ----

// Les huit chemins du lot 1a (C1) et les deux du lot 2b : dix chemins, vingt routes.
export const OLD_PATHS: readonly string[] = ['', 'projects/', 'hackathons/', 'skills/', 'projects/droit-de-retard/', 'projects/diary/', 'projects/croix-rouge/', 'experiences/bnp-paribas/'];
export const LOT2B_PATHS: readonly string[] = ['experiences/bpce/', 'experiences/ecole-42/'];
export const EXPECTED_PATHS: readonly string[] = [...OLD_PATHS, ...LOT2B_PATHS];
export const LOT2B_ROUTES: readonly string[] = ['/experiences/bpce/', '/fr/experiences/bpce/', '/experiences/ecole-42/', '/fr/experiences/ecole-42/'];
export const OLD_ROUTES: readonly string[] = OLD_PATHS.flatMap((p) => ['/' + p, '/fr/' + p]);
export const routePrefix = (l: Lang): string => (l === 'fr' ? '/fr/' : '/');

export interface DetailSpec {
  id: DetailId;
  lang: Lang;
  route: string; // /experiences/bpce/
  dir: string; // experiences/bpce (dossier de l'index.html)
  flat: string; // experiences/bpce.html
  rsc: string; // experiences/bpce.rsc
  bnpDir: string; // page BNP de la même langue (gabarit, C4)
}

function spec(id: DetailId, lang: Lang): DetailSpec {
  const base = (lang === 'fr' ? 'fr/' : '') + 'experiences/';
  return { id, lang, route: '/' + base + id + '/', dir: base + id, flat: base + id + '.html', rsc: base + id + '.rsc', bnpDir: base + 'bnp-paribas' };
}
export const BPCE_SPECS: readonly DetailSpec[] = [spec('bpce', 'fr'), spec('bpce', 'en')];
export const E42_SPECS: readonly DetailSpec[] = [spec('ecole-42', 'fr'), spec('ecole-42', 'en')];
export const DETAIL_SPECS: readonly DetailSpec[] = [...BPCE_SPECS, ...E42_SPECS];

// ---- Lecture d'une page ----

export function readPage(root: string, dir: string): string | null {
  const file = join(root, dir, 'index.html');
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

// Texte d'un élément au sens « en ligne » : texte des descendants concaténé, <br> compté comme un blanc, blancs réduits.
export function inlineText(n: HNode): string {
  const walk = (x: HNode): string => {
    if (x.tag === '#text') return x.text;
    if (x.tag === 'script' || x.tag === 'style') return '';
    if (x.tag === 'br') return ' ';
    return x.children.map(walk).join('');
  };
  return walk(n).replace(/\s+/g, ' ').trim();
}

const BLOCK = 'address|article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|td|th|tr|ul';
// Lignes de texte d'un fragment : coupure à chaque balise de bloc et à <br>, balises en ligne retirées, blancs réduits.
export function textLines(fragment: string): string[] {
  const cut = fragment
    .replace(/<script\b[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '\n')
    .replace(new RegExp(`<\\/?(?:${BLOCK})\\b[^>]*>`, 'gi'), '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(cut)
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export const bodyHtml = (html: string): string => /<body\b[\s\S]*<\/body>/i.exec(html)?.[0] ?? '';
export const mainHtml = (html: string): string => /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? '';
export const headHtml = (html: string): string => /<head\b[\s\S]*?<\/head>/i.exec(html)?.[0] ?? '';

// Déséchappement des chaînes JS et JSON (charge RSC en ligne et fichier .rsc), appliqué deux fois (JSON dans une chaîne JS).
export function unescapeJs(s: string): string {
  const once = (x: string): string =>
    x
      .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\n/g, '\n')
      .replace(/\\(["'\\/])/g, '$1');
  return once(once(s));
}

export const inlineScripts = (html: string): string =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) => !/\bsrc\s*=/.test(m[1] ?? '')).map((m) => m[2] ?? '').join('\n');

// Métadonnées du <head> : <title>, puis chaque meta name/property (toutes les occurrences).
export interface HeadMeta {
  titles: string[];
  metas: Map<string, string[]>;
  links: { rel: string; href: string; hreflang?: string }[];
}
export function headMeta(html: string): HeadMeta {
  const head = parseHtml(headHtml(html));
  const titles = byTag(head, 'title').map((t) => inlineText(t));
  const metas = new Map<string, string[]>();
  for (const m of byTag(head, 'meta')) {
    const key = m.attrs.property ?? m.attrs.name;
    if (!key) continue;
    metas.set(key, [...(metas.get(key) ?? []), (m.attrs.content ?? '').replace(/\s+/g, ' ').trim()]);
  }
  const links = byTag(head, 'link').map((l) => ({ rel: (l.attrs.rel ?? '').toLowerCase(), href: l.attrs.href ?? '', hreflang: l.attrs.hreflang }));
  return { titles, metas, links };
}

// Toutes les sources de texte d'une page (contrat P2 : texte visible, métadonnées, JS).
export interface PageSources {
  visible: string; // lignes du <body>, jointes par des retours à la ligne
  head: string; // <title> et contenus des meta
  inline: string; // scripts en ligne déséchappés (charge RSC)
  rsc: string; // fichier .rsc de la page, déséchappé, s'il existe
  js: string; // modules atteints par import statique depuis les scripts de la page
}
export function pageSources(root: string, s: DetailSpec, html: string): PageSources {
  const meta = headMeta(html);
  const rscFile = join(root, s.rsc);
  const jsUrls = [...staticClosure(root, pageScriptUrls(html))].filter((u) => u.endsWith('.js'));
  const js = jsUrls
    .map((u) => join(root, u.replace(/^\//, '')))
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  return {
    visible: textLines(bodyHtml(html)).join('\n'),
    head: [...meta.titles, ...[...meta.metas.values()].flat()].join('\n'),
    inline: unescapeJs(inlineScripts(html)),
    rsc: existsSync(rscFile) ? unescapeJs(readFileSync(rscFile, 'utf8')) : '',
    js,
  };
}

// ---- Textes attendus (FAITS) ----

export interface PageRef {
  name: string; // h1
  required: string[]; // textes propres à la page, dans la langue (liste blanche, description admise)
}
export function pageRef(s: DetailSpec): PageRef {
  const l = s.lang;
  if (s.id === 'bpce') {
    const r = bpceReference();
    return { name: r.name, required: [r.role[l], r.dates[l], r.cardHook[l], r.cardSubtitle[l], r.sandbox[l], r.trainingTitle[l], r.training[l]] };
  }
  const r = ecole42Reference();
  return { name: r.name, required: [r.line, r.cardSubtitle[l], r.paragraph[l]] };
}
// Textes publics de la page qui peuvent servir de méta-description (FAITS ne donne pas de description, P2 et P3).
export function descriptionCandidates(s: DetailSpec): string[] {
  const l = s.lang;
  if (s.id === 'bpce') {
    const r = bpceReference();
    return [r.sandbox[l], r.training[l], r.cardHook[l], r.cardSubtitle[l]];
  }
  const r = ecole42Reference();
  return [r.paragraph[l], r.line, r.cardSubtitle[l]];
}

// ---- Contrôle commun : en-tête de page cohérent avec la page BNP de la même langue (P1, P2, P3) ----

const one = (xs: string[] | undefined): string | null => (xs && xs.length === 1 ? (xs[0] ?? null) : null);

export function headErrors(root: string, s: DetailSpec, html: string): string[] {
  const errors: string[] = [];
  const need = (ok: boolean, msg: string): void => {
    if (!ok) errors.push(`${s.route} : ${msg}`);
  };
  const ref = pageRef(s);
  const doc = parseHtml(html);
  const h1s = byTag(doc, 'h1').map(inlineText);
  need(h1s.length === 1 && h1s[0] === ref.name, `un seul <h1> « ${ref.name} » attendu, reçu ${JSON.stringify(h1s)}`);
  const lang = /<html\b[^>]*\blang\s*=\s*["']([^"']*)["']/i.exec(html)?.[1];
  need(lang === s.lang, `<html lang="${s.lang}"> attendu, reçu ${JSON.stringify(lang)}`);

  const m = headMeta(html);
  const canon = m.links.filter((x) => x.rel === 'canonical').map((x) => x.href);
  need(canon.length === 1 && canon[0] === ORIGIN + s.route, `canonical unique ${ORIGIN + s.route} attendue, reçu ${JSON.stringify(canon)}`);
  const alt = (hl: string): string[] => m.links.filter((x) => x.rel === 'alternate' && x.hreflang === hl).map((x) => x.href);
  const en = ORIGIN + '/experiences/' + s.id + '/';
  const fr = ORIGIN + '/fr/experiences/' + s.id + '/';
  need(JSON.stringify(alt('en')) === JSON.stringify([en]), `hreflang en unique ${en} attendu, reçu ${JSON.stringify(alt('en'))}`);
  need(JSON.stringify(alt('fr')) === JSON.stringify([fr]), `hreflang fr unique ${fr} attendu, reçu ${JSON.stringify(alt('fr'))}`);
  need(JSON.stringify(alt('x-default')) === JSON.stringify([en]), `hreflang x-default unique ${en} attendu, reçu ${JSON.stringify(alt('x-default'))}`);

  // Gabarit de la page BNP : « <nom> | Arnaud Durand ».
  const title = one(m.titles);
  const wantTitle = `${ref.name} | Arnaud Durand`;
  need(title === wantTitle, `<title> unique « ${wantTitle} » attendu (gabarit de la page BNP), reçu ${JSON.stringify(m.titles)}`);
  need(one(m.metas.get('og:title')) === title, `og:title unique égal au <title> attendu, reçu ${JSON.stringify(m.metas.get('og:title'))}`);
  need(one(m.metas.get('twitter:title')) === title, `twitter:title unique égal au <title> attendu, reçu ${JSON.stringify(m.metas.get('twitter:title'))}`);
  const desc = one(m.metas.get('description'));
  const candidates = descriptionCandidates(s);
  need(!!desc && candidates.includes(desc), `méta-description unique, prise mot pour mot dans les textes publics de FAITS pour cette page, attendue ; reçu ${JSON.stringify(m.metas.get('description'))}`);
  need(one(m.metas.get('og:description')) === desc, `og:description égale à la description attendue, reçu ${JSON.stringify(m.metas.get('og:description'))}`);
  need(one(m.metas.get('twitter:description')) === desc, `twitter:description égale à la description attendue, reçu ${JSON.stringify(m.metas.get('twitter:description'))}`);
  need(one(m.metas.get('og:url')) === ORIGIN + s.route, `og:url ${ORIGIN + s.route} attendu, reçu ${JSON.stringify(m.metas.get('og:url'))}`);

  // Autres métadonnées : identiques à celles de la page BNP de la même langue (même mode d'export).
  const bnp = readPage(root, s.bnpDir);
  if (!bnp) errors.push(`${s.route} : page BNP de référence absente (${s.bnpDir})`);
  else {
    const b = headMeta(bnp);
    for (const key of ['robots', 'og:type', 'og:site_name', 'og:locale', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:image']) {
      need(JSON.stringify(m.metas.get(key) ?? []) === JSON.stringify(b.metas.get(key) ?? []), `${key} ${JSON.stringify(m.metas.get(key) ?? [])} différent de la page BNP ${JSON.stringify(b.metas.get(key) ?? [])}`);
    }
    const icons = (x: HeadMeta): string[] => x.links.filter((l) => l.rel === 'icon').map((l) => l.href);
    need(JSON.stringify(icons(m)) === JSON.stringify(icons(b)), `icône ${JSON.stringify(icons(m))} différente de la page BNP ${JSON.stringify(icons(b))}`);
  }
  return errors;
}

// ---- P1 : carte statique, aucun module client propre ----

export function staticPageErrors(root: string, s: DetailSpec, html: string, island?: string): string[] {
  const errors: string[] = [];
  const refs = new Set(pageScriptUrls(html).filter((u) => u.endsWith('.js')));
  const projects = readPage(root, 'projects');
  if (!projects) return [`${s.route} : page de référence /projects/ absente`];
  const base = new Set(pageScriptUrls(projects).filter((u) => u.endsWith('.js')));
  const extra = [...refs].filter((u) => !base.has(u));
  if (extra.length) errors.push(`${s.route} : scripts propres à la page (module client) : ${extra.join(', ')}`);
  if (/\sdata-tree-[\w-]+/.test(html)) errors.push(`${s.route} : élément de l'arbre (data-tree-*) sur une page de détail`);
  if (/\sdata-client-proof|client-proof/.test(html)) errors.push(`${s.route} : composant de preuve client-proof (retiré au 1c)`);
  if (island) {
    const name = island.slice(island.lastIndexOf('/') + 1);
    if (html.includes(name)) errors.push(`${s.route} : référence l'îlot de l'arbre ${name}`);
    if (staticClosure(root, pageScriptUrls(html)).has(island)) errors.push(`${s.route} : l'îlot ${name} est atteint par import statique`);
  }
  for (const u of refs) if (!existsSync(join(root, u.replace(/^\//, '')))) errors.push(`${s.route} : module ${u} référencé mais absent`);
  return errors;
}

// ---- Liste blanche : tout le texte du <body> vient de FAITS (page) ou de la coquille commune à la page BNP ----

// Lignes de la coquille du site (en-tête, navigation, contact, pied) : lignes du <body> de la page BNP de la même
// langue, moins celles qui sont propres au cas BNP (titre, carte, récit, FAITS §1).
export function shellLines(root: string, s: DetailSpec): string[] | null {
  const bnp = readPage(root, s.bnpDir);
  if (!bnp) return null;
  const r = bnpReference();
  const own = new Set<string>(['BNP Paribas', ...r.paragraphs[s.lang], ...r.card[s.lang], r.meta[s.lang]]);
  return textLines(bodyHtml(bnp)).filter((l) => !own.has(l));
}

export const PUNCT_ONLY = /^[\s·,;:|/•–—\-()]*$/u;

export function whitelistErrors(root: string, s: DetailSpec, html: string): string[] {
  const shell = shellLines(root, s);
  if (!shell) return [`${s.route} : page BNP de référence absente (${s.bnpDir})`];
  const ref = pageRef(s);
  const allowed = [...new Set([...shell, ref.name, ...ref.required])].filter(Boolean).sort((a, b) => b.length - a.length);
  const out: string[] = [];
  for (const line of textLines(bodyHtml(html))) {
    let rest = line;
    for (const a of allowed) rest = rest.split(a).join(' ');
    if (!PUNCT_ONLY.test(rest)) out.push(`${s.route} : texte absent de FAITS (page) et de la coquille commune : « ${rest.replace(/\s+/g, ' ').trim()} » (ligne « ${line} »)`);
  }
  return out;
}

// ---- Structure : paragraphes, titres et lignes ----

export const paragraphs = (doc: HNode): HNode[] => docOrder(doc).filter((n) => n.tag === 'p');
export const headings = (doc: HNode): HNode[] => docOrder(doc).filter((n) => /^h[1-6]$/.test(n.tag));

// ---- P2 : interdits ----

// Interdits du contrat P2 cherchés partout, JS compris (noms de technologies et de solveurs, « mieux optimisé »).
// Les noms courts (PuLP, HiGHS, SCIP, Z3) ne sont cherchés que dans le texte de la page (P2_PAGE) : dans du JS minifié,
// un identifiant de deux à cinq lettres peut les former par hasard et changer à chaque build.
export const P2_EVERYWHERE: readonly RegExp[] = [
  /mieux optimis/i,
  /\b(?:better|more) optimi[sz]ed\b/i,
  /\bopenshift\b/i,
  /\bkata\b/i,
  /\bgvisor\b/i,
  /\bpodman\b/i,
  /\blangchain\b/i,
  /\blanggraph\b/i,
  /\bor-?tools\b/i,
  /\bcp-?sat\b/i,
  /\bgurobi\b/i,
  /\bcplex\b/i,
  /\boptaplanner\b/i,
  /\btimefold\b/i,
  /\bminizinc\b/i,
  /\bpyomo\b/i,
  /\bglpk\b/i,
  /\bxpress\b/i,
  /\bmosek\b/i,
  /\bhexaly\b/i,
  /\blocalsolver\b/i,
  /\bchoco-?solver\b/i,
];
// Interdits du contrat P2 cherchés dans le texte de la page (visible, <head>, charge RSC) : le POC n'était pas
// terminé, ni livré, ni abouti ; Kubernetes ne s'écrit que comme contribution.
export const P2_PAGE: readonly RegExp[] = [
  /(?<!\p{L})(?:terminé|livré|abouti)(?:e|s|es)?(?!\p{L})/iu,
  /\b(?:completed?|finished|delivered|shipped)\b/i,
  /\b(?:sur|on|onto|dans|in|under) Kubernetes\b/i,
  /\bKubernetes[- ](?:based|native|cluster)\b/i,
  /\bpulp\b/i,
  /\bhighs\b/i,
  /\bscip\b/i,
  /\bz3\b/i,
];

// Phrases contenant « Kubernetes » sans « contribu… » (contribution, contribué, contributed).
export function kubernetesWithoutContribution(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|\n|"/);
  return sentences.filter((x) => /kubernetes/i.test(x) && !/contribu/i.test(x)).map((x) => x.trim().slice(0, 160));
}

export function forbiddenIn(text: string, patterns: readonly RegExp[]): string[] {
  return patterns.filter((p) => p.test(text)).map((p) => `${p} (« ${p.exec(text)?.[0] ?? ''} »)`);
}

export function bpceForbiddenErrors(root: string, s: DetailSpec, html: string): string[] {
  const src = pageSources(root, s, html);
  const out: string[] = [];
  const where: [string, string][] = [['texte visible', src.visible], ['<head>', src.head], ['scripts en ligne', src.inline], ['fichier .rsc', src.rsc]];
  for (const [label, text] of [...where, ['JS de la page', src.js] as [string, string]]) {
    for (const f of forbiddenIn(text, P2_EVERYWHERE)) out.push(`${s.route} : ${label} : interdit ${f}`);
  }
  for (const [label, text] of where) {
    for (const f of forbiddenIn(text, P2_PAGE)) out.push(`${s.route} : ${label} : interdit ${f}`);
    for (const k of kubernetesWithoutContribution(text)) out.push(`${s.route} : ${label} : Kubernetes hors contribution : « ${k} »`);
  }
  return out;
}

// Aucun logo ni emblème : ni image, ni SVG, ni objet embarqué, ni style en ligne avec url() ; og:image et icône
// identiques à la page BNP (vérifiés par headErrors).
export function logoErrors(s: DetailSpec, html: string): string[] {
  const body = bodyHtml(html).replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const out: string[] = [];
  for (const tag of ['img', 'svg', 'picture', 'object', 'embed', 'iframe', 'canvas', 'video', 'image']) {
    if (new RegExp(`<${tag}\\b`, 'i').test(body)) out.push(`${s.route} : <${tag}> dans la page (logo ou emblème interdit)`);
  }
  for (const m of body.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    if (/url\s*\(|image-set\s*\(/i.test(decodeEntities(m[1] ?? m[2] ?? ''))) out.push(`${s.route} : style en ligne avec une image`);
  }
  if (/<input\b[^>]*type\s*=\s*["']?image/i.test(body)) out.push(`${s.route} : <input type="image">`);
  return out;
}

// ---- P3 : interdits École 42 ----

export const P3_FORBIDDEN: readonly RegExp[] = [
  /rncp/i,
  /alumni/i,
  /\bMaster\b/,
  /\bbac\s*\+/i,
  /binôme/i,
  /\bpair(?:s|ed)?\b/i,
  /étudiant/i,
  /\bstudents?\b/i,
  /diplôm/i,
  /\bdiploma/i,
  /\bdegree\b/i,
  /\bbachelor/i,
  /\bmsc\b/i,
  /\b(?:niveau|level)\s*[1-8]\b/i,
  /expert en architecture/i,
  /concepteur développeur/i,
  /\btitre (?:professionnel|de niveau|certifié)/i,
];

export function e42ForbiddenErrors(root: string, s: DetailSpec, html: string): string[] {
  const src = pageSources(root, s, html);
  const out: string[] = [];
  for (const [label, text] of [['texte visible', src.visible], ['<head>', src.head], ['scripts en ligne', src.inline], ['fichier .rsc', src.rsc]] as [string, string][]) {
    for (const f of forbiddenIn(text, P3_FORBIDDEN)) out.push(`${s.route} : ${label} : interdit ${f}`);
  }
  return out;
}

// ---- P4 et P5 : accueils ----

// Neutralise les seuls changements permis par P4 sur un accueil : le lien de fiche des expériences BPCE et École 42
// (a[data-card-link] dans leur article[data-card]) et l'élément du nom de ces deux expériences dans le repli.
export function neutralizeHome(html: string, names: readonly string[]): string {
  let out = html;
  for (const id of ['bpce', 'ecole-42']) {
    for (const a of elementsWithAttr(out, 'data-card').filter((e) => new RegExp(`\\bdata-card="${id}"`).test(e.open))) {
      out = out.replace(a.outer, a.outer.replace(/<a\b[^>]*\bdata-card-link\b[^>]*>[\s\S]*?<\/a>/gi, ''));
    }
  }
  for (const fb of elementsWithAttr(out, 'data-tree-fallback')) {
    let inner = fb.outer;
    for (const name of names) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      inner = inner.replace(new RegExp(`<(a|span)\\b[^>]*>\\s*${esc}\\s*</(?:a|span)>`, 'g'), `§${name}§`);
    }
    out = out.replace(fb.outer, inner);
  }
  return out;
}

// Document normalisé : scripts retirés, commentaires retirés (séparateurs de texte « <!-- --> » de React, posés selon
// le découpage du rendu en flux), noms d'actifs hachés remplacés, blancs réduits (règle de E15.1, étendue au <head>).
export function normalizedDocument(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/_next\/static\/[^"'\s)]+/g, '/_next/static/*')
    .replace(/\s+/g, ' ')
    .trim();
}
export const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
export const HOME_NAMES = (): string[] => [bpceReference().name, ecole42Reference().name];
export function pageDigest(route: string, html: string): string {
  const h = route === '/' || route === '/fr/' ? neutralizeHome(html, HOME_NAMES()) : html;
  return sha(normalizedDocument(h));
}

export const BASELINE_2B = 'baseline-6d9e441.json';
export interface Baseline2b {
  commit: string;
  commande: string;
  pages: Record<'preview' | 'public', Record<string, string>>;
}

export const caseLinkLabel = (l: Lang): string => faitsCommons().caseLink[l];

// ---- Page conforme synthétique (témoins négatifs) ----
// Construite à partir de la page BNP exportée de la même langue (coquille, en-tête, scripts) et des textes de FAITS.
// Elle ne préjuge pas du balisage que choisira le codeur : elle sert seulement de base saine aux mutations.
export const escHtml = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

export function conformingPage(root: string, s: DetailSpec): string {
  const bnp = readPage(root, s.bnpDir);
  if (!bnp) throw new Error(`page BNP absente (${s.bnpDir}) : témoin impossible`);
  const ref = pageRef(s);
  const l = s.lang;
  const title = escHtml(`${ref.name} | Arnaud Durand`);
  const desc = escHtml(descriptionCandidates(s)[0] ?? '');
  let article: string;
  if (s.id === 'bpce') {
    const r = bpceReference();
    article =
      `<header class="page-intro"><p>${escHtml(r.role[l])} · ${escHtml(r.dates[l])}</p><h1>${escHtml(ref.name)}</h1>` +
      `<p class="intro">${escHtml(r.cardHook[l])}<br/><span class="contribution">${escHtml(r.cardSubtitle[l])}</span></p></header>` +
      `<div class="prose"><p>${escHtml(r.sandbox[l])}</p><h2>${escHtml(r.trainingTitle[l])}</h2><p>${escHtml(r.training[l])}</p></div>`;
  } else {
    const r = ecole42Reference();
    article =
      `<header class="page-intro"><h1>${escHtml(ref.name)}</h1><p class="intro">${escHtml(r.line)}<br/><span class="contribution">${escHtml(r.cardSubtitle[l])}</span></p></header>` +
      `<div class="prose"><p>${escHtml(r.paragraph[l])}</p></div>`;
  }
  return bnp
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m: string, a: string) => (/\bsrc\s*=/.test(a) ? m : ''))
    .split('/experiences/bnp-paribas/')
    .join(`/experiences/${s.id}/`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/(<meta\b[^>]*(?:name|property)="(?:og:|twitter:)?title"[^>]*content=")[^"]*(")/gi, `$1${title}$2`)
    .replace(/(<meta\b[^>]*(?:name|property)="(?:og:|twitter:)?description"[^>]*content=")[^"]*(")/gi, `$1${desc}$2`)
    .replace(/<article\b[\s\S]*?<\/article>/i, `<article class="story">${article}</article>`);
}
