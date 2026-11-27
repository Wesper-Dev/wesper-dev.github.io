// Contrat du lot 6a, V2, V3, V4 et la partie JSON-LD de V6 (tmp/refonte-arbre/contrat-lot6a.md), durcis au tour X
// (tmp/refonte-arbre/arbitrage-audit-lot6a.md, X1, X2, X3, X5) :
// - V2 : FAQPage sur les deux accueils, identique au texte visible ; X2 : Answer.text = blocs de la réponse joints par
//   « \n » (liens réduits à leur libellé), Question.name = question, à l'identique de faq.json ; X5 : url = canonique de
//   la page, inLanguage = langue de la page ;
// - V3 : un Person unique (@id https://wesper-dev.github.io/#arnaud-durand). Person COMPLÈTE sur les accueils
//   (ProfilePage.mainEntity) et Compétences, avec les mêmes propriétés sur les quatre pages (X5) : url = origine,
//   jobTitle et noms de langues dans la langue de la page, email = l'adresse des liens mailto: de la page, sans
//   « mailto: », sameAs GitHub et LinkedIn ; knowsAbout, s'il est donné, = compétences de la langue, partout. Person
//   RÉDUITE (@type, @id, name, url, rien d'autre) comme author des récits (X1). Aucun téléphone, aucune adresse postale.
//   ProfilePage : url canonique, inLanguage (X5) ;
// - V4 / X1 : sur les six récits, un CreativeWork qui décrit le RÉCIT : name = <h1> de la page, description =
//   méta-description, url = canonique, inLanguage, author = Person réduite, about = SoftwareSourceCode { name du
//   projet, codeRepository = dépôt } ; ni codeRepository ni sameAs sur le CreativeWork ; ni CreativeWork ni
//   SoftwareSourceCode ailleurs ;
// - V6 / X3 : JSON analysable, @context schema.org, types attendus par page, et LISTE BLANCHE de propriétés par type et
//   par position sur tout l'export (helpers-6, LD_PROPS et ldShapeErrors) : toute clé, tout type, tout objet hors liste
//   est un écart (mutations A10 et A11 de l'audit).
// L'adresse électronique n'est jamais écrite ici : elle est lue dans les liens mailto: de la page, et masquée dans les
// messages (redact).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { headMeta } from './helpers-2b.ts';
import { readRoute } from './helpers-4.ts';
import { ORIGIN, assertDistExists, distDir, siteDir } from './helpers.ts';
import { byTag, parseHtml } from './helpers-home.ts';
import { FORBIDDEN_LD_KEYS, FORBIDDEN_LD_TYPES, HOMES, PERSON_ID, PERSON_URL, SAME_AS, SKILLS_ROUTES, STORY_ROUTES, allowedTypes, blanks, expectedItems, faitsRuleHits, langOfRoute, ldBlocks, ldObjects, ldShapeErrors, ldStrings, mailtoAddresses, pageLd, readFaq, redact, renderedFaq, storyId, typesOf, visibleOf } from './helpers-6.ts';
import type { FaqContent, Lang } from './helpers-6.ts';

