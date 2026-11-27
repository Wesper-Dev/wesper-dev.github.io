// Lot 5, U7 (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit C7 ; FAITS §7) :
// - content/home.ts ne garde pas les champs non rendus contraires à FAITS : `title`/`titleEnd` (« qui tournent
//   vraiment »), `intro` (« j'ai déployé et instrumenté des outils LLM »), `experiences` (« mise en production », « hôte de
//   75+ conteneurs » sans staging). Aucun composant ne les lit au 24/11 (vérifié : ni le rendu ni la charge RSC ne les
//   portent), donc ils sont supprimés ;
// - scripts/export-copy.mjs n'écrit plus de texte absent du site ni d'en-tête daté en dur : rejoué dans un bac à sable,
//   chaque ligne de sa copie (hors titre et ligne de provenance, sans date) est du texte du site de la langue (texte
//   visible, attributs, liens), à la mise en forme Markdown près ;
// - deliverables/portfolio-etapes-3-4/CONTENUS-{FR,EN}.md sont régénérés : identiques à la sortie rejouée (dépôt
//   complet seulement ; la CI ne voit que site/).
// Rouge attendu avant le code : les quatre champs existent, l'en-tête dit « actualisé le 13 septembre 2026 », la copie
// porte des textes non rendus.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertDistExists, distDir, readManifest, routesOf, siteDir } from './helpers.ts';
import { readRoute } from './helpers-4.ts';

type L = 'fr' | 'en';
const tmp: string[] = [];
after(() => tmp.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const DEAD_FIELDS = ['title', 'titleEnd', 'intro', 'experiences'];
test('U7 : content/home.ts n\'a plus les champs non rendus contraires à FAITS (title, titleEnd, intro, experiences), en FR comme en EN', async () => {
  const { home } = (await import('../content/home.ts')) as { home: Record<L, Record<string, unknown>> };
  const bad: string[] = [];
  for (const l of ['fr', 'en'] as const) for (const k of DEAD_FIELDS) if (k in home[l]) bad.push(`home.${l}.${k} = ${JSON.stringify(home[l][k]).slice(0, 70)} (non rendu, contraire à FAITS §7 : à supprimer)`);
  assert.deepEqual(bad, []);
});

// Une date écrite en dur : « 13 septembre 2026 », « September 13, 2026 », « 2026-09-13 ».
const MONTHS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december';
const DATE = new RegExp(`\\b\\d{1,2}(?:er)?\\s+(?:${MONTHS})\\s+20\\d\\d\\b|\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+20\\d\\d\\b|\\b20\\d\\d-\\d\\d-\\d\\d\\b`, 'i');
test('U7 (témoins) : le motif de date en dur voit « 13 septembre 2026 », « September 13, 2026 », « 2026-09-13 » et laisse « 2019–2026 », « mai 2026 »', () => {
  for (const s of ['actualisé le 13 septembre 2026', 'updated September 13, 2026', 'le 1er octobre 2026', '2026-09-13']) assert.ok(DATE.test(s), s);
  for (const s of ['École 42 Paris, 2019–2026', 'depuis mai 2026', 'juillet 2026']) assert.ok(!DATE.test(s), s);
});
test('U7 : scripts/export-copy.mjs n\'écrit aucune date en dur', () => {
  const src = readFileSync(join(siteDir, 'scripts', 'export-copy.mjs'), 'utf8');
  const m = DATE.exec(src);
  assert.equal(m, null, `date en dur dans export-copy.mjs : « ${m?.[0]} »`);
});

// Rejoue export-copy.mjs dans un bac à sable (copie de site/content et du script) et renvoie ses deux copies.
function replay(): Record<L, string> {
  const root = mkdtempSync(join(tmpdir(), 'lot5-u7-'));
  tmp.push(root);
  cpSync(join(siteDir, 'content'), join(root, 'site', 'content'), { recursive: true });
  mkdirSync(join(root, 'site', 'scripts'), { recursive: true });
  cpSync(join(siteDir, 'scripts', 'export-copy.mjs'), join(root, 'site', 'scripts', 'export-copy.mjs'));
  const out = join(root, 'deliverables', 'portfolio-etapes-3-4');
  mkdirSync(out, { recursive: true });
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(root, 'site', 'scripts', 'export-copy.mjs')], { cwd: join(root, 'site'), encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, `export-copy.mjs : code ${r.status} ${r.stderr.slice(0, 400)}`);
  assert.deepEqual(readdirSync(out).sort(), ['CONTENUS-EN.md', 'CONTENUS-FR.md']);
  return { fr: readFileSync(join(out, 'CONTENUS-FR.md'), 'utf8'), en: readFileSync(join(out, 'CONTENUS-EN.md'), 'utf8') };
}

