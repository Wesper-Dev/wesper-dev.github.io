// Contrat B8 : content/tree.ts (compétences, expériences, liens, réponses, infobulles, icônes).
// Les données attendues sont LUES dans deliverables/refonte-arbre/FAITS.md, une seule fois, par titre de section
// et en-tête de colonnes (aucun numéro de ligne). F12 (audit Fable) : sans FAITS.md (dépôt publié limité à site/),
// ils lisent la copie versionnée tests/fixtures/textes-publics.json (helpers-faits.ts) ; aucun test n'est sauté.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faitsText, memo, parseFaits, siteDir, treeMod } from './helpers-tree.ts';
import { faitsCorpus, faitsPresent, faitsTree } from './helpers-faits.ts';
import type { FaitsTree, Mod } from './helpers-tree.ts';

type Ans = Record<'A-02' | 'A-05' | 'A-06', boolean>;
const NO: Ans = { 'A-02': false, 'A-05': false, 'A-06': false };
const ALL: Ans = { 'A-02': true, 'A-05': true, 'A-06': true };
// Réponses par défaut validées (évolution du contrat décidée d'après les réponses du 20/11) : A-02 oui, A-05 sans réponse, A-06 oui.
const DEFAULT: Ans = { 'A-02': true, 'A-05': false, 'A-06': true };
const COMBOS: Ans[] = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => ({ 'A-02': !!(m & 1), 'A-05': !!(m & 2), 'A-06': !!(m & 4) }));
const only = (k: keyof Ans): Ans => ({ ...NO, [k]: true });

// Icônes du contrat (B8 IconId) ; indépendant de FAITS.
const ICON_IDS = ['cplusplus', 'gnubash', 'python', 'docker', 'kubernetes', 'react', 'obs', 'llm', 'rag', 'agents', 'neutral'];

const faits = memo(async (): Promise<FaitsTree> => faitsTree());


const litRef = (cond: string, a: Ans): boolean => (cond === 'always' ? true : cond === 'unconfirmed' ? false : a[cond as keyof Ans]);
const condOf = (f: FaitsTree, e: string, s: string): string | undefined => f.links.find((l) => l.exp === e && l.skill === s)?.condition;
const nodeOf = (f: FaitsTree, id: string): FaitsTree['nodes'][number] => {
  const n = f.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`nœud ${id} absent de FAITS 6.1`);
  return n;
};

function expectedTooltip(f: FaitsTree, id: string, locale: 'fr' | 'en', a: Ans): string {
  return nodeOf(f, id)
    .fragments.filter((x) => litRef(condOf(f, x.from, id) ?? 'unconfirmed', a))
    .map((x) => (locale === 'fr' ? x.fr : x.en))
    .join(locale === 'fr' ? ' ; ' : '; ');
}

// Écarts entre FAITS lu et le module, sur les liens, conditions et infobulles (8 combinaisons).
function discrepancies(f: FaitsTree, m: Mod): string[] {
  const out: string[] = [];
  const got = m.EXPERIENCES.flatMap((e: Mod) => e.links.map((l: Mod) => `${e.id}→${l.skill}:${l.condition}`));
  const want = f.links.map((l) => `${l.exp}→${l.skill}:${l.condition}`);
  if (JSON.stringify(got) !== JSON.stringify(want)) out.push(`liens ${JSON.stringify(got.filter((x: string) => !want.includes(x)))} au lieu de ${JSON.stringify(want.filter((x) => !got.includes(x)))}`);
  for (const a of COMBOS) {
    for (const e of f.experiences) {
      const w = f.links.filter((l) => l.exp === e.id && litRef(l.condition, a)).map((l) => l.skill);
      const g = m.litSkills(e.id, a);
      if (JSON.stringify(g) !== JSON.stringify(w)) out.push(`litSkills(${e.id}) sous ${JSON.stringify(a)} : ${JSON.stringify(g)}, FAITS ${JSON.stringify(w)}`);
    }
    for (const n of f.nodes) for (const l of ['fr', 'en'] as const) {
      const g = m.skillTooltip(n.id, l, a);
      const w = expectedTooltip(f, n.id, l, a);
      if (g !== w) out.push(`skillTooltip(${n.id}, ${l}) sous ${JSON.stringify(a)}`);
    }
  }
  return out;
}

