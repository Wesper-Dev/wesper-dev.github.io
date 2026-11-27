// Contrat du lot 4, Q6 : image de partage. og:image et twitter:image par défaut = une capture de l'arbre, 1200×630,
// < 300 Ko, produite par un script versionné ; l'image produite est versionnée ; la carte propre au récit
// droit-de-retard est conservée (figée par Q3).
// Lot 4, S2 (tmp/refonte-arbre/contrat-lot4-s.md) : une image par défaut PAR LANGUE (nom et titre de la langue à gauche,
// l'arbre à droite). Q6 est adapté au plus juste : « même image sur les 18 pages » devient « même image sur les 9 pages
// d'une langue, deux images distinctes » ; tout le reste de Q6 vaut pour chacune des deux images.
// Partie statique : même image sur les pages d'une langue qui ont des métadonnées de partage sans carte propre (accueil
// compris), URL absolue du site, fichier présent dans l'export ET à la même place dans site/public (versionné), autre que
// l'ancienne /og.jpg, dimensions lues dans l'en-tête du fichier, poids < 300 000 octets, og:image:width/height cohérents,
// et un script de site/scripts/ qui la nomme. Les pixels (fond Halo aux coins, arbre présent, texte) et la reproduction
// par le script sont vérifiés dans tmp/refonte-arbre/verif-4/verif.mjs (Q6.1, Q6.2, S2.1 à S2.3) ; « aucun logo, aucun
// autre texte » se juge sur la planche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { headMeta } from './helpers-2b.ts';
import { ALL_PAGES, NOT_FOUND, OWN_SHARE_IMAGE, imageSize, langOf, readBaseline4, readRoute, sha256, urlToPath } from './helpers-4.ts';
import type { Lang } from './helpers-4.ts';
import { ORIGIN, assertDistExists, distDir, exportModeOf, siteDir } from './helpers.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export : contrat lot 4, Q6`);
  return html;
};
// La 404 n'a aucune métadonnée de partage à a040fb0 et Q3 la garde ainsi (lecture retenue) : 18 pages, 9 par langue.
const DEFAULT_PAGES = (): string[] => ALL_PAGES.filter((r) => !OWN_SHARE_IMAGE.includes(r) && r !== NOT_FOUND);
const LANGS: Lang[] = ['en', 'fr'];

function defaultImages(): { urls: Record<Lang, string>; errors: string[] } {
  const errors: string[] = [];
  const byLang: Record<Lang, Set<string>> = { en: new Set(), fr: new Set() };
  for (const route of DEFAULT_PAGES()) {
    const m = headMeta(page(route)).metas;
    const og = m.get('og:image') ?? [];
    const tw = m.get('twitter:image') ?? [];
    if (og.length !== 1) errors.push(`${route} : ${og.length} og:image`);
    if (JSON.stringify(tw) !== JSON.stringify(og)) errors.push(`${route} : twitter:image ${JSON.stringify(tw)} ≠ og:image ${JSON.stringify(og)}`);
    if (JSON.stringify(m.get('og:image:width')) !== '["1200"]' || JSON.stringify(m.get('og:image:height')) !== '["630"]') errors.push(`${route} : og:image:width/height ${JSON.stringify(m.get('og:image:width'))}×${JSON.stringify(m.get('og:image:height'))} (1200×630 attendu)`);
    if (JSON.stringify(m.get('twitter:card')) !== '["summary_large_image"]') errors.push(`${route} : twitter:card ${JSON.stringify(m.get('twitter:card'))}`);
    for (const u of og) byLang[langOf(route)].add(u);
  }
  for (const l of LANGS) {
    const n = DEFAULT_PAGES().filter((r) => langOf(r) === l).length;
    if (byLang[l].size !== 1) errors.push(`pages ${l} : une seule image par défaut attendue sur les ${n} pages de la langue, reçu ${JSON.stringify([...byLang[l]])} (S2 : une image par langue)`);
  }
  const urls = { en: [...byLang.en][0] ?? '', fr: [...byLang.fr][0] ?? '' };
  if (urls.en && urls.en === urls.fr) errors.push(`même image ${urls.en} pour les pages FR et EN : une image par langue attendue (S2)`);
  return { urls, errors };
}
test('Q6, S2 : og:image et twitter:image par défaut identiques sur les 9 pages de chaque langue qui en ont sans carte propre (accueil compris, 404 exclue), deux images distinctes FR et EN, 1200×630 déclarés, summary_large_image', () => {
  assertDistExists();
  const { urls, errors } = defaultImages();
  for (const l of LANGS) if (!urls[l].startsWith(ORIGIN + '/')) errors.push(`og:image ${l} ${urls[l]} : URL absolue du site attendue`);
  assert.deepEqual(errors, [], `contrat lot 4, Q6 et S2\n${errors.join('\n')}`);
});