// Corpus du site d'une langue : texte du HTML de chaque route (balises retirées), valeurs d'attributs et liens, en
// forme compacte (minuscules, sans blancs ni marques de mise en forme), pour comparer à la copie Markdown.
const squash = (s: string): string => s.normalize('NFC').toLowerCase().replace(/[’‘ʼ]/g, "'").replace(/[\s  *_`]+/g, '');
const decode = (s: string): string => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&');
function corpus(l: L): string {
  const routes = routesOf(readManifest().paths).filter((r) => (l === 'fr') === r.startsWith('/fr/'));
  return routes
    .map((r) => {
      const html = (readRoute(distDir, r) ?? '').replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi, ' ');
      const attrs = [...html.matchAll(/\s(?:href|content|alt|title|aria-label)="([^"]*)"/gi)].map((m) => m[1]!);
      return squash(decode(html.replace(/<[^>]+>/g, '') + ' ' + attrs.join(' | ')));
    })
    .join('|');
}
// Morceaux d'une ligne Markdown : marques de titre, de liste et de citation retirées ; un lien [texte](cible) donne
// deux morceaux ; les jointures que le script pose lui-même (« · », « — », « libellé : chemin ») séparent les morceaux.
// Les dates ISO des données (date d'un hackathon, que le site affiche mises en forme) ne sont pas du texte : ignorées.
const ISO = /^\d{4}-\d\d-\d\d(?:\/\d{4}-\d\d-\d\d)?$/;
function pieces(line: string): string[] {
  const t = line.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+|>\s+|\d+\.\s+)/, '');
  const links = [...t.matchAll(/\[([^\]]*)\]\(([^)\s]*)\)/g)].flatMap((m) => [m[1]!, m[2]!]);
  const rest = t.replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, ' ¦ ');
  return [...links, ...rest.split(/\s+[·—¦]\s+|\s*¦\s*|[\s\u00a0]+:\s+(?=\/)/)].map((x) => x.trim()).filter((x) => squash(x).length >= 3 && !ISO.test(x));
}
test('U7 (témoins) : un texte non rendu (ancien titre, « hôte de 75+ conteneurs ») est hors du site ; une phrase rendue, un lien rendu et une jointure « · » passent', () => {
  assertDistExists();
  const c = corpus('fr');
  const missing = (line: string): string[] => pieces(line).filter((p) => !c.includes(squash(p)));
  assert.notDeepEqual(missing('Des outils IA utiles, qui tournent vraiment.'), [], 'titre non rendu');
  assert.notDeepEqual(missing('2025–2026 · BNP Paribas · Data Scientist (stage) · une application React mise en production, un hôte de 75+ conteneurs, Langfuse'), [], 'expérience non rendue');
  assert.deepEqual(missing('Fitness 42 — S’entraîner et encourager'), [], 'jointure « — » de deux textes rendus');
  assert.deepEqual(missing('- [Mon fork public](https://github.com/Wesper-Dev/CroixRouge-Hackathon)'), [], 'lien Markdown rendu');
});

test('U7 : la copie d\'export-copy.mjs (rejouée) ne porte que du texte du site : titre et ligne de provenance sans date, puis chaque ligne présente sur le site de la langue', () => {
  assertDistExists();
  const copies = replay();
  const bad: string[] = [];
  for (const l of ['fr', 'en'] as const) {
    const lines = copies[l].split('\n').filter((x) => x.trim() && x.trim() !== '---');
    for (const h of lines.slice(0, 2)) if (DATE.test(h)) bad.push(`${l} : en-tête daté « ${h} »`);
    const c = corpus(l);
    for (const line of lines.slice(2)) for (const p of pieces(line)) if (!c.includes(squash(p))) bad.push(`${l} : « ${p.slice(0, 90)} » absent du site`);
  }
  assert.deepEqual(bad, []);
});

test('U7 : deliverables/portfolio-etapes-3-4/CONTENUS-{FR,EN}.md sont régénérés (identiques à la sortie rejouée d\'export-copy.mjs)', (t) => {
  const repo = join(siteDir, '..', 'deliverables', 'portfolio-etapes-3-4');
  const files = { fr: join(repo, 'CONTENUS-FR.md'), en: join(repo, 'CONTENUS-EN.md') };
  if (!existsSync(files.fr) || !existsSync(files.en)) {
    t.diagnostic('CONTENUS-*.md absents (dépôt limité à site/)');
    return;
  }
  const copies = replay();
  for (const l of ['fr', 'en'] as const) assert.equal(readFileSync(files[l], 'utf8'), copies[l], `CONTENUS-${l.toUpperCase()}.md ≠ sortie d'export-copy.mjs : relancer « node --experimental-strip-types site/scripts/export-copy.mjs »`);
});