test('B8 : ANSWERS = réponses validées (A-02 oui, A-05 sans réponse, A-06 oui), une ligne par réponse ; NO_ANSWERS figé tout à faux', async () => {
  // B8 signature, évolution du contrat après les réponses du client.
  const { ANSWERS, NO_ANSWERS } = await treeMod();
  assert.deepEqual({ ...ANSWERS }, DEFAULT, `ANSWERS ${JSON.stringify(ANSWERS)}`);
  assert.deepEqual({ ...NO_ANSWERS }, NO, `NO_ANSWERS ${JSON.stringify(NO_ANSWERS)}`);
  assert.ok(Object.isFrozen(NO_ANSWERS), 'NO_ANSWERS doit être figé (Object.freeze)');
  const src = readFileSync(join(siteDir, 'content', 'tree.ts'), 'utf8');
  for (const id of ['A-02', 'A-05', 'A-06']) {
    const re = new RegExp(`^\\s*['"]${id}['"]\\s*:\\s*(true|false)\\s*,?\\s*(//.*)?$`, 'm');
    assert.match(src, re, `content/tree.ts : la réponse ${id} doit tenir sur sa propre ligne`);
  }
});

test('B8 état par défaut validé : BPCE allume Docker, la Croix-Rouge allume Pipelines LLM, front reste « React · front » relié à BNP seul', async () => {
  // Réponses du 20/11 : A-02 oui, A-06 oui, A-05 sans réponse ; appels sans argument = ANSWERS.
  const { litSkills, experiencesUsing, skillLabel, skillIcon } = await treeMod();
  const want: Record<string, string[]> = {
    'bnp-paribas': ['llm', 'python', 'obs', 'docker', 'front'], bpce: ['agents', 'k8s', 'docker'], 'croix-rouge': ['rag', 'llm'],
    'ecole-42': ['c', 'unix'], 'droit-de-retard': ['tests', 'python'],
  };
  for (const [e, w] of Object.entries(want)) assert.deepEqual(litSkills(e), w, `${e} par défaut : ${JSON.stringify(litSkills(e))}`);
  assert.deepEqual(experiencesUsing('docker'), ['bnp-paribas', 'bpce'], `docker par défaut : ${JSON.stringify(experiencesUsing('docker'))}`);
  assert.deepEqual(experiencesUsing('llm'), ['bnp-paribas', 'croix-rouge'], `llm par défaut : ${JSON.stringify(experiencesUsing('llm'))}`);
  assert.deepEqual(experiencesUsing('front'), ['bnp-paribas'], `front par défaut : ${JSON.stringify(experiencesUsing('front'))}`);
  assert.equal(skillLabel('front', 'fr'), 'React · front');
  assert.equal(skillLabel('front', 'en'), 'React · front-end');
  assert.equal(skillIcon('front'), 'react');
});

test('B8 état par défaut validé : infobulles Docker avec BPCE sans Inception, LLM avec la Croix-Rouge sans Gemma (FAITS)', async (t) => {
  // FAITS §6 « État retenu » : textes intégraux recomposés depuis le tableau 6.1.
  const f = await faits();
  const { skillTooltip } = await treeMod();
  for (const id of ['docker', 'llm', 'front', 'python'] as const) for (const l of ['fr', 'en'] as const) {
    assert.equal(skillTooltip(id, l), expectedTooltip(f, id, l, DEFAULT), `${id}/${l} par défaut`);
  }
  const d = nodeOf(f, 'docker').fragments;
  assert.equal(skillTooltip('docker', 'fr'), `${d[0].fr} ; ${d[1].fr}`, 'Docker par défaut : BNP puis BPCE');
  const l = nodeOf(f, 'llm').fragments;
  assert.equal(skillTooltip('llm', 'en'), `${l[0].en}; ${l[2].en}`, 'LLM par défaut : BNP puis Croix-Rouge');
});

