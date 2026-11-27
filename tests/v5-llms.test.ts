// Contrat du lot 6a, V5 (tmp/refonte-arbre/contrat-lot6a.md) : public/llms.txt servi à /llms.txt (text/plain, UTF-8) ;
// format llmstxt.org ; chaque URL citée existe dans l'export (les 20 routes et les deux PDF du CV, chacune une fois) ;
// chaque phrase qualifiée d'une page est présente sur cette page (texte visible ou méta-description) ; règles de FAITS
// (listes noires U2 et interdits du brief) ; check-export.py le contrôle. Le texte est provisoire : ces tests lisent le
// fichier et ne recopient aucune phrase ; le texte courant est figé à part (v8-textes-figes.test.ts).
// Le type servi (en-tête Content-Type) se mesure en navigateur : tmp/refonte-arbre/verif-6/verif.mjs (W2).
// Tour X (tmp/refonte-arbre/arbitrage-audit-lot6a.md, X4) :
// - URL internes = les 20 routes et les 2 PDF ; URL externes = une liste FERMÉE de quatre (dépôt droit-de-retard, son
//   EVALUATION.md, profils GitHub et LinkedIn), toutes dans une section finale « ## Optional » qui ne contient qu'elles ;
//   leur nom et leur description sont des noms seuls ou des libellés de liens de la FAQ pour la même adresse : aucune
//   phrase nouvelle ; check-export.py admet une URL https externe dans « ## Optional » sans l'exiger dans l'export, et
//   refuse toujours une URL hors origine ailleurs (la liste fermée elle-même est contrôlée ici : C1 interdit d'écrire
//   des chemins en dur dans check-export.py) ;
// - exception NOMMÉE à la règle de présence : les deux lignes droit-de-retard = méta-description de la page + la
//   phrase prescrite par FAITS §5 (« More than 120 offline tests. » / « Plus de 120 tests hors ligne. »), lue dans la
//   réponse droit-de-retard de faq.json ; cette phrase, ces deux lignes, rien d'autre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRoute } from './helpers-4.ts';
import { spacingIssues, context } from './helpers-r.ts';
import { ORIGIN, assertDistExists, distDir, makeSandbox, modeFlags, parseReport } from './helpers.ts';
import { headMeta } from './helpers-2b.ts';
import { CV_PDFS, FAQ_FILE, FAQ_FIXTURE, HOMES, LLMS_FILE, LLMS_FIXTURE, ROUTES_20, blanks, expectedItems, faitsRuleHits, faqStrings, inlineParts, langOfRoute, llmsItems, parseLlms, presentOnPage, readFaq, same, sentences, utf8Errors } from './helpers-6.ts';
import type { FaqContent, Lang, LlmsDoc } from './helpers-6.ts';

