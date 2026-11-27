// Utilitaires partagés des tests du contrat lot 1a. node:test + node:assert, aucune dépendance npm.
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bnpReference } from './helpers-faits.ts';

export const siteDir: string = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// SITE_TEST_DIST : export de remplacement (copie mutée, essais de mutation) ; par défaut dist/client.
export const distDir: string = process.env.SITE_TEST_DIST ?? join(siteDir, 'dist', 'client');
export const manifestPath: string = join(siteDir, 'content', 'routes.json');
export const normalizeScriptPath: string = join(siteDir, 'scripts', 'normalize-export.mjs');
export const checkScriptPath: string = join(siteDir, 'scripts', 'check-export.py');
export const previewScriptPath: string = join(siteDir, 'scripts', 'preview.mjs');
export const workflowPath: string = join(siteDir, '.github', 'workflows', 'pages.yml');
export const packagePath: string = join(siteDir, 'package.json');

// Chemins que le jalon 1a doit contenir. Seule leur présence est figée ; les totaux se calculent depuis le manifeste lu.
export const JALON_PATHS: string[] = [
  '',
  'projects/',
  'hackathons/',
  'skills/',
  'projects/droit-de-retard/',
  'projects/diary/',
  'projects/croix-rouge/',
  'experiences/bnp-paribas/',
];
export const ORIGIN = 'https://wesper-dev.github.io';
export const BNP_ROUTES: string[] = ['/experiences/bnp-paribas/', '/fr/experiences/bnp-paribas/'];

export interface Manifest {
  origin: string;
  paths: string[];
}

export function routesOf(paths: string[]): string[] {
  return paths.flatMap((p) => ['/' + p, '/fr/' + p]);
}

export function sitemapLocsOf(manifest: Manifest): string[] {
  return routesOf(manifest.paths).map((r) => manifest.origin + r);
}

export function readManifest(): Manifest {
  if (!existsSync(manifestPath)) throw new Error(`manifeste absent : ${manifestPath}`);
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
}

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

export function assertDistExists(): void {
  if (!existsSync(distDir)) throw new Error(`dist/client absent (${distDir}) : lancer npm run build`);
}

const tempDirs: string[] = [];

export function cleanupTempDirs(): void {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// Environnement d'un enfant : SITE_PUBLIC est retiré sauf si fourni explicitement.
export function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  if (!('SITE_PUBLIC' in extra)) delete env.SITE_PUBLIC;
  return env;
}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function toResult(r: SpawnSyncReturns<string>): RunResult {
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

export function runNode(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): RunResult {
  return toResult(
    spawnSync(process.execPath, args, {
      cwd: options.cwd ?? siteDir,
      env: options.env ?? childEnv(),
      encoding: 'utf8',
      timeout: 30000,
    }),
  );
}

export function runPython(args: string[], cwd: string = siteDir): RunResult {
  return toResult(spawnSync('python3', args, { cwd, env: childEnv(), encoding: 'utf8', timeout: 30000 }));
}

// Bac à sable : scripts copiés, manifeste (réel par défaut), et deux copies de dist/client.
// - artifact : dossier passé en --dist à tous les essais, seul modifié par les tests ;
// - witness : dossier par défaut (dist/client du bac à sable), témoin : il ne doit jamais être touché.
export interface Sandbox {
  root: string;
  artifact: string;
  witness: string;
  writeManifest: (text: string) => void;
  normalizeAt: (dist: string, env?: Record<string, string>) => RunResult;
  normalizeRun: (env?: Record<string, string>) => RunResult;
  checkAt: (dist: string, flags?: string[]) => RunResult;
  checkRun: (flags?: string[]) => RunResult;
}

export function makeSandbox(): Sandbox {
  assertDistExists();
  const root = tempDir('arbre-sandbox-');
  cpSync(join(siteDir, 'scripts'), join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'content'), { recursive: true });
  const manifest = join(root, 'content', 'routes.json');
  if (existsSync(manifestPath)) copyFileSync(manifestPath, manifest);
  const artifact = join(root, 'artifact');
  const witness = join(root, 'dist', 'client');
  cpSync(distDir, artifact, { recursive: true });
  cpSync(distDir, witness, { recursive: true });
  const normalizeScript = join(root, 'scripts', 'normalize-export.mjs');
  const checkScript = join(root, 'scripts', 'check-export.py');
  return {
    root,
    artifact,
    witness,
    writeManifest: (text: string) => writeFileSync(manifest, text),
    normalizeAt: (dist: string, env: Record<string, string> = {}) =>
      runNode([normalizeScript, '--dist', dist], { cwd: root, env: childEnv(env) }),
    normalizeRun: (env: Record<string, string> = {}) =>
      runNode([normalizeScript, '--dist', artifact], { cwd: root, env: childEnv(env) }),
    checkAt: (dist: string, flags: string[] = []) => runPython([checkScript, ...flags, '--dist', dist], root),
    checkRun: (flags: string[] = []) => runPython([checkScript, ...flags, '--dist', artifact], root),
  };
}

