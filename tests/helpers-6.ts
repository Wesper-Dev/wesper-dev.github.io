// Outils des tests du lot 6a (tmp/refonte-arbre/contrat-lot6a.md, V1 à V7 : FAQ de l'accueil, JSON-LD, llms.txt,
// cohérence, rien d'autre ne bouge). Aucune lecture de l'export ni des fichiers de contenu au chargement du module.
//
// Interface attendue du codeur (rapport-tests-lot6a.md §4) :
// - FAQ : UN fichier de contenu, site/content/faq.json, de forme FaqContent ci-dessous. Les textes y sont provisoires
//   (brouillon tmp/refonte-arbre/textes-lot6.md §1 et §2) : les tests de structure les LISENT, ils ne les recopient pas.
//   Un bloc de réponse peut porter des liens en ligne écrits [libellé](adresse) ; rien d'autre n'est interprété.
// - Balisage : <section data-home-section="faq"> ; un <h2> qui l'ouvre (texte = title) ; puis un élément
//   [data-faq-item="<id>"] par question, dans l'ordre du fichier, contenant la question [data-faq-question] (<h3> ou
//   <dt>), la réponse [data-faq-answer] (un élément de bloc par entrée de answer, <p> par exemple) et, si link n'est
//   pas null, le lien [data-faq-link] HORS de [data-faq-answer]. Le texte visible de [data-faq-answer] est celui du
//   JSON-LD (Answer.text : blocs joints par « \n », tour X, X2) ; les éléments aria-hidden (flèches décoratives) n'en font
//   pas partie.
// - JSON-LD (tour X, tmp/refonte-arbre/arbitrage-audit-lot6a.md X1, X3, X5) : liste blanche de propriétés PAR TYPE ET PAR
//   POSITION (LD_SCHEMA ci-dessous) ; toute clé, tout type ou tout objet hors de cette liste est un écart.
// - llms.txt : le fichier de contenu est site/public/llms.txt lui-même (format llmstxt.org).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { headMeta } from './helpers-2b.ts';
import { ALL_PAGES, HOME_ROUTES_4, LOT4_PAGES, blockText, cssGzipTotal, pageJsGzip, readRoute } from './helpers-4.ts';
import type { Lang, Mode } from './helpers-4.ts';
import { ORIGIN, readManifest, siteDir } from './helpers.ts';
import { byAttr, byTag, docOrder, elChildren, parseHtml } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';
import { FORBIDDEN, phoneHits } from './helpers-pdf.ts';
import { foldRecetteYHtml } from './helpers-typo.ts';
import { EXTENDED, digitRuns } from './helpers-u.ts';
import { Z1_FORBIDDEN } from './helpers-z.ts';