const NOT_FOUND = '/404.html';
const ROUTES = (): string[] => {
  const m = JSON.parse(readFileSync(join(siteDir, 'content', 'routes.json'), 'utf8')) as { paths: string[] };
  return m.paths.flatMap((p) => ['/' + p, '/fr/' + p]);
};
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (contrat lot 6a)`);
  return html;
};
const imp = async <T,>(file: string): Promise<T> => (await import(pathToFileURL(join(siteDir, 'content', file)).href)) as T;
// Canonique normalisée par l'analyseur d'URL : celle de / est écrite sans barre finale (https://wesper-dev.github.io), ce
// qui désigne la même adresse que ORIGIN + '/' ; le <head> des accueils ne bouge pas (V7).
const canonicalOf = (html: string): string => {
  const h = headMeta(html).links.find((l) => l.rel === 'canonical')?.href ?? '';
  try {
    return new URL(h).href;
  } catch {
    return h;
  }
};
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const CONTEXTS = new Set(['https://schema.org', 'https://schema.org/']);
const PERSON_REF = { '@type': 'Person', '@id': PERSON_ID, name: 'Arnaud Durand', url: PERSON_URL };
const FULL_REQUIRED = ['@type', '@id', 'name', 'url', 'jobTitle', 'email', 'knowsLanguage', 'sameAs'];
// Égalité profonde, ordre des clés indifférent (l'ordre des listes compte).
const eq = (a: unknown, b: unknown): boolean => isDeepStrictEqual(a, b);
const sortKeys = (o: Record<string, unknown>): string[] => Object.keys(o).sort();

// Ce que la Person complète doit dire, lu dans le contenu du site (aucun texte recopié ici).
export interface PersonCtx {
  jobTitle: Record<Lang, string>;
  languages: Record<Lang, string[]>; // noms des langues parlées, dans la langue de la page (casse libre)
  skills: Record<Lang, string[]>; // knowsAbout admis : compétences de content/skills.ts, dans l'ordre
}
// Noms des langues : premiers mots de la phrase des langues de la section contact (content/home.ts, endText :
// « French native; English fluent; Spanish B1. » / « Français langue maternelle ; anglais courant ; espagnol B1. »).
// Tour W (contrat-relecture-w.md, W4 A13) : la ligne anglaise devient « Native French, fluent English, Spanish (B1). »
// Lecture : dernière phrase, parties séparées par « ; » ou « , », niveau retiré (parenthèses, mots de niveau, A1–C2),
// premier mot restant.
const LEVEL_WORDS = /^(?:native|fluent|langue|maternelle|courant|[A-C][12])$/i;
export const languageNames = (endText: string): string[] =>
  (endText.split(/[.!?]\s+/).filter(Boolean).at(-1) ?? '')
    .split(/\s*[;,]\s*/)
    .map((x) => x.replace(/\([^)]*\)/g, ' ').replace(/[.!?]+\s*$/, '').trim().split(/\s+/).filter((w) => w && !LEVEL_WORDS.test(w))[0] ?? '')
    .filter(Boolean);
async function personCtx(): Promise<PersonCtx> {
  const { jobTitle } = await imp<{ jobTitle: Record<Lang, string> }>('experiences.ts');
  const { home } = await imp<{ home: Record<Lang, { endText: string }> }>('home.ts');
  const { skills } = await imp<{ skills: Record<Lang, { groups: { items: { name: string }[] }[] }> }>('skills.ts');
  const per = <T,>(f: (l: Lang) => T): Record<Lang, T> => ({ fr: f('fr'), en: f('en') });
  return { jobTitle, languages: per((l) => languageNames(home[l].endText)), skills: per((l) => skills[l].groups.flatMap((g) => g.items.map((i) => i.name))) };
}

// V6 (pur) : JSON analysable, @context de chaque racine, types attendus et admis, clés et types interdits.
export function ldValidity(route: string, html: string): string[] {
  const out: string[] = [];
  const blocks = ldBlocks(html);
  const { required, allowed } = allowedTypes(route);
  if (!required.length && blocks.length) out.push(`${route} : ${blocks.length} bloc(s) JSON-LD sur une page sans type attendu`);
  for (const [i, b] of blocks.entries()) {
    if (b.error) {
      out.push(`${route} bloc ${i} : JSON non analysable (${b.error})`);
      continue;
    }
    if (/<\/script/i.test(b.raw)) out.push(`${route} bloc ${i} : « </script » non échappé`);
    const roots = Array.isArray(b.data) ? b.data : [b.data];
    for (const r of roots) {
      if (!isObj(r)) {
        out.push(`${route} bloc ${i} : racine non objet`);
        continue;
      }
      if (!CONTEXTS.has(String(r['@context']))) out.push(`${route} bloc ${i} : @context ${JSON.stringify(r['@context'])} (https://schema.org attendu)`);
    }
  }
  const types = pageLd(html).flatMap((o) => typesOf(o.node));
  for (const t of new Set(types)) if (!allowed.includes(t)) out.push(`${route} : type ${t} hors de la liste admise (${allowed.join(', ') || 'aucun'})`);
  for (const t of required) if (!types.includes(t)) out.push(`${route} : type ${t} attendu, absent`);
  for (const o of pageLd(html)) {
    for (const k of Object.keys(o.node)) if (FORBIDDEN_LD_KEYS.includes(k)) out.push(`${route} ${o.path} : clé ${k} (ni téléphone ni adresse, V3)`);
    for (const t of typesOf(o.node)) if (FORBIDDEN_LD_TYPES.includes(t)) out.push(`${route} ${o.path} : type ${t} interdit (V3, V4)`);
  }
  return out;
}

// Nœud de page (ProfilePage, FAQPage) : url = canonique de la page, inLanguage = langue de la page (X5).
function pageNodeDiffs(route: string, html: string, node: Record<string, unknown>, t: string): string[] {
  const out: string[] = [];
  if (node.url !== ORIGIN + route || node.url !== canonicalOf(html)) out.push(`${route} : ${t}.url ${JSON.stringify(node.url)} (canonique ${ORIGIN + route} attendue, X5)`);
  if (node.inLanguage !== langOfRoute(route)) out.push(`${route} : ${t}.inLanguage ${JSON.stringify(node.inLanguage)} (« ${langOfRoute(route)} » attendu, X5)`);
  return out;
}