const LLMS_ABSENT = 'site/public/llms.txt absent (contrat lot 6a, V5)';
const llmsText = (): string => {
  if (!existsSync(LLMS_FILE)) throw new Error(LLMS_ABSENT);
  return readFileSync(LLMS_FILE, 'utf8');
};
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export`);
  return html;
};
const routeOf = (url: string): string | null => (url.startsWith(ORIGIN + '/') ? url.slice(ORIGIN.length) : null);

// X4 : liens externes admis (liste fermée), section qui les porte, noms admis comme nom ou description.
export const DDR_REPO = 'https://github.com/Wesper-Dev/droit-de-retard';
export const EXTERNAL_LLMS: readonly string[] = [DDR_REPO, `${DDR_REPO}/blob/main/docs/EVALUATION.md`, 'https://github.com/Wesper-Dev', 'https://www.linkedin.com/in/arnaud-durand42/'];
export const OPTIONAL = 'Optional';
export const EXTERNAL_NAMES: readonly string[] = ['Arnaud Durand', 'droit-de-retard', 'GitHub', 'LinkedIn'];
export const DDR_ROUTES: Record<string, Lang> = { '/projects/droit-de-retard/': 'en', '/fr/projects/droit-de-retard/': 'fr' };
// Phrase prescrite par FAITS §5 pour droit-de-retard, lue dans faq.json : la phrase « 120 » de la réponse qui mène au dépôt.
export function ddrSentence(faq: FaqContent, l: Lang): string {
  const it = expectedItems(faq, l).find((w) => w.links.some((k) => k.href.startsWith(DDR_REPO)));
  const s = it ? it.blocks.flatMap(sentences).filter((x) => /\b120\b/.test(x)) : [];
  if (s.length !== 1) throw new Error(`faq.json ${l} : ${s.length} phrase(s) « 120 » dans la réponse droit-de-retard (une attendue : la phrase prescrite par FAITS §5)`);
  return s[0] as string;
}
export const ddrExceptions = (faq: FaqContent): Record<string, string> => Object.fromEntries(Object.entries(DDR_ROUTES).map(([r, l]) => [r, ddrSentence(faq, l)]));

// URL citées (pur) : exactement les 20 routes et les deux PDF, chacune une fois, sur l'origine, hors de « ## Optional » ;
// la section finale « ## Optional » porte exactement les quatre URL externes admises, chacune une fois (X4).
export function llmsUrlErrors(d: LlmsDoc, routes: string[], exists: (path: string) => boolean): string[] {
  const out: string[] = [];
  const want = [...routes, ...CV_PDFS].map((r) => ORIGIN + r).sort();
  const opt = d.sections.filter((s) => s.title === OPTIONAL);
  if (opt.length !== 1 || d.sections.at(-1)?.title !== OPTIONAL) out.push(`section « ## ${OPTIONAL} » : ${opt.length} (une attendue, en dernier, X4)`);
  const ext = opt.flatMap((s) => s.items.map((i) => i.url));
  for (const u of ext) if (!EXTERNAL_LLMS.includes(u)) out.push(`${u} : dans « ## ${OPTIONAL} », hors de la liste fermée des quatre liens externes (X4)`);
  for (const u of EXTERNAL_LLMS) if (ext.filter((x) => x === u).length !== 1) out.push(`${u} : cité ${ext.filter((x) => x === u).length} fois dans « ## ${OPTIONAL} » (une attendue, X4)`);
  const got = d.sections.filter((s) => s.title !== OPTIONAL).flatMap((s) => s.items.map((i) => i.url));
  for (const u of got) {
    const r = routeOf(u);
    if (!r) out.push(`${u} : hors de ${ORIGIN}`);
    else if (!exists(r)) out.push(`${u} : absente de l'export`);
  }
  for (const u of new Set(got)) if (got.filter((x) => x === u).length > 1) out.push(`${u} citée ${got.filter((x) => x === u).length} fois`);
  for (const u of want) if (!got.includes(u)) out.push(`${u} : non citée (20 routes FR et EN et deux PDF attendus)`);
  for (const u of new Set(got)) if (!want.includes(u)) out.push(`${u} : citée, hors des 20 routes et des deux PDF`);
  return out;
}
// Phrases qualifiées (pur) : chaque phrase de la description d'une page est sur cette page ; résumé et titre sur un accueil.
// Exception nommée (X4) : exempt[route] = la seule phrase admise hors de la page, sur cette ligne seulement.
export function llmsPresenceErrors(d: LlmsDoc, pageOf: (route: string) => string | null, exempt: Record<string, string> = {}): string[] {
  const out: string[] = [];
  for (const it of llmsItems(d)) {
    const r = routeOf(it.url);
    if (!r) continue;
    if (!it.desc) {
      out.push(`ligne ${it.line} ${it.url} : description absente (une phrase qualifiée par page)`);
      continue;
    }
    if (CV_PDFS.includes(r)) continue;
    const html = pageOf(r);
    if (!html) continue;
    for (const s of sentences(it.desc)) if (!presentOnPage(html, s) && !(exempt[r] !== undefined && same(s) === same(exempt[r]))) out.push(`ligne ${it.line} ${r} : « ${s} » n'est ni dans le texte visible ni dans la méta-description de la page`);
  }
  const homes = HOMES.map((h) => pageOf(h) ?? '');
  for (const q of d.quote) for (const s of sentences(q)) {
    const bare = s.replace(/\.$/, '');
    if (!homes.some((h) => presentOnPage(h, bare))) out.push(`résumé : « ${s} » absent des deux accueils (point final toléré)`);
  }
  if (d.h1 && !homes.some((h) => presentOnPage(h, d.h1 as string))) out.push(`titre « ${d.h1} » absent des accueils`);
  return out;
}

