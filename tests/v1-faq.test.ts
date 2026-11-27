// Contrat du lot 6a, V1 (tmp/refonte-arbre/contrat-lot6a.md) : FAQ de l'accueil, cinquième section après contact
// (Q-R4), data-home-section="faq", un <h2>, quatre à six questions en <h3> ou <dt>, réponses en HTML statique toujours
// visibles (ni accordéon ni JS), liens du brouillon ; styles de l'accueil existants (jetons, polices), aucune animation.
// Les textes sont provisoires : ces tests LISENT site/content/faq.json (forme : helpers-6.ts) et ne recopient aucun
// texte. Le texte courant est figé à part (v8-textes-figes.test.ts). Contraste, cibles, débordement, rendu sans JS :
// tmp/refonte-arbre/verif-6/verif.mjs. Typographie R1 : r1-typographie.test.ts (qui lit content/*.json, clé fr).
// Tour X (tmp/refonte-arbre/arbitrage-audit-lot6a.md) : la section porte id="faq" (X6, ancre /#faq) ; aucun lien de la
// FAQ ne porte target ni rel (X3, A12) ; apostrophe courbe U+2019 seule dans le texte de faq.json et dans le texte
// rendu de la FAQ (X6, M7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertDistExists, distDir, readManifest } from './helpers.ts';
import { readRoute } from './helpers-4.ts';
import { byAttr, byTag, cmapCodepoints, contains, docOrder, elChildren, exportCss, inRanges, parseHtml, parseUnicodeRange } from './helpers-home.ts';
import { CV_PDFS, FAQ_FIXTURE, HOMES, LANGS6, blanks, expectedItems, faqHiddenOrInteractive, faqShapeErrors, faqStrings, langOfRoute, readFaq, readFaqRaw, renderedFaq, visibleOf, withoutFaqSection } from './helpers-6.ts';
import type { FaqContent, Lang, RenderedFaq } from './helpers-6.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : accueil absent de l'export (contrat lot 6a, V1)`);
  return html;
};
const prefix = (l: Lang): string => (l === 'fr' ? '/fr/' : '/');

// Écarts entre la FAQ rendue d'un accueil et le fichier de contenu (pur : sert aussi aux témoins).
function faqDiffs(route: string, html: string, c: FaqContent): string[] {
  const l = langOfRoute(route);
  const f: RenderedFaq = renderedFaq(html);
  const out: string[] = [];
  if (f.sections.length !== 1) return [`${route} : ${f.sections.length} section(s) [data-home-section="faq"] (une attendue)`];
  const s = f.section!;
  if (s.tag !== 'section') out.push(`${route} : [data-home-section="faq"] est un <${s.tag}> (<section> attendu)`);
  if (f.first?.tag !== 'h2') out.push(`${route} : la FAQ doit s'ouvrir par un <h2> (premier enfant : <${f.first?.tag}>)`);
  if (byTag(s, 'h2').length !== 1) out.push(`${route} : ${byTag(s, 'h2').length} <h2> dans la FAQ (un attendu)`);
  if (blanks(f.title) !== blanks(c[l].title)) out.push(`${route} : titre « ${f.title} » ≠ faq.json ${l}.title « ${c[l].title} »`);
  const want = expectedItems(c, l);
  const ids = f.items.map((i) => i.id);
  if (JSON.stringify(ids) !== JSON.stringify(want.map((w) => w.id))) out.push(`${route} : [data-faq-item] ${JSON.stringify(ids)} ≠ ids de faq.json ${JSON.stringify(want.map((w) => w.id))}`);
  for (const [i, w] of want.entries()) {
    const it = f.items[i];
    if (!it) break;
    const at = `${route} [data-faq-item=${w.id}]`;
    if (it.questions.length !== 1) out.push(`${at} : ${it.questions.length} [data-faq-question] (un attendu)`);
    else if (!['h3', 'dt'].includes(it.questions[0]!.tag)) out.push(`${at} : question en <${it.questions[0]!.tag}> (<h3> ou <dt> attendu)`);
    if (it.answers.length !== 1) out.push(`${at} : ${it.answers.length} [data-faq-answer] (un attendu)`);
    if (blanks(it.question) !== blanks(w.question)) out.push(`${at} : question « ${it.question} » ≠ « ${w.question} »`);
    if (JSON.stringify(it.answerBlocks) !== JSON.stringify(w.blocks.map(blanks))) out.push(`${at} : blocs de réponse ${JSON.stringify(it.answerBlocks)} ≠ ${JSON.stringify(w.blocks.map(blanks))} (un élément de bloc par entrée de answer, ni plus ni moins)`);
    const got = it.links.map((x) => `${x.href} « ${blanks(x.text)} »`);
    const exp = w.links.map((x) => `${x.href} « ${blanks(x.text)} »`);
    if (JSON.stringify(got) !== JSON.stringify(exp)) out.push(`${at} : liens ${JSON.stringify(got)} ≠ ${JSON.stringify(exp)}`);
    if (w.link) {
      if (it.linkEls.length !== 1) out.push(`${at} : ${it.linkEls.length} [data-faq-link] (un attendu)`);
      else {
        const le = it.linkEls[0]!;
        if (it.answers[0] && (contains(it.answers[0], le) || le === it.answers[0])) out.push(`${at} : [data-faq-link] dans [data-faq-answer] (hors de la réponse attendu)`);
        if (!byTag(le, 'a').some((a) => a.attrs.href === w.link!.href) && !(le.tag === 'a' && le.attrs.href === w.link.href)) out.push(`${at} : [data-faq-link] ne porte pas le lien ${w.link.href}`);
      }
    } else if (it.linkEls.length) out.push(`${at} : [data-faq-link] alors que link est null`);
    if (it.answers[0] && it.questions[0] && (contains(it.answers[0], it.questions[0]) || contains(it.questions[0], it.answers[0]))) out.push(`${at} : question et réponse imbriquées`);
  }
  // Rien d'autre dans la section : Q2, S, T0 et V7 retirent la section ENTIÈRE avant l'empreinte de l'accueil ; un
  // paragraphe ou un lien ajouté hors des items n'y serait vu nulle part. Le texte visible de la section doit donc être
  // exactement titre + (question, blocs de réponse, ligne de lien) de chaque item, et ses liens ceux des items.
  const noZw = (t: string): string => blanks(t.replace(/\u200b/g, ''));
  const wantText = noZw([c[l].title, ...want.flatMap((w) => [w.question, ...w.blocks, ...(w.link ? [w.link.text] : [])])].join(' '));
  const gotText = noZw(visibleOf(s));
  if (gotText !== wantText) {
    let k = 0;
    while (k < gotText.length && gotText[k] === wantText[k]) k++;
    out.push(`${route} : texte visible de la section ≠ titre, questions, réponses et lignes de lien de faq.json (contenu en plus ou en moins hors des items ?) au caractère ${k} : « …${gotText.slice(Math.max(0, k - 20), k + 40)}… »`);
  }
  const allLinks = byTag(s, 'a').map((a) => a.attrs.href ?? '');
  const itemLinks = want.flatMap((w) => w.links.map((x) => x.href));
  if (JSON.stringify(allLinks) !== JSON.stringify(itemLinks)) out.push(`${route} : liens de la section ${JSON.stringify(allLinks)} ≠ liens des items ${JSON.stringify(itemLinks)}`);
  const strays = byAttr(s, 'data-faq-question').length - f.items.length;
  if (strays > 0) out.push(`${route} : ${strays} question(s) hors d'un [data-faq-item]`);
  out.push(...faqHiddenOrInteractive(s).map((e) => `${route} : ${e}`));
  return out;
}
// Place de la section (pure).
function placeDiffs(route: string, html: string): string[] {
  const doc = parseHtml(html);
  const main = byAttr(doc, 'id', 'main')[0];
  if (!main) return [`${route} : <main id="main"> absent`];
  const sections = byAttr(main, 'data-home-section').map((x) => x.attrs['data-home-section']);
  const out: string[] = [];
  if (JSON.stringify(sections) !== JSON.stringify(['projects', 'hackathons', 'about', 'contact', 'faq'])) out.push(`${route} : sections ${JSON.stringify(sections)} (projects, hackathons, about, contact, faq attendu : Q-R4)`);
  const all = byAttr(doc, 'data-home-section', 'faq');
  if (all.some((x) => !contains(main, x))) out.push(`${route} : section FAQ hors du <main>`);
  const faq = all[0];
  if (faq && elChildren(main).at(-1) !== faq) out.push(`${route} : la FAQ n'est pas le dernier enfant du <main> (après contact, Q-R4)`);
  if (faq && faq.attrs.id !== 'faq') out.push(`${route} : la section FAQ porte id=${JSON.stringify(faq.attrs.id ?? null)} (id="faq" attendu, ancre /#faq, X6)`);
  const ids = byAttr(doc, 'id', 'faq').length;
  if (faq && ids !== 1) out.push(`${route} : ${ids} élément(s) id="faq" dans la page (un attendu)`);
  return out;
}