// Chemin à plat d'une route (avant normalisation) : '/projects/diary/' -> 'projects/diary.html'.
export function flatSourceFor(route: string): string {
  const rel = route.slice(1);
  return rel === '' ? 'index.html' : rel.slice(0, -1) + '.html';
}

// Chemin du index.html de répertoire attendu après normalisation.
export function dirIndexFor(route: string): string {
  return route.slice(1) + 'index.html';
}

export function placeholderPage(label: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>placeholder ${label}</title></head><body><h1>placeholder ${label}</h1></body></html>\n`;
}

// Ajoute une page à plat factice pour chaque route absente de la copie (routes passées explicitement).
export function fillMissingFlatPages(client: string, routes: string[]): void {
  for (const route of routes) {
    const src = join(client, flatSourceFor(route));
    if (!existsSync(src)) {
      mkdirSync(dirname(src), { recursive: true });
      writeFileSync(src, placeholderPage(route));
    }
  }
}

// Supprime les index.html de répertoire (sauf racine) : la normalisation doit les recréer.
export function removeDirIndexes(client: string, routes: string[]): void {
  for (const route of routes) {
    if (route === '/') continue;
    rmSync(join(client, dirIndexFor(route)), { force: true });
  }
}

// Supprime les fichiers produits par la normalisation : seules les sources à plat restent.
export function removeGenerated(client: string): void {
  for (const name of ['404.html', '.nojekyll', 'robots.txt', 'sitemap.xml']) rmSync(join(client, name), { force: true });
}

// Empreinte de tous les fichiers d'un dossier (chemin relatif -> sha256). Sert aux preuves « rien n'a été écrit ».
export function snapshotDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[relative(dir, full)] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

// Vrai si au moins une erreur nomme la page relPath (ex. 'projects/diary/' ou 'fr/projects/diary/').
// Pour une page EN, une occurrence 'fr/...' ne compte pas.
export function namesPage(errors: string[], relPath: string): boolean {
  if (relPath.startsWith('fr/')) return errors.some((e) => e.includes(relPath));
  return errors.some((e) => e.split('fr/' + relPath).join('').includes(relPath));
}

export function robotsDisallowsAll(text: string): boolean {
  return text.split(/\r?\n/).some((line) => /^\s*Disallow:\s*\/\s*$/i.test(line));
}

export type ExportMode = 'preview' | 'public';

// Mode d'un export d'après son robots.txt : Disallow: / = aperçu, sinon public.
export function exportModeOf(client: string): ExportMode {
  const file = join(client, 'robots.txt');
  if (!existsSync(file)) throw new Error(`robots.txt absent de ${client} : mode de l'export indétectable`);
  return robotsDisallowsAll(readFileSync(file, 'utf8')) ? 'preview' : 'public';
}