// X4 (pur) : chaque ligne droit-de-retard = méta-description de sa page + la phrase prescrite, rien d'autre.
export function ddrLineErrors(d: LlmsDoc, pageOf: (route: string) => string | null, exempt: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [r, s] of Object.entries(exempt)) {
    const lines = llmsItems(d).filter((i) => i.url === ORIGIN + r);
    const meta = headMeta(pageOf(r) ?? '').metas.get('description')?.[0] ?? '';
    if (lines.length !== 1) out.push(`${r} : ${lines.length} ligne(s) dans llms.txt (une attendue)`);
    else if (same(lines[0]!.desc) !== same(`${meta} ${s}`)) out.push(`ligne ${lines[0]!.line} ${r} : « ${lines[0]!.desc} » ≠ méta-description de la page suivie de « ${s} » (X4, FAITS §5)`);
  }
  return out;
}
// X4 (pur) : liens externes : nom et description faits de noms seuls ou de libellés de liens de faq.json pour la même
// adresse (segments séparés par « · »), description non vide.
export function externalWordingErrors(d: LlmsDoc, faq: FaqContent): string[] {
  const out: string[] = [];
  for (const it of d.sections.filter((s) => s.title === OPTIONAL).flatMap((s) => s.items)) {
    const labels = (['fr', 'en'] as const).flatMap((l) => expectedItems(faq, l).flatMap((w) => w.links.filter((k) => k.href === it.url).map((k) => k.text)));
    // Casse indifférente (« Documentation d’évaluation » reprend le libellé « documentation d’évaluation »).
    const low = (s: string): string => same(s).toLocaleLowerCase('fr');
    const ok = (seg: string): boolean => EXTERNAL_NAMES.some((n) => low(n) === low(seg)) || labels.some((x) => low(x) === low(seg));
    const segs = (s: string): string[] => s.split(/\s+·\s+/).map((x) => x.trim());
    if (!segs(it.name).every(ok)) out.push(`ligne ${it.line} : nom « ${it.name} » ni nom seul (${EXTERNAL_NAMES.join(', ')}) ni libellé d'un lien de la FAQ vers ${it.url} (X4)`);
    if (!it.desc) out.push(`ligne ${it.line} ${it.url} : description absente (courte et factuelle, X4)`);
    else for (const s of segs(it.desc)) if (!ok(s)) out.push(`ligne ${it.line} ${it.url} : « ${s} » ni nom seul ni libellé d'un lien de la FAQ vers cette adresse : aucune phrase nouvelle (X4)`);
  }
  return out;
}

test('V5 : site/public/llms.txt présent, UTF-8 sans BOM, fins de ligne LF, retour final ; copié tel quel dans l\'export (/llms.txt)', () => {
  assertDistExists();
  assert.ok(existsSync(LLMS_FILE), LLMS_ABSENT);
  const b = readFileSync(LLMS_FILE);
  assert.deepEqual(utf8Errors(b), [], 'public/llms.txt');
  const exported = join(distDir, 'llms.txt');
  assert.ok(existsSync(exported), 'llms.txt absent de l\'export (dist/client/llms.txt) : /llms.txt ne serait pas servi');
  assert.ok(readFileSync(exported).equals(b), 'dist/client/llms.txt ≠ public/llms.txt');
});

test('V5 : format llmstxt.org : « # titre », résumé en citation « > », sections « ## » de liens « - [nom](url): description »', () => {
  const d = parseLlms(llmsText());
  assert.deepEqual(d.errors, []);
});