// V2 (pur) : FAQPage = FAQ visible et = faq.json ; Answer.text = blocs joints par « \n » (X2).
export function faqPageDiffs(route: string, html: string, faq: FaqContent): string[] {
  const out: string[] = [];
  const pages = pageLd(html).filter((o) => typesOf(o.node).includes('FAQPage'));
  if (pages.length !== 1) return [`${route} : ${pages.length} FAQPage (une attendue)`];
  const fp = pages[0]!.node;
  out.push(...pageNodeDiffs(route, html, fp, 'FAQPage'));
  const visible = renderedFaq(html).items;
  const want = expectedItems(faq, langOfRoute(route));
  const me = Array.isArray(fp.mainEntity) ? fp.mainEntity : fp.mainEntity === undefined ? [] : [fp.mainEntity];
  if (me.length !== visible.length || me.length !== want.length) out.push(`${route} : FAQPage.mainEntity a ${me.length} question(s), la FAQ visible ${visible.length}, faq.json ${want.length}`);
  me.forEach((q: unknown, i: number) => {
    const v = visible[i];
    const w = want[i];
    if (!isObj(q) || !typesOf(q).includes('Question')) return void out.push(`${route} : mainEntity[${i}] n'est pas une Question`);
    const a = q.acceptedAnswer;
    if (!isObj(a) || !typesOf(a).includes('Answer')) out.push(`${route} : mainEntity[${i}].acceptedAnswer n'est pas une Answer`);
    if (w && q.name !== w.question) out.push(`${route} : Question[${i}].name « ${String(q.name)} » ≠ question de faq.json « ${w.question} » (à l'identique)`);
    if (v && blanks(String(q.name ?? '')) !== blanks(v.question)) out.push(`${route} : Question[${i}].name « ${String(q.name)} » ≠ question visible « ${v.question} »`);
    if (!isObj(a)) return;
    const text = String(a.text ?? '');
    if (w && text !== w.answerText) out.push(`${route} : Answer[${i}].text ${JSON.stringify(text.slice(0, 90))}… ≠ blocs de faq.json joints par « \\n » ${JSON.stringify(w.answerText.slice(0, 90))}… (X2)`);
    if (v && !eq(text.split('\n').map(blanks), v.answerBlocks)) out.push(`${route} : Answer[${i}].text, coupé aux « \\n », ${JSON.stringify(text.split('\n').map(blanks)).slice(0, 120)} ≠ blocs visibles de [data-faq-answer] ${JSON.stringify(v.answerBlocks).slice(0, 120)} (X2)`);
  });
  return out;
}

// V3 (pur) : Person complète (accueils, Compétences), réduite (récits), absente ailleurs ; ProfilePage.
export function personDiffs(route: string, html: string, ctx: PersonCtx): string[] {
  const out: string[] = [];
  const l = langOfRoute(route);
  const objs = pageLd(html);
  const persons = objs.filter((o) => typesOf(o.node).includes('Person'));
  for (const p of persons) if (p.node['@id'] !== PERSON_ID) out.push(`${route} ${p.path} : Person @id ${JSON.stringify(p.node['@id'])} (≠ ${PERSON_ID})`);
  const full = HOMES.includes(route) || SKILLS_ROUTES.includes(route);
  if (STORY_ROUTES.includes(route)) {
    if (persons.length !== 1) out.push(`${route} : ${persons.length} Person (une seule attendue : l'author réduit du CreativeWork)`);
    for (const p of persons) if (!eq(p.node, PERSON_REF)) out.push(`${route} ${p.path} : Person ${redact(JSON.stringify(p.node)).slice(0, 160)} ≠ Person réduite ${JSON.stringify(PERSON_REF)} (X1)`);
  } else if (!full) {
    if (persons.length) out.push(`${route} : ${persons.length} Person sur une page qui n'en porte pas`);
  } else {
    if (persons.length !== 1) out.push(`${route} : ${persons.length} Person (une complète attendue)`);
    const mails = mailtoAddresses(html);
    if (mails.length !== 1) out.push(`${route} : ${mails.length} adresse(s) distincte(s) dans les liens mailto: de la page (une attendue : c'est elle que porte Person.email)`);
    for (const { node: p, path } of persons) {
      for (const k of FULL_REQUIRED) if (!(k in p)) out.push(`${route} ${path} : propriété ${k} absente de la Person complète (X5 : mêmes propriétés sur les accueils et Compétences)`);
      if (p.name !== 'Arnaud Durand') out.push(`${route} ${path} : name ${JSON.stringify(p.name)}`);
      if (p.url !== PERSON_URL) out.push(`${route} ${path} : url ${JSON.stringify(p.url)} (url canonique unique ${PERSON_URL} attendu)`);
      if (p.jobTitle !== ctx.jobTitle[l]) out.push(`${route} ${path} : jobTitle ${JSON.stringify(p.jobTitle)} (≠ « ${ctx.jobTitle[l]} »)`);
      const sa = Array.isArray(p.sameAs) ? [...p.sameAs].map(String).sort() : [];
      if (!eq(sa, [...SAME_AS].sort())) out.push(`${route} ${path} : sameAs ${JSON.stringify(p.sameAs)} (GitHub et LinkedIn attendus)`);
      if (typeof p.email !== 'string' || /^mailto:/i.test(p.email)) out.push(`${route} ${path} : email absent ou écrit avec « mailto: » (adresse seule attendue, X5)`);
      else if (mails.length === 1 && p.email !== mails[0]) out.push(`${route} ${path} : email ≠ adresse des liens mailto: de la page (X5)`);
      const langs = Array.isArray(p.knowsLanguage) ? p.knowsLanguage.map((x) => (isObj(x) ? String(x.name ?? '') : '')) : [];
      const low = (xs: string[]): string[] => xs.map((x) => x.toLocaleLowerCase(l));
      if (!eq(low(langs), low(ctx.languages[l]))) out.push(`${route} ${path} : knowsLanguage ${JSON.stringify(langs)} (noms de langues dans la langue de la page attendus, casse libre : ${JSON.stringify(ctx.languages[l])}, X5)`);
      if ('knowsAbout' in p && !eq(p.knowsAbout, ctx.skills[l])) out.push(`${route} ${path} : knowsAbout ${redact(JSON.stringify(p.knowsAbout)).slice(0, 100)} ≠ compétences de content/skills.ts (${l})`);
    }
  }
  if (HOMES.includes(route)) {
    const pp = objs.filter((o) => typesOf(o.node).includes('ProfilePage'));
    if (pp.length !== 1) out.push(`${route} : ${pp.length} ProfilePage (une attendue)`);
    else {
      out.push(...pageNodeDiffs(route, html, pp[0]!.node, 'ProfilePage'));
      const me = pp[0]!.node.mainEntity;
      if (!isObj(me) || !typesOf(me).includes('Person') || me['@id'] !== PERSON_ID) out.push(`${route} : ProfilePage.mainEntity n'est pas la Person d'@id ${PERSON_ID}`);
    }
  }
  return out;
}

