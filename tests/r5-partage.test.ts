// Lot 4, corrections d'audit, R5 (tmp/refonte-arbre/arbitrage-audit-lot4.md ; audit C6) : un test statique lie
// l'image de partage par défaut à la palette par défaut. Changer DEFAULT_PALETTE sans relancer le script de l'image
// doit faire rougir npm test.
// Lecture retenue : des deux voies admises (coins à ± 4/255 du bg, ou fichier voisin écrit par le script), seule la
// seconde sépare les palettes : les coins de l'image Forêt (3,12,9) sont à 2/255 au plus du bg Forêt (#040C0A) ET du
// bg sous-bois (#050A08). Le script de l'image écrit donc, à côté de lui dans site/scripts/ (hors de public/, pour
// ne pas entrer dans l'export), un fichier JSON qui nomme l'image (« image », chemin sous public/) et note la palette
// (« palette »), la graine (« seed ») et l'empreinte SHA-256 de l'image écrite (« sha256 »).
// Lot 4, S2 (contrat-lot4-s.md) : deux images par défaut (FR et EN), le fichier voisin est étendu aux deux. Lecture
// retenue de la forme : une ENTRÉE par image, soit un fichier par image ({ image, palette, seed, sha256 }), soit un
// seul fichier { palette, seed, images: [{ image, sha256 }, …] } (palette et graine de l'entrée, sinon du fichier).
// Chaque image est nommée par une seule entrée, et un script de site/scripts/ nomme l'image et le fichier voisin.
// Les coins à ± 4/255 de la palette du site servi sont aussi mesurés en navigateur (verif-4, R5.1), sur les deux images.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { headMeta } from './helpers-2b.ts';
import { filesUnder, readRoute, sha256, urlToPath } from './helpers-4.ts';
import { assertDistExists, distDir, siteDir } from './helpers.ts';

interface Sidecar { file: string; data: Record<string, unknown> }
const SCRIPTS = join(siteDir, 'scripts');

// Images de partage par défaut : og:image de l'accueil anglais et de l'accueil français, ramenées à leur chemin sous public/.
function defaultImages(): string[] {
  const out: string[] = [];
  for (const route of ['/', '/fr/']) {
    const html = readRoute(distDir, route);
    if (!html) throw new Error(`${route} absente de l'export (R5)`);
    const og = headMeta(html).metas.get('og:image') ?? [];
    if (og.length !== 1) throw new Error(`${route} : ${og.length} og:image (R5)`);
    out.push(urlToPath(og[0] as string).replace(/^\//, ''));
  }
  return [...new Set(out)];
}
// Entrées des fichiers JSON de site/scripts/ qui nomment l'image (une par fichier, ou une par élément de « images »).
function entriesOf(file: string, data: Record<string, unknown>): Sidecar[] {
  if (typeof data.image === 'string') return [{ file, data }];
  if (!Array.isArray(data.images)) return [];
  const { images, ...top } = data;
  return (images as unknown[]).filter((e): e is Record<string, unknown> => !!e && typeof e === 'object').map((e) => ({ file, data: { ...top, ...e } }));
}
function sidecars(image: string): Sidecar[] {
  return readdirSync(SCRIPTS)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      try {
        return entriesOf(f, JSON.parse(readFileSync(join(SCRIPTS, f), 'utf8')) as Record<string, unknown>);
      } catch {
        return [];
      }
    })
    .filter((s) => s.data.image === image);
}

function r5Errors(image: string, found: Sidecar[], imageBytes: Buffer, want: { palette: string; seed: number }, scriptSources: Record<string, string>): string[] {
  const errors: string[] = [];
  if (found.length !== 1) return [`site/scripts/*.json : une seule entrée qui nomme « ${image} » attendue, ${found.length} trouvée(s) (palette, graine et empreinte de l'image ; S2 : une entrée par image)`];
  const s = found[0] as Sidecar;
  if (s.data.palette !== want.palette) errors.push(`${s.file} : palette « ${String(s.data.palette)} » ≠ DEFAULT_PALETTE « ${want.palette} » : relancer le script de l'image`);
  if (s.data.seed !== want.seed) errors.push(`${s.file} : graine ${String(s.data.seed)} ≠ DEFAULT_SEED ${want.seed}`);
  if (s.data.sha256 !== sha256(imageBytes)) errors.push(`${s.file} : sha256 ${String(s.data.sha256)} ≠ empreinte de public/${image} (${sha256(imageBytes)}) : image et fichier voisin désaccordés`);
  const writers = Object.entries(scriptSources).filter(([, src]) => src.includes(image) && src.includes(s.file));
  if (writers.length === 0) errors.push(`${s.file} : aucun script de site/scripts/ ne nomme à la fois ${image} et ${s.file} (le fichier voisin doit être écrit par le script de l'image)`);
  return errors;
}