test('V1 : site/content/faq.json : fr et en, titre, quatre à six questions appariées (mêmes id, même ordre), chaque réponse avec au moins un lien ; liens internes de la langue vers une route ou un PDF du CV', () => {
  const raw = readFaqRaw();
  assert.deepEqual(faqShapeErrors(raw), [], 'forme de faq.json');
  const c = raw as FaqContent;
  const errors: string[] = [];
  const routes = new Set(readManifest().paths.flatMap((p) => ['/' + p, '/fr/' + p]));
  if (JSON.stringify(c.fr.items.map((i) => i.id)) !== JSON.stringify(c.en.items.map((i) => i.id))) errors.push(`ids fr ${JSON.stringify(c.fr.items.map((i) => i.id))} ≠ ids en ${JSON.stringify(c.en.items.map((i) => i.id))}`);
  for (const l of LANGS6) {
    for (const w of expectedItems(c, l)) {
      if (!w.links.length) errors.push(`${l} ${w.id} : réponse sans lien (un lien interne ou public par réponse)`);
      for (const k of w.links) {
        if (k.href.startsWith('/')) {
          if (CV_PDFS.includes(k.href)) continue;
          if (!routes.has(k.href)) errors.push(`${l} ${w.id} : ${k.href} n'est ni une route de content/routes.json ni un PDF du CV`);
          else if (langOfRoute(k.href) !== l) errors.push(`${l} ${w.id} : ${k.href} mène à l'autre langue`);
        } else if (!/^https:\/\/[^\s]+$/.test(k.href)) errors.push(`${l} ${w.id} : lien « ${k.href} » ni interne absolu ni https`);
      }
    }
    // Q-R9 : les deux questions imposées, repérées par leur cible et non par leur texte (provisoire).
    const items = expectedItems(c, l);
    if (!items.some((w) => w.links.some((k) => k.href === `${prefix(l)}experiences/bnp-paribas/`))) errors.push(`${l} : aucune question ne mène au cas BNP (${prefix(l)}experiences/bnp-paribas/), Q-R9 « Quel outil a atteint la production ? »`);
    if (!items.some((w) => w.links.some((k) => k.href.startsWith('https://github.com/Wesper-Dev/droit-de-retard')))) errors.push(`${l} : aucune question ne mène au dépôt droit-de-retard, Q-R9 « Où consulter le code de droit-de-retard… »`);
  }
  assert.deepEqual(errors, []);
});

