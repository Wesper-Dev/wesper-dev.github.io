// Régénère tests/fixtures/textes-publics.json depuis deliverables/refonte-arbre/FAITS.md et BASE_DONNEES.md (F12,
// audit Fable). Usage, depuis site/ : node --experimental-strip-types tests/fixtures/regenerer-textes-publics.ts
// La copie ne contient que les textes publics lus par les tests (pas les colonnes Source, ni les notes de travail).
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { BASE_FILE, FAITS_FILE, FIXTURE_FILE, basePresent, extractFaitsTexts, faitsPresent, parseContact } from '../helpers-faits.ts';
import { e31FaitsCandidates } from '../helpers-home.ts';

if (!faitsPresent() || !basePresent()) {
  console.error(`sources absentes : ${faitsPresent() ? '' : FAITS_FILE} ${basePresent() ? '' : BASE_FILE}`);
  process.exit(2);
}
const out = {
  _lisezMoi: 'Copie versionnée des textes publics attendus (F12, audit Fable du lot 2a). Ne pas éditer à la main : régénérer avec node --experimental-strip-types tests/fixtures/regenerer-textes-publics.ts ; f12-copie-faits.test.ts échoue si elle diverge de FAITS.md ou de BASE_DONNEES.md.',
  _sources: { faits: 'deliverables/refonte-arbre/FAITS.md (§1, §2 et §4 pages de détail, §6.1, §6.2, §7 ; sections et pages ouvertes)', contact: 'BASE_DONNEES.md (tableau des profils : Email, GitHub, LinkedIn)' },
  faits: extractFaitsTexts(readFileSync(FAITS_FILE, 'utf8'), e31FaitsCandidates()),
  contact: parseContact(readFileSync(BASE_FILE, 'utf8')),
};
writeFileSync(FIXTURE_FILE, JSON.stringify(out, null, 2) + '\n');
console.log(`écrit : ${FIXTURE_FILE}`);