// X5 (pur) : la Person complète est la même sur les quatre pages, à la langue près (jobTitle, noms de langues,
// knowsAbout) : mêmes clés partout ; accueil et Compétences d'une même langue identiques ; @id, name, url, email et
// sameAs identiques d'une langue à l'autre.
export function personConsistency(byRoute: Record<string, Record<string, unknown> | undefined>): string[] {
  const out: string[] = [];
  const routes = [...HOMES, ...SKILLS_ROUTES];
  const got = routes.map((r) => byRoute[r]);
  if (got.some((p) => !p)) return [`Person complète absente de ${routes.filter((r) => !byRoute[r]).join(', ')}`];
  const keys = got.map((p) => JSON.stringify(sortKeys(p!).filter((k) => k !== '@context')));
  if (new Set(keys).size !== 1) out.push(`propriétés de la Person différentes selon la page : ${routes.map((r, i) => `${r} ${keys[i]}`).join(' ; ')} (X5)`);
  const bare = (p: Record<string, unknown> | undefined): unknown => p && Object.fromEntries(Object.entries(p).filter(([k]) => k !== '@context'));
  for (const [h, s] of [['/', '/skills/'], ['/fr/', '/fr/skills/']] as const) if (!eq(bare(byRoute[h]), bare(byRoute[s]))) out.push(`${h} et ${s} : Person différente dans une même langue (X5)`);
  for (const k of ['@type', '@id', 'name', 'url', 'email', 'sameAs']) if (!eq(byRoute['/']?.[k], byRoute['/fr/']?.[k])) out.push(`Person.${k} différent entre / et /fr/ (X5)`);
  return out;
}
const fullPersonOf = (html: string): Record<string, unknown> | undefined => pageLd(html).find((o) => typesOf(o.node).includes('Person'))?.node;

