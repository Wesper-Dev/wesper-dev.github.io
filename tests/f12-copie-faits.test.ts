// Audit contradictoire Fable du lot 2a, point F12 (T1) : les tests de texte ne sautent plus en silence.
// Sans FAITS.md (dépôt publié limité à site/, CI de publication), ils lisent tests/fixtures/textes-publics.json ;
// ce fichier vérifie que la copie reste synchronisée avec FAITS.md et BASE_DONNEES.md quand ils sont présents, et
// qu'aucun test de texte n'est sauté, avec ou sans eux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_FILE, FAITS_FILE, basePresent, extractFaitsTexts, faitsPresent, fixture, parseContact } from './helpers-faits.ts';
import { e31Candidates, e31FaitsCandidates, straightApos } from './helpers-home.ts';
import { siteDir } from './helpers.ts';

const REGEN = 'node --experimental-strip-types tests/fixtures/regenerer-textes-publics.ts';

test('F12 : la copie versionnée est synchronisée avec FAITS.md (§1, §2 et §4 pages de détail, §6.1, §6.2, §7, table E3.1) quand il est présent', (t) => {
  const copy = fixture().faits;
  // Forme minimale, vérifiée dans les deux cas (une copie vide ou tronquée ne doit pas passer pour une référence).
  assert.equal(copy.tree.nodes.length, 11, 'copie : 11 compétences attendues');
  assert.equal(copy.tree.links.length, 21, 'copie : 21 liens attendus');
  assert.equal(copy.tree.experiences.length, 5, 'copie : 5 expériences attendues');
  assert.equal(copy.bnp.paragraphs.fr.length, 5, 'copie : 5 paragraphes BNP attendus');
  assert.deepEqual(e31Candidates().filter((s) => !copy.e31.includes(s) && !copy.e31.includes(straightApos(s))), [], 'copie : chaînes de la table E3.1 non attestées (tour Y : forme courbe ou droite)');
  // Lot 2b (P5) : la copie couvre les textes des pages BPCE (§2) et École 42 (§4).
  assert.ok(copy.bpce && copy.bpce.sandbox.fr.length > 0 && copy.bpce.training.en.length > 0 && copy.bpce.trainingTitle.fr.length > 0, 'copie : textes de la page BPCE (§2) absents');
  assert.ok(copy.ecole42 && copy.ecole42.line.length > 0 && copy.ecole42.paragraph.fr.length > 0 && copy.ecole42.paragraph.en.length > 0, 'copie : textes de la page École 42 (§4) absents');
  if (!faitsPresent()) {
    t.diagnostic(`FAITS.md absent (${FAITS_FILE}) : les tests de texte lisent la copie versionnée`);
    return;
  }
  const fresh = extractFaitsTexts(readFileSync(FAITS_FILE, 'utf8'), e31FaitsCandidates());
  assert.deepEqual(copy, fresh, `copie désynchronisée de FAITS.md : régénérer avec « ${REGEN} »`);
});

test('F12 : la copie versionnée est synchronisée avec BASE_DONNEES.md (adresse, GitHub, LinkedIn) quand il est présent', (t) => {
  const { contact } = fixture();
  assert.match(contact.mail, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, 'copie : adresse électronique illisible');
  assert.match(contact.linkedin, /^https:\/\/www\.linkedin\.com\/in\/[\w-]+\/$/, 'copie : profil LinkedIn illisible');
  if (!basePresent()) {
    t.diagnostic(`BASE_DONNEES.md absent (${BASE_FILE}) : les tests de contact lisent la copie versionnée`);
    return;
  }
  assert.deepEqual(contact, parseContact(readFileSync(BASE_FILE, 'utf8')), `copie désynchronisée de BASE_DONNEES.md : régénérer avec « ${REGEN} »`);
});