// Option --public à passer à check-export.py si et seulement si l'export est public.
export function modeFlags(client: string): string[] {
  return exportModeOf(client) === 'public' ? ['--public'] : [];
}

// Rapport JSON brut de check-export.py : doit sortir sur stdout, quel que soit le code de sortie.
export interface Report {
  mode: unknown;
  routes: unknown;
  errors: string[];
}

export function parseReport(stdout: string): Report {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    throw new Error(`rapport JSON attendu sur stdout, reçu : ${JSON.stringify(stdout.slice(0, 300))}`);
  }
  if (!Array.isArray(data.errors) || !data.errors.every((e) => typeof e === 'string')) {
    throw new Error('le rapport doit contenir une liste "errors" de chaînes');
  }
  return { mode: data.mode, routes: data.routes, errors: data.errors as string[] };
}

export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => (m[1] ?? '').trim());
}

export function attrsOf(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([A-Za-z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[(m[1] ?? '').toLowerCase()] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

export function tagsNamed(html: string, name: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map((m) => attrsOf(m[1] ?? ''));
}

export function textOf(fragment: string): string {
  return fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function h1Count(html: string): number {
  return [...html.matchAll(/<h1[\s>]/gi)].length;
}

export function langOf(html: string): string | undefined {
  return /<html\b[^>]*\blang\s*=\s*["']([^"']*)["']/i.exec(html)?.[1];
}

// ---- Contrat C4 (réécrit au lot 1c, D2.7) : pages BNP, récit dans le corps, aucun composant client propre ----
// Le composant de preuve du 1a est retiré : ses garanties de chargement portent désormais sur l'îlot de l'arbre
// (chunk chargé par l'accueil) et sur le module de scène qu'il charge à la demande (D11).

export interface BnpSpec {
  lang: 'en' | 'fr';
  route: string;
  dir: string;
}

export const BNP_EN: BnpSpec = { lang: 'en', route: '/experiences/bnp-paribas/', dir: 'experiences/bnp-paribas' };
export const BNP_FR: BnpSpec = { lang: 'fr', route: '/fr/experiences/bnp-paribas/', dir: 'fr/experiences/bnp-paribas' };

// Tour Z (contrat-textes-z.md, Z1, décision d'Arnaud du 25/11) : « validé pour la production par le comité de pilotage » /
// « approved for production by the steering committee » ; plus jamais « mis en production » ni « released to production ».
export const BNP_REQUIRED: Record<string, string[]> = {
  fr: ['validé pour la production par le comité de pilotage', 'en binôme', '3–5', '1–3'],
  en: ['approved for production by the steering committee', '3–5', '1–3'],
};

export const BNP_FORBIDDEN: string[] = ['tourne en production', 'tournent en production', 'runs in production', 'running in production', 'mis en production', 'mise en production', 'released to production', 'reached production', 'atteint la production'];

const CHUNKS = '_next/static/chunks';

// Paragraphe .intro de l'en-tête (carte : chiffre et sous-titre), rendu en <p class="intro"> ordinaire.
function introParagraph(html: string): { open: string; inner: string } | null {
  const m = /<p\b([^>]*\bclass="intro"[^>]*)>([\s\S]*?)<\/p>/i.exec(html);
  return m ? { open: m[1] ?? '', inner: m[2] ?? '' } : null;
}

// Scripts d'une page (script src et modulepreload) : sert de référence « sans composant client propre ».
function scriptRefs(html: string): Set<string> {
  return new Set(pageScriptUrls(html).filter((u) => u.endsWith('.js')));
}

// Liste des erreurs de contrôle d'une page BNP exportée. Vide = conforme.
export function bnpPageErrors(root: string, spec: BnpSpec, ref?: BnpReference): string[] {
  const errors: string[] = [];
  const file = join(root, spec.dir, 'index.html');
  if (!existsSync(file)) return [`${spec.route} : page absente (${spec.dir}/index.html)`];
  const html = readFileSync(file, 'utf8');
  const need = (ok: boolean, msg: string): void => {
    if (!ok) errors.push(`${spec.route} : ${msg}`);
  };
  need(h1Count(html) === 1, 'exactement un h1 attendu');
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  need(!!h1 && textOf(h1[1] ?? '').length > 0, 'h1 vide');
  need(langOf(html) === spec.lang, `lang="${spec.lang}" attendu`);

  const links = tagsNamed(html, 'link');
  const canonicals = links.filter((a) => a.rel === 'canonical').map((a) => a.href ?? '');
  need(canonicals.length === 1 && canonicals[0] === ORIGIN + spec.route, `canonical exact unique attendu, reçu ${JSON.stringify(canonicals)}`);
  const alternates = links.filter((a) => a.rel === 'alternate' && a.hreflang);
  const hrefsFor = (lang: string): string[] => alternates.filter((a) => a.hreflang === lang).map((a) => a.href ?? '');
  need(JSON.stringify(hrefsFor('en')) === JSON.stringify([ORIGIN + '/experiences/bnp-paribas/']), 'hreflang en exact unique attendu');
  need(JSON.stringify(hrefsFor('fr')) === JSON.stringify([ORIGIN + '/fr/experiences/bnp-paribas/']), 'hreflang fr exact unique attendu');
  need(JSON.stringify(hrefsFor('x-default')) === JSON.stringify([ORIGIN + '/experiences/bnp-paribas/']), 'hreflang x-default exact unique attendu');
  const description = tagsNamed(html, 'meta').find((a) => a.name === 'description')?.content ?? '';
  need(description.trim().length > 0, 'meta description non vide attendue');

  // Récit : dans l'article, au moins cinq paragraphes non vides de .prose, et les phrases exigées dans ce corps.
  const articles = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)];
  need(articles.length === 1, 'un seul élément article attendu');
  const body = articles[0]?.[1] ?? '';
  const prose = /<div\b[^>]*class="prose"[^>]*>([\s\S]*?)<\/div>/i.exec(body)?.[1] ?? '';
  const paragraphs = [...prose.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map((m) => textOf(m[1] ?? ''));
  const filled = paragraphs.filter((p) => p.length > 0).length;
  need(filled >= 5, `au moins 5 paragraphes de récit non vides dans article .prose, reçu ${filled}`);
  const bodyText = textOf(body);
  if (ref) {
    const exp = bnpExportText(html);
    const expected = ref.paragraphs[spec.lang];
    need(
      exp.paragraphs.length === expected.length && expected.every((t, i) => exp.paragraphs[i] === t),
      `les cinq paragraphes de article .prose diffèrent de FAITS.md §1 (reçu ${JSON.stringify(exp.paragraphs)})`,
    );
    need(JSON.stringify(exp.card) === JSON.stringify(ref.card[spec.lang]), `chiffre et sous-titre de la carte différents de FAITS.md §1 : ${JSON.stringify(exp.card)}`);
    need(exp.meta === normalizeText(ref.meta[spec.lang]), `méta-description différente de la phrase du premier écran (FAITS.md §7) : ${JSON.stringify(exp.meta)}`);
  }
  for (const phrase of BNP_REQUIRED[spec.lang] ?? []) {
    need(bodyText.includes(phrase), `phrase exigée absente du corps de l'article : « ${phrase} »`);
  }
  const lower = html.toLowerCase();
  for (const phrase of BNP_FORBIDDEN) need(!lower.includes(phrase), `formule interdite présente : « ${phrase} »`);

  // Carte : un <p class="intro"> ordinaire au texte lisible (D2.7), sans attribut de composant client.
  const intro = introParagraph(html);
  need(!!intro && textOf(intro.inner).length > 0, 'un <p class="intro"> au texte non vide attendu (carte)');
  need(!!intro && intro.open.trim() === 'class="intro"', `<p class="intro"> ordinaire attendu, reçu <p ${intro?.open.trim() ?? ''}>`);
  need(!/data-client-proof|client-proof/.test(html), 'le composant de preuve client-proof doit être retiré (D2.7)');
  need(!/\sdata-tree-[\w-]+/.test(html), "aucun élément de l'arbre (data-tree-*) sur la page BNP");

  // Aucun composant client propre à l'application : la page ne charge aucun script de plus que /projects/.
  const projectsFile = join(root, 'projects', 'index.html');
  if (!existsSync(projectsFile)) errors.push(`${spec.route} : page de référence /projects/ absente`);
  else {
    const base = scriptRefs(readFileSync(projectsFile, 'utf8'));
    const extra = [...scriptRefs(html)].filter((u) => !base.has(u));
    need(extra.length === 0, `scripts propres à la page (composant client) : ${extra.join(', ')}`);
    for (const u of scriptRefs(html)) need(existsSync(join(root, u.replace(/^\//, ''))), `module ${u} référencé mais absent de l'export`);
  }
  return errors;
}

// Chunks de l'arbre (îlot et module de scène chargé à la demande), désignés par leur URL /_next/static/chunks/….
export interface TreeChain {
  island: string;
  scene: string;
}

// Les routes hors accueil ne doivent pas référencer le chunk de l'îlot.
export function otherRoutesChainErrors(root: string, otherRoutes: string[], chain: TreeChain): string[] {
  const errors: string[] = [];
  const name = chain.island.slice(chain.island.lastIndexOf('/') + 1);
  for (const route of otherRoutes) {
    const file = join(root, dirIndexFor(route));
    if (!existsSync(file)) {
      errors.push(`${route} : page absente (${dirIndexFor(route)})`);
      continue;
    }
    if (readFileSync(file, 'utf8').includes(name)) {
      errors.push(`${route} : référence l'îlot de l'arbre ${name} alors que seul l'accueil le charge`);
    }
  }
  return errors;
}

// Chaîne de l'arbre complète : îlot présent et référencé par / et /fr/, module de scène présent, chargé par import()
// depuis l'îlot, ni cité par un HTML, ni atteint par un import statique depuis les entrées d'une page d'accueil.
export function treeChainErrors(root: string, chain: TreeChain): string[] {
  const errors: string[] = [];
  const sceneName = chain.scene.slice(chain.scene.lastIndexOf('/') + 1);
  const islandFile = join(root, chain.island.replace(/^\//, ''));
  if (!existsSync(islandFile)) return [`îlot ${chain.island} absent de l'export`];
  if (!existsSync(join(root, chain.scene.replace(/^\//, '')))) errors.push(`module de scène ${sceneName} absent de l'export`);
  const islandSrc = readFileSync(islandFile, 'utf8');
  if (!new RegExp(`import\\(\\s*["'\`]\\./${sceneName.replace(/[.$]/g, '\\$&')}["'\`]\\s*\\)`).test(islandSrc)) {
    errors.push(`l'îlot doit charger ${sceneName} par import()`);
  }
  for (const route of ['/', '/fr/']) {
    const file = join(root, dirIndexFor(route));
    if (!existsSync(file)) {
      errors.push(`${route} : page absente`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    if (!pageScriptUrls(html).includes(chain.island)) errors.push(`${route} : l'îlot ${chain.island} n'est pas référencé`);
    if (html.includes(sceneName)) errors.push(`${route} : le module de scène ${sceneName} ne doit pas figurer dans le HTML (chargement à la demande)`);
    if (staticClosure(root, pageScriptUrls(html)).has(chain.scene)) errors.push(`${route} : ${sceneName} atteint par import statique`);
  }
  return errors;
}

export function chunkFiles(root: string, prefix: string): string[] {
  const dir = join(root, CHUNKS);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.startsWith(prefix));
}

// ---- Référence textuelle FAITS.md (§1 Page de détail, carte ; §7 phrase du premier écran) ----

// F12 (audit Fable) : la référence est lue dans FAITS.md s'il est présent, sinon dans la copie versionnée
// tests/fixtures/textes-publics.json (helpers-faits.ts). Plus jamais undefined, donc plus de test sauté.
export const FAITS_ABSENT = 'référence FAITS.md ou copie versionnée introuvable';

export interface BnpReference {
  paragraphs: Record<'fr' | 'en', string[]>;
  card: Record<'fr' | 'en', string[]>;
  meta: Record<'fr' | 'en', string>;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lsquo: '‘', rsquo: '’', hellip: '…', ndash: '–', mdash: '—',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

// Texte de l'export : entités décodées, espaces réduits.
export function normalizeText(s: string): string {
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

// Texte de FAITS.md : gras et code Markdown retirés, retours à la ligne joints.
export function readFaitsBnp(): BnpReference {
  return bnpReference();
}

export interface BnpExport {
  paragraphs: string[];
  card: string[];
  meta: string | undefined;
}

// Récit (cinq <p> de .prose), carte (figure et sous-titre du composant) et méta-description, décodés.
export function bnpExportText(html: string): BnpExport {
  const prose = /<div\b[^>]*class="prose"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? '';
  const paragraphs = [...prose.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map((m) => normalizeText(textOf(m[1] ?? '')));
  const proof = /<p\b[^>]*\bclass="intro"[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] ?? '';
  const sub = /<span class="contribution">([\s\S]*?)<\/span>/i.exec(proof)?.[1] ?? '';
  const figure = proof.replace(/<span class="contribution">[\s\S]*?<\/span>/i, '');
  const meta = tagsNamed(html, 'meta').find((a) => a.name === 'description')?.content;
  return {
    paragraphs,
    card: [normalizeText(textOf(figure)), normalizeText(textOf(sub))],
    meta: meta === undefined ? undefined : normalizeText(meta),
  };
}

// ---- Graphe d'imports statiques des modules (sans les imports dynamiques) ----

export function pageScriptUrls(html: string): string[] {
  const scripts = tagsNamed(html, 'script').map((a) => a.src ?? '').filter((s) => s.length > 0);
  const preloads = tagsNamed(html, 'link').filter((a) => a.rel === 'modulepreload').map((a) => a.href ?? '');
  return [...scripts, ...preloads];
}

// Spécificateurs des imports statiques : import "x", import … from "x", export … from "x". Pas import("x").
export function staticSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'`]([^"'`\n]+)["'`]/g)].map((m) => m[1] ?? '');
}

// Modules atteints en suivant les imports statiques depuis les URL d'entrée (chemins absolus du site).
export function staticClosure(root: string, entryUrls: string[]): Set<string> {
  const reached = new Set<string>();
  const queue = [...entryUrls];
  while (queue.length > 0) {
    const url = queue.shift() ?? '';
    if (reached.has(url)) continue;
    reached.add(url);
    const file = join(root, url.replace(/^\//, ''));
    if (!url.endsWith('.js') || !existsSync(file)) continue;
    for (const spec of staticSpecifiers(readFileSync(file, 'utf8'))) {
      queue.push(new URL(spec, 'http://site' + url).pathname);
    }
  }
  return reached;
}

// Fichiers .html d'un dossier, récursivement.
export function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

// Export public synthétique : métas robots des pages (hors 404 et missing) passées en index, follow ;
// robots.txt et sitemap régénérés par la normalisation en mode public. À utiliser quand l'aperçu est seul disponible.
export function makePublicArtifact(sb: Sandbox): void {
  for (const file of htmlFiles(sb.artifact)) {
    if (/(^|\/)(404|missing)\.html$/.test(file)) continue;
    const html = readFileSync(file, 'utf8');
    writeFileSync(file, html.replace(/(<meta[^>]*name="robots"[^>]*content=")noindex, nofollow(")/gi, '$1index, follow$2'));
  }
  const r = sb.normalizeRun({ SITE_PUBLIC: '1' });
  if (r.status !== 0) throw new Error(`normalisation publique synthétique en échec : ${r.stderr.slice(0, 300)}`);
}