// V4 / X1 (pur) : CreativeWork du récit.
export function creativeWorkDiffs(route: string, html: string, project: { name: string; repo?: string } | null): string[] {
  const out: string[] = [];
  const cws = pageLd(html).filter((o) => typesOf(o.node).includes('CreativeWork'));
  const sscs = pageLd(html).filter((o) => typesOf(o.node).includes('SoftwareSourceCode'));
  if (!STORY_ROUTES.includes(route)) return [...(cws.length ? [`${route} : CreativeWork hors des récits`] : []), ...(sscs.length ? [`${route} : SoftwareSourceCode hors des récits`] : [])];
  if (cws.length !== 1) return [`${route} : ${cws.length} CreativeWork (un attendu)`];
  const cw = cws[0]!.node;
  const desc = headMeta(html).metas.get('description')?.[0] ?? '';
  const h1s = byTag(parseHtml(html), 'h1');
  const h1 = h1s.length === 1 ? visibleOf(h1s[0]!) : null;
  if (h1 === null) out.push(`${route} : ${h1s.length} <h1> (un attendu : il donne le nom du récit)`);
  else if (typeof cw.name !== 'string' || blanks(cw.name) !== h1) out.push(`${route} : name ${JSON.stringify(cw.name)} ≠ titre visible du récit (<h1>) « ${h1} » (X1)`);
  if (blanks(String(cw.description ?? '')) !== blanks(desc)) out.push(`${route} : description ${JSON.stringify(cw.description)} ≠ méta-description « ${desc} »`);
  if (cw.url !== canonicalOf(html) || cw.url !== ORIGIN + route) out.push(`${route} : url ${JSON.stringify(cw.url)} ≠ canonique ${ORIGIN + route}`);
  if (cw.inLanguage !== langOfRoute(route)) out.push(`${route} : inLanguage ${JSON.stringify(cw.inLanguage)} (« ${langOfRoute(route)} » attendu)`);
  if (!eq(cw.author, PERSON_REF)) out.push(`${route} : author ${redact(JSON.stringify(cw.author) ?? 'undefined')} ≠ Person réduite ${JSON.stringify(PERSON_REF)} (X1)`);
  for (const k of ['codeRepository', 'sameAs']) if (k in cw) out.push(`${route} : ${k} sur le CreativeWork (le dépôt va dans about, X1)`);
  const about = project ? { '@type': 'SoftwareSourceCode', name: project.name, codeRepository: project.repo } : null;
  if (!eq(cw.about, about)) out.push(`${route} : about ${redact(JSON.stringify(cw.about) ?? 'undefined')} ≠ ${JSON.stringify(about)} (nom et dépôt de content/projects.json, X1)`);
  return out;
}
const projectOf = (route: string): { name: string; repo?: string } | null => {
  if (!STORY_ROUTES.includes(route)) return null;
  const projects = JSON.parse(readFileSync(join(siteDir, 'content', 'projects.json'), 'utf8')) as { id: string; name: string; repo?: string; fr: { name?: string }; en: { name?: string } }[];
  const p = projects.find((x) => x.id === storyId(route));
  // Tour W (contrat-relecture-w.md, W2) : nom de la langue de la page quand projects.json en donne un (« French Red
  // Cross » sur les pages anglaises), sinon le nom commun.
  return p ? { name: p[langOfRoute(route) as 'fr' | 'en'].name ?? p.name, repo: p.repo } : null;
};

test('V6 : JSON-LD des 20 routes et de la 404 : JSON analysable, @context https://schema.org, types attendus (accueils : ProfilePage, Person, FAQPage ; Compétences : Person ; récits : CreativeWork, Person, SoftwareSourceCode) et aucun autre ; ni téléphone, ni adresse, ni Organization', () => {
  assertDistExists();
  const errors = [...ROUTES(), NOT_FOUND].flatMap((r) => ldValidity(r, page(r)));
  assert.deepEqual(errors.map(redact), []);
});

test('V6, X3 : liste blanche du JSON-LD par type et par position sur tout l\'export : chaque nœud a un seul @type à sa place, ses seules propriétés admises, des valeurs chaînes hors des nœuds prévus (aucune affirmation ajoutée : alumniOf, worksFor, award, creator…)', () => {
  assertDistExists();
  const errors = [...ROUTES(), NOT_FOUND].flatMap((r) => ldShapeErrors(r, page(r)));
  assert.deepEqual(errors.map(redact), []);
});

test('V2, X2, X5 : FAQPage de chaque accueil = FAQ visible et faq.json : mêmes questions dans le même ordre, Answer.text = blocs joints par « \\n » (liens réduits à leur libellé) ; url canonique et inLanguage de la page', () => {
  assertDistExists();
  const faq = readFaq();
  const errors = HOMES.flatMap((r) => faqPageDiffs(r, page(r), faq));
  assert.deepEqual(errors.map(redact), []);
});

test('V3, X1, X5 : Person d\'@id commun : complète sur les accueils et Compétences (url unique, jobTitle et noms de langues de la page, email = adresse des liens mailto: sans « mailto: », sameAs), réduite comme author des récits, absente ailleurs ; ProfilePage.mainEntity = cette Person, url canonique et inLanguage', async () => {
  assertDistExists();
  const ctx = await personCtx();
  const errors = [...ROUTES(), NOT_FOUND].flatMap((r) => personDiffs(r, page(r), ctx));
  assert.deepEqual(errors.map(redact), []);
});

test('X5 : la Person complète a les mêmes propriétés sur les quatre pages (accueils et Compétences) ; identique entre accueil et Compétences d\'une langue ; @id, name, url, email, sameAs identiques d\'une langue à l\'autre', () => {
  assertDistExists();
  const byRoute = Object.fromEntries([...HOMES, ...SKILLS_ROUTES].map((r) => [r, fullPersonOf(page(r))]));
  assert.deepEqual(personConsistency(byRoute).map(redact), []);
});