export type { Lang, Mode };
export const LANGS6: readonly Lang[] = ['fr', 'en'];
export const PERSON_ID = 'https://wesper-dev.github.io/#arnaud-durand';
export const PERSON_URL = ORIGIN + '/';
export const SAME_AS: readonly string[] = ['https://github.com/Wesper-Dev', 'https://www.linkedin.com/in/arnaud-durand42/'];
export const FAQ_FILE = join(siteDir, 'content', 'faq.json');
export const LLMS_FILE = join(siteDir, 'public', 'llms.txt');
export const FAQ_FIXTURE = join(siteDir, 'tests', 'fixtures', 'faq-lot6.json');
export const LLMS_FIXTURE = join(siteDir, 'tests', 'fixtures', 'llms-lot6.txt');
export const REPRISES_FIXTURE = join(siteDir, 'tests', 'fixtures', 'reprises-lot6.json');
export const BASELINE_6_FILE = join(siteDir, 'tests', 'fixtures', 'baseline-274537a.json');
export const CV_PDFS: readonly string[] = ['/cv/arnaud-durand-cv-platform-en.pdf', '/cv/arnaud-durand-cv-platform-fr.pdf'];
export const STORY_ROUTES: readonly string[] = ['/projects/droit-de-retard/', '/fr/projects/droit-de-retard/', '/projects/diary/', '/fr/projects/diary/', '/projects/croix-rouge/', '/fr/projects/croix-rouge/'];
export const SKILLS_ROUTES: readonly string[] = ['/skills/', '/fr/skills/'];
export const HOMES: readonly string[] = HOME_ROUTES_4;
export const ROUTES_20 = (): string[] => readManifest().paths.flatMap((p) => ['/' + p, '/fr/' + p]);
export const langOfRoute = (route: string): Lang => (route.startsWith('/fr/') ? 'fr' : 'en');
export const storyId = (route: string): string => route.replace(/^\/(fr\/)?projects\//, '').replace(/\/$/, '');

// ---- Comparaison de textes ----

// « Blancs réduits » : toute suite de blancs (espace, retour, U+00A0, U+202F, U+2009, U+200B) devient une espace.
export const blanks = (s: string): string => s.replace(/[\s\u00a0\u202f\u2009\u200b]+/g, ' ').trim();
// Apostrophes : droite et courbe confondues (l'harmonisation est un choix d'intégration, brouillon §Conventions).
export const apos = (s: string): string => s.replace(/[’‘ʼ]/g, "'");
export const same = (s: string): string => apos(blanks(s));

// ---- Fichier de contenu de la FAQ ----

export interface FaqLink { text: string; href: string }
export interface FaqItem { id: string; question: string; answer: string[]; link: FaqLink | null }
export interface FaqLang { title: string; items: FaqItem[] }
export type FaqContent = Record<Lang, FaqLang>;

export const FAQ_ABSENT = 'site/content/faq.json absent : fichier de contenu de la FAQ attendu (contrat lot 6a, V1 ; forme : tests/helpers-6.ts, FaqContent ; rapport-tests-lot6a.md §4.1)';
export function readFaqRaw(file: string = FAQ_FILE): unknown {
  if (!existsSync(file)) throw new Error(FAQ_ABSENT);
  return JSON.parse(readFileSync(file, 'utf8')) as unknown;
}
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const nonEmpty = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
// Forme du fichier : fr et en ; title non vide ; 4 à 6 items ; id, question, answer (≥ 1 bloc non vide), link ou null.
export function faqShapeErrors(raw: unknown): string[] {
  const out: string[] = [];
  if (!isObj(raw)) return ['faq.json : objet attendu'];
  for (const l of LANGS6) {
    const v = raw[l];
    if (!isObj(v)) {
      out.push(`faq.json : clé ${l} absente`);
      continue;
    }
    if (!nonEmpty(v.title)) out.push(`faq.json ${l}.title : titre de section (<h2>) vide ou absent`);
    const items = v.items;
    if (!Array.isArray(items)) {
      out.push(`faq.json ${l}.items : tableau attendu`);
      continue;
    }
    if (items.length < 4 || items.length > 6) out.push(`faq.json ${l}.items : ${items.length} questions (quatre à six, Q-R9)`);
    items.forEach((it: unknown, i: number) => {
      const w = `faq.json ${l}.items[${i}]`;
      if (!isObj(it)) return void out.push(`${w} : objet attendu`);
      if (!nonEmpty(it.id) || !/^[a-z0-9-]+$/.test(it.id)) out.push(`${w}.id : identifiant [a-z0-9-] attendu`);
      if (!nonEmpty(it.question)) out.push(`${w}.question vide`);
      if (!Array.isArray(it.answer) || !it.answer.length || !it.answer.every(nonEmpty)) out.push(`${w}.answer : tableau de blocs non vides attendu`);
      if (it.link !== null && !(isObj(it.link) && nonEmpty(it.link.text) && nonEmpty(it.link.href))) out.push(`${w}.link : { text, href } ou null attendu`);
      for (const k of Object.keys(it)) if (!['id', 'question', 'answer', 'link'].includes(k)) out.push(`${w} : clé inattendue ${k}`);
    });
  }
  for (const k of Object.keys(raw)) if (!['fr', 'en'].includes(k) && !k.startsWith('_')) out.push(`faq.json : clé inattendue ${k}`);
  return out;
}
export function readFaq(file: string = FAQ_FILE): FaqContent {
  const raw = readFaqRaw(file);
  const e = faqShapeErrors(raw);
  if (e.length) throw new Error(`forme de faq.json (contrat lot 6a, V1) :\n${e.join('\n')}`);
  return raw as FaqContent;
}

// Liens en ligne d'un bloc : [libellé](adresse). Le texte affiché est le libellé.
const INLINE_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
export function inlineParts(block: string): { text: string; links: FaqLink[] } {
  const links: FaqLink[] = [];
  const text = block.replace(INLINE_LINK, (_m, t: string, h: string) => {
    links.push({ text: t, href: h });
    return t;
  });
  return { text, links };
}
// answerText : texte attendu de l'Answer du JSON-LD = blocs (liens réduits à leur libellé) joints par « \n » (X2).
export interface ExpectedItem { id: string; question: string; blocks: string[]; answerText: string; links: FaqLink[]; link: FaqLink | null }
export function expectedItems(c: FaqContent, l: Lang): ExpectedItem[] {
  return c[l].items.map((it) => {
    const parts = it.answer.map(inlineParts);
    const blocks = parts.map((p) => p.text);
    return { id: it.id, question: it.question, blocks, answerText: blocks.join('\n'), links: [...parts.flatMap((p) => p.links), ...(it.link ? [it.link] : [])], link: it.link };
  });
}
// Toutes les chaînes d'une langue (titre, questions, blocs, libellés) : sert aux listes noires.
export const faqStrings = (c: FaqContent, l: Lang): string[] => [c[l].title, ...c[l].items.flatMap((it) => [it.question, ...it.answer.map((b) => inlineParts(b).text), ...(it.link ? [it.link.text] : [])])];

// ---- FAQ rendue (export) ----

const SKIP = new Set(['script', 'style', 'template', 'noscript']);
const hasAttr = (n: HNode, a: string): boolean => Object.prototype.hasOwnProperty.call(n.attrs, a);
// Éléments de bloc : leur bord sépare deux mots ; le bord d'un élément en ligne (<a>, <span>) ne sépare rien.
const BLOCK_TAGS = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'td', 'th', 'tr', 'ul', 'caption', 'details', 'summary']);
// Texte visible d'un nœud : scripts, hidden et aria-hidden="true" exclus, blancs réduits.
export function visibleOf(n: HNode): string {
  const parts: string[] = [];
  const walk = (x: HNode): void => {
    if (x.tag === '#text') return void parts.push(x.text);
    if (SKIP.has(x.tag) || hasAttr(x, 'hidden') || x.attrs['aria-hidden'] === 'true') return;
    const edge = BLOCK_TAGS.has(x.tag) ? ' ' : '';
    parts.push(edge);
    x.children.forEach(walk);
    parts.push(edge);
  };
  walk(n);
  return blanks(parts.join(''));
}
// Blocs d'un nœud (une ligne par élément de bloc), mêmes exclusions.
export function blocksOf(n: HNode): string[] {
  const strip = (x: HNode): HNode => ({ ...x, children: x.children.filter((c) => c.tag === '#text' || c.attrs['aria-hidden'] !== 'true').map(strip) });
  return blockText(strip(n)).replace(/\u200b/g, '').split('\n').map(blanks).filter(Boolean);
}
export interface RenderedItem { id: string | undefined; node: HNode; questions: HNode[]; answers: HNode[]; linkEls: HNode[]; question: string; answer: string; answerBlocks: string[]; links: FaqLink[] }
export interface RenderedFaq { sections: HNode[]; section: HNode | null; first: HNode | undefined; title: string; items: RenderedItem[] }
export function renderedFaq(html: string): RenderedFaq {
  const doc = parseHtml(html);
  const sections = byAttr(doc, 'data-home-section', 'faq');
  const section = sections[0] ?? null;
  if (!section) return { sections, section, first: undefined, title: '', items: [] };
  const first = elChildren(section)[0];
  const h2 = byTag(section, 'h2')[0];
  const items = byAttr(section, 'data-faq-item').map((node): RenderedItem => {
    const questions = byAttr(node, 'data-faq-question');
    const answers = byAttr(node, 'data-faq-answer');
    return {
      id: node.attrs['data-faq-item'],
      node,
      questions,
      answers,
      linkEls: byAttr(node, 'data-faq-link'),
      question: questions[0] ? visibleOf(questions[0]) : '',
      answer: answers[0] ? visibleOf(answers[0]) : '',
      answerBlocks: answers[0] ? blocksOf(answers[0]) : [],
      links: byTag(node, 'a').map((a) => ({ text: visibleOf(a), href: a.attrs.href ?? '' })),
    };
  });
  return { sections, section, first, title: h2 ? visibleOf(h2) : '', items };
}
// Tout élément interactif, masqué ou dépliable dans la FAQ (V1 : réponses toujours visibles, pas d'accordéon, pas de JS).
export function faqHiddenOrInteractive(section: HNode): string[] {
  const out: string[] = [];
  for (const n of docOrder(section)) {
    if (n.tag === '#text') continue;
    const where = `<${n.tag}${n.attrs['data-faq-item'] ? ` data-faq-item=${n.attrs['data-faq-item']}` : ''}>`;
    if (['details', 'summary', 'button', 'input', 'dialog', 'script', 'template', 'noscript'].includes(n.tag)) out.push(`${where} : élément ${n.tag}`);
    for (const a of ['hidden', 'inert', 'popover', 'aria-expanded', 'aria-controls', 'onclick']) if (hasAttr(n, a)) out.push(`${where} : attribut ${a}`);
    for (const a of Object.keys(n.attrs)) if (/^on/i.test(a) && a !== 'onclick') out.push(`${where} : attribut ${a}`);
    // Tour X, A12 : un lien de la FAQ ne porte ni target ni rel (aucun n'est prévu : liens internes ou dépôt public).
    if (n.tag === 'a') for (const a of ['target', 'rel']) if (hasAttr(n, a)) out.push(`${where} : lien avec ${a}="${n.attrs[a]}" (ni target ni rel attendu, X3)`);
    if (n.attrs['aria-hidden'] === 'true' && blanks(n.children.map((c) => (c.tag === '#text' ? c.text : '')).join('')).replace(/[→↗↑·]/g, '').length > 0) out.push(`${where} : texte masqué aux lecteurs d'écran (aria-hidden)`);
    const style = (n.attrs.style ?? '').replace(/\s+/g, '');
    if (/display:none|visibility:hidden|height:0|max-height:0|opacity:0(?![.\d])|content-visibility:hidden/.test(style)) out.push(`${where} : style ${n.attrs.style}`);
    if (n.tag === 'a' && /^(?:javascript:|#)/.test(n.attrs.href ?? '')) out.push(`${where} : lien de script ou d'ancre ${n.attrs.href}`);
  }
  return out;
}

// Retire de l'accueil la section FAQ (élément entier, équilibré) : sert aux comparaisons « rien d'autre ne bouge ».
// Seule la PREMIÈRE section [data-home-section="faq"] est retirée ; une seconde reste un écart.
export function withoutFaqSection(html: string): string {
  const open = /<section\b[^>]*\bdata-home-section\s*=\s*["']faq["'][^>]*>/i.exec(html);
  if (!open) return html;
  const tag = /<\/?section\b[^>]*>/gi;
  tag.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(0, open.index) + html.slice(m.index + m[0].length);
  }
  return html;
}

// ---- JSON-LD ----

export interface LdBlock { raw: string; data: unknown; error: string | null }
export function ldBlocks(html: string): LdBlock[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => /\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1] ?? ''))
    .map((m) => {
      const raw = m[2] ?? '';
      try {
        return { raw, data: JSON.parse(raw) as unknown, error: null };
      } catch (e) {
        return { raw, data: null, error: (e as Error).message };
      }
    });
}
export const typesOf = (o: Record<string, unknown>): string[] => (typeof o['@type'] === 'string' ? [o['@type']] : Array.isArray(o['@type']) ? o['@type'].filter((t): t is string => typeof t === 'string') : []);
// Tous les objets du JSON-LD (racines, @graph et objets imbriqués), avec leur chemin.
export function ldObjects(x: unknown, path = '$', out: { path: string; node: Record<string, unknown> }[] = []): { path: string; node: Record<string, unknown> }[] {
  if (Array.isArray(x)) x.forEach((v, i) => ldObjects(v, `${path}[${i}]`, out));
  else if (isObj(x)) {
    out.push({ path, node: x });
    for (const [k, v] of Object.entries(x)) ldObjects(v, `${path}.${k}`, out);
  }
  return out;
}
export const pageLd = (html: string): { path: string; node: Record<string, unknown> }[] => ldBlocks(html).flatMap((b, i) => (b.error ? [] : ldObjects(b.data, `bloc${i}`)));
export const nodesOfType = (html: string, t: string): Record<string, unknown>[] => pageLd(html).filter((o) => typesOf(o.node).includes(t)).map((o) => o.node);
// Chaînes de tout le JSON-LD d'une page (valeurs seulement).
export function ldStrings(x: unknown): string[] {
  if (typeof x === 'string') return [x];
  if (Array.isArray(x)) return x.flatMap(ldStrings);
  if (isObj(x)) return Object.values(x).flatMap(ldStrings);
  return [];
}
// Clés et types interdits (V3 : aucun téléphone, aucune adresse postale).
export const FORBIDDEN_LD_KEYS: readonly string[] = ['telephone', 'faxNumber', 'address', 'streetAddress', 'postalCode', 'addressLocality', 'addressRegion', 'addressCountry', 'postOfficeBoxNumber', 'homeLocation'];
export const FORBIDDEN_LD_TYPES: readonly string[] = ['PostalAddress', 'Organization', 'EducationalOrganization', 'CollegeOrUniversity', 'Corporation', 'EmployeeRole', 'OrganizationRole', 'Occupation', 'EducationalOccupationalCredential'];
// Types admis par page (V6, lecture retenue §6) : un type absent de la liste rougit, un type attendu manquant aussi.
export function allowedTypes(route: string): { required: string[]; allowed: string[] } {
  if (HOMES.includes(route)) return { required: ['ProfilePage', 'Person', 'FAQPage'], allowed: ['ProfilePage', 'Person', 'FAQPage', 'Question', 'Answer', 'Language'] };
  if (SKILLS_ROUTES.includes(route)) return { required: ['Person'], allowed: ['Person', 'Language'] };
  if (STORY_ROUTES.includes(route)) return { required: ['CreativeWork', 'Person', 'SoftwareSourceCode'], allowed: ['CreativeWork', 'Person', 'SoftwareSourceCode'] };
  return { required: [], allowed: [] };
}

