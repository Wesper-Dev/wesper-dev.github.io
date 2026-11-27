// Tour Z, Z1 (tmp/refonte-arbre/contrat-textes-z.md ; décision d'Arnaud du 25/11/2026) : BNP « validé pour la
// production par le comité de pilotage » / « approved for production by the steering committee », partout ; plus aucune
// occurrence de « mis en production », « mise en production », « released to production », « reached production »,
// « atteint la production » (site, llms.txt, JSON-LD, méta-descriptions, CV publics PDF et .tex, copies de contenus).
// Lecture retenue : « à propos de BNP » vaut ici « nulle part » : aucune autre expérience n'emploie ces formes
// (droit-de-retard dit « déploiement en production » / « production deployment », qui restent permis).
// Les textes exacts sont aussi figés ailleurs (faq-lot6.json, llms-lot6.txt, cv-public-texte-*.txt, FAITS.md) ; ce
// fichier les exige à chaque endroit rendu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageContent, readRoute } from './helpers-4.ts';
import type { Lang } from './helpers-4.ts';
import { assertDistExists, distDir, siteDir } from './helpers.ts';
import { byAttr, parseHtml } from './helpers-home.ts';
import { faitsRuleHits, nodesOfType, renderedFaq, visibleOf } from './helpers-6.ts';
import { pdfText } from './helpers-pdf.ts';
import { Z1, Z1_FORBIDDEN, hits, norm, publicCorpus, scan } from './helpers-z.ts';

const LANGS: Lang[] = ['fr', 'en'];
const HOME: Record<Lang, string> = { fr: '/fr/', en: '/' };
const BNP: Record<Lang, string> = { fr: '/fr/experiences/bnp-paribas/', en: '/experiences/bnp-paribas/' };
const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir})`);
  return html;
};
const n = (s: string): string => norm(s).trim();
const metas = (html: string, k: string): string[] => [...html.matchAll(new RegExp(`<meta\\b[^>]*(?:name|property)="${k}"[^>]*content="([^"]*)"`, 'g'))].map((m) => n(m[1] as string));

test('Z1 : aucune forme interdite (« mis en production », « released to production »…) dans l\'export, llms.txt, les sources de contenu, le texte des CV publics, leurs .tex et les copies de contenus', (t) => {
  assertDistExists();
  const { docs, missing } = publicCorpus();
  for (const m of missing) t.diagnostic(`absent ici (dépôt partiel ?) : ${m}`);
  const found = scan(docs, Z1_FORBIDDEN);
  assert.deepEqual(found, [], `tour Z, Z1 : formes interdites\n${found.join('\n')}`);
});