test('V4, X1 : sur les six récits, un CreativeWork qui décrit le récit (name = <h1>, description = méta-description, url canonique, inLanguage, author = Person réduite, about = SoftwareSourceCode du projet et de son dépôt) ; aucun CreativeWork ni SoftwareSourceCode ailleurs', () => {
  assertDistExists();
  const errors = [...ROUTES(), NOT_FOUND].flatMap((r) => creativeWorkDiffs(r, page(r), projectOf(r)));
  assert.deepEqual(errors.map(redact), []);
});

test('V3, V5 : aucun texte du JSON-LD ne contredit FAITS (listes noires U2, titres, niveaux, BNP au présent, Kubernetes, « plus de 120 », « environ 50 », numéros)', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const r of [...ROUTES(), NOT_FOUND]) for (const b of ldBlocks(page(r))) if (!b.error) for (const s of ldStrings(b.data)) for (const h of faitsRuleHits(s)) errors.push(`${r} : ${h} dans « ${s.slice(0, 80)} »`);
  assert.deepEqual(errors.map(redact), []);
});

// ---- Témoins ----

const ld = (o: unknown): string => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const FAKE_MAIL = 'temoin@example.org';
const CTX = async (): Promise<PersonCtx> => personCtx();
const PERSON = (l: Lang, c: PersonCtx) => ({ '@type': 'Person', '@id': PERSON_ID, name: 'Arnaud Durand', url: PERSON_URL, jobTitle: c.jobTitle[l], email: FAKE_MAIL, knowsLanguage: c.languages[l].map((name) => ({ '@type': 'Language', name })), knowsAbout: c.skills[l], sameAs: [...SAME_AS] });