test('B8 lecture de FAITS : insensible au déplacement des lignes, sensible à un changement de condition', async () => {
  // Audit, bloquant 2 : une ligne vide en tête ne casse rien ; BPCE → docker passé de A-02 à A-05 dans 6.2 est détecté.
  // F12 : la robustesse du lecteur ne s'éprouve que sur FAITS.md ; sans lui, la condition est mutée dans la copie.
  let ref: FaitsTree;
  let mutated: FaitsTree;
  if (faitsPresent()) {
    const text = faitsText();
    ref = parseFaits(text);
    assert.deepEqual(parseFaits('\n' + text), ref, 'une ligne vide en tête change la lecture');
    assert.deepEqual(parseFaits(text.replace('\n## ', '\n\nParagraphe ajouté.\n\n## ')), ref, 'un paragraphe ajouté avant les sections change la lecture');
    const re = /(\| BPCE → `docker` \|[^\n]*?\| )A-02( : \*\*allumé\*\*)/;
    assert.match(text, re, 'ligne BPCE → docker introuvable dans 6.2');
    mutated = parseFaits(text.replace(re, '$1A-05$2'));
  } else {
    ref = faitsTree();
    mutated = structuredClone(ref);
    const link = mutated.links.find((l) => l.exp === 'bpce' && l.skill === 'docker');
    assert.ok(link, 'copie : lien BPCE → docker introuvable');
    link.condition = 'A-05';
  }
  assert.equal(condOf(mutated, 'bpce', 'docker'), 'A-05', 'la condition mutée doit être lue');
  const m = await treeMod();
  assert.deepEqual(discrepancies(ref, m), [], 'le module doit être conforme à FAITS');
  const found = discrepancies(mutated, m);
  assert.ok(found.some((x) => x.includes('bpce→docker')), `la mutation de condition n'est pas détectée : ${JSON.stringify(found.slice(0, 3))}`);
});

test('B8.1 : 11 compétences dans l\'ordre de FAITS 6.1, couches, 5 expériences et 21 liens dans l\'ordre de 6.2', async (t) => {
  // B8.1 et « Ordres à respecter ».
  const f = await faits();
  const { SKILLS, EXPERIENCES } = await treeMod();
  assert.equal(f.nodes.length, 11, `FAITS 6.1 : ${f.nodes.length} nœuds`);
  assert.deepEqual(SKILLS.map((s: Mod) => s.id), f.nodes.map((n) => n.id), `ordre de SKILLS ${JSON.stringify(SKILLS.map((s: Mod) => s.id))}`);
  for (const s of SKILLS) assert.equal(s.layer, nodeOf(f, s.id).layer, `${s.id} : couche ${s.layer}`);
  const by = (layer: string): string[] => SKILLS.filter((s: Mod) => s.layer === layer).map((s: Mod) => s.id).sort();
  assert.deepEqual(by('root'), ['c', 'tests', 'unix']);
  assert.deepEqual(by('trunk'), ['docker', 'k8s', 'obs', 'python']);
  assert.deepEqual(by('canopy'), ['agents', 'front', 'llm', 'rag']);
  assert.deepEqual(EXPERIENCES.map((e: Mod) => e.id), f.experiences.map((e) => e.id), `ordre de EXPERIENCES ${JSON.stringify(EXPERIENCES.map((e: Mod) => e.id))}`);
  assert.equal(f.experiences.length, 5);
  const links = EXPERIENCES.flatMap((e: Mod) => e.links.map((l: Mod) => [e.id, l.skill]));
  assert.equal(links.length, 21, `${links.length} liens`);
  assert.deepEqual(links, f.links.map((l) => [l.exp, l.skill]), `liens ${JSON.stringify(links)}`);
});