test('V5, X4 : URL citées = exactement les 20 routes (EN et FR) et les deux PDF du CV, chacune une fois, sur https://wesper-dev.github.io, toutes présentes dans l\'export ; plus, dans une section finale « ## Optional », exactement les quatre liens externes admis', () => {
  assertDistExists();
  const d = parseLlms(llmsText());
  const exists = (r: string): boolean => (r.endsWith('.pdf') ? existsSync(join(distDir, r)) : readRoute(distDir, r) !== null);
  assert.deepEqual(llmsUrlErrors(d, ROUTES_20(), exists), []);
});

test('V5, X4 : chaque phrase de la description d\'une page est sur cette page (texte visible ou méta-description, blancs et apostrophes près), hors l\'exception nommée droit-de-retard ; chaque phrase du résumé et le titre sont sur un accueil', () => {
  assertDistExists();
  const d = parseLlms(llmsText());
  assert.deepEqual(llmsPresenceErrors(d, (r) => readRoute(distDir, r), ddrExceptions(readFaq())), []);
});

test('X4 : les deux lignes droit-de-retard de llms.txt = méta-description de la page + la phrase prescrite par FAITS §5 (« More than 120 offline tests. » / « Plus de 120 tests hors ligne. », lue dans faq.json)', () => {
  assertDistExists();
  const d = parseLlms(llmsText());
  assert.deepEqual(ddrLineErrors(d, (r) => readRoute(distDir, r), ddrExceptions(readFaq())), []);
});

test('X4 : liens externes de « ## Optional » : noms seuls ou libellés de la FAQ pour la même adresse, description courte non vide, aucune phrase nouvelle', () => {
  const d = parseLlms(llmsText());
  assert.ok(d.sections.some((s) => s.title === OPTIONAL), `section « ## ${OPTIONAL} » absente de llms.txt (X4)`);
  assert.deepEqual(externalWordingErrors(d, readFaq()), []);
});

test('V5 : règles de FAITS sur llms.txt et faq.json (listes noires U2, titres périmés, niveaux, RNCP, master, Alumni, BNP au présent, Kubernetes = contribution, « plus de 120 », « environ 50 », numéros)', () => {
  const errors: string[] = [];
  const t = llmsText();
  t.split('\n').forEach((l, i) => {
    for (const h of faitsRuleHits(l)) errors.push(`llms.txt ligne ${i + 1} : ${h}`);
  });
  if (existsSync(FAQ_FILE)) {
    const c = readFaq();
    for (const l of ['fr', 'en'] as const) for (const s of faqStrings(c, l)) for (const h of faitsRuleHits(s)) errors.push(`faq.json ${l} : ${h} dans « ${s.slice(0, 70)} »`);
  } else errors.push('site/content/faq.json absent (V1)');
  assert.deepEqual(errors, []);
});

test('V5, R1 : typographie française des descriptions françaises de llms.txt (URL /fr/ et PDF français) et du résumé français : U+00A0 devant « : », U+202F devant « ; ? ! »', () => {
  assertDistExists();
  const d = parseLlms(llmsText());
  const errors: string[] = [];
  const check = (where: string, s: string): void => {
    for (const x of spacingIssues(s)) errors.push(`${where} : ${x.message} dans « …${context(s, x.at)}… »`);
  };
  for (const it of llmsItems(d)) {
    const r = routeOf(it.url) ?? '';
    if (langOfRoute(r) === 'fr' || /-fr\.pdf$/.test(r)) check(`ligne ${it.line}`, it.desc);
  }
  const fr = page('/fr/');
  for (const q of d.quote) if (sentences(q).some((s) => presentOnPage(fr, s.replace(/\.$/, '')) && !presentOnPage(page('/'), s.replace(/\.$/, '')))) check('résumé français', q);
  assert.deepEqual(errors, []);
});

// ---- check-export.py contrôle llms.txt (bac à sable : scripts et copie de l'export) ----

