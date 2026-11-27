// Contrat C6 : node scripts/preview.mjs [--lan] [--port <n>] lancé pour de vrai (port libre, ou port par défaut déjà pris : H14).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { TestContext } from 'node:test';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { randomUUID } from 'node:crypto';
import { assertDistExists, childEnv, makeSandbox, previewScriptPath, siteDir } from './helpers.ts';

const TIMEOUT_MS = 30000;

interface Started {
  child: ChildProcess;
  output: () => string;
  stderr: () => string;
}

const running: ChildProcess[] = [];

after(async () => {
  for (const child of running.splice(0)) await stopChild(child);
});

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

// Arrête le processus : SIGTERM, puis SIGKILL après 2 s. Idempotent.
function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveStop) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveStop();
    });
    child.kill('SIGTERM');
  });
}

function startPreview(args: string[], script: string = previewScriptPath, cwd: string = siteDir): Started {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env: childEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.push(child);
  let out = '';
  let err = '';
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (d: string) => {
    out += d;
  });
  child.stderr?.on('data', (d: string) => {
    err += d;
  });
  return { child, output: () => out, stderr: () => err };
}

// Attend (5 s max) la ligne annoncée sur stdout et retourne les URL qu'elle contient.
async function announcedUrls(started: Started): Promise<string[]> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const text = started.output();
    if (text.includes('\n')) {
      const urls = [...text.matchAll(/https?:\/\/[^\s'"<>]+/g)].map((m) => m[0]);
      if (urls.length > 0) return urls;
    }
    if (started.child.exitCode !== null) break;
    await delay(50);
  }
  throw new Error(`aucune URL annoncée sur stdout. stdout="${started.output()}" stderr="${started.stderr()}"`);
}

function hostOf(url: string): string {
  return new URL(url).hostname;
}

function portOf(url: string): string {
  return new URL(url).port;
}

async function fetchPage(url: string): Promise<{ status: number; type: string | null; body: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
  return { status: res.status, type: res.headers.get('content-type'), body: await res.text() };
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

// Première IPv4 non locale de la machine, ou undefined.
function lanIPv4(): string | undefined {
  for (const list of Object.values(networkInterfaces())) {
    for (const info of list ?? []) {
      const family = String(info.family);
      if ((family === 'IPv4' || family === '4') && !info.internal) return info.address;
    }
  }
  return undefined;
}

// H14 (audit astra n° 3) : le port par défaut peut déjà être pris par un autre serveur, sur toutes les interfaces
// (`*:4173`, par exemple l'aperçu --lan du propriétaire) ou sur la boucle locale. Le test ne suppose plus le port libre :
// il sert une copie de l'export marquée d'un jeton aléatoire et n'attribue au serveur testé que les réponses qui
// portent ce jeton. Si la boucle locale est déjà prise, le script doit échouer en nommant 127.0.0.1:4173 (preuve de
// l'adresse visée) ; un script qui viserait toutes les interfaces nommerait 0.0.0.0 ou :: et reste refusé.
const DEFAULT_PORT = 4173;

// Attend (5 s max) que le script annonce une URL ou s'arrête ; vrai s'il s'est arrêté sans rien annoncer.
async function exitedWithoutListening(started: Started): Promise<boolean> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (started.output().includes('\n')) return false;
    if (started.child.exitCode !== null || started.child.signalCode !== null) return true;
    await delay(50);
  }
  return false;
}

async function tokenAt(url: string, token: string): Promise<'jeton' | 'autre' | 'refus'> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const body = await res.text();
    return res.status === 200 && body.includes(token) ? 'jeton' : 'autre';
  } catch {
    return 'refus';
  }
}

// Lance le script donné (copie du bac à sable, qui sert son propre dist/client marqué) sans option et vérifie le
// résultat sur le port par défaut. Lève une erreur au premier écart. Retourne ce qui a été observé.
async function defaultPortCheck(script: string, client: string, t?: TestContext): Promise<string> {
  const token = `c6-${randomUUID()}`;
  writeFileSync(join(client, `${token}.txt`), token);
  const started = startPreview([], script);
  try {
    if (await exitedWithoutListening(started)) {
      // Le script n'a pas pu écouter : seule une boucle locale déjà prise est acceptable, et l'erreur doit la nommer.
      const err = started.stderr();
      assert.match(err, /EADDRINUSE/, `le script s'est arrêté sans écouter, pour une autre raison que le port occupé : ${err.slice(0, 300)}`);
      assert.match(err, /127\.0\.0\.1:4173\b/, `port ${DEFAULT_PORT} occupé : l'erreur doit nommer 127.0.0.1:${DEFAULT_PORT}, l'adresse visée sans option. Reçu : ${err.slice(0, 300)}`);
      return `boucle locale ${DEFAULT_PORT} déjà prise par un autre processus : le script vise bien 127.0.0.1:${DEFAULT_PORT} (EADDRINUSE) ; service et non-joignabilité non mesurés`;
    }
    const urls = await announcedUrls(started);
    assert.ok(
      urls.some((u) => hostOf(u) === '127.0.0.1' && portOf(u) === String(DEFAULT_PORT)),
      `sans option, l'URL annoncée doit être 127.0.0.1:${DEFAULT_PORT}. Annoncé : ${urls.join(', ')}`,
    );
    assert.equal(await tokenAt(`http://127.0.0.1:${DEFAULT_PORT}/${token}.txt`, token), 'jeton', `GET http://127.0.0.1:${DEFAULT_PORT}/ : ce n'est pas le serveur lancé qui répond`);
    const page = await fetchPage(`http://127.0.0.1:${DEFAULT_PORT}/`);
    assert.equal(page.status, 200, `GET http://127.0.0.1:${DEFAULT_PORT}/ doit répondre 200, reçu ${page.status}`);
    assert.match(page.type ?? '', /text\/html/, 'la page doit être servie en text/html');
    const lan = lanIPv4();
    if (!lan) {
      t?.diagnostic('aucune IPv4 non locale sur cette machine : test de non-joignabilité sur le réseau local ignoré');
      return 'boucle locale servie ; pas d\'IPv4 non locale';
    }
    assert.ok(!urls.some((u) => hostOf(u) === lan), `sans --lan, aucune URL annoncée ne doit porter l'IP locale ${lan}`);
    const seen = await tokenAt(`http://${lan}:${DEFAULT_PORT}/${token}.txt`, token);
    assert.notEqual(seen, 'jeton', `sans --lan, le serveur lancé ne doit pas être joignable sur ${lan}:${DEFAULT_PORT}`);
    return seen === 'autre' ? `boucle locale servie ; sur ${lan}:${DEFAULT_PORT}, un autre serveur répond (sans le jeton) : conforme` : `boucle locale servie ; ${lan}:${DEFAULT_PORT} refuse la connexion`;
  } finally {
    await stopChild(started.child);
  }
}