test('B8.2 : condition de chaque lien = colonnes « Si oui » / « Sans réponse » de FAITS 6.2 (12, 1, 4, 1, 3)', async (t) => {
  // B8.2 : conditions lues dans le tableau, pas recopiées dans le test.
  const f = await faits();
  const { EXPERIENCES } = await treeMod();
  for (const l of f.links) {
    const e = EXPERIENCES.find((x: Mod) => x.id === l.exp);
    const got = e?.links.find((x: Mod) => x.skill === l.skill)?.condition;
    assert.equal(got, l.condition, `${l.exp} → ${l.skill} : ${got}, FAITS ${l.condition}`);
  }
  const count = (c: string): number => f.links.filter((l) => l.condition === c).length;
  assert.deepEqual([count('always'), count('A-02'), count('A-05'), count('A-06'), count('unconfirmed')], [12, 1, 4, 1, 3], 'répartition des conditions de FAITS 6.2 (B8.2)');
});

test('B8.3 : liens vers des compétences existantes, sans doublon, identifiants uniques', async () => {
  // B8.3.
  const { SKILLS, EXPERIENCES } = await treeMod();
  const ids = new Set(SKILLS.map((s: Mod) => s.id));
  assert.equal(ids.size, SKILLS.length, 'identifiants de compétences dupliqués');
  assert.equal(new Set(EXPERIENCES.map((e: Mod) => e.id)).size, EXPERIENCES.length, 'identifiants d\'expériences dupliqués');
  for (const e of EXPERIENCES) {
    const seen = new Set<string>();
    for (const l of e.links) {
      assert.ok(ids.has(l.skill), `${e.id} → ${l.skill} : compétence inconnue`);
      assert.ok(!seen.has(l.skill), `${e.id} → ${l.skill} : doublon`);
      seen.add(l.skill);
    }
  }
});

test('B8 isLit : always vrai, A-xx = answers[id], unconfirmed toujours faux, défaut ANSWERS', async () => {
  // B8 isLit.
  const { isLit, ANSWERS } = await treeMod();
  for (const a of COMBOS) {
    assert.equal(isLit('always', a), true);
    assert.equal(isLit('unconfirmed', a), false, `unconfirmed allumé sous ${JSON.stringify(a)}`);
    for (const id of ['A-02', 'A-05', 'A-06'] as const) assert.equal(isLit(id, a), a[id], `isLit(${id}) sous ${JSON.stringify(a)}`);
  }
  for (const id of ['A-02', 'A-05', 'A-06']) assert.equal(isLit(id), ANSWERS[id], `isLit(${id}) sans réponses doit lire ANSWERS`);
  assert.equal(isLit('always'), true);
  assert.equal(isLit('unconfirmed'), false);
});

test('B8.4 : pour les 8 combinaisons, litSkills et experiencesUsing suivent FAITS 6.2 et gardent un lien allumé', async (t) => {
  // B8.4.
  const f = await faits();
  const { litSkills, experiencesUsing } = await treeMod();
  for (const a of COMBOS) {
    for (const e of f.experiences) {
      const got = litSkills(e.id, a);
      assert.deepEqual(got, f.links.filter((l) => l.exp === e.id && litRef(l.condition, a)).map((l) => l.skill), `litSkills(${e.id}) sous ${JSON.stringify(a)}`);
      assert.ok(got.length >= 1, `${e.id} n'allume rien sous ${JSON.stringify(a)}`);
    }
    for (const n of f.nodes) {
      const got = experiencesUsing(n.id, a);
      assert.deepEqual(got, f.experiences.filter((e) => litRef(condOf(f, e.id, n.id) ?? 'unconfirmed', a)).map((e) => e.id), `experiencesUsing(${n.id}) sous ${JSON.stringify(a)}`);
      assert.ok(got.length >= 1, `${n.id} sans lien allumé sous ${JSON.stringify(a)}`);
    }
  }
});