const scriptSources = (): Record<string, string> => Object.fromEntries(readdirSync(SCRIPTS).filter((f) => /\.(mjs|js|ts|cjs|py)$/.test(f)).map((f) => [f, readFileSync(join(SCRIPTS, f), 'utf8')]));
async function defaults(): Promise<{ palette: string; seed: number }> {
  const pal = (await import(pathToFileURL(join(siteDir, 'content', 'palettes.ts')).href)) as { DEFAULT_PALETTE: string };
  const sk = (await import(pathToFileURL(join(siteDir, 'lib', 'tree', 'skeleton.ts')).href)) as { DEFAULT_SEED: number };
  return { palette: pal.DEFAULT_PALETTE, seed: sk.DEFAULT_SEED };
}

test('R5, S2 : pour chacune des deux images par défaut (FR, EN), une entrée d\'un fichier de site/scripts/ écrit par le script de l\'image la lie à DEFAULT_PALETTE, DEFAULT_SEED et à son empreinte', async () => {
  assertDistExists();
  const images = defaultImages();
  const want = await defaults();
  const errors: string[] = [];
  if (images.length !== 2) errors.push(`images par défaut de / et /fr/ : ${JSON.stringify(images)} (deux images distinctes attendues, S2)`);
  for (const image of images) {
    const file = join(siteDir, 'public', image);
    if (!existsSync(file)) {
      errors.push(`public/${image} absente (Q6)`);
      continue;
    }
    errors.push(...r5Errors(image, sidecars(image), readFileSync(file), want, scriptSources()));
  }
  assert.deepEqual(errors, [], `lot 4, R5 et S2\n${errors.join('\n')}`);
});

test('R5 : le fichier voisin n\'entre pas dans l\'export', () => {
  assertDistExists();
  const names = new Set(defaultImages().flatMap((i) => sidecars(i).map((s) => s.file)));
  const leaked = filesUnder(distDir).filter((f) => names.has(basename(f)));
  assert.deepEqual(leaked, [], 'lot 4, R5 : fichier voisin de l\'image exporté');
});

test('R5 (témoins) : un fichier conforme passe ; palette sous-bois ou ardoise, graine changée, image régénérée sans lui, deux fichiers, fichier non écrit par le script rougissent', async () => {
  const want = await defaults();
  const img = Buffer.from('image');
  const ok = { file: 'og-arbre.json', data: { image: 'og-arbre.jpg', palette: want.palette, seed: want.seed, sha256: sha256(img) } };
  const src = { 'share-image.mjs': "const out = 'og-arbre.jpg'; const side = 'og-arbre.json';" };
  assert.deepEqual(r5Errors('og-arbre.jpg', [ok], img, want, src), [], 'fichier conforme refusé');
  // S2 : forme « un seul fichier, une entrée par image » : lue entrée par entrée ; une image absente de la liste rougit.
  const one = entriesOf('og-arbre.json', { palette: want.palette, seed: want.seed, images: [{ image: 'og-arbre-en.jpg', sha256: sha256(img) }, { image: 'og-arbre-fr.jpg', sha256: sha256(img) }] });
  assert.equal(one.length, 2, 'forme en liste mal lue');
  assert.deepEqual(r5Errors('og-arbre-fr.jpg', one.filter((e) => e.data.image === 'og-arbre-fr.jpg'), img, want, { 'share-image.mjs': "'og-arbre-fr.jpg' 'og-arbre.json'" }), [], 'entrée conforme de la liste refusée');
  assert.ok(r5Errors('og-arbre-fr.jpg', [], img, want, src).length > 0, 'image sans entrée non détectée');
  assert.ok(r5Errors('og-arbre-fr.jpg', entriesOf('og-arbre.json', { palette: 'ardoise', seed: want.seed, images: [{ image: 'og-arbre-fr.jpg', sha256: sha256(img) }] }), img, want, { 'share-image.mjs': "'og-arbre-fr.jpg' 'og-arbre.json'" }).length > 0, 'palette du fichier (forme en liste) non lue');
  // Chaque autre palette, dont celle dont le bg est à 2/255 de celui de la palette par défaut (forêt / sous-bois).
  const others = ['sous-bois', 'foret', 'ardoise', 'givre'].filter((p) => p !== want.palette);
  const muts: [string, Sidecar[], Buffer, Record<string, string>][] = [
    ...others.map((p): [string, Sidecar[], Buffer, Record<string, string>] => [`palette ${p}`, [{ ...ok, data: { ...ok.data, palette: p } }], img, src]),
    ['graine changée', [{ ...ok, data: { ...ok.data, seed: want.seed + 1 } }], img, src],
    ['image régénérée sans le fichier', [ok], Buffer.from('autre image'), src],
    ['aucun fichier', [], img, src],
    ['deux fichiers', [ok, { ...ok, file: 'b.json' }], img, src],
    ['fichier non écrit par le script', [ok], img, { 'share-image.mjs': "const out = 'og-arbre.jpg';" }],
  ];
  for (const [label, found, bytes, sources] of muts) assert.ok(r5Errors('og-arbre.jpg', found, bytes, want, sources).length > 0, `« ${label} » non détecté`);
});