// ---- Liste blanche du JSON-LD par type et par position (tour X, X1, X3, X5) ----
// Chaque nœud porte exactement un @type (chaîne) ; ses clés sont celles de son genre, rien d'autre ; une valeur est une
// chaîne, une liste de chaînes, ou, pour les seules clés de CHILD, un nœud du genre prévu. Le @context n'est admis qu'à la
// racine d'un bloc ; une racine @graph ne porte que @context et @graph. Genres : PersonRef est la Person réduite des
// récits (type Person ; @type, @id, name, url, rien d'autre).
export type LdKind = 'ProfilePage' | 'FAQPage' | 'Question' | 'Answer' | 'Person' | 'PersonRef' | 'Language' | 'CreativeWork' | 'SoftwareSourceCode';
export const LD_PROPS: Record<LdKind, readonly string[]> = {
  ProfilePage: ['@type', 'url', 'inLanguage', 'mainEntity'],
  FAQPage: ['@type', 'url', 'inLanguage', 'mainEntity'],
  Question: ['@type', 'name', 'acceptedAnswer'],
  Answer: ['@type', 'text'],
  Person: ['@type', '@id', 'name', 'url', 'jobTitle', 'email', 'knowsLanguage', 'knowsAbout', 'sameAs'],
  PersonRef: ['@type', '@id', 'name', 'url'],
  Language: ['@type', 'name'],
  CreativeWork: ['@type', 'name', 'description', 'url', 'inLanguage', 'author', 'about'],
  SoftwareSourceCode: ['@type', 'name', 'codeRepository'],
};
const LD_TYPE: Record<LdKind, string> = { ProfilePage: 'ProfilePage', FAQPage: 'FAQPage', Question: 'Question', Answer: 'Answer', Person: 'Person', PersonRef: 'Person', Language: 'Language', CreativeWork: 'CreativeWork', SoftwareSourceCode: 'SoftwareSourceCode' };
// Clés qui portent un nœud : genre attendu, et liste (many) ou nœud seul.
const LD_CHILD: Partial<Record<LdKind, Record<string, { kind: LdKind; many: boolean }>>> = {
  ProfilePage: { mainEntity: { kind: 'Person', many: false } },
  FAQPage: { mainEntity: { kind: 'Question', many: true } },
  Question: { acceptedAnswer: { kind: 'Answer', many: false } },
  Person: { knowsLanguage: { kind: 'Language', many: true } },
  CreativeWork: { author: { kind: 'PersonRef', many: false }, about: { kind: 'SoftwareSourceCode', many: false } },
};
// Racines admises par page : accueils = un @graph de ProfilePage et FAQPage ; Compétences = une Person ; récits = un CreativeWork.
export function ldRoots(route: string): { graph: boolean; kinds: LdKind[] } {
  if (HOMES.includes(route)) return { graph: true, kinds: ['ProfilePage', 'FAQPage'] };
  if (SKILLS_ROUTES.includes(route)) return { graph: false, kinds: ['Person'] };
  if (STORY_ROUTES.includes(route)) return { graph: false, kinds: ['CreativeWork'] };
  return { graph: false, kinds: [] };
}
const isScalar = (v: unknown): boolean => typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
function ldNodeErrors(node: unknown, kinds: LdKind[], path: string, root: boolean): string[] {
  if (!isObj(node)) return [`${path} : objet attendu`];
  const t = node['@type'];
  if (typeof t !== 'string') return [`${path} : @type ${JSON.stringify(t)} (une chaîne attendue, parmi ${kinds.map((k) => LD_TYPE[k]).join(', ')})`];
  const kind = kinds.find((k) => LD_TYPE[k] === t);
  if (!kind) return [`${path} : type ${t} hors de sa place (admis ici : ${kinds.map((k) => LD_TYPE[k]).join(', ') || 'aucun'})`];
  const out: string[] = [];
  const allowed = [...LD_PROPS[kind], ...(root ? ['@context'] : [])];
  for (const k of Object.keys(node)) if (!allowed.includes(k)) out.push(`${path} : propriété ${k} hors de la liste blanche de ${kind} (${LD_PROPS[kind].join(', ')})`);
  for (const [k, v] of Object.entries(node)) {
    if (!allowed.includes(k) || k === '@context') continue;
    const child = LD_CHILD[kind]?.[k];
    if (child) {
      if (child.many && !Array.isArray(v)) out.push(`${path}.${k} : liste attendue`);
      const list = child.many && Array.isArray(v) ? v : [v];
      list.forEach((x, i) => out.push(...ldNodeErrors(x, [child.kind], child.many ? `${path}.${k}[${i}]` : `${path}.${k}`, false)));
    } else if (!isScalar(v)) out.push(`${path}.${k} : chaîne ou liste de chaînes attendue (objet ou nombre refusé)`);
  }
  return out;
}
// Écarts d'une page à la liste blanche (pur).
export function ldShapeErrors(route: string, html: string): string[] {
  const out: string[] = [];
  const { graph, kinds } = ldRoots(route);
  ldBlocks(html).forEach((b, i) => {
    if (b.error) return;
    const at = `${route} bloc${i}`;
    if (!isObj(b.data)) return void out.push(`${at} : racine non objet`);
    if (!kinds.length) return void out.push(`${at} : JSON-LD sur une page qui n'en porte pas`);
    if (graph) {
      for (const k of Object.keys(b.data)) if (!['@context', '@graph'].includes(k)) out.push(`${at} : clé ${k} à la racine (@context et @graph seuls)`);
      const g = b.data['@graph'];
      if (!Array.isArray(g)) return void out.push(`${at} : @graph attendu`);
      g.forEach((n, j) => out.push(...ldNodeErrors(n, kinds, `${at}.@graph[${j}]`, false)));
    } else out.push(...ldNodeErrors(b.data, kinds, at, true));
  });
  return out;
}
// Adresse de contact lue dans la page elle-même (liens mailto:), jamais écrite dans les tests ni les rapports.
export const mailtoAddresses = (html: string): string[] => [...new Set([...html.matchAll(/href="mailto:([^"?]+)/gi)].map((m) => decodeURIComponent(m[1] as string)))];
// Masque toute adresse électronique dans un message d'erreur (les rapports et journaux ne la citent jamais).
export const redact = (s: string): string => s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<adresse>');

