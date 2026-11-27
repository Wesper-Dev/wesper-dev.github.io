// Contrat du lot 4, Q2 : en-tête, pied et typographie communs. Les 18 routes intérieures et la 404 ont l'en-tête et
// le pied de l'accueil de leur langue (structure par attributs data-site-*, libellés, liens, menu du téléphone), avec
// une bascule de langue vers la page équivalente ; Inter Tight et IBM Plex Mono partout ; Bricolage Grotesque et
// Public Sans ne sont plus ni préchargées ni référencées et quittent l'export ; poids des polices ≤ celui que
// l'accueil charge à a040fb0. L'accueil ne change pas, hors ce que le contrat impose (Q1 palette et theme-color,
// Q6 image de partage) et hors les changements listés dans HOME_CHANGES.
// Lectures retenues (rapport-tests-lot4.md) : le <h1> de l'accueil (nom et titre) n'est pas exigé tel quel sur les
// pages intérieures, qui gardent leur propre <h1> (Q3) : on exige un seul <h1> par page, dans le <main> ; le nom n'y
// porte pas aria-current="page" ; la 404 (en anglais) bascule vers /fr/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bodyHtml, textLines } from './helpers-2b.ts';
import { HOME_ROUTES_4, LOT4_PAGES, equivalentRoute, filesUnder, homeDigest, homeOf, langOf, readBaseline4, readRoute, rel, revertNamedExceptionsHtml, woff2Files } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf } from './helpers.ts';
import { byTag, cmapCodepoints, docOrder, exportCss, inRanges, parseHtml, parseUnicodeRange } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';
import { withoutFaqSection } from './helpers-6.ts';

// Changements de l'accueil admis par l'orchestrateur pour le lot 4 (« route : raison »), à re-valider par Arnaud
// (contrat Q2, PLAN §4 principe 5). Vide : l'accueil ne change pas hors Q1 (palette, theme-color) et Q6.
const HOME_CHANGES: readonly string[] = [];

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export : contrat lot 4, Q2`);
  return html;
};
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
const textOf = (n: HNode): string => {
  const walk = (x: HNode): string => (x.tag === '#text' ? x.text : x.tag === 'script' || x.tag === 'style' ? '' : x.children.map(walk).join(''));
  return squash(walk(n));
};
const siteAttrs = (n: HNode): string[] => Object.keys(n.attrs).filter((a) => a.startsWith('data-site-')).sort();

// Signature de l'en-tête : chaque élément porteur d'un attribut data-site-* ou de l'id site-menu, dans l'ordre du
// document, avec ses attributs utiles et son texte. Le lien de langue est ramené à « (page équivalente) » ; la balise
// de [data-site-id] (h1 sur l'accueil) et aria-current du nom ne sont pas comparés (lecture retenue).
function headerSignature(html: string, route: string, isHome: boolean): { sig: string[]; count: number } {
  const doc = parseHtml(html);
  const headers = docOrder(doc).filter((n) => Object.prototype.hasOwnProperty.call(n.attrs, 'data-site-header'));
  const h = headers[0];
  if (!h) return { sig: [], count: 0 };
  const sig: string[] = [];
  for (const n of docOrder(h)) {
    const keys = siteAttrs(n);
    if (!keys.length && n.attrs.id !== 'site-menu') continue;
    const k = keys.map((a) => `${a}=${n.attrs[a]}`).join(' ');
    const tag = keys.includes('data-site-id') ? '*' : n.tag;
    const at: Record<string, string | undefined> = {};
    for (const a of ['href', 'type', 'hreflang', 'lang', 'aria-label', 'popover', 'popovertarget', 'id', 'target']) at[a] = n.attrs[a];
    if (n.attrs['data-site-link'] === 'lang') at.href = isHome ? '(page équivalente)' : n.attrs.href === equivalentRoute(route) ? '(page équivalente)' : `${n.attrs.href} (≠ ${equivalentRoute(route)})`;
    const text = keys.includes('data-site-id') || keys.includes('data-site-nav') || n.attrs.id === 'site-menu' || keys.includes('data-site-actions') ? '' : textOf(n);
    sig.push(`${tag}[${k}] ${JSON.stringify(at)} « ${text} »`);
  }
  return { sig, count: headers.length };
}
function footerSignature(html: string): { lines: string[]; links: string[]; count: number } {
  const doc = parseHtml(html);
  const f = docOrder(doc).filter((n) => Object.prototype.hasOwnProperty.call(n.attrs, 'data-site-footer'));
  const one = f[0];
  if (!one) return { lines: [], links: [], count: 0 };
  const texts: string[] = [];
  const walk = (x: HNode): void => {
    if (x.tag === '#text') texts.push(squash(x.text));
    else if (x.tag !== 'script' && x.tag !== 'style') x.children.forEach(walk);
  };
  walk(one);
  return { lines: texts.filter(Boolean), links: byTag(one, 'a').map((a) => `${a.attrs.href} « ${textOf(a)} »`), count: f.length };
}

test('Q2 : chaque page intérieure et la 404 a l\'en-tête de l\'accueil de sa langue (nom, titre, CV, menu natif, cinq liens dans l\'ordre, bascule vers la page équivalente)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    const home = headerSignature(page(homeOf(langOf(route))), homeOf(langOf(route)), true);
    assert.ok(home.count === 1 && home.sig.length >= 8, `accueil ${homeOf(langOf(route))} : en-tête de référence introuvable`);
    const got = headerSignature(page(route), route, false);
    if (got.count !== 1) errors.push(`${route} : un seul [data-site-header] attendu, reçu ${got.count}`);
    else if (JSON.stringify(got.sig) !== JSON.stringify(home.sig)) {
      const missing = home.sig.filter((x) => !got.sig.includes(x));
      const extra = got.sig.filter((x) => !home.sig.includes(x));
      errors.push(`${route} : en-tête différent de celui de l'accueil ; absents : ${JSON.stringify(missing)} ; en trop ou différents : ${JSON.stringify(extra)}`);
    }
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q2\n${errors.join('\n')}`);
});

test('Q2 : aucun lien ne porte aria-current="page" s\'il ne mène pas à la page elle-même (le nom ne le porte pas hors de l\'accueil)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    for (const a of byTag(parseHtml(page(route)), 'a')) {
      if (a.attrs['aria-current'] !== 'page') continue;
      const href = (a.attrs.href ?? '').replace(/#.*$/, '');
      if (href !== route) errors.push(`${route} : aria-current="page" sur un lien vers ${a.attrs.href} (« ${textOf(a)} »)`);
    }
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q2\n${errors.join('\n')}`);
});

