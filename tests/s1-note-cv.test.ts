// Lot 4, décision S1 du propriétaire (tmp/refonte-arbre/contrat-lot4-s.md) : la note du CV de la page Compétences
// (content/skills.ts, cvNote) perd sa date passée. Sa première phrase est celle de FAITS §7 (Q-R7), cadratin compris,
// identique à `availability` de content/experiences.ts (une seule source) ; la deuxième phrase est inchangée en
// anglais, et vaut « Écrivez-moi et je vous envoie la version avec un téléphone. » en français. « 16 octobre 2026 » /
// « October 16 » n'apparaît plus sur aucune page (à a040fb0, la seule mention est cette note : aucune autre mention
// du stage n'est donc admise).
// Tour Z (contrat-textes-z.md, Z4, décision d'Arnaud du 25/11) : la deuxième phrase (« Écrivez-moi et je vous envoie la
// version avec un téléphone. » / « Write to me and I will send the version with a phone number. ») est retirée : la note
// vaut availability[langue] + « . », rien d'autre (z4-competences.test.ts l'interdit partout).
// Lectures retenues (rapport-tests-lot4-s.md) :
// - « identique à availability » : cvNote commence par availability[langue], à l'octet (U+202F compris, typographie
//   R1), suivi de « . », d'une espace et de la deuxième phrase ; les modules sont lus BRUTS (sans untypoModule) ;
// - « une seule source » : content/skills.ts n'écrit pas la phrase en toutes lettres (il la prend de experiences.ts) ;
// - « sur aucune page » : tous les fichiers texte de l'export (HTML, .html à plat, .rsc, .txt, .js, .json, .xml), les
//   deux ordres (« 16 octobre », « 16 October », « October 16 »), avec un blanc quelconque (U+00A0, U+202F, &nbsp;).
//   Les sources ne sont pas lues : content/home.ts garde une date qui n'est rendue nulle part (signalé au rapport).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { filesUnder, pageContent, readRoute, rel } from './helpers-4.ts';
import type { Lang } from './helpers-4.ts';
import { assertDistExists, distDir, siteDir } from './helpers.ts';

const LANGS: Lang[] = ['en', 'fr'];
// Contrat S1 : première phrase (= FAITS §7, Q-R7), en clair, blancs ordinaires. Tour Z (Z4) : plus de deuxième phrase ;
// `removed` = la phrase retirée, gardée ici pour les témoins.
export const S1_NOTE: Record<Lang, { first: string; removed: string }> = {
  en: { first: 'Available now — permanent role; open to freelance and open-source projects', removed: 'Write to me and I will send the version with a phone number.' },
  fr: { first: 'Disponible immédiatement — CDI ; ouvert au freelance et aux projets open source', removed: 'Écrivez-moi et je vous envoie la version avec un téléphone.' },
};
const SKILLS_ROUTE: Record<Lang, string> = { en: '/skills/', fr: '/fr/skills/' };
const ws = (s: string): string => s.replace(/\s+/g, ' ').trim();
// Date périmée de la note, dans les deux ordres, avec un blanc quelconque.
const B = String.raw`(?:\s|&nbsp;|&#160;|&#xa0;|\\u00a0|\\u202f)+`;
export const STALE_DATE = new RegExp(String.raw`\b16${B}(?:octobre|october)\b|\boctober${B}16\b`, 'i');

async function raw(): Promise<{ cvNote: Record<Lang, string>; availability: Record<Lang, string> }> {
  // Lecture brute (import direct, sans les chargeurs untypo des anciens tests) : U+202F et U+00A0 comptent.
  const sk = (await import(pathToFileURL(join(siteDir, 'content', 'skills.ts')).href)) as { skills: Record<Lang, { cvNote: string }> };
  const ex = (await import(pathToFileURL(join(siteDir, 'content', 'experiences.ts')).href)) as { availability: Record<Lang, string> };
  return { cvNote: { en: sk.skills.en.cvNote, fr: sk.skills.fr.cvNote }, availability: ex.availability };
}

function noteErrors(cvNote: Record<Lang, string>, availability: Record<Lang, string>): string[] {
  const errors: string[] = [];
  for (const l of LANGS) {
    if (ws(availability[l]) !== S1_NOTE[l].first) errors.push(`availability.${l} « ${availability[l]} » ≠ FAITS §7 « ${S1_NOTE[l].first} » (blancs réduits)`);
    const want = `${availability[l]}.`;
    if (cvNote[l] !== want) errors.push(`skills.${l}.cvNote « ${cvNote[l]} » ≠ availability.${l} + « . » (tour Z, Z4 : seule la phrase de disponibilité) : « ${want} »`);
  }
  return errors;
}
// La phrase écrite en toutes lettres dans content/skills.ts (blancs quelconques, avec ou sans apostrophe typographique).
function duplicated(src: string): string[] {
  const flat = src.replace(/\s+/g, ' ');
  return LANGS.filter((l) => flat.includes(S1_NOTE[l].first.split(' — ')[0] as string)).map((l) => `content/skills.ts écrit « ${S1_NOTE[l].first.split(' — ')[0]} » en toutes lettres (${l}) : la phrase doit venir de availability (content/experiences.ts, une seule source)`);
}
function staleFiles(root: string): string[] {
  return filesUnder(root)
    .filter((f) => /\.(html|rsc|txt|js|mjs|json|xml|webmanifest)$/.test(f))
    .filter((f) => STALE_DATE.test(readFileSync(f, 'utf8')))
    .map((f) => {
      const t = readFileSync(f, 'utf8');
      const m = STALE_DATE.exec(t) as RegExpExecArray;
      return `${rel(root, f)} : « …${t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 10).replace(/\s+/g, ' ')}… »`;
    });
}