test('Z1 : premier écran, carte, page de détail et méta-descriptions BNP portent la formulation du contrat, FR et EN', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const l of LANGS) {
    const home = page(HOME[l]);
    const p = byAttr(parseHtml(home), 'data-tree-bnp')[0];
    if (!p || n(visibleOf(p)) !== n(Z1.sentence[l])) errors.push(`${HOME[l]} : phrase du premier écran « ${p ? visibleOf(p) : '(absente)'} » ≠ « ${Z1.sentence[l]} »`);
    if (!n(home).includes(n(Z1.card[l]))) errors.push(`${HOME[l]} : sous-titre de la carte « ${Z1.card[l]} » absent`);
    const bnp = page(BNP[l]);
    const text = pageContent(BNP[l], bnp).text.split('\n').map(n);
    if (!text.includes(n(Z1.card[l]))) errors.push(`${BNP[l]} : sous-titre « ${Z1.card[l]} » absent (ligne seule)`);
    if (!text.some((x) => x.startsWith(n(Z1.detail[l])))) errors.push(`${BNP[l]} : paragraphe « ${Z1.detail[l]}… » absent`);
    for (const k of ['description', 'og:description', 'twitter:description']) if (JSON.stringify(metas(bnp, k)) !== JSON.stringify([n(Z1.sentence[l])])) errors.push(`${BNP[l]} : ${k} = ${JSON.stringify(metas(bnp, k))}`);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z1 : FAQ (question 1, réponse rendue et FAQPage du JSON-LD) et llms.txt portent la formulation du contrat', () => {
  assertDistExists();
  const errors: string[] = [];
  const llms = readFileSync(join(siteDir, 'public', 'llms.txt'), 'utf8');
  for (const l of LANGS) {
    const home = page(HOME[l]);
    const q = renderedFaq(home).items.find((i) => i.id === 'production');
    if (!q) errors.push(`${HOME[l]} : question « production » absente de la FAQ rendue`);
    else {
      if (n(q.question) !== n(Z1.question[l])) errors.push(`${HOME[l]} : question 1 « ${q.question} » ≠ « ${Z1.question[l]} »`);
      if (n(q.answer) !== n(Z1.sentence[l])) errors.push(`${HOME[l]} : réponse 1 « ${q.answer} » ≠ « ${Z1.sentence[l]} »`);
    }
    const faq = nodesOfType(home, 'FAQPage')[0] as { mainEntity?: { name?: string; acceptedAnswer?: { text?: string } }[] } | undefined;
    const ld = faq?.mainEntity?.find((x) => n(x.name ?? '') === n(Z1.question[l]));
    if (!ld) errors.push(`${HOME[l]} : FAQPage sans la question « ${Z1.question[l]} »`);
    else if (n(ld.acceptedAnswer?.text ?? '') !== n(Z1.sentence[l])) errors.push(`${HOME[l]} : réponse JSON-LD « ${ld.acceptedAnswer?.text} »`);
    const c = n(llms).split(n(Z1.sentence[l])).length - 1;
    if (c !== 3) errors.push(`llms.txt : phrase ${l} trouvée ${c} fois (3 attendues : résumé, expérience BNP, accueil)`);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z1 : CV publics servis (texte extrait) : résumé et puce BNP du contrat', () => {
  const errors: string[] = [];
  for (const l of LANGS) {
    const txt = n(pdfText(join(siteDir, 'public', 'cv', `arnaud-durand-cv-platform-${l}.pdf`)));
    for (const s of [Z1.cvSummary[l], Z1.cvBullet[l]]) if (!txt.includes(n(s))) errors.push(`CV ${l} : « ${s} » absent du texte extrait`);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('Z1 (témoins) : chaque forme interdite est vue (casse, insécables, entités, balise, TeX, JSON) ; les formes permises ne le sont pas ; la règle des FAQ, llms.txt et JSON-LD la connaît', () => {
  const bad = [
    'outil mis en production après comité de pilotage', 'Mis en production après comité de pilotage', 'L’outil a été mis&nbsp;en production',
    'une mise en\u00a0production', 'mises en production', 'it was released to production', 'Released\u202fto production', 'released into production',
    'Which tool reached production?', 'Quel outil a atteint la production ?', 'mis en <span>production</span>', 'mis~en production', 'mis en\\u00a0production',
    'mis en prod\u00aduction',
  ];
  for (const s of bad) assert.ok(hits(s, Z1_FORBIDDEN).length > 0, `« ${s} » non vu`);
  const good = [Z1.sentence.fr, Z1.sentence.en, Z1.card.fr, Z1.card.en, Z1.question.fr, Z1.question.en, Z1.cvSummary.fr, Z1.cvBullet.en, 'ni la preuve d’un déploiement en production', 'evidence of a production deployment', 'selon les contraintes visées en production', 'with future production security requirements in mind'];
  for (const s of good) assert.deepEqual(hits(s, Z1_FORBIDDEN), [], `faux positif « ${s} »`);
  for (const s of ['Mis en production après comité de pilotage.', 'it was released to production after steering-committee approval']) assert.ok(faitsRuleHits(s).length > 0, `faitsRuleHits ne voit pas « ${s} »`);
  for (const s of [Z1.sentence.fr, Z1.sentence.en, Z1.question.fr]) assert.deepEqual(faitsRuleHits(s), [], `faitsRuleHits refuse « ${s} »`);
});