test('V2–V6, X1–X5 (témoins) : un JSON-LD conforme synthétique passe ; adresse, téléphone, @id différent, url de langue, sameAs incomplet, mailto:, autre adresse, langues en anglais sur /fr/, propriété ajoutée (A10), type en trop, JSON cassé, réponse divergente ou jointe par une espace, url ou inLanguage de page manquants sont vus', async () => {
  const c = await CTX();
  const faq: FaqContent = {
    fr: { title: 'T', items: [{ id: 'a', question: 'Q ?', answer: ['R1.', 'R2 [lien](/x/).'], link: null }] },
    en: { title: 'T', items: [{ id: 'a', question: 'Q?', answer: ['R1.'], link: null }] },
  };
  const sec = '<section id="faq" data-home-section="faq"><h2>T</h2><div data-faq-item="a"><h3 data-faq-question="">Q ?</h3><div data-faq-answer=""><p>R1.</p><p>R2 <a href="/x/">lien</a>.</p></div></div></section>';
  const home = (o: unknown): string => `<html lang="fr"><head><link rel="canonical" href="${ORIGIN}/fr/"/></head><body>${ld(o)}<main id="main"><a href="mailto:${FAKE_MAIL}">m</a>${sec}</main></body></html>`;
  const good = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ProfilePage', url: ORIGIN + '/fr/', inLanguage: 'fr', mainEntity: PERSON('fr', c) },
      { '@type': 'FAQPage', url: ORIGIN + '/fr/', inLanguage: 'fr', mainEntity: [{ '@type': 'Question', name: 'Q ?', acceptedAnswer: { '@type': 'Answer', text: 'R1.\nR2 lien.' } }] },
    ],
  };
  type G = typeof good & Record<string, unknown>;
  const all = (h: string): string[] => [...ldValidity('/fr/', h), ...ldShapeErrors('/fr/', h), ...faqPageDiffs('/fr/', h, faq), ...personDiffs('/fr/', h, c)];
  assert.deepEqual(all(home(good)), [], 'JSON-LD conforme refusé');
  const g = (f: (x: G) => void): string => {
    const x = JSON.parse(JSON.stringify(good)) as G;
    f(x);
    return home(x);
  };
  const P = (x: G): Record<string, unknown> => x['@graph'][0]!.mainEntity as unknown as Record<string, unknown>;
  const muts: [string, string][] = [
    ['adresse postale', g((x) => Object.assign(P(x), { address: { '@type': 'PostalAddress', addressLocality: 'Paris' } }))],
    ['téléphone', g((x) => Object.assign(P(x), { telephone: '+33 0 00 00 00 00' }))],
    ['@id différent', g((x) => Object.assign(P(x), { '@id': 'https://wesper-dev.github.io/fr/#arnaud' }))],
    ['url de la langue', g((x) => Object.assign(P(x), { url: ORIGIN + '/fr/' }))],
    ['sameAs incomplet', g((x) => Object.assign(P(x), { sameAs: [SAME_AS[0]] }))],
    ['jobTitle de l\'autre langue', g((x) => Object.assign(P(x), { jobTitle: c.jobTitle.en }))],
    ['email avec mailto:', g((x) => Object.assign(P(x), { email: 'mailto:' + FAKE_MAIL }))],
    ['email ≠ lien mailto: de la page', g((x) => Object.assign(P(x), { email: 'autre@example.org' }))],
    ['email absent', g((x) => void delete P(x).email)],
    ['knowsLanguage absent', g((x) => void delete P(x).knowsLanguage)],
    ['langues en anglais sur /fr/', g((x) => Object.assign(P(x), { knowsLanguage: c.languages.en.map((name) => ({ '@type': 'Language', name })) }))],
    ['knowsAbout inventé', g((x) => Object.assign(P(x), { knowsAbout: [...c.skills.fr, 'PyTorch'] }))],
    ['A10 : alumniOf, worksFor, award', g((x) => Object.assign(P(x), { alumniOf: 'MIT', worksFor: 'BNP Paribas', award: '1st place' }))],
    ['Language avec propriété en plus', g((x) => ((P(x).knowsLanguage as Record<string, unknown>[])[0]!.proficiencyLevel = 'native'))],
    ['objet sans @type', g((x) => Object.assign(P(x), { knowsLanguage: [{ name: 'français' }] }))],
    ['@id sur la ProfilePage', g((x) => Object.assign(x['@graph'][0]!, { '@id': ORIGIN + '/fr/#page' }))],
    ['ProfilePage sans url', g((x) => void delete (x['@graph'][0] as Record<string, unknown>).url)],
    ['ProfilePage en anglais', g((x) => Object.assign(x['@graph'][0]!, { inLanguage: 'en' }))],
    ['FAQPage sans inLanguage', g((x) => void delete (x['@graph'][1] as Record<string, unknown>).inLanguage)],
    ['FAQPage url de l\'autre langue', g((x) => Object.assign(x['@graph'][1]!, { url: ORIGIN + '/' }))],
    ['type en trop', g((x) => x['@graph'].push({ '@type': 'BreadcrumbList' } as never))],
    ['Organization', g((x) => x['@graph'].push({ '@type': 'Organization', name: 'BNP Paribas' } as never))],
    ['clé à la racine', g((x) => Object.assign(x, { name: 'x' }))],
    ['@context http', g((x) => Object.assign(x, { '@context': 'http://example.org' }))],
    ['réponse divergente', g((x) => ((x['@graph'][1] as { mainEntity: { acceptedAnswer: { text: string } }[] }).mainEntity[0]!.acceptedAnswer.text = 'R1.'))],
    ['X2 : blocs joints par une espace', g((x) => ((x['@graph'][1] as { mainEntity: { acceptedAnswer: { text: string } }[] }).mainEntity[0]!.acceptedAnswer.text = 'R1. R2 lien.'))],
    ['blocs joints par deux « \\n »', g((x) => ((x['@graph'][1] as { mainEntity: { acceptedAnswer: { text: string } }[] }).mainEntity[0]!.acceptedAnswer.text = 'R1.\n\nR2 lien.'))],
    ['Answer avec HTML', g((x) => ((x['@graph'][1] as { mainEntity: { acceptedAnswer: { text: string } }[] }).mainEntity[0]!.acceptedAnswer.text = 'R1.\nR2 <a href="/x/">lien</a>.'))],
    ['Answer avec propriété en plus', g((x) => Object.assign((x['@graph'][1] as { mainEntity: { acceptedAnswer: object }[] }).mainEntity[0]!.acceptedAnswer, { author: 'x' }))],
    ['question en trop', g((x) => (x['@graph'][1] as { mainEntity: unknown[] }).mainEntity.push({ '@type': 'Question', name: 'Q2', acceptedAnswer: { '@type': 'Answer', text: 'x' } }))],
    ['ProfilePage sans @id de Person', g((x) => Object.assign(x['@graph'][0]!, { mainEntity: { '@type': 'Person', name: 'Arnaud Durand' } }))],
    ['JSON cassé', home(good).replace('"@graph"', '"@graph",')],
  ];
  for (const [label, h] of muts) assert.ok(all(h).length > 0, `mutation « ${label} » non vue`);
  // Messages : l'adresse n'y paraît jamais.
  assert.ok(!all(g((x) => Object.assign(P(x), { email: 'mailto:' + FAKE_MAIL }))).map(redact).join(' ').includes(FAKE_MAIL), 'adresse dans un message');
  assert.equal(redact('a temoin@example.org b'), 'a <adresse> b');
  // X5 : cohérence des quatre pages.
  const fr = PERSON('fr', c);
  const en = PERSON('en', c);
  assert.deepEqual(personConsistency({ '/': en, '/fr/': fr, '/skills/': en, '/fr/skills/': fr }), [], 'Person cohérente refusée');
  const reorder = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).reverse());
  assert.deepEqual(personConsistency({ '/': en, '/fr/': fr, '/skills/': reorder(en), '/fr/skills/': reorder(fr) }), [], 'mêmes clés dans un autre ordre refusées');
  const { knowsAbout: _k, ...frNoSkills } = fr;
  for (const [label, m] of [
    ['knowsAbout seulement sur Compétences', { '/': en, '/fr/': frNoSkills, '/skills/': en, '/fr/skills/': fr }],
    ['email seulement sur Compétences', { '/': { ...en, email: undefined }, '/fr/': fr, '/skills/': en, '/fr/skills/': fr }],
    ['autre adresse en anglais', { '/': { ...en, email: 'autre@example.org' }, '/fr/': fr, '/skills/': { ...en, email: 'autre@example.org' }, '/fr/skills/': fr }],
    ['Person absente de /skills/', { '/': en, '/fr/': fr, '/skills/': undefined, '/fr/skills/': fr }],
  ] as [string, Record<string, Record<string, unknown> | undefined>][]) assert.ok(personConsistency(JSON.parse(JSON.stringify(m)) as typeof m).length > 0, `mutation « ${label} » non vue`);
  // V4 / X1 : CreativeWork conforme, puis chaque écart.
  const reorderObj = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).reverse());
  const story = '/fr/projects/diary/';
  const proj = { name: 'Diary / Kura', repo: 'https://github.com/Wesper-Dev/Diary' };
  const cw = { '@context': 'https://schema.org', '@type': 'CreativeWork', name: 'Diary / Kura : suivre', description: 'D.', url: ORIGIN + story, inLanguage: 'fr', author: { ...PERSON_REF }, about: { '@type': 'SoftwareSourceCode', name: proj.name, codeRepository: proj.repo } };
  const sp = (o: unknown, r = story): string => `<html lang="fr"><head><meta name="description" content="D."/><link rel="canonical" href="${ORIGIN + r}"/></head><body>${ld(o)}<main><h1>Diary / Kura : suivre</h1></main></body></html>`;
  const allCw = (o: unknown, r = story): string[] => [...ldValidity(r, sp(o, r)), ...ldShapeErrors(r, sp(o, r)), ...creativeWorkDiffs(r, sp(o, r), STORY_ROUTES.includes(r) ? proj : null), ...personDiffs(r, sp(o, r), c)];
  assert.deepEqual(allCw(cw), [], 'CreativeWork conforme refusé');
  assert.deepEqual(allCw({ ...cw, author: reorderObj(cw.author), about: reorderObj(cw.about) }), [], 'author et about aux clés réordonnées refusés');
  const cwMuts: [string, unknown, string?][] = [
    ['auteur absent', { ...cw, author: undefined }],
    ['auteur par @id seul (I3)', { ...cw, author: { '@id': PERSON_ID } }],
    ['auteur complet (jobTitle)', { ...cw, author: { ...PERSON_REF, jobTitle: 'x' } }],
    ['codeRepository sur le CreativeWork (I1)', { ...cw, codeRepository: proj.repo }],
    ['sameAs de dépôt sur le CreativeWork', { ...cw, sameAs: [proj.repo] }],
    ['about absent', { ...cw, about: undefined }],
    ['about sans dépôt', { ...cw, about: { '@type': 'SoftwareSourceCode', name: proj.name } }],
    ['about en CreativeWork', { ...cw, about: { '@type': 'CreativeWork', name: proj.name, codeRepository: proj.repo } }],
    ['type SoftwareSourceCode à la racine', { ...cw, '@type': 'SoftwareSourceCode' }],
    ['name = nom du projet', { ...cw, name: proj.name }],
    ['description divergente', { ...cw, description: 'Autre.' }],
    ['inLanguage fr-FR', { ...cw, inLanguage: 'fr-FR' }],
    ['A11 : creator et award', { ...cw, creator: 'Arnaud Durand, sole author', award: 'Winner' }],
    ['contributor ajouté', { ...cw, contributor: { ...PERSON_REF } }],
    ['CreativeWork sur BNP', cw, '/fr/experiences/bnp-paribas/'],
  ];
  for (const [label, o, r] of cwMuts) assert.ok(allCw(o, r).length > 0, `mutation « ${label} » non vue`);
  assert.ok(ldObjects({ a: [{ '@type': 'X' }] }).some((o) => typesOf(o.node).includes('X')), 'parcours des objets imbriqués');
  assert.deepEqual(languageNames('I like it. French native; English fluent; Spanish B1.'), ['French', 'English', 'Spanish']);
  assert.deepEqual(languageNames('I like it. Native French, fluent English, Spanish (B1).'), ['French', 'English', 'Spanish']);
});