test('Q2 : chaque page intérieure et la 404 a le pied de l\'accueil de sa langue (mêmes textes, mêmes liens) et un lien d\'évitement vers #main en premier', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    const homeHtml = page(homeOf(langOf(route)));
    const want = footerSignature(homeHtml);
    assert.ok(want.count === 1 && want.lines.length >= 2, 'pied de référence introuvable sur l\'accueil');
    const html = page(route);
    const got = footerSignature(html);
    if (got.count !== 1) errors.push(`${route} : un seul [data-site-footer] attendu, reçu ${got.count}`);
    else {
      if (JSON.stringify(got.lines) !== JSON.stringify(want.lines)) errors.push(`${route} : textes du pied ${JSON.stringify(got.lines)} ≠ accueil ${JSON.stringify(want.lines)}`);
      if (JSON.stringify(got.links) !== JSON.stringify(want.links)) errors.push(`${route} : liens du pied ${JSON.stringify(got.links)} ≠ accueil ${JSON.stringify(want.links)}`);
    }
    // Lien d'évitement : premier élément focalisable du <body>, vers #main, au texte de celui de l'accueil.
    const skip = (h: string): HNode | undefined => docOrder(parseHtml(bodyHtml(h))).find((n) => (n.tag === 'a' && n.attrs.href !== undefined) || n.tag === 'button');
    const hs = skip(homeHtml);
    const ps = skip(html);
    if (!ps || ps.tag !== 'a' || ps.attrs.href !== '#main' || textOf(ps) !== (hs ? textOf(hs) : '§')) errors.push(`${route} : premier élément focalisable ${ps ? `<${ps.tag} href="${ps.attrs.href}"> « ${textOf(ps)} »` : 'absent'} ; lien d'évitement « ${hs ? textOf(hs) : '?'} » vers #main attendu`);
    if (!docOrder(parseHtml(html)).some((n) => n.tag === 'main' && n.attrs.id === 'main')) errors.push(`${route} : <main id="main"> absent`);
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q2\n${errors.join('\n')}`);
});

test('Q2 : un seul <h1> par page intérieure et 404, dans le <main> (lecture retenue : le <h1> de l\'accueil ne se répète pas)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    const doc = parseHtml(page(route));
    const h1 = byTag(doc, 'h1');
    const main = byTag(doc, 'main')[0];
    const inMain = (n: HNode): boolean => {
      for (let p = n.parent; p; p = p.parent) if (p === main) return true;
      return false;
    };
    if (h1.length !== 1 || !inMain(h1[0] as HNode)) errors.push(`${route} : ${h1.length} <h1>, ${h1.filter(inMain).length} dans le <main>`);
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q2\n${errors.join('\n')}`);
});