test('Q6, S2 : chaque image par défaut (FR, EN) est une nouvelle capture (pas l\'ancienne /og.jpg), 1200×630 réels, < 300 000 octets, versionnée dans site/public à la même place ; les deux fichiers diffèrent', () => {
  assertDistExists();
  const { urls } = defaultImages();
  const errors: string[] = [];
  const hashes: string[] = [];
  for (const l of LANGS) {
    const url = urls[l];
    const path = urlToPath(url).replace(/^\//, '');
    const file = join(distDir, path);
    if (!path || !existsSync(file)) {
      errors.push(`${l} : ${url} : fichier absent de l'export`);
      continue;
    }
    const b = readFileSync(file);
    hashes.push(sha256(b));
    const old = readBaseline4().mesures[exportModeOf(distDir)].defaultShareImage;
    if (sha256(b) === old.sha256) errors.push(`${l} : ${url} : c'est l'ancienne image de partage (${old.url}, ${old.bytes} octets), pas une capture de l'arbre`);
    const size = imageSize(b);
    if (!size) errors.push(`${l} : ${url} : format illisible (PNG, JPEG ou WebP attendu)`);
    else if (size.width !== 1200 || size.height !== 630) errors.push(`${l} : ${url} : ${size.width}×${size.height} (1200×630 attendu)`);
    if (b.length >= 300000) errors.push(`${l} : ${url} : ${b.length} octets (< 300 000 attendu)`);
    const src = join(siteDir, 'public', path);
    if (!existsSync(src)) errors.push(`${l} : ${path} absent de site/public (l'image produite doit être versionnée)`);
    else if (sha256(readFileSync(src)) !== sha256(b)) errors.push(`${l} : site/public/${path} différent du fichier exporté`);
  }
  if (hashes.length === 2 && hashes[0] === hashes[1]) errors.push('images FR et EN identiques octet pour octet (S2 : titre de la langue)');
  assert.deepEqual(errors, [], `contrat lot 4, Q6 et S2\n${errors.join('\n')}`);
});

test('Q6, S2 : un même script versionné de site/scripts/ produit les deux images par défaut (il les nomme toutes les deux)', () => {
  assertDistExists();
  const { urls } = defaultImages();
  const names = LANGS.map((l) => basename(urlToPath(urls[l])));
  const dir = join(siteDir, 'scripts');
  const scripts = readdirSync(dir).filter((f) => /\.(mjs|js|ts|cjs|py)$/.test(f));
  const hits = scripts.filter((f) => {
    const src = readFileSync(join(dir, f), 'utf8');
    return names.every((n) => n && src.includes(n));
  });
  assert.ok(new Set(names).size === 2 && names.every((n) => n && n !== 'og.jpg') && hits.length >= 1, `contrat lot 4, Q6 et S2 : deux images distinctes attendues, nommées en toutes lettres par un même script de site/scripts/ ; images ${JSON.stringify(names)}, scripts qui les nomment toutes : ${JSON.stringify(hits)} (${scripts.join(', ')})`);
});

test('Q6 (témoins) : dimensions lues dans les en-têtes PNG, JPEG et WebP ; l\'ancienne og.jpg mesure 1200×630', () => {
  const png = Buffer.alloc(33);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(1200, 16);
  png.writeUInt32BE(630, 20);
  assert.deepEqual(imageSize(png), { format: 'png', width: 1200, height: 630 });
  const og = join(siteDir, 'public', 'og.jpg');
  if (existsSync(og)) assert.deepEqual(imageSize(readFileSync(og)), { format: 'jpeg', width: 1200, height: 630 });
  const webp = Buffer.alloc(40);
  webp.write('RIFF', 0, 'ascii');
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8X', 12, 'ascii');
  webp.writeUIntLE(1199, 24, 3);
  webp.writeUIntLE(629, 27, 3);
  assert.deepEqual(imageSize(webp), { format: 'webp', width: 1200, height: 630 });
});