// ---- llms.txt (format llmstxt.org) ----

export interface LlmsItem { name: string; url: string; desc: string; line: number }
export interface LlmsDoc { h1: string | null; quote: string[]; paragraphs: string[]; sections: { title: string; items: LlmsItem[] }[]; errors: string[] }
export function parseLlms(text: string): LlmsDoc {
  const doc: LlmsDoc = { h1: null, quote: [], paragraphs: [], sections: [], errors: [] };
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i]?.trim()) i++;
  const h = /^# (\S.*)$/.exec(lines[i] ?? '');
  if (!h) doc.errors.push(`ligne ${i + 1} : titre « # … » attendu en tête (llmstxt.org)`);
  else doc.h1 = h[1] as string;
  i++;
  const quote: string[] = [];
  for (; i < lines.length; i++) {
    const l = lines[i] as string;
    if (l.startsWith('## ')) break;
    if (/^>( |$)/.test(l)) quote.push(l.replace(/^> ?/, ''));
    else if (l.trim()) {
      if (/^#/.test(l)) doc.errors.push(`ligne ${i + 1} : titre de niveau inattendu avant les sections : ${l}`);
      else doc.paragraphs.push(l);
    } else if (quote.length && !quote[quote.length - 1]?.endsWith('\n')) quote.push('');
  }
  doc.quote = quote.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  if (!doc.quote.length) doc.errors.push('résumé en citation « > … » absent après le titre (llmstxt.org)');
  for (; i < lines.length; i++) {
    const l = lines[i] as string;
    if (!l.trim()) continue;
    const s = /^## (\S.*)$/.exec(l);
    if (s) {
      doc.sections.push({ title: s[1] as string, items: [] });
      continue;
    }
    const it = /^- \[([^\]]+)\]\(([^)\s]+)\)(?:: (.*))?$/.exec(l);
    const cur = doc.sections[doc.sections.length - 1];
    if (it && cur) cur.items.push({ name: it[1] as string, url: it[2] as string, desc: (it[3] ?? '').trim(), line: i + 1 });
    else doc.errors.push(`ligne ${i + 1} : ni titre « ## » ni lien « - [nom](url): description » : ${l.slice(0, 80)}`);
  }
  if (!doc.sections.length) doc.errors.push('aucune section « ## » de liens');
  return doc;
}
export const llmsItems = (d: LlmsDoc): LlmsItem[] => d.sections.flatMap((s) => s.items);
// Phrases d'une description (coupure après . ! ? suivis d'une majuscule) ; une phrase isolée reste entière.
export const sentences = (t: string): string[] => blanks(t).split(/(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÛÇ«"])/u).filter(Boolean);
// UTF-8 strict.
export function utf8Errors(b: Buffer): string[] {
  const out: string[] = [];
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    out.push('octets non UTF-8');
  }
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) out.push('BOM UTF-8 en tête');
  if (b.includes(0x0d)) out.push('fins de ligne CR (LF seul attendu)');
  if (b.length && b[b.length - 1] !== 0x0a) out.push('pas de retour à la ligne final');
  return out;
}

