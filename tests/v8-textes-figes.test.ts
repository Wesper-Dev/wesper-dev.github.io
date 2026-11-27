// Contrat du lot 6a : textes provisoires figés À PART des tests de structure (brief des tests du lot 6a). Le texte
// courant de la FAQ (site/content/faq.json) et de site/public/llms.txt est celui du brouillon
// tmp/refonte-arbre/textes-lot6.md §1 à §3 (à valider ligne à ligne par Arnaud), copié dans tests/fixtures/faq-lot6.json
// et tests/fixtures/llms-lot6.txt. Changer un texte est permis, mais explicite : on modifie le fichier de contenu, on
// relance tests/fixtures/figer-textes-lot6.ts, et le changement avant → après apparaît dans le diff des fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FAQ_FILE, FAQ_FIXTURE, LLMS_FILE, LLMS_FIXTURE } from './helpers-6.ts';

const REFIGER = 'cd site && node --experimental-strip-types tests/fixtures/figer-textes-lot6.ts';
const withoutMeta = (x: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith('_')));
function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `au caractère ${i} : « …${b.slice(Math.max(0, i - 30), i + 30)}… » attendu, « …${a.slice(Math.max(0, i - 30), i + 30)}… » reçu`;
}

test('Textes figés (lot 6a) : site/content/faq.json = tests/fixtures/faq-lot6.json (hors clés « _ ») ; tout changement de texte passe par une nouvelle fixture', () => {
  assert.ok(existsSync(FAQ_FILE), 'site/content/faq.json absent (contrat lot 6a, V1)');
  const got = JSON.stringify(withoutMeta(JSON.parse(readFileSync(FAQ_FILE, 'utf8')) as Record<string, unknown>), null, 1);
  const want = JSON.stringify(withoutMeta(JSON.parse(readFileSync(FAQ_FIXTURE, 'utf8')) as Record<string, unknown>), null, 1);
  assert.ok(got === want, `faq.json diffère du texte figé ${firstDiff(got, want)}. Si le changement est voulu et validé : ${REFIGER}`);
});

// Tour X (X6, M9) : le _lisezMoi de site/content/faq.json est le sien. Copié de la fixture, il disait « doit être
// identique à ce fichier » en parlant de lui-même. Il est libre, mais ne peut être ni celui de la fixture ni se décrire
// comme elle.
export function lisezMoiErrors(content: Record<string, unknown>, fixture: Record<string, unknown>): string[] {
  const l = content._lisezMoi;
  if (l === undefined) return [];
  if (typeof l !== 'string') return ['site/content/faq.json : _lisezMoi non textuel'];
  const out: string[] = [];
  if (l === fixture._lisezMoi) out.push('site/content/faq.json : _lisezMoi recopié de tests/fixtures/faq-lot6.json (il doit décrire faq.json lui-même, X6)');
  if (/identique à ce fichier|texte fig[ée] de la faq/i.test(l)) out.push('site/content/faq.json : _lisezMoi qui se décrit comme la fixture (« identique à ce fichier », « Texte FIGÉ de la FAQ », X6)');
  return out;
}
test('X6 : le _lisezMoi de site/content/faq.json, s\'il existe, est propre au fichier : ni celui de la fixture, ni « identique à ce fichier »', () => {
  assert.ok(existsSync(FAQ_FILE), 'site/content/faq.json absent (contrat lot 6a, V1)');
  const read = (f: string): Record<string, unknown> => JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
  assert.deepEqual(lisezMoiErrors(read(FAQ_FILE), read(FAQ_FIXTURE)), []);
  // Témoins : l'ancien _lisezMoi est refusé, un texte propre admis, l'absence admise.
  const fx = read(FAQ_FIXTURE);
  assert.ok(lisezMoiErrors({ _lisezMoi: fx._lisezMoi }, fx).length > 0, 'copie du _lisezMoi de la fixture non vue');
  assert.ok(lisezMoiErrors({ _lisezMoi: 'Texte FIGÉ de la FAQ de l\'accueil. site/content/faq.json doit être identique à ce fichier.' }, fx).length > 0, 'ancien _lisezMoi non vu');
  assert.deepEqual(lisezMoiErrors({ _lisezMoi: 'Texte de la FAQ de l’accueil ; figé par tests/fixtures/faq-lot6.json.' }, fx), []);
  assert.deepEqual(lisezMoiErrors({}, fx), []);
});

test('Textes figés (lot 6a) : site/public/llms.txt = tests/fixtures/llms-lot6.txt, à l\'octet', () => {
  assert.ok(existsSync(LLMS_FILE), 'site/public/llms.txt absent (contrat lot 6a, V5)');
  const got = readFileSync(LLMS_FILE, 'utf8');
  const want = readFileSync(LLMS_FIXTURE, 'utf8');
  assert.ok(got === want, `llms.txt diffère du texte figé ${firstDiff(got, want)}. Si le changement est voulu et validé : ${REFIGER}`);
});