// ---- Polices ----

const OLD_FONT_FILE = /bricolage|public-?sans/i;
const OLD_FONT_NAME = /bricolage|public[\s-]?sans/i;

test('Q2 : Bricolage Grotesque et Public Sans quittent l\'export (fichiers, licences), les CSS et le HTML des 21 pages (ni préchargées ni référencées)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const f of filesUnder(distDir).filter((x) => OLD_FONT_FILE.test(x.split('/').pop() ?? ''))) errors.push(`fichier ${rel(distDir, f)} dans l'export`);
  const css = filesUnder(distDir).filter((f) => f.endsWith('.css'));
  for (const f of css) {
    const t = readFileSync(f, 'utf8');
    if (OLD_FONT_NAME.test(t) || OLD_FONT_FILE.test(t)) errors.push(`${rel(distDir, f)} : « ${(OLD_FONT_NAME.exec(t) ?? OLD_FONT_FILE.exec(t))?.[0]} »`);
  }
  for (const route of [...HOME_ROUTES_4, ...LOT4_PAGES]) {
    const html = page(route).replace(/<script\b[\s\S]*?<\/script>/gi, '');
    if (OLD_FONT_NAME.test(html) || OLD_FONT_FILE.test(html)) errors.push(`${route} : « ${(OLD_FONT_NAME.exec(html) ?? OLD_FONT_FILE.exec(html))?.[0]} » dans le HTML`);
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q2\n${errors.join('\n')}`);
});

test('Q2 : Σ des WOFF2 de l\'export ≤ poids des polices que l\'accueil charge à a040fb0 (préchargements Inter Tight et IBM Plex Mono)', (t) => {
  assertDistExists();
  const ref = readBaseline4().mesures[exportModeOf(distDir)].homeFonts;
  const files = woff2Files(distDir);
  const total = files.reduce((s, f) => s + statSync(f).size, 0);
  t.diagnostic(`WOFF2 : ${files.map((f) => `${rel(distDir, f)}=${statSync(f).size}`).join(', ')} ; Σ ${total} ; plafond ${ref.bytes} (${ref.files.join(', ')})`);
  assert.ok(total <= ref.bytes, `contrat lot 4, Q2 : Σ WOFF2 ${total} octets > ${ref.bytes} (polices de l'accueil à a040fb0)`);
});