test('S1, Z4 : skills.cvNote = availability (content/experiences.ts, FAITS §7) + « . », sans deuxième phrase, en FR et EN, à l\'octet', async () => {
  const { cvNote, availability } = await raw();
  const errors = noteErrors(cvNote, availability);
  assert.deepEqual(errors, [], `lot 4, S1\n${errors.join('\n')}`);
});

test('S1 : une seule source : content/skills.ts n\'écrit pas la phrase de disponibilité en toutes lettres', () => {
  const errors = duplicated(readFileSync(join(siteDir, 'content', 'skills.ts'), 'utf8'));
  assert.deepEqual(errors, [], `lot 4, S1\n${errors.join('\n')}`);
});

test('S1 : la note rendue sur /skills/ et /fr/skills/ est une ligne du <main> égale à la nouvelle note (blancs réduits), et l\'ancienne a disparu', () => {
  assertDistExists();
  const errors: string[] = [];
  for (const l of LANGS) {
    const route = SKILLS_ROUTE[l];
    const html = readRoute(distDir, route);
    if (!html) {
      errors.push(`${route} absente de l'export`);
      continue;
    }
    const lines = pageContent(route, html).text.split('\n').map(ws);
    const want = ws(`${S1_NOTE[l].first}.`);
    if (!lines.includes(want)) errors.push(`${route} : ligne « ${want} » absente du <main> ; note rendue : « ${lines.find((x) => x.startsWith(S1_NOTE[l].first)) ?? '(aucune)'} »`);
  }
  assert.deepEqual(errors, [], `lot 4, S1\n${errors.join('\n')}`);
});

test('S1 : « 16 octobre » / « 16 October » / « October 16 » n\'apparaît dans aucun fichier texte de l\'export', () => {
  assertDistExists();
  const found = staleFiles(distDir);
  assert.deepEqual(found, [], `lot 4, S1 : date périmée encore exportée\n${found.join('\n')}`);
});

test('S1 (témoins) : la note conforme passe ; ancienne note, troisième formulation, phrase recopiée sans U+202F, point ou deuxième phrase changés, phrase écrite en toutes lettres, date dans les deux ordres rougissent', async () => {
  const { availability } = await raw();
  const ok = { en: `${availability.en}.`, fr: `${availability.fr}.` };
  assert.deepEqual(noteErrors(ok, availability), [], 'note conforme refusée');
  const muts: [string, Record<Lang, string>][] = [
    ['ancienne note FR', { ...ok, fr: 'Écrit pour un CDI à partir du 16 octobre 2026. Écrivez-moi et je vous envoie la version avec un téléphone.' }],
    ['ancienne note EN', { ...ok, en: 'Written for a permanent role from 16 October 2026. Write to me and I will send the version with a phone number.' }],
    ['troisième formulation', { ...ok, fr: ok.fr.replace('immédiatement', 'dès maintenant') }],
    ['phrase recopiée avec une espace ordinaire devant « ; »', { ...ok, fr: ok.fr.replace(/ ;/, ' ;') }],
    ['tiret court au lieu du cadratin', { ...ok, en: ok.en.replace('—', '–') }],
    ['point final retiré', { ...ok, en: ok.en.replace(/\.$/, '') }],
    ['phrase retirée par Z4 encore là (FR)', { ...ok, fr: `${ok.fr} ${S1_NOTE.fr.removed}` }],
    ['phrase retirée par Z4 encore là (EN)', { ...ok, en: `${ok.en} ${S1_NOTE.en.removed}` }],
    ['autre deuxième phrase', { ...ok, fr: `${ok.fr} Écrivez-moi.` }],
  ];
  assert.ok(/ /.test(availability.fr), 'availability.fr sans U+202F : le témoin « espace ordinaire » serait vide');
  for (const [label, note] of muts) assert.ok(noteErrors(note, availability).length > 0, `« ${label} » non détecté`);
  // Une seule source.
  assert.deepEqual(duplicated("import { availability } from './experiences.ts';\ncvNote: `${availability.fr}. Écrivez-moi…`"), []);
  assert.ok(duplicated("cvNote: 'Disponible immédiatement — CDI ; ouvert au freelance et aux projets open source. Écrivez-moi'").length > 0, 'phrase FR recopiée non détectée');
  assert.ok(duplicated("cvNote: 'Available now — permanent role; open'").length > 0, 'phrase EN recopiée non détectée');
  // Date périmée : formes et blancs.
  for (const s of ['à partir du 16 octobre 2026', 'from 16 October 2026', 'from October 16, 2026', '16 octobre', '16&nbsp;October', '16\\u202foctobre']) assert.ok(STALE_DATE.test(s), `« ${s} » non détecté`);
  for (const s of ['2016 octobre', '160 October', 'October 2016', 'le 16 novembre']) assert.ok(!STALE_DATE.test(s), `« ${s} » pris à tort pour la date`);
});