test('C6 : sans option, écoute sur 127.0.0.1:4173, annonce 127.0.0.1 et sert une page en 200, même si un autre serveur occupe déjà le port 4173', { timeout: TIMEOUT_MS }, async (t) => {
  assertDistExists();
  const sb = makeSandbox();
  t.diagnostic(await defaultPortCheck(join(sb.root, 'scripts', 'preview.mjs'), sb.witness, t));
});

test('C6 mutation (H14) : script qui écoute sur toutes les interfaces sans --lan → vérification du port par défaut en échec', { timeout: TIMEOUT_MS }, async (t) => {
  assertDistExists();
  if (!lanIPv4()) return t.skip('mutation non exécutable : la machine n\'a aucune IPv4 non locale (une seule interface : boucle locale)');
  const sb = makeSandbox();
  const mutated = join(sb.root, 'scripts', 'preview.mjs');
  const source = readFileSync(mutated, 'utf8');
  const changed = source.replace("lan?'0.0.0.0':'127.0.0.1'", "'0.0.0.0'");
  assert.notEqual(changed, source, 'mutation sans effet sur la ligne d\'écoute');
  writeFileSync(mutated, changed);
  await assert.rejects(() => defaultPortCheck(mutated, sb.witness), 'la vérification doit échouer quand le serveur écoute sur toutes les interfaces sans --lan');
});

test('C6 : --port <n> change le port annoncé et le port d\'écoute', { timeout: TIMEOUT_MS }, async () => {
  assertDistExists();
  const port = await freePort();
  const started = startPreview(['--port', String(port)]);
  try {
    const urls = await announcedUrls(started);
    assert.ok(
      urls.some((u) => hostOf(u) === '127.0.0.1' && portOf(u) === String(port)),
      `avec --port ${port}, l'URL annoncée doit être 127.0.0.1:${port}. Annoncé : ${urls.join(', ')}`,
    );
    const page = await fetchPage(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200, `GET http://127.0.0.1:${port}/ doit répondre 200, reçu ${page.status}`);
  } finally {
    await stopChild(started.child);
  }
});

// Vérifie --lan sur le script donné : la boucle locale et le réseau local sont annoncés et répondent 200.
async function lanCheck(script: string, t?: TestContext): Promise<void> {
  const port = await freePort();
  const lan = lanIPv4();
  const started = startPreview(['--lan', '--port', String(port)], script);
  try {
    const urls = await announcedUrls(started);
    const hosts = urls.map(hostOf);
    assert.ok(hosts.includes('127.0.0.1'), `avec --lan, une URL doit annoncer la boucle locale 127.0.0.1. Annoncé : ${urls.join(', ')}`);
    if (lan) {
      assert.ok(hosts.includes(lan), `avec --lan, une URL doit annoncer ${lan}. Annoncé : ${urls.join(', ')}`);
    } else {
      t?.diagnostic('aucune IPv4 non locale sur cette machine : vérification réduite (seule la boucle locale est testée)');
      assert.ok(hosts.some((h) => h !== '127.0.0.1'), `avec --lan, l'adresse annoncée ne doit pas être 127.0.0.1 seule. Annoncé : ${urls.join(', ')}`);
    }
    // Chaque URL annoncée doit réellement répondre.
    for (const url of urls) {
      const page = await fetchPage(url);
      assert.equal(page.status, 200, `GET ${url} doit répondre 200, reçu ${page.status}`);
    }
  } finally {
    await stopChild(started.child);
  }
}

test('C6 : --lan annonce la boucle locale et le réseau local, et les deux URL annoncées répondent 200', { timeout: TIMEOUT_MS }, async (t) => {
  assertDistExists();
  await lanCheck(previewScriptPath, t);
});

test('C6 mutation : serveur lié seulement à l\'IPv4 locale avec --lan (boucle locale refusée) → vérification en échec', { timeout: TIMEOUT_MS }, async (t) => {
  assertDistExists();
  const lan = lanIPv4();
  if (!lan) return t.skip('mutation non exécutable : la machine n\'a aucune IPv4 non locale (une seule interface : boucle locale)');
  const sb = makeSandbox();
  const mutated = join(sb.root, 'scripts', 'preview.mjs');
  const source = readFileSync(mutated, 'utf8');
  const changed = source.replace("lan?'0.0.0.0':'127.0.0.1'", 'lan?lanAddress():\'127.0.0.1\'');
  assert.notEqual(changed, source, 'mutation sans effet sur la ligne d\'écoute');
  writeFileSync(mutated, changed);
  await assert.rejects(() => lanCheck(mutated), 'la vérification doit échouer quand la boucle locale n\'accepte pas la connexion');
});