test('Q2 : chaque page intérieure et la 404 précharge au plus deux polices, prises parmi celles que précharge l\'accueil (as=font, type=font/woff2, crossorigin)', () => {
  // Remplace E9.5 « préchargements des pages secondaires = 4ed945b » (lot 2b).
  assertDistExists();
  const fontLinks = (html: string): Record<string, string>[] =>
    [...(/<head\b[\s\S]*?<\/head>/i.exec(html)?.[0] ?? '').matchAll(/<link\b([^>]*)>/gi)]
      .map((m) => Object.fromEntries([...(m[1] ?? '').matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((x) => [(x[1] ?? '').toLowerCase(), x[2] ?? ''])))
      .filter((a) => (a.rel ?? '').toLowerCase() === 'preload' && (a.as === 'font' || /\.woff2?$/.test(a.href ?? '')));
  const homeFonts = new Set(fontLinks(page('/')).map((a) => a.href));
  const errors: string[] = [];
  for (const route of LOT4_PAGES) {
    const links = fontLinks(page(route));
    if (links.length > 2) errors.push(`${route} : ${links.length} polices préchargées`);
    for (const a of links) {
      if (!homeFonts.has(a.href ?? '')) errors.push(`${route} : ${a.href} préchargée, absente des préchargements de l'accueil`);
      if (a.as !== 'font' || a.type !== 'font/woff2' || a.crossorigin === undefined) errors.push(`${route} : préchargement ${a.href} sans as=font, type=font/woff2 ou crossorigin`);
      if (a.href && !existsSync(join(distDir, a.href.replace(/^\//, '')))) errors.push(`${route} : ${a.href} absente de l'export`);
    }
  }
  assert.deepEqual(errors, [], `contrat lot 4, Q2\n${errors.join('\n')}`);
});

// Couverture : chaque caractère visible des pages intérieures est dans Inter Tight (unicode-range et cmap) ; celui
// d'un <code>, <pre>, <kbd> ou <samp> dans IBM Plex Mono. Sinon une police système le dessinerait.
function coverage(family: string): ((cp: number) => boolean) | null {
  const faces = exportCss().fontFaces.filter((f) => f.family === family);
  if (!faces.length) return null;
  const loaded = faces.map((f) => ({ ranges: parseUnicodeRange(f.unicodeRange || 'U+0-10FFFF'), cmap: new Set<number>(f.urls.flatMap((u) => [...cmapCodepoints(readFileSync(join(distDir, u.replace(/^\//, ''))))])) }));
  return (cp) => loaded.some((f) => inRanges(cp, f.ranges) && f.cmap.has(cp));
}
test('Q2 : chaque caractère visible des pages intérieures et de la 404 est couvert par Inter Tight (code : IBM Plex Mono)', () => {
  assertDistExists();
  const inter = coverage('Inter Tight');
  const plex = coverage('IBM Plex Mono');
  assert.ok(inter && plex, 'contrat lot 4, Q2 : @font-face Inter Tight ou IBM Plex Mono absente des CSS exportés');
  const miss = new Map<string, Set<string>>();
  const note = (ch: string, where: string): void => {
    const k = `${ch} (U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')})`;
    (miss.get(k) ?? miss.set(k, new Set()).get(k))?.add(where);
  };
  for (const route of LOT4_PAGES) {
    const html = page(route);
    const codeRe = /<(code|pre|kbd|samp)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    const code = [...bodyHtml(html).matchAll(codeRe)].map((m) => textLines(m[2] ?? '').join(' ')).join(' ');
    const prose = textLines(bodyHtml(html).replace(codeRe, ' ')).join(' ');
    for (const ch of new Set([...prose].filter((c) => !/[\s\p{Cc}\p{Cf}]/u.test(c)))) if (!inter((ch.codePointAt(0) ?? 0))) note(ch, route);
    for (const ch of new Set([...code].filter((c) => !/[\s\p{Cc}\p{Cf}]/u.test(c)))) if (!plex((ch.codePointAt(0) ?? 0))) note(ch, `${route} (code)`);
  }
  const out = [...miss].map(([k, v]) => `${k} : ${[...v].slice(0, 4).join(', ')}${v.size > 4 ? '…' : ''}`);
  assert.deepEqual(out, [], `contrat lot 4, Q2 : caractères non couverts\n${out.join('\n')}`);
});

// ---- L'accueil ne change pas ----

test('Q2 : les deux accueils = a040fb0 (document normalisé), hors palette par défaut et theme-color (Q1), image de partage (Q6, S2), texte alternatif nommé (S3), section FAQ (lot 6a, V1) et HOME_CHANGES', () => {
  // Remplace, pour les accueils, P5 « = 6d9e441 » : le passage à foret (Q1) change les jetons écrits dans le HTML.
  assertDistExists();
  const mode = exportModeOf(distDir);
  const ref = readBaseline4().homes[mode];
  const diffs: string[] = [];
  for (const route of HOME_ROUTES_4) {
    if (HOME_CHANGES.some((x) => x.startsWith(route + ' '))) continue;
    // Lot 4, S3 : og:image:alt nouveau exact ramené à a040fb0 (exception nommée, fixtures/exceptions-s.json).
    // Lot 6a (V1) : la section FAQ, imposée par le contrat, est retirée avant l'empreinte ; le reste de l'accueil ne bouge pas.
    if (homeDigest(withoutFaqSection(revertNamedExceptionsHtml(route, page(route)))) !== ref[route]) diffs.push(`${route} : HTML de l'accueil différent de a040fb0 hors Q1 et Q6 : à lister dans HOME_CHANGES pour re-validation (contrat lot 4, Q2)`);
  }
  assert.deepEqual(diffs, [], `(${mode})`);
});

test('Q2 (témoins) : l\'empreinte des accueils ignore palette, theme-color et image de partage ; elle change pour un lien, un texte, un préchargement ou une classe', () => {
  assertDistExists();
  const html = page('/fr/');
  const same = html
    .replace(/#050A08/g, '#040C0A')
    .replace(/#0D1712/g, '#051912')
    .replace('<head>', '<head><meta name="theme-color" content="#040C0A"/>')
    .split('https://wesper-dev.github.io/og.jpg')
    .join('https://wesper-dev.github.io/og-arbre.png');
  assert.notEqual(same, html);
  assert.equal(homeDigest(same), homeDigest(html), 'palette, theme-color ou image de partage prise pour un changement');
  const muts: [string, string][] = [
    ['lien CV', html.replace('/cv/arnaud-durand-cv-platform-fr.pdf"', '/cv/x.pdf"')],
    ['texte du pied', html.replace(/(<footer\b[^>]*>[\s\S]*?<span>)/, '$1x')],
    ['préchargement retiré', html.replace(/<link\b[^>]*rel="preload"[^>]*inter-tight[^>]*>/, '')],
    ['classe changée', html.replace('class="tree-case-link"', 'class="autre"')],
    ['couleur hors style', html.replace('<footer data-site-footer="">', '<footer data-site-footer="" data-x="#123456">')],
  ];
  for (const [label, m] of muts) {
    assert.notEqual(m, html, `mutation « ${label} » sans effet`);
    assert.notEqual(homeDigest(m), homeDigest(html), `« ${label} » doit changer l'empreinte`);
  }
});

test('Q2 (témoins) : l\'en-tête de l\'accueil transplanté sur une page intérieure (h1 → div, sans aria-current, langue vers la page équivalente) passe ; un lien retiré, un libellé changé ou une bascule vers l\'accueil rougissent', () => {
  assertDistExists();
  const route = '/fr/skills/';
  const home = page('/fr/');
  const header = /<header\b[^>]*data-site-header[\s\S]*?<\/header>/i.exec(home)?.[0];
  assert.ok(header, 'en-tête de l\'accueil introuvable');
  const moved = header
    .replace(/<h1\b([^>]*)>/, '<div$1>')
    .replace(/<\/h1>/, '</div>')
    .replace(/\saria-current="page"/, '')
    .replace(/(data-site-link="lang" href=")[^"]*/, `$1${equivalentRoute(route)}`);
  const html = page(route).replace(/<header\b[\s\S]*?<\/header>/i, moved);
  const sig = (h: string): string[] => headerSignature(h, route, false).sig;
  const want = headerSignature(home, '/fr/', true).sig;
  assert.deepEqual(sig(html), want, 'en-tête transplanté jugé différent');
  const muts: [string, string][] = [
    ['lien GitHub retiré', html.replace(/<a\b[^>]*data-site-link="github"[^>]*>[\s\S]*?<\/a>/, '')],
    ['libellé du CV changé', html.replace(/(<a\b[^>]*data-site-cv[^>]*>)([^<]*)/, '$1x$2')],
    ['bascule vers l\'accueil anglais', html.replace(`data-site-link="lang" href="${equivalentRoute(route)}"`, 'data-site-link="lang" href="/"')],
    ['menu sans popover', html.replace(/(id="site-menu"[^>]*?)\spopover="auto"/, '$1')],
  ];
  for (const [label, m] of muts) {
    assert.notEqual(m, html, `mutation « ${label} » sans effet`);
    assert.notDeepEqual(sig(m), want, `« ${label} » non détecté`);
  }
});