test('B8.5 : litSkills sous NO_ANSWERS et avec toutes les réponses à oui (tableau du contrat)', async () => {
  // B8.5 : assertion indépendante de FAITS.
  const { litSkills, NO_ANSWERS } = await treeMod();
  const none: Record<string, string[]> = {
    'bnp-paribas': ['llm', 'python', 'obs', 'docker', 'front'], bpce: ['agents', 'k8s'], 'croix-rouge': ['rag'],
    'ecole-42': ['c', 'unix'], 'droit-de-retard': ['tests', 'python'],
  };
  const yes: Record<string, string[]> = {
    'bnp-paribas': ['llm', 'python', 'obs', 'docker', 'front'], bpce: ['agents', 'k8s', 'docker'], 'croix-rouge': ['rag', 'front', 'llm'],
    'ecole-42': ['c', 'unix', 'docker'], 'droit-de-retard': ['tests', 'python', 'llm', 'front'],
  };
  for (const e of Object.keys(none)) {
    assert.deepEqual(litSkills(e, NO_ANSWERS), none[e], `${e} sous NO_ANSWERS : ${JSON.stringify(litSkills(e, NO_ANSWERS))}`);
    assert.deepEqual(litSkills(e, ALL), yes[e], `${e} tout à oui : ${JSON.stringify(litSkills(e, ALL))}`);
  }
});

test('B8.6 : un fragment par lien confirmé (18), textes intégraux et ordre de la cellule FAITS', async (t) => {
  // B8.6 et « Les fragments tip suivent l'ordre de leur cellule FAITS ».
  const f = await faits();
  const { SKILLS } = await treeMod();
  let total = 0;
  for (const s of SKILLS) {
    const tips = s.tip.map((x: Mod) => ({ from: x.from, fr: x.text.fr, en: x.text.en }));
    assert.deepEqual(tips, nodeOf(f, s.id).fragments, `${s.id} : fragments ${JSON.stringify(tips)}`);
    total += tips.length;
  }
  assert.equal(total, 18, `${total} fragments, attendu 18`);
  for (const l of f.links) {
    const n = SKILLS.find((x: Mod) => x.id === l.skill).tip.filter((x: Mod) => x.from === l.exp).length;
    assert.equal(n, l.condition === 'unconfirmed' ? 0 : 1, `${l.exp} → ${l.skill} (${l.condition}) : ${n} fragment(s)`);
  }
});

test('B8.7 : exemples exacts d\'infobulles (python, docker, front) lus dans FAITS 6.1', async (t) => {
  // B8.7.
  const f = await faits();
  const { skillTooltip, NO_ANSWERS } = await treeMod();
  const py = nodeOf(f, 'python').fragments;
  assert.equal(skillTooltip('python', 'fr', NO_ANSWERS), `${py[0].fr} ; ${py[1].fr}`);
  assert.equal(skillTooltip('python', 'en', NO_ANSWERS), `${py[0].en}; ${py[1].en}`);
  assert.equal(skillTooltip('docker', 'fr', NO_ANSWERS), nodeOf(f, 'docker').fragments[0].fr, 'docker sous NO_ANSWERS : seul le fragment BNP');
  const fr = nodeOf(f, 'front');
  assert.equal(skillTooltip('front', 'fr', ALL), fr.fragments.map((x) => x.fr).join(' ; '), 'front, A-05 = oui (FR)');
  assert.equal(skillTooltip('front', 'en', ALL), fr.fragments.map((x) => x.en).join('; '), 'front, A-05 = oui (EN)');
  assert.ok(fr.noAnswerTooltip, 'FAITS : infobulle « Sans réponse » de front absente');
  assert.equal(skillTooltip('front', 'fr', NO_ANSWERS), fr.noAnswerTooltip!.fr, 'front sans réponse (FR)');
  assert.equal(skillTooltip('front', 'en', NO_ANSWERS), fr.noAnswerTooltip!.en, 'front sans réponse (EN)');
});