test('V1, X6 : chaque accueil a une seule FAQ, cinquième et dernière section du <main>, après contact (Q-R4), d\'id « faq »', () => {
  assertDistExists();
  const errors = HOMES.flatMap((r) => placeDiffs(r, page(r)));
  assert.deepEqual(errors, []);
});

test('V1, X3 : la FAQ de chaque accueil = faq.json de sa langue : <h2> = title, un [data-faq-item] par question dans l\'ordre, question en <h3> ou <dt>, blocs de réponse et liens identiques ; réponses en HTML statique, sans accordéon, bouton, hidden, inert ni script ; liens sans target ni rel', () => {
  assertDistExists();
  const c = readFaq();
  const errors = HOMES.flatMap((r) => faqDiffs(r, page(r), c));
  assert.deepEqual(errors, []);
});

// X6 (pur) : apostrophes droites U+0027 dans des textes (chemin, extrait).
const straight = (where: string, s: string): string[] => [...s.matchAll(/'/g)].map((m) => `${where} : apostrophe droite U+0027 dans « …${s.slice(Math.max(0, m.index - 20), m.index + 20)}… » (U+2019 attendue, X6)`);
test('X6 : apostrophe courbe U+2019 seule dans le texte de faq.json (titres, questions, réponses, libellés, FR et EN) et dans le texte rendu de la FAQ des deux accueils', () => {
  assertDistExists();
  const c = readFaq();
  const errors: string[] = [];
  for (const l of LANGS6) for (const s of faqStrings(c, l)) errors.push(...straight(`faq.json ${l}`, s));
  for (const r of HOMES) {
    const s = renderedFaq(page(r)).section;
    if (!s) errors.push(`${r} : FAQ absente`);
    else errors.push(...straight(`${r} texte rendu de la FAQ`, visibleOf(s)));
  }
  assert.deepEqual(errors, []);
});

test('V1 : hiérarchie : la FAQ suit les autres sections (h2 puis h3 ou dl), aucun saut de niveau ; aucun <h1> dans la FAQ', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const r of HOMES) {
    const s = renderedFaq(page(r)).section;
    if (!s) {
      errors.push(`${r} : FAQ absente`);
      continue;
    }
    const levels = docOrder(s).filter((n) => /^h[1-6]$/.test(n.tag)).map((n) => Number(n.tag[1]));
    if (levels.includes(1)) errors.push(`${r} : <h1> dans la FAQ`);
    for (let i = 1; i < levels.length; i++) if ((levels[i] as number) > (levels[i - 1] as number) + 1) errors.push(`${r} : saut h${levels[i - 1]} → h${levels[i]} dans la FAQ`);
    for (const dt of byTag(s, 'dt')) if (!byTag(s, 'dl').some((dl) => contains(dl, dt))) errors.push(`${r} : <dt> hors d'un <dl>`);
  }
  assert.deepEqual(errors, []);
});