const runCheck = (sb: ReturnType<typeof makeSandbox>) => {
  const r = sb.checkRun(modeFlags(sb.artifact));
  return { status: r.status, errors: parseReport(r.stdout).errors, out: r.stdout.slice(0, 400) + r.stderr.slice(0, 400) };
};
const llmsErrors = (errors: string[]): string[] => errors.filter((e) => /llms\.txt/.test(e));
function sandboxWithLlms(): { sb: ReturnType<typeof makeSandbox>; file: string; text: string } {
  const sb = makeSandbox();
  const file = join(sb.artifact, 'llms.txt');
  assert.ok(existsSync(file), 'préalable : llms.txt absent de l\'export (V5) ; les contrôles de check-export.py ne peuvent pas être éprouvés');
  return { sb, file, text: readFileSync(file, 'utf8') };
}

test('V5, check-export.py : l\'export du dépôt (llms.txt compris) passe le contrôle, sans erreur sur llms.txt', () => {
  const { sb } = sandboxWithLlms();
  const r = runCheck(sb);
  assert.deepEqual(r.errors, [], r.out);
  assert.equal(r.status, 0);
});

test('X4, check-export.py : le llms.txt de la fixture (quatre liens externes dans « ## Optional ») passe, sans erreur sur llms.txt : les URL externes admises ne sont pas exigées dans l\'export', () => {
  const { sb, file } = sandboxWithLlms();
  writeFileSync(file, readFileSync(LLMS_FIXTURE));
  const r = runCheck(sb);
  assert.deepEqual(llmsErrors(r.errors), [], r.out);
});