// ---- Textes d'une page (V5 : texte visible ou méta-description) ----

export function pageTexts(html: string): { visible: string; descriptions: string[] } {
  const doc = parseHtml(html);
  const body = byTag(doc, 'body')[0] ?? doc;
  const descriptions = [...(headMeta(html).metas.get('description') ?? [])];
  return { visible: same(blockText(body).replace(/\n/g, ' ')), descriptions: descriptions.map(same) };
}
export function presentOnPage(html: string, sentence: string): boolean {
  const t = pageTexts(html);
  const s = same(sentence);
  return t.visible.includes(s) || t.descriptions.some((d) => d.includes(s));
}

// ---- Règles de FAITS (listes noires U2 et interdits du brief des textes) ----

// Formes BNP au présent (helpers.ts, BNP_FORBIDDEN) et règles de FAITS pour la FAQ, llms.txt et le JSON-LD :
// Kubernetes = contribution (dans une phrase de cinq mots ou plus : un mot-clé seul, knowsAbout, n'est pas une revendication) ; « 120 » seulement dans « plus de 120 » / « more than 120 » ; « 50 » secouristes
// seulement « environ 50 » / « about 50 » ; ni RNCP, ni master, ni titre, ni niveau, ni « Alumni » ; aucun numéro.
const BNP_PRESENT = [/tourne(?:nt)?\s+en\s+production/i, /\bruns\s+in\s+production/i, /running\s+in\s+production/i, /\best\s+en\s+production/i, /\bis\s+in\s+production/i];
export function faitsRuleHits(text: string): string[] {
  const t = blanks(text);
  const out: string[] = [];
  for (const [name, re] of [...EXTENDED, ...FORBIDDEN]) if (re.test(apos(t).replace(/[‐‑‒–—−]/g, '-'))) out.push(name);
  for (const re of BNP_PRESENT) if (re.test(t)) out.push(`production au présent (${re.source})`);
  // Tour Z (Z1, 25/11) : plus jamais « mis en production », « released to production »… (helpers-z.ts, Z1_FORBIDDEN).
  for (const re of Z1_FORBIDDEN) if (re.test(t)) out.push(`formulation BNP retirée par Z1 (${re.source})`);
  if (/\brncp\b/i.test(t)) out.push('RNCP');
  if (/\bmaster(?:'s)?\b|\bmastère\b/i.test(t)) out.push('master');
  for (const s of t.split(/(?<=[.;!?])\s+/)) if (/kubernetes/i.test(s) && s.split(' ').length >= 5 && !/contribu/i.test(s)) out.push(`Kubernetes sans « contribution » : « ${s.slice(0, 80)} »`);
  for (const m of t.matchAll(/\b120\b/g)) if (!/(?:plus de|more than)\s$/i.test(t.slice(Math.max(0, m.index - 10), m.index))) out.push(`« 120 » hors « plus de 120 » / « more than 120 »`);
  for (const m of t.matchAll(/\b50\b/g)) if (!/(?:environ|about)\s$/i.test(t.slice(Math.max(0, m.index - 8), m.index))) out.push(`« 50 » hors « environ 50 » / « about 50 »`);
  if (digitRuns(t).length) out.push('suite de neuf chiffres ou plus');
  if (phoneHits(t).length) out.push('numéro de téléphone');
  return out;
}

// ---- V7 (tour X, X3) : seuls le JSON-LD et la charge RSC de vinext sont retirés avant l'empreinte ----
// La charge RSC est reconnue à sa forme EXACTE, d'un bout à l'autre du script (sans attribut) : un push d'une chaîne
// JSON, l'amorce { params (chaînes seules), nav } et la clôture { initialCacheKind } … done=true. Tout autre script en ligne (A6 :
// <script>fetch(…)</script>) reste dans le document et change l'empreinte ; les <script src> restent aussi (noms
// hachés ramenés à *).
const RSC_P = '((self[Symbol.for("vinext.navigationRuntime")]??={bootstrap:{routeManifest:null},functions:{}}).bootstrap.rsc??={rsc:[]})'.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const RSC_FORMS: readonly RegExp[] = [
  new RegExp(`^${RSC_P}\\.rsc\\.push\\("(?:[^"\\\\]|\\\\.)*"\\)$`),
  new RegExp(`^Object\\.assign\\(${RSC_P},\\{params:\\{(?:"[A-Za-z]+":"[^"\\\\]*"(?:,"[A-Za-z]+":"[^"\\\\]*")*)?\\},nav:\\{"pathname":"[^"\\\\]*","searchParams":\\[\\]\\}\\}\\)$`),
  new RegExp(`^Object\\.assign\\(${RSC_P},\\{"initialCacheKind":"static"\\}\\);${RSC_P}\\.done=true$`),
];
export const isLdScript = (attrs: string): boolean => /\btype\s*=\s*["']application\/ld\+json["']/i.test(attrs);
export const isRscScript = (attrs: string, body: string): boolean => !attrs.trim() && RSC_FORMS.some((re) => re.test(body));
export function normalizedDocument6(html: string): string {
  return html
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs: string, body: string) => (isLdScript(attrs) || isRscScript(attrs, body) ? '' : m))
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/_next\/static\/[^"'\s)]+/g, '/_next/static/*')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Référence de départ 274537a (V6 budgets, sitemap ; V7 rien d'autre ne bouge) ----

export interface Snapshot6 {
  docs: Record<string, string>; // 18 routes intérieures et 404 : sha256 de normalizedDocument6 (JSON-LD et charge RSC retirés, tour X)
  homes: Record<string, string>; // accueils : sha256 de normalizedDocument6, section FAQ retirée
  homeGzip: Record<string, number>; // accueils : gzip -9 du HTML
  cssGzip: number; // Σ gzip -9 des CSS
  jsGzip: Record<string, number>; // 21 pages : Σ gzip -9 des modules (fermeture statique)
  sitemap: string; // sha256 de sitemap.xml
  files: string[]; // fichiers de l'export, hachages et identifiant de build ramenés à *
  publicFiles: Record<string, string>; // site/public : chemin -> sha256
}
export interface Baseline6 { commit: string; commande: string; modes: Record<Mode, Snapshot6> }
export const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
export const gz9 = (b: Buffer | string): number => gzipSync(b, { level: 9 }).length;
export function filesOf(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f);
      else out.push(relative(root, f).split('\\').join('/'));
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}
export const normFileName = (f: string): string =>
  f
    .replace(/^_next\/static\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//, '_next/static/<build>/')
    .replace(/-[A-Za-z0-9_-]{8}\.js$/, '-*.js')
    .replace(/\.[A-Za-z0-9_-]{8}\.css$/, '.*.css');
export function snapshot6(root: string, publicDir: string): Snapshot6 {
  const read = (r: string): string => {
    const h = readRoute(root, r);
    if (h === null) throw new Error(`page absente : ${r} (${root})`);
    return h;
  };
  const docs: Record<string, string> = {};
  // Tour Y : repli symétrique des changements imposés par la recette Y (helpers-typo.ts, foldRecetteYHtml).
  for (const r of LOT4_PAGES) docs[r] = sha256(normalizedDocument6(foldRecetteYHtml(read(r))));
  const homes: Record<string, string> = {};
  const homeGzip: Record<string, number> = {};
  for (const r of HOMES) {
    homes[r] = sha256(normalizedDocument6(foldRecetteYHtml(withoutFaqSection(read(r)))));
    homeGzip[r] = gz9(read(r));
  }
  const jsGzip: Record<string, number> = {};
  for (const r of ALL_PAGES) jsGzip[r] = pageJsGzip(root, read(r));
  const publicFiles: Record<string, string> = {};
  for (const f of filesOf(publicDir)) publicFiles[f] = sha256(readFileSync(join(publicDir, f)));
  return {
    docs,
    homes,
    homeGzip,
    cssGzip: cssGzipTotal(root),
    jsGzip,
    sitemap: sha256(readFileSync(join(root, 'sitemap.xml'))),
    files: [...new Set(filesOf(root).map(normFileName))].sort(),
    publicFiles,
  };
}
export function readBaseline6(): Baseline6 {
  if (!existsSync(BASELINE_6_FILE)) throw new Error(`référence du lot 6a absente : ${BASELINE_6_FILE}`);
  return JSON.parse(readFileSync(BASELINE_6_FILE, 'utf8')) as Baseline6;
}
export const fileSize = (f: string): number => statSync(f).size;