// Règles CSS propres à la FAQ : sélecteur qui nomme faq (attribut data-home-section="faq" ou data-faq-*).
const FAQ_SELECTOR = /faq/i;
const COLOR_PROPS = /^(?:color|background(?:-color)?|border(?:-[a-z]+)*-color|border(?:-(?:top|right|bottom|left))?|outline(?:-color)?|text-decoration(?:-color)?|fill|stroke|box-shadow|caret-color|accent-color)$/;
const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
function faqCssErrors(rules: { selector: string; declList: [string, string][] }[]): string[] {
  const out: string[] = [];
  for (const r of rules) {
    if (!FAQ_SELECTOR.test(r.selector)) continue;
    for (const [k, v] of r.declList) {
      if (/^(?:animation|transition)/.test(k)) out.push(`${r.selector} { ${k}: ${v} } : aucune animation dans la FAQ`);
      if (COLOR_PROPS.test(k) && LITERAL_COLOR.test(v.replace(/var\([^)]*\)/g, ''))) out.push(`${r.selector} { ${k}: ${v} } : couleur littérale (jetons var(--…) de l'accueil attendus)`);
      if (k === 'font-family' && !/^(?:var\(|inherit|"?Inter Tight"?|"?IBM Plex Mono"?)/.test(v.trim())) out.push(`${r.selector} { font-family: ${v} } : police hors de l'accueil`);
      if (k === 'font' && !/var\(|Inter Tight|IBM Plex Mono|inherit/.test(v)) out.push(`${r.selector} { font: ${v} } : police hors de l'accueil`);
    }
  }
  return out;
}

test('V1 : styles de la FAQ : jetons et polices de l\'accueil, aucune animation ni transition propre, aucune @font-face nouvelle', () => {
  assertDistExists();
  const css = exportCss();
  const errors = faqCssErrors(css.rules);
  const families = [...new Set(css.fontFaces.map((f) => f.family))].sort();
  assert.deepEqual(families, ['IBM Plex Mono', 'Inter Tight'], 'familles @font-face de l\'export');
  assert.deepEqual(errors, []);
});

function coverage(family: string): ((cp: number) => boolean) | null {
  const faces = exportCss().fontFaces.filter((f) => f.family === family);
  if (!faces.length) return null;
  const loaded = faces.map((f) => ({ ranges: parseUnicodeRange(f.unicodeRange || 'U+0-10FFFF'), cmap: new Set<number>(f.urls.flatMap((u) => [...cmapCodepoints(readFileSync(join(distDir, u.replace(/^\//, ''))))])) }));
  return (cp) => loaded.some((f) => inRanges(cp, f.ranges) && f.cmap.has(cp));
}
test('V1 : chaque caractère visible de la FAQ (flèches décoratives comprises) est dans le sous-ensemble d\'Inter Tight exporté', () => {
  assertDistExists();
  const inter = coverage('Inter Tight');
  assert.ok(inter, '@font-face Inter Tight absente');
  const miss = new Set<string>();
  for (const r of HOMES) {
    const s = renderedFaq(page(r)).section;
    assert.ok(s, `${r} : FAQ absente (contrat lot 6a, V1)`);
    const all: string[] = [];
    const walk = (x: typeof s): void => {
      if (x.tag === '#text') all.push(x.text);
      else if (!['script', 'style'].includes(x.tag)) x.children.forEach(walk);
    };
    walk(s);
    for (const ch of new Set([...all.join('')].filter((c) => !/[\s\p{Cc}\p{Cf}]/u.test(c)))) if (!inter(ch.codePointAt(0) ?? 0)) miss.add(`${r} : ${ch} (U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase()})`);
  }
  assert.deepEqual([...miss], []);
});

// ---- Témoins : chaque détecteur voit sa mutation sur une FAQ conforme synthétique ----

const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function conformingFaq(c: FaqContent, l: Lang): string {
  const inline = (b: string): string => esc(b).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, h: string) => `<a href="${h}">${t}</a>`);
  const items = c[l].items
    .map((it) => `<div data-faq-item="${it.id}"><h3 data-faq-question="">${esc(it.question)}</h3><div data-faq-answer="">${it.answer.map((b) => `<p>${inline(b)}</p>`).join('')}</div>${it.link ? `<p data-faq-link=""><a href="${it.link.href}">${esc(it.link.text)} <span aria-hidden="true">→</span></a></p>` : ''}</div>`)
    .join('');
  return `<section id="faq" data-home-section="faq"><h2>${esc(c[l].title)}</h2>${items}</section>`;
}
const homeWith = (faq: string): string =>
  `<!doctype html><html lang="fr"><body><div data-home=""><main id="main"><div data-tree-hero=""></div><section data-home-section="projects"><h2>p</h2></section><section data-home-section="hackathons"><h2>h</h2></section><section data-home-section="about"><h2>a</h2></section><section data-home-section="contact"><h2>c</h2></section>${faq}</main></div></body></html>`;

test('V1 (témoins) : une FAQ conforme synthétique passe ; accordéon, réponse masquée, question retirée, ordre changé, lien déplacé dans la réponse, blocs fondus, section avant contact ou en double sont vus', () => {
  const c = readFaq(FAQ_FIXTURE);
  const l: Lang = 'fr';
  const ok = conformingFaq(c, l);
  const h = homeWith(ok);
  assert.deepEqual(faqDiffs('/fr/', h, c), [], 'FAQ conforme refusée');
  assert.deepEqual(placeDiffs('/fr/', h), [], 'place conforme refusée');
  const first = c.fr.items[0]!;
  const second = c.fr.items[1]!;
  const muts: [string, string, (x: string) => string[]][] = [
    ['<details> autour d\'une réponse', h.replace('<div data-faq-answer="">', '<details><summary>x</summary><div data-faq-answer="">').replace('</div><p data-faq-link=""', '</div></details><p data-faq-link=""'), (x) => faqDiffs('/fr/', x, c)],
    ['réponse hidden', h.replace('<div data-faq-answer="">', '<div data-faq-answer="" hidden="">'), (x) => faqDiffs('/fr/', x, c)],
    ['réponse en display:none', h.replace('<div data-faq-answer="">', '<div data-faq-answer="" style="display: none">'), (x) => faqDiffs('/fr/', x, c)],
    ['bouton', h.replace('<h3 data-faq-question="">', '<h3 data-faq-question=""><button aria-expanded="false">+</button>'), (x) => faqDiffs('/fr/', x, c)],
    ['question retirée', h.replace(new RegExp(`<div data-faq-item="${first.id}">[\\s\\S]*?</div></div>(?=<div data-faq-item)`), ''), (x) => faqDiffs('/fr/', x, c)],
    ['ordre changé', homeWith(conformingFaq({ ...c, fr: { ...c.fr, items: [second, first, ...c.fr.items.slice(2)] } }, 'fr')), (x) => faqDiffs('/fr/', x, c)],
    ['lien déplacé dans la réponse', h.replace(/<\/div><p data-faq-link="">([\s\S]*?)<\/p><\/div>/, '<p data-faq-link="">$1</p></div></div>'), (x) => faqDiffs('/fr/', x, c)],
    ['blocs fondus (ligne 42 collée)', h.replace(/<\/p><p>(?=[^<]*cursus|[^<]*curriculum)/, ' '), (x) => faqDiffs('/fr/', x, c)],
    ['lien changé', h.replace('/fr/experiences/bnp-paribas/', '/fr/experiences/bpce/'), (x) => faqDiffs('/fr/', x, c)],
    ['mot changé', h.replace('production', 'prod'), (x) => faqDiffs('/fr/', x, c)],
    ['titre en <h3>', h.replace(/<h2>([^<]*)<\/h2><div data-faq-item/, '<h3>$1</h3><div data-faq-item'), (x) => faqDiffs('/fr/', x, c)],
    ['question en <p>', h.replace('<h3 data-faq-question="">', '<p data-faq-question="">').replace(/(<p data-faq-question="">[^<]*)<\/h3>/, '$1</p>'), (x) => faqDiffs('/fr/', x, c)],
    ['FAQ avant contact', h.replace(ok, '').replace('<section data-home-section="contact">', ok + '<section data-home-section="contact">'), (x) => placeDiffs('/fr/', x)],
    ['FAQ en double', homeWith(ok + ok), (x) => [...placeDiffs('/fr/', x), ...faqDiffs('/fr/', x, c)]],
    ['paragraphe et lien ajoutés hors des items', h.replace(ok, ok.replace(/(<h2>[^<]*<\/h2>)/, '$1<p>En plus <a href="/fr/skills/">ici</a></p>')), (x) => faqDiffs('/fr/', x, c)],
    ['texte ajouté hors des items, sans balise de FAQ', h.replace(/<\/div><\/section>(?![\s\S]*data-faq-item)/, '</div><p>Fin.</p></section>'), (x) => faqDiffs('/fr/', x, c)],
    ['A12 : target="_blank" rel="nofollow" sur la ligne de lien', h.replace('<p data-faq-link=""><a href=', '<p data-faq-link=""><a target="_blank" rel="nofollow" href='), (x) => faqDiffs('/fr/', x, c)],
    ['rel="noopener" seul sur un lien en ligne', h.replace('<a href="https://github.com/Wesper-Dev/droit-de-retard">', '<a rel="noopener" href="https://github.com/Wesper-Dev/droit-de-retard">'), (x) => faqDiffs('/fr/', x, c)],
    ['onmouseover sur un lien', h.replace('<p data-faq-link=""><a href=', '<p data-faq-link=""><a onmouseover="x()" href='), (x) => faqDiffs('/fr/', x, c)],
    ['id="faq" retiré', h.replace('<section id="faq" data-home-section="faq">', '<section data-home-section="faq">'), (x) => placeDiffs('/fr/', x)],
    ['second id="faq" dans la page', h.replace('<section data-home-section="contact">', '<section id="faq" data-home-section="contact">'), (x) => placeDiffs('/fr/', x)],
  ];
  for (const [label, m, check] of muts) {
    assert.notEqual(m, h, `mutation « ${label} » sans effet`);
    assert.ok(check(m).length > 0, `mutation « ${label} » non vue`);
  }
  // X6 : une apostrophe droite est vue, la courbe ne l'est pas.
  assert.ok(straight('t', "j'ai").length === 1 && straight('t', 'j’ai').length === 0, 'apostrophes : détecteur');
  assert.ok(faqStrings(c, 'fr').some((s) => s.includes('’')), 'fixture sans apostrophe courbe : témoin X6 vide');
  // CSS : animation, couleur littérale, police étrangère vues ; jetons et transition hors FAQ admis.
  assert.deepEqual(faqCssErrors([{ selector: '[data-home-section=faq] a', declList: [['color', 'var(--ink)'], ['font-family', 'var(--font-sans)']] }, { selector: '[data-home] a', declList: [['transition', 'color .2s']] }]), []);
  assert.equal(faqCssErrors([{ selector: '[data-faq-item]', declList: [['animation', 'x 1s'], ['color', '#fff'], ['font-family', 'Georgia, serif']] }]).length, 3);
  // withoutFaqSection : retire la FAQ seule, équilibrée, et laisse le reste intact.
  const imbriquée = homeWith(ok.replace('</h2>', '</h2><section data-x="">y</section>'));
  assert.equal(withoutFaqSection(imbriquée), homeWith(''));
  assert.equal(withoutFaqSection(homeWith('')), homeWith(''));
});
