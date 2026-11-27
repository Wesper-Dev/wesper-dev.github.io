// Contrat E16.2 et E16.3 (lot 2a) : formules interdites dans le texte visible de l'accueil, ligne « École 42 », aucune
// image ni emblème hors de la capture de droit-de-retard. E16.1 reste couvert par check-export (C3) ; E16.4 : [B].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_ROUTES,
  byTag,
  homeDoc,
  homeMods,
  homeRoot,
  listDir,
  pageText,
  readBaseline,
  textOf,
  walk,
} from './helpers-home.ts';
import { pageHtml } from './helpers-scene.ts';

// E16.2 : chaînes interdites (sensibles à la casse, comme dans le contrat).
const FORBIDDEN: (string | RegExp)[] = [
  /\bMaster\b/, 'bac+5', 'diplôm', 'degree',
  'PyTorch', 'OpenShift', 'Kata', 'gVisor', 'Podman',
  'déterministe', 'deterministic',
  'mes systèmes', 'tournent vraiment', 'actually run', 'Applied AI Engineer',
  '121 tests', '300+', '300 membres', '15+ séances', '15+ fitness sessions',
  'victoires', 'podiums', 'wins',
  '16 octobre 2026', '16 October 2026',
];

test('E16.2 : aucune formule interdite dans le texte visible des deux accueils', () => {
  // E16.2 : mutations « Master informatique dans une fiche », « 121 tests », « 300+ membres », « Applied AI Engineer ».
  for (const route of HOME_ROUTES) {
    homeRoot(route);
    const text = pageText(route);
    const found = FORBIDDEN.filter((f) => (typeof f === 'string' ? text.includes(f) : f.test(text))).map(String);
    assert.deepEqual(found, [], `${route} : formules interdites`);
  }
});

test('E16.2 : le détecteur respecte la casse de « Master » et les mots entiers (témoins)', () => {
  // Témoins : « Mastering » et « master » ne sont pas « Master » ; « Master informatique » l'est.
  const re = FORBIDDEN[0] as RegExp;
  assert.ok(re.test('Master informatique'));
  assert.ok(!re.test('Mastering CI'));
  assert.ok(!re.test('the master branch'));
});

test('E16.2 : tout nœud de texte contenant « École 42 » vaut « École 42 Paris » ou « École 42 Paris, 2019–2026 »', () => {
  // E16.2 : mutation « École 42 Paris, titre RNCP 7 ».
  for (const route of HOME_ROUTES) {
    homeRoot(route);
    const bad: string[] = [];
    let seen = 0;
    walk(homeDoc(route), (n) => {
      if (n.tag !== '#text') return;
      if (n.parent && (n.parent.tag === 'script' || n.parent.tag === 'style' || n.parent.tag === 'title')) return;
      if (!n.text.includes('École 42')) return;
      seen++;
      const t = n.text.replace(/\s+/g, ' ').trim();
      if (t !== 'École 42 Paris' && t !== 'École 42 Paris, 2019–2026') bad.push(t);
    });
    assert.ok(seen >= 2, `${route} : « École 42 » attendu au moins dans la liste et la fiche`);
    assert.deepEqual(bad, [], `${route} : nœuds de texte « École 42 » non conformes`);
  }
});

test('E16.3 : aucune <img> autre que /images/droit-de-retard.png ; chaque <svg> est une icône de ICONS ou décoratif aria-hidden, sans <text>', async () => {
  // E16.3 : mutation « logo SVG ajouté ».
  const { ICONS } = await homeMods.tree();
  const icons = new Set(Object.values(ICONS as Record<string, string>).map((s) => s.replace(/\s+/g, ' ').trim()));
  for (const route of HOME_ROUTES) {
    homeRoot(route);
    const doc = homeDoc(route);
    const imgs = byTag(doc, 'img').map((i) => i.attrs.src ?? '');
    assert.deepEqual(imgs.filter((s) => s !== '/images/droit-de-retard.png'), [], `${route} : images non autorisées`);
    const html = pageHtml(route).replace(/<script\b[\s\S]*?<\/script>/gi, '');
    const svgs = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)].map((m) => m[0]);
    for (const s of svgs) {
      assert.ok(!/<text\b/i.test(s), `${route} : <svg> avec <text>`);
      const isIcon = icons.has(s.replace(/\s+/g, ' ').trim());
      const hidden = /^<svg\b[^>]*\saria-hidden="true"/i.test(s);
      assert.ok(isIcon || hidden, `${route} : <svg> ni icône de ICONS ni aria-hidden="true" : ${s.slice(0, 120)}`);
    }
    for (const n of byTag(doc, 'svg')) assert.equal(textOf(n), '', `${route} : texte dans un <svg>`);
  }
});

test('E16.3 (mis à jour au lot 4, puis S2) : public/images = 4ed945b, plus au plus les images de partage par défaut du lot 4 (contrat lot 4, Q6 ; S2 : une par langue) si elles y sont rangées', () => {
  // E16.3 : aucun fichier nouveau dans public/images, sauf les captures de l'arbre de Q6 et S2 (nommées par og:image des deux accueils).
  const ogs = ['/', '/fr/'].map((r) => /<meta\b[^>]*property="og:image"[^>]*content="([^"]*)"/.exec(pageHtml(r))?.[1] ?? '');
  const shares = ogs.filter((og) => og.includes('/images/')).map((og) => og.replace(/^https?:\/\/[^/]+\//, '').replace(/^images\//, ''));
  const extra = listDir('public/images').filter((f) => !readBaseline().images.includes(f));
  assert.deepEqual(readBaseline().images.filter((f) => !listDir('public/images').includes(f)), [], 'fichier de 4ed945b retiré de public/images');
  // Tour Y (contrat-recette-y.md, Y11) : exception nommée, UNE version compressée de l'image du récit droit-de-retard
  // (droit-de-retard.webp, .avif ou .jpg), à côté du PNG d'origine ; y11-image-compressee.test.ts exige son poids.
  const y11 = extra.filter((f) => /^droit-de-retard\.(?:webp|avif|jpe?g)$/.test(f));
  assert.ok(y11.length <= 1, `plusieurs versions compressées de droit-de-retard : ${y11.join(', ')} (Y11 : une seule)`);
  assert.deepEqual(extra.filter((f) => !shares.includes(f) && !y11.includes(f)), [], `fichiers nouveaux dans public/images hors images de partage (${ogs.join(', ')}) et hors image compressée de Y11`);
});
