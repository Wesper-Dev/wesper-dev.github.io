// Tour Y, Y11 (constat 15) : l'image du récit droit-de-retard est servie compressée (120 Ko au plus, 120 000 octets ici),
// avec les mêmes dimensions déclarées (width 1440, height 1180), le même alt (FR et EN), le même chargement différé, et un
// rendu visuellement équivalent (contrôlé par verif-7, Y11 : décodage dans le navigateur, écart à la vignette de
// référence). Les dimensions réelles du fichier gardent les proportions déclarées. Le lien « Ouvrir l'image en taille
// réelle » peut continuer de mener au PNG d'origine : il doit seulement mener à un fichier présent.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { imageSize } from './helpers-4.ts';
import { byTag } from './helpers-home.ts';
import { DDR_ROUTES, bodyY, docY, readDepartY, storyImages } from './helpers-y.ts';
import { distDir } from './helpers.ts';

const MAX = 120_000;

test('Y11 : l\'image du récit droit-de-retard pèse 120 000 octets au plus, mêmes width, height, alt et loading qu\'au départ', () => {
  const dep = readDepartY();
  for (const r of DDR_ROUTES) {
    const now = storyImages(r);
    const was = dep.images[r] ?? [];
    assert.equal(was.length, 1, `référence de départ : ${was.length} image(s) sur ${r}`);
    assert.equal(now.length, 1, `${r} : ${now.length} image(s) /images/droit-de-retard.* dans le récit`);
    const [a, b] = [was[0]!, now[0]!];
    assert.ok(b.bytes > 0, `${r} : ${b.src} absent de l'export`);
    // Tour W (contrat-relecture-w.md, W2) : seule la graphie « droit-de-retard » change dans l'alt (exceptions W2-ddr-alt-*).
    const altW = a.alt === null || a.alt === undefined ? a.alt : String(a.alt).replace('Droit de Retard', 'droit-de-retard');
    assert.deepEqual({ width: b.width, height: b.height, alt: b.alt, loading: b.loading }, { width: a.width, height: a.height, alt: altW, loading: a.loading }, `${r} : attributs changés (Y11 : mêmes dimensions déclarées, même alt)`);
    assert.ok(b.bytes <= MAX, `${r} : ${b.src} pèse ${b.bytes} octets (${MAX} au plus, Y11 ; ${a.bytes} au départ)`);
    const size = imageSize(readFileSync(join(distDir, b.src)));
    assert.ok(size, `${r} : ${b.src} : format non reconnu (PNG, JPEG ou WebP attendu)`);
    const ratio = size.width / size.height / (Number(a.width) / Number(a.height));
    assert.ok(Math.abs(ratio - 1) < 0.005, `${r} : ${b.src} ${size.width}×${size.height}, proportions différentes de ${a.width}×${a.height}`);
    assert.ok(size.width >= Number(a.width) / 2, `${r} : ${b.src} ${size.width} px de large (au moins la moitié des ${a.width} px déclarés)`);
  }
});

test('Y11 (garde) : les liens « taille réelle » du récit droit-de-retard mènent à une image présente dans l\'export', () => {
  for (const r of DDR_ROUTES) {
    const links = byTag(bodyY(docY(r)), 'a').filter((a) => /^\/images\/droit-de-retard\./.test(a.attrs.href ?? ''));
    assert.ok(links.length >= 1, `${r} : aucun lien vers l'image en taille réelle`);
    for (const l of links) assert.ok(existsSync(join(distDir, l.attrs.href as string)), `${r} : ${l.attrs.href} absent de l'export`);
  }
});