test('B8 infobulles : fragments allumés joints par « ; » (FR) et « ; » (EN), pour les 8 combinaisons', async (t) => {
  // B8 règle des infobulles : seuls les liens allumés sont cités ; textes intégraux.
  const f = await faits();
  const { skillTooltip } = await treeMod();
  for (const a of COMBOS) for (const n of f.nodes) for (const l of ['fr', 'en'] as const) {
    assert.equal(skillTooltip(n.id, l, a), expectedTooltip(f, n.id, l, a), `${n.id}/${l} sous ${JSON.stringify(a)}`);
  }
  const dk = nodeOf(f, 'docker').fragments;
  assert.equal(skillTooltip('docker', 'fr', only('A-02')), `${dk[0].fr} ; ${dk[1].fr}`);
  assert.equal(skillTooltip('docker', 'en', only('A-05')), `${dk[0].en}; ${dk[2].en}`);
  const llm = nodeOf(f, 'llm').fragments.map((x) => x.from);
  assert.deepEqual(llm, ['bnp-paribas', 'droit-de-retard', 'croix-rouge'], 'llm : BNP puis droit-de-retard puis Croix-Rouge');
});

test('B8.8 : libellés et icônes intégraux de FAITS 6.1, front selon A-05', async (t) => {
  // B8.8.
  const f = await faits();
  const { SKILLS, skillLabel, skillIcon } = await treeMod();
  for (const n of f.nodes) {
    const s = SKILLS.find((x: Mod) => x.id === n.id);
    assert.deepEqual({ ...s.label }, n.label, `${n.id} : libellé ${JSON.stringify(s.label)}`);
    assert.equal(s.icon, n.icon, `${n.id} : icône ${s.icon}`);
    assert.deepEqual(s.ifYes ? { answer: s.ifYes.answer, label: { ...s.ifYes.label }, icon: s.ifYes.icon } : null, n.ifYes, `${n.id} : variante ${JSON.stringify(s.ifYes)}`);
    for (const a of COMBOS) {
      const yes = n.ifYes !== null && a[n.ifYes.answer as keyof Ans];
      const lab = yes ? n.ifYes!.label : n.label;
      assert.equal(skillLabel(n.id, 'fr', a), lab.fr, `${n.id} FR sous ${JSON.stringify(a)}`);
      assert.equal(skillLabel(n.id, 'en', a), lab.en, `${n.id} EN sous ${JSON.stringify(a)}`);
      assert.equal(skillIcon(n.id, a), yes ? n.ifYes!.icon : n.icon, `${n.id} : icône sous ${JSON.stringify(a)}`);
    }
  }
  const front = nodeOf(f, 'front');
  assert.deepEqual([front.label, front.icon, front.ifYes], [{ fr: 'React · front', en: 'React · front-end' }, 'react', { answer: 'A-05', label: { fr: 'Front-end', en: 'Front-end' }, icon: 'neutral' }], 'lecture de la variante front (B8.8)');
});

test('B8 expériences : noms et href lus dans les sections de FAITS (titre et « Page ouverte »)', async (t) => {
  // B8 « Pour les expériences ».
  const f = await faits();
  const { EXPERIENCES } = await treeMod();
  for (const e of f.experiences) {
    const m = EXPERIENCES.find((x: Mod) => x.id === e.id);
    assert.ok(m, `expérience ${e.id} absente`);
    assert.deepEqual({ name: { ...m.name }, href: m.href }, { name: e.name, href: e.href }, `${e.id} : ${JSON.stringify({ name: m.name, href: m.href })}`);
  }
  assert.equal(f.experiences.find((e) => e.id === 'croix-rouge')?.name.en, 'French Red Cross', 'nom anglais de la Croix-Rouge (B8)');
});

test('B8.9 : aucun texte hors de FAITS (libellés, noms, fragments, FR et EN)', async (t) => {
  // B8.9 : sous-chaînes exactes de FAITS.md ; complété par les comparaisons intégrales ci-dessus.
  const { SKILLS, EXPERIENCES } = await treeMod();
  const text = faitsCorpus();
  const texts: [string, string][] = [];
  for (const s of SKILLS) {
    texts.push([`${s.id}.label.fr`, s.label.fr], [`${s.id}.label.en`, s.label.en]);
    if (s.ifYes) texts.push([`${s.id}.ifYes.fr`, s.ifYes.label.fr], [`${s.id}.ifYes.en`, s.ifYes.label.en]);
    for (const x of s.tip) texts.push([`${s.id}.tip(${x.from}).fr`, x.text.fr], [`${s.id}.tip(${x.from}).en`, x.text.en]);
  }
  for (const e of EXPERIENCES) texts.push([`${e.id}.name.fr`, e.name.fr], [`${e.id}.name.en`, e.name.en]);
  const outside = texts.filter(([, v]) => typeof v !== 'string' || v.length === 0 || !text.includes(v));
  assert.deepEqual(outside, [], `textes absents de FAITS.md : ${JSON.stringify(outside)}`);
});

