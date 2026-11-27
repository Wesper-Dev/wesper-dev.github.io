// Contrats C1/C2/C3 : manifeste invalide. Les deux scripts doivent échouer en nommant le problème.
// La normalisation ne doit rien écrire ; check-export.py doit sortir un rapport JSON avec code 1.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, makeSandbox, modeFlags, parseReport, readManifest, snapshotDir } from './helpers.ts';

after(cleanupTempDirs);

const real = readManifest();
const { origin, paths } = real;

const CASES: { name: string; text: string; token: string }[] = [
  { name: 'chemin en double', text: JSON.stringify({ origin, paths: [...paths, 'skills/'] }), token: 'skills/' },
  { name: 'origin absent', text: JSON.stringify({ paths }), token: 'origin' },
  { name: 'paths non tableau', text: JSON.stringify({ origin, paths: null }), token: 'paths' },
  {
    name: 'chemin non vide sans slash final',
    text: JSON.stringify({ origin, paths: paths.map((p) => (p === 'skills/' ? 'skills' : p)) }),
    token: 'skills',
  },
  { name: 'manifeste tronqué (JSON illisible)', text: JSON.stringify({ origin, paths }).slice(0, -10), token: 'routes.json' },
];

// Origines invalides ou non canoniques : refusées par les deux scripts, en nommant origin.
for (const origin2 of ['https://[', 'https://wesper-dev.github.io:443', 'https://wesper-dev.github.io/', 'https://wesper-dev.github.io/fr']) {
  CASES.push({ name: `origin « ${origin2} »`, text: JSON.stringify({ origin: origin2, paths }), token: 'origin' });
}

for (const c of CASES) {
  test(`C2 manifeste invalide (${c.name}) : la normalisation échoue, nomme le problème et n'écrit rien`, () => {
    const sb = makeSandbox();
    sb.writeManifest(c.text);
    const before = snapshotDir(sb.artifact);
    const witnessBefore = snapshotDir(sb.witness);
    const r = sb.normalizeRun();
    assert.notEqual(r.status, 0, `normalize doit sortir avec un code non nul (${c.name}), reçu 0`);
    assert.doesNotMatch(r.stderr, /TypeError|ReferenceError|SyntaxError|\n\s+at /, `échec contrôlé attendu, pas une exception non gérée : ${r.stderr.slice(0, 300)}`);
    assert.ok(`${r.stdout}\n${r.stderr}`.includes(c.token), `la sortie doit nommer le problème (« ${c.token} »). stderr : ${r.stderr.slice(0, 400)}`);
    assert.deepEqual(snapshotDir(sb.artifact), before, `aucun fichier ne doit être écrit dans --dist (${c.name})`);
    assert.deepEqual(snapshotDir(sb.witness), witnessBefore, `le dossier par défaut ne doit pas être touché (${c.name})`);
  });

  test(`C3 manifeste invalide (${c.name}) : check-export.py sort un rapport JSON code 1 qui nomme le problème`, () => {
    const sb = makeSandbox();
    sb.writeManifest(c.text);
    const r = sb.checkRun(modeFlags(sb.artifact));
    assert.equal(r.status, 1, `code 1 attendu (${c.name}), reçu ${r.status}. stderr : ${r.stderr.slice(0, 300)}`);
    assert.doesNotMatch(r.stderr, /Traceback/, `rapport attendu, pas une exception Python non gérée : ${r.stderr.slice(0, 300)}`);
    const report = parseReport(r.stdout);
    assert.ok(report.errors.length > 0, `errors doit être non vide (${c.name})`);
    assert.ok(report.errors.some((e) => e.includes(c.token)), `une erreur doit nommer le problème « ${c.token} ». Erreurs : ${JSON.stringify(report.errors)}`);
  });
}

// routes.json remplacé par un répertoire : échec contrôlé nommant le fichier, rien écrit côté normalisation.
test('C2 manifeste : routes.json remplacé par un répertoire → normalisation en échec contrôlé, rien n\'est écrit', () => {
  const sb = makeSandbox();
  const manifest = join(sb.root, 'content', 'routes.json');
  rmSync(manifest);
  mkdirSync(manifest);
  const before = snapshotDir(sb.artifact);
  const r = sb.normalizeRun();
  assert.notEqual(r.status, 0, 'normalize doit sortir avec un code non nul si routes.json est un répertoire');
  assert.doesNotMatch(r.stderr, /TypeError|ReferenceError|SyntaxError|\n\s+at /, `échec contrôlé attendu, pas une exception non gérée : ${r.stderr.slice(0, 300)}`);
  assert.ok(`${r.stdout}\n${r.stderr}`.includes('routes.json'), `la sortie doit nommer routes.json. stderr : ${r.stderr.slice(0, 300)}`);
  assert.deepEqual(snapshotDir(sb.artifact), before, 'aucun fichier ne doit être écrit');
});

test('C3 manifeste : routes.json remplacé par un répertoire → rapport JSON code 1 nommant routes.json', () => {
  const sb = makeSandbox();
  const manifest = join(sb.root, 'content', 'routes.json');
  rmSync(manifest);
  mkdirSync(manifest);
  const r = sb.checkRun(modeFlags(sb.artifact));
  assert.equal(r.status, 1, `code 1 attendu, reçu ${r.status}. stderr : ${r.stderr.slice(0, 300)}`);
  assert.doesNotMatch(r.stderr, /Traceback/, 'rapport attendu, pas une exception Python non gérée');
  const { errors } = parseReport(r.stdout);
  assert.ok(errors.some((e) => e.includes('routes.json')), `une erreur doit nommer routes.json. Erreurs : ${JSON.stringify(errors)}`);
});