const CHECK_MUTATIONS: [string, (s: { file: string; text: string }) => void, RegExp][] = [
  ['URL externe hors de « ## Optional » (X4)', (s) => writeFileSync(s.file, s.text.replace('\n## CV (English)\n', '- [x](https://example.org/x/): x\n\n## CV (English)\n')), /example\.org/],
  ['llms.txt retiré', (s) => rmSync(s.file), /llms\.txt/],
  ['URL vers une page inexistante', (s) => writeFileSync(s.file, s.text.replace(`${ORIGIN}/fr/projects/diary/`, `${ORIGIN}/fr/projects/inexistant/`)), /\/fr\/projects\/inexistant\//],
  ['octets non UTF-8', (s) => writeFileSync(s.file, Buffer.concat([Buffer.from(s.text), Buffer.from([0xff, 0xfe, 0x0a])])), /utf-?8/i],
  ['route non citée (/hackathons/ retirée)', (s) => writeFileSync(s.file, s.text.split('\n').filter((l) => !l.includes(`(${ORIGIN}/hackathons/)`)).join('\n')), /\/hackathons\//],
  ['PDF du CV non cité', (s) => writeFileSync(s.file, s.text.split('\n').filter((l) => !l.includes('cv-platform-fr.pdf')).join('\n')), /cv-platform-fr\.pdf/],
];
for (const [label, mutate, names] of CHECK_MUTATIONS) {
  test(`V5, check-export.py : ${label} → code 1 et une erreur qui nomme llms.txt (et la cible)`, () => {
    const s = sandboxWithLlms();
    mutate(s);
    const r = runCheck(s.sb);
    assert.equal(r.status, 1, `${label} : code 1 attendu, reçu ${r.status}. ${r.out}`);
    const mine = llmsErrors(r.errors);
    assert.ok(mine.length > 0, `${label} : aucune erreur ne nomme llms.txt. Erreurs : ${JSON.stringify(r.errors)}`);
    assert.ok(mine.some((e) => names.test(e)), `${label} : aucune erreur sur llms.txt ne nomme ${names}. Erreurs : ${JSON.stringify(mine)}`);
  });
}

// ---- Témoins ----

test('V5 (témoins) : un llms.txt conforme synthétique passe ; titre absent, citation absente, ligne libre, URL hors origine, URL en double, route manquante, phrase absente de sa page, résumé inventé, interdits et BOM sont vus', () => {
  const routes = ['/', '/fr/'];
  const pageOf = (r: string): string | null =>
    r === '/' ? '<html lang="en"><head><meta name="description" content="Home."/></head><body><main><h1>Arnaud Durand</h1><p>Software Engineer</p><p>One sentence. Two sentence.</p></main></body></html>' : r === '/fr/' ? '<html lang="fr"><body><main><p>Phrase une.</p></main></body></html>' : null;
  const optional = `\n## Optional\n\n- [droit-de-retard](${EXTERNAL_LLMS[0]}): my public repository · mon dépôt public\n- [droit-de-retard](${EXTERNAL_LLMS[1]}): evaluation documentation\n- [GitHub](${EXTERNAL_LLMS[2]}): Arnaud Durand\n- [LinkedIn](${EXTERNAL_LLMS[3]}): Arnaud Durand\n`;
  const ok = `# Arnaud Durand\n\n> Software Engineer. One sentence.\n\nLine.\n\n## Pages\n\n- [Home](${ORIGIN}/): One sentence. Two sentence.\n- [Accueil](${ORIGIN}/fr/): Phrase une.\n\n## CV\n\n- [CV EN](${ORIGIN}${CV_PDFS[0]}): Public CV.\n- [CV FR](${ORIGIN}${CV_PDFS[1]}): CV public.\n${optional}`;
  const exists = (): boolean => true;
  const all = (t: string): string[] => {
    const d = parseLlms(t);
    return [...d.errors, ...llmsUrlErrors(d, routes, exists), ...llmsPresenceErrors(d, pageOf)];
  };
  assert.deepEqual(all(ok), [], 'llms.txt conforme refusé');
  const muts: [string, string][] = [
    ['titre absent', ok.replace('# Arnaud Durand\n', '')],
    ['citation absente', ok.replace('> Software Engineer. One sentence.\n', '')],
    ['ligne libre dans une section', ok.replace('- [Accueil]', 'texte libre\n- [Accueil]')],
    ['URL hors origine', ok.replace(`${ORIGIN}/fr/`, 'https://example.org/fr/')],
    ['section Optional absente', ok.replace(optional, '')],
    ['section Optional pas en dernier', ok.replace(optional, '').replace('\n## CV\n', optional + '\n## CV\n')],
    ['lien externe hors liste dans Optional', ok.replace(EXTERNAL_LLMS[3]!, 'https://example.org/')],
    ['lien externe manquant', ok.replace(/- \[LinkedIn\][^\n]*\n/, '')],
    ['lien externe en double', ok.replace(EXTERNAL_LLMS[3]!, EXTERNAL_LLMS[2]!)],
    ['lien externe hors de Optional', ok.replace('\n## CV\n', `\n## CV\n\n- [GitHub](${EXTERNAL_LLMS[2]}): Arnaud Durand\n`)],
    ['route interne dans Optional', ok.replace(/- \[Accueil\][^\n]*\n/, '').replace(/(## Optional\n\n)/, `$1- [Accueil](${ORIGIN}/fr/): Phrase une.\n`)],
    ['URL en double', ok.replace(`(${ORIGIN}/fr/)`, `(${ORIGIN}/)`)],
    ['route manquante', ok.replace(/- \[Accueil\][^\n]*\n/, '')],
    ['PDF manquant', ok.replace(/- \[CV FR\][^\n]*\n/, '')],
    ['phrase absente de sa page', ok.replace('Two sentence.', 'Three sentence.')],
    ['phrase d\'une autre page', ok.replace('): Phrase une.', '): One sentence.')],
    ['description vide', ok.replace('): Phrase une.', ')')],
    ['résumé inventé', ok.replace('> Software Engineer.', '> Senior Staff Engineer.')],
  ];
  for (const [label, t] of muts) assert.ok(all(t).length > 0, `mutation « ${label} » non vue`);
  // X4 : formulation des liens externes (FAQ de la fixture) et exception nommée droit-de-retard.
  const faq = readFaq(FAQ_FIXTURE);
  assert.deepEqual(externalWordingErrors(parseLlms(ok), faq), [], 'liens externes conformes refusés');
  assert.deepEqual(externalWordingErrors(parseLlms(ok.replace('evaluation documentation', 'Documentation d’évaluation · Evaluation documentation')), faq), [], 'libellé de la FAQ avec majuscule refusé (exemple de l’arbitrage)');
  for (const [label, t] of [
    ['phrase nouvelle', ok.replace('evaluation documentation', 'reproducible evaluation with 121 tests')],
    ['description vide', ok.replace(': Arnaud Durand\n- [LinkedIn]', '\n- [LinkedIn]')],
    ['nom inventé', ok.replace('[GitHub]', '[My GitHub profile]')],
    ['libellé d\'un autre lien', ok.replace('evaluation documentation', 'my public repository')],
  ] as [string, string][]) assert.ok(externalWordingErrors(parseLlms(t), faq).length > 0, `mutation « ${label} » non vue`);
  const ddr = '/projects/droit-de-retard/';
  const ex = { [ddr]: 'More than 120 offline tests.' };
  const ddrPage = (r: string): string | null => (r === ddr ? '<html><head><meta name="description" content="Prepare a draft."/></head><body><p>Prepare a draft.</p></body></html>' : pageOf(r));
  const withDdr = (desc: string, url = ddr): LlmsDoc => parseLlms(ok.replace('\n## CV\n', `\n- [Droit de Retard](${ORIGIN}${url}): ${desc}\n\n## CV\n`));
  const ddrAll = (d: LlmsDoc): string[] => [...llmsPresenceErrors(d, ddrPage, ex), ...ddrLineErrors(d, ddrPage, ex)];
  assert.deepEqual(ddrAll(withDdr('Prepare a draft. More than 120 offline tests.')), [], 'ligne droit-de-retard conforme refusée');
  for (const [label, d] of [
    ['phrase prescrite absente', withDdr('Prepare a draft.')],
    ['autre phrase en plus', withDdr('Prepare a draft. More than 120 offline tests. Fully reproducible.')],
    ['phrase prescrite changée', withDdr('Prepare a draft. 121 offline tests.')],
    ['méta-description absente', withDdr('More than 120 offline tests.')],
  ] as [string, LlmsDoc][]) assert.ok(ddrAll(d).length > 0, `mutation « ${label} » non vue`);
  assert.ok(llmsPresenceErrors(parseLlms(ok.replace('): Phrase une.', '): Phrase une. More than 120 offline tests.')), pageOf, ex).length > 0, 'phrase prescrite sur une autre ligne non vue');
  assert.deepEqual(ddrExceptions(faq), { '/projects/droit-de-retard/': 'More than 120 offline tests.', '/fr/projects/droit-de-retard/': 'Plus de 120 tests hors ligne.' }, 'phrase prescrite lue dans la fixture');
  assert.ok(utf8Errors(Buffer.from('﻿x\n')).length > 0 && utf8Errors(Buffer.from([0x78, 0xff, 0x0a])).length > 0 && utf8Errors(Buffer.from('x\r\n')).length > 0, 'BOM, octet invalide ou CRLF non vus');
  for (const bad of ['The tool runs in production.', 'Kubernetes architecture lead at BPCE today.', '120+ tests.', 'tested with 50 first-aiders', 'RNCP 7', 'École 42 Alumni', 'Applied AI Engineer', 'Disponible à partir du 16 octobre']) assert.ok(faitsRuleHits(bad).length > 0, `interdit « ${bad} » non vu`);
  for (const good of ['The PoC did not run in production.', 'I contributed to its Kubernetes design with the infrastructure team.', 'More than 120 offline tests.', 'tested with about 50 first-aiders', 'École 42 Paris, 2019–2026']) assert.deepEqual(faitsRuleHits(good), [], `faux positif « ${good} »`);
  assert.equal(same('j’ai  dit'), same("j'ai dit"));
  assert.equal(blanks('a : ;'), 'a : ;');
});