test('B8.10 : ICONS (une entrée par icône utilisée, SVG monochrome sans URL externe)', async () => {
  // B8.10.
  const { ICONS, SKILLS } = await treeMod();
  const used = new Set<string>(ICON_IDS);
  for (const s of SKILLS) { used.add(s.icon); if (s.ifYes) used.add(s.ifYes.icon); }
  for (const id of used) {
    const svg = ICONS[id];
    assert.equal(typeof svg, 'string', `icône ${id} absente`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${id} : doit commencer par <svg et finir par </svg>`);
    const urls = [...svg.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]).filter((u) => u !== 'http://www.w3.org/2000/svg');
    assert.deepEqual(urls, [], `${id} : URL interdite ${urls.join(' ')}`);
    assert.ok(!/href|src\s*=|url\(/i.test(svg), `${id} : href, src ou url( interdit`);
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(svg), `${id} : couleur codée en dur`);
    const paints = [...svg.matchAll(/(?:fill|stroke|color|stop-color)\s*[=:]\s*["']?([^"';\s>]+)/gi)].map((m) => m[1]);
    const bad = paints.filter((v) => v !== 'none' && v !== 'currentColor');
    assert.deepEqual(bad, [], `${id} : couleurs autres que currentColor : ${bad.join(', ')}`);
    assert.ok(svg.includes('currentColor'), `${id} : currentColor attendu`);
  }
});

// SHA-256 de l'attribut d des icônes du paquet officiel simple-icons 13.21.0 (icons/<id>.svg, CC0),
// relevés sur https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/ et non sur une exécution du module.
const SIMPLE_ICONS_D_SHA256: Record<string, string> = {
  python: '22ef2bec5a94ab65a654b95adf49c016aba554435440f7a71b69c434e89180d8',
  docker: '484488a1e384291d1bd1937b2aee4da83821d2fb283b2b51c737282d95a8ffbf',
  kubernetes: '703363e94db0e87865654afa59fbf0e73a272aa6e439af3da3fe21aa59b47577',
  react: '7d6ad7ab75f95c858dc7ea6f9f85ffba7aea5fb853356755b6384a05ce78d83d',
  cplusplus: '437eb63c0ad80a51924ad9794756eddd144ead68e6c093ec2f1cccf68f4b3711',
  gnubash: 'fd5dc30157502e12cd6ca5d302414ee0ecb226b141a821db7795a8cdbdf65d3a',
};

test('B8.10 : tracés Simple Icons identiques au paquet officiel 13.21.0 (empreinte de l\'attribut d)', async () => {
  // Audit, mutation « remplacer le tracé Python par un triangle » non détectée.
  const { ICONS } = await treeMod();
  for (const [id, sha] of Object.entries(SIMPLE_ICONS_D_SHA256)) {
    const ds = [...String(ICONS[id]).matchAll(/\sd="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(ds.length, 1, `${id} : un seul tracé attendu, reçu ${ds.length}`);
    const got = createHash('sha256').update(ds[0]).digest('hex');
    assert.equal(got, sha, `${id} : tracé différent de simple-icons 13.21.0`);
  }
});

test('B8.11 : les href de bnp-paribas, croix-rouge et droit-de-retard figurent dans content/routes.json', async () => {
  // B8.11 ; bpce et ecole-42 attendent le lot 2b (A-01).
  const { EXPERIENCES } = await treeMod();
  const paths = (JSON.parse(readFileSync(join(siteDir, 'content', 'routes.json'), 'utf8')) as { paths: string[] }).paths;
  for (const id of ['bnp-paribas', 'croix-rouge', 'droit-de-retard']) {
    const e = EXPERIENCES.find((x: Mod) => x.id === id);
    assert.ok(e, `expérience ${id} absente`);
    assert.ok(paths.includes(e.href), `${id} : href ${e.href} absent de routes.json`);
  }
  for (const id of ['bpce', 'ecole-42']) {
    const e = EXPERIENCES.find((x: Mod) => x.id === id);
    assert.match(e.href, /^experiences\/[a-z0-9-]+\/$/, `${id} : href ${e.href} au format de routes.json attendu`);
  }
});

// Dernier test du fichier : il tente d'écrire dans les données, puis restaure ce qui aurait changé.
test('B8 données figées : écrire dans SKILLS, EXPERIENCES et leurs objets imbriqués échoue ou est sans effet', async () => {
  // Audit « données publiques modifiables après import ».
  const m = await treeMod();
  const safe = (f: () => unknown): unknown => { try { return f(); } catch (e) { return `erreur : ${(e as Error).message}`; } };
  const snapshot = (): string => JSON.stringify({
    s: m.SKILLS, e: m.EXPERIENCES,
    f: COMBOS.map((a) => [m.EXPERIENCES.map((e: Mod) => safe(() => m.litSkills(e.id, a))), m.SKILLS.map((s: Mod) => safe(() => [m.skillLabel(s.id, 'fr', a), m.skillTooltip(s.id, 'en', a), m.skillIcon(s.id, a)]))]),
  });
  const before = snapshot();
  const s0 = m.SKILLS[0];
  const e0 = m.EXPERIENCES[0];
  const saved = { label: s0.label.fr, tip: s0.tip[0].text.en, from: s0.tip[0].from, icon: s0.icon, cond: e0.links[0].condition, skill: e0.links[0].skill, name: e0.name.fr, href: e0.href, nS: m.SKILLS.length, nL: e0.links.length, nT: s0.tip.length };
  const attempts: [string, () => void][] = [
    ['SKILLS[0].label.fr', () => { s0.label.fr = 'X'; }],
    ['SKILLS[0].tip[0].text.en', () => { s0.tip[0].text.en = 'X'; }],
    ['SKILLS[0].tip[0].from', () => { s0.tip[0].from = 'bpce'; }],
    ['SKILLS[0].icon', () => { s0.icon = 'react'; }],
    ['SKILLS[0].tip.push', () => { s0.tip.push({ from: 'bpce', text: { fr: 'X', en: 'X' } }); }],
    ['SKILLS.push', () => { m.SKILLS.push({ id: 'x' }); }],
    ['EXPERIENCES[0].links[0].condition', () => { e0.links[0].condition = 'unconfirmed'; }],
    ['EXPERIENCES[0].links[0].skill', () => { e0.links[0].skill = 'rag'; }],
    ['EXPERIENCES[0].links.push', () => { e0.links.push({ skill: 'rag', condition: 'always' }); }],
    ['EXPERIENCES[0].name.fr', () => { e0.name.fr = 'X'; }],
    ['EXPERIENCES[0].href', () => { e0.href = 'x/'; }],
  ];
  const accepted: string[] = [];
  for (const [name, f] of attempts) {
    const ref = snapshot();
    try { f(); } catch { /* écriture refusée : attendu */ }
    if (snapshot() !== ref) accepted.push(name);
  }
  const after = snapshot();
  // Restauration best effort pour ne rien laisser derrière soi si le module n'est pas figé.
  try {
    s0.label.fr = saved.label; s0.tip[0].text.en = saved.tip; s0.tip[0].from = saved.from; s0.icon = saved.icon;
    s0.tip.length = saved.nT; m.SKILLS.length = saved.nS;
    e0.links[0].condition = saved.cond; e0.links[0].skill = saved.skill; e0.links.length = saved.nL; e0.name.fr = saved.name; e0.href = saved.href;
  } catch { /* données figées */ }
  assert.deepEqual(accepted, [], `écritures acceptées : ${accepted.join(', ')}`);
  assert.equal(after, before, 'les fonctions renvoient d\'autres textes ou liens après les tentatives d\'écriture');
});