test('F12 (témoin) : une infobulle, une phrase BNP ou un libellé changés dans FAITS.md désynchronisent la copie', (t) => {
  if (!faitsPresent()) {
    t.diagnostic('FAITS.md absent : témoin joué sur une copie altérée de la copie versionnée');
    const altered = structuredClone(fixture().faits);
    altered.commons.bnpSentence.fr = altered.commons.bnpSentence.fr.replace('en binôme', 'seul');
    assert.notDeepEqual(altered, fixture().faits);
    return;
  }
  const text = readFileSync(FAITS_FILE, 'utf8');
  const ref = extractFaitsTexts(text, e31FaitsCandidates());
  for (const [from, to] of [
    ["« Croix-Rouge : RAG co-construit sur un manuel de 700 pages »", "« Croix-Rouge : RAG construit seul sur un manuel de 700 pages »"],
    ["| Phrase BNP du premier écran | Chez BNP Paribas, j'ai développé en binôme", "| Phrase BNP du premier écran | Chez BNP Paribas, j'ai développé seul"],
    ['| Kubernetes (contribution) |', '| Kubernetes |'],
    ['« 3–5 min → 1–3 min par rapport »', '« 3–5 min → 30 s par rapport »'],
    ['titre « Un autre outil : la planification des formations »', 'titre « Un autre outil : planification »'],
    ['Ce POC ne tournait pas en production. »', 'Ce POC tournait en production. »'],
    ['| Rôle FR / EN | Ingénierie plateforme IA (stage) /', '| Rôle FR / EN | Ingénierie plateforme IA /'],
    ['| Ligne de formation (FR et EN) | **« École 42 Paris, 2019–2026 »**', '| Ligne de formation (FR et EN) | **« École 42 Paris, 2019–2024 »**'],
    ['concurrency. Minishell, a shell in C', 'concurrency. Minishell, a shell in C built as a pair'],
  ] as const) {
    assert.ok(text.includes(from), `témoin : « ${from} » introuvable dans FAITS.md`);
    let changed: unknown;
    try {
      changed = extractFaitsTexts(text.replace(from, to), e31FaitsCandidates());
    } catch {
      continue; // une lecture qui échoue fait aussi échouer le test de synchronisation
    }
    assert.notDeepEqual(changed, ref, `la modification « ${to} » ne change pas la copie extraite`);
  }
});

// Fichiers qui comparent des textes à FAITS ou aux valeurs de référence du dépôt.
// Lot 2b : p2 (BPCE, §2), p3 (École 42, §4), p4 (noms du repli) et p5 (copie des nouveaux textes) lisent aussi FAITS.
const TEXT_FILES = ['b8-tree.test.ts', 'c4-bnp.test.ts', 'd2-montage.test.ts', 'e3-textes.test.ts', 'e19-audit-opus.test.ts', 'f13-trous-texte.test.ts', 'p2-bpce.test.ts', 'p3-ecole-42.test.ts', 'p4-accueil-2b.test.ts', 'p5-non-regression-2b.test.ts'];

function summary(out: string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of ['tests', 'pass', 'fail', 'skipped', 'todo', 'cancelled']) {
    const m = new RegExp(`^ℹ ${k} (\\d+)$`, 'm').exec(out);
    r[k] = m ? Number(m[1]) : -1;
  }
  return r;
}

test('F12 : sans FAITS.md ni BASE_DONNEES.md (arborescence limitée à site/), les tests de texte passent, aucun sauté', () => {
  // Processus enfant : chemins des références surchargés vers un fichier inexistant ; NODE_TEST_CONTEXT retiré pour
  // que l'enfant imprime son propre résumé au lieu de le remonter au lanceur parent.
  const env: NodeJS.ProcessEnv = { ...process.env, SITE_TEST_FAITS: join(siteDir, 'tests', 'fixtures', 'absent', 'FAITS.md'), SITE_TEST_BASE: join(siteDir, 'tests', 'fixtures', 'absent', 'BASE_DONNEES.md') };
  delete env.NODE_TEST_CONTEXT;
  const files = TEXT_FILES.map((f) => join('tests', f));
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=spec', ...files], { cwd: siteDir, env, encoding: 'utf8', timeout: 300000 });
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const s = summary(out);
  const skipped = [...out.matchAll(/^\s*﹣ (.*?) \([\d.]+ms\)/gmu)].map((m) => m[1]);
  assert.ok(s.tests > 0, `résumé illisible (code ${r.status}) : ${out.slice(-800)}`);
  assert.equal(s.skipped, 0, `${s.skipped} test(s) de texte sautés sans FAITS.md : ${JSON.stringify(skipped.slice(0, 8))}`);
  assert.equal(s.fail, 0, `${s.fail} test(s) de texte rouges sans FAITS.md :\n${out.split('\n').filter((l) => /✖|AssertionError|Error:/.test(l)).slice(0, 12).join('\n')}`);
  assert.equal(r.status, 0, `code de sortie ${r.status}`);
});

test('F12 : aucun test du dépôt ne saute sur l\'absence d\'un fichier de référence (seul saut permis : machine sans IPv4 non locale, C6)', () => {
  // Garde statique pour les deux modes : un saut conditionnel ajouté plus tard à un test de texte fait rougir ici.
  const allowed = /aucune adresse IPv4|IPv4 non locale|sans IPv4/i;
  const bad: string[] = [];
  for (const f of readdirSync(join(siteDir, 'tests')).filter((x) => /\.test\.ts$/.test(x))) {
    const lines = readFileSync(join(siteDir, 'tests', f), 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (!/\bt\.skip\s*\(|\btest\.skip\s*\(|\{\s*skip\s*:|\.todo\s*\(/.test(l)) return;
      if (f === 'f12-copie-faits.test.ts' && /allowed|bad\.push|test\(|\/\//.test(l)) return;
      const ctx = lines.slice(Math.max(0, i - 3), i + 2).join(' ');
      if (!allowed.test(ctx)) bad.push(`${f}:${i + 1} ${l.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(bad, [], 'sauts conditionnels hors de C6');
});
