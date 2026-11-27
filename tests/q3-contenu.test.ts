// Contrat du lot 4, Q3 : contenu inchangé. Le texte visible du <main> de chaque page intérieure (18 routes) et de la
// 404 est identique, mot pour mot et dans le même ordre, à celui de a040fb0, en FR et EN ; mêmes liens (href),
// mêmes images (src, alt, dimensions), mêmes titres et niveaux, mêmes métadonnées (title, description, canonique,
// hreflang, og:*, twitter:*) hors l'image de partage par défaut (Q6). La carte du récit droit-de-retard reste.
// Référence : tests/fixtures/baseline-a040fb0.json (script : tests/fixtures/figer-reference-a040fb0.ts).
// Ce test est VERT sur le code de départ et doit le rester : il remplace E15.1 (pages identiques à 4ed945b), la
// comparaison des règles CSS de E18 et la partie « pages intérieures » de P5, que le lot 4 rend caduques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOT4_PAGES, OWN_SHARE_IMAGE, contentDiffs, pageContent, readBaseline4, readRoute } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf } from './helpers.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (${distDir}) : contrat lot 4, Q3`);
  return html;
};

test('Q3 : la référence a040fb0 couvre les 18 routes intérieures et la 404, dans les deux modes, avec sa commande', () => {
  const ref = readBaseline4();
  assert.equal(ref.commit, 'a040fb0');
  assert.ok(ref.commande.includes('git archive a040fb0') && ref.commande.includes('SITE_PUBLIC=1'), 'commande de construction de la référence absente');
  for (const mode of ['preview', 'public'] as const) {
    assert.deepEqual(Object.keys(ref.pages[mode]).sort(), [...LOT4_PAGES].sort(), `référence ${mode} : pages`);
    for (const r of LOT4_PAGES) {
      const p = ref.pages[mode][r];
      assert.ok(p && p.mains === 1 && p.text.length > 40 && p.headings.some((h) => h.level === 1), `référence ${mode} ${r} : contenu vide ou sans <h1>`);
    }
  }
});

test('Q3 : texte du <main>, liens, images, titres et métadonnées de chaque page intérieure et de la 404 = a040fb0 (mode détecté)', () => {
  assertDistExists();
  const mode = exportModeOf(distDir);
  const ref = readBaseline4().pages[mode];
  const diffs: string[] = [];
  for (const route of LOT4_PAGES) {
    const want = ref[route];
    if (!want) {
      diffs.push(`${route} : absente de la référence`);
      continue;
    }
    diffs.push(...contentDiffs(route, want, pageContent(route, page(route))));
  }
  assert.deepEqual(diffs, [], `(${mode})\n${diffs.join('\n')}`);
});

// ---- Mutations de preuve, sur l'export lui-même (en mémoire) ----

const diffsOf = (route: string, html: string): string[] => {
  const mode = exportModeOf(distDir);
  const want = readBaseline4().pages[mode][route];
  if (!want) throw new Error(`${route} absente de la référence`);
  return contentDiffs(route, want, pageContent(route, html));
};
// Applique une mutation au <main> seulement (l'en-tête et le pied peuvent contenir les mêmes mots).
const inMain = (html: string, fn: (main: string) => string): string => html.replace(/<main\b[\s\S]*?<\/main>/i, (m) => fn(m));

test('Q3 (témoins) : un mot changé, un mot retiré, deux mots soudés, un lien retiré ou changé, un titre déplacé ou changé de niveau, une image changée, une métadonnée changée font rougir', () => {
  assertDistExists();
  const ok = (route: string): string => {
    const html = page(route);
    assert.deepEqual(diffsOf(route, html), [], `${route} : l'export de départ doit être conforme pour servir de témoin`);
    return html;
  };
  const red = (label: string, route: string, mutated: string, html: string, clue: RegExp): void => {
    assert.notEqual(mutated, html, `mutation « ${label} » sans effet sur ${route}`);
    const d = diffsOf(route, mutated);
    assert.ok(d.length > 0, `mutation « ${label} » (${route}) non détectée`);
    assert.ok(d.some((x) => clue.test(x)), `mutation « ${label} » (${route}) : message inattendu ${JSON.stringify(d)}`);
  };
  // Mot changé dans un paragraphe du récit Croix-Rouge, et dans la page Compétences.
  for (const route of ['/fr/projects/croix-rouge/', '/skills/']) {
    const html = ok(route);
    const word = /<p\b[^>]*>([^<]*?)\b([A-Za-zÀ-ÿ]{5,})\b/.exec(html.slice(html.search(/<main\b/i)));
    assert.ok(word, `${route} : aucun mot témoin`);
    const w = word[2] as string;
    red('mot changé', route, inMain(html, (m) => m.replace(new RegExp(`\\b${w}\\b`), w.slice(0, -1) + 'x')), html, /texte du <main>/);
    red('mot retiré', route, inMain(html, (m) => m.replace(new RegExp(`\\s?\\b${w}\\b`), '')), html, /texte du <main>/);
  }
  // Deux mots soudés (le blanc entre deux mots du premier paragraphe retiré).
  {
    const route = '/projects/diary/';
    const html = ok(route);
    const mutated = inMain(html, (m) => m.replace(/(<p\b[^>]*>[^<]*?[\p{L}])\s+([\p{L}])/u, '$1$2'));
    red('deux mots soudés', route, mutated, html, /texte du <main>/);
  }
  // Ponctuation : le point décoratif du titre Compétences retiré.
  {
    const route = '/fr/skills/';
    const html = ok(route);
    red('ponctuation retirée', route, inMain(html, (m) => m.replace(/(<h1\b[^>]*>[^<]*)<span>\.<\/span>/, '$1')), html, /ponctuation|titres/);
  }
  // Lien retiré, lien dont la cible change (texte gardé), lien ajouté.
  {
    const route = '/fr/skills/';
    const html = ok(route);
    red('lien retiré (texte gardé)', route, inMain(html, (m) => m.replace(/<a\b[^>]*href="\/fr\/projects\/droit-de-retard\/"[^>]*>([\s\S]*?)<\/a>/, '<span>$1</span>')), html, /liens du <main>/);
    red('cible changée', route, inMain(html, (m) => m.replace('href="https://github.com/Wesper-Dev/Minishell"', 'href="https://github.com/Wesper-Dev/Minishel"')), html, /liens du <main>/);
    red('lien ajouté', route, inMain(html, (m) => m.replace(/(<\/h1>)/, '$1<a href="/fr/">x</a>')), html, /liens du <main>|texte du <main>/);
  }
  // Titre déplacé (premier <h2> ramené en fin de <main>), titre changé de niveau, titre devenu paragraphe.
  {
    const route = '/projects/';
    const html = ok(route);
    const h2 = /<h2\b[^>]*>[\s\S]*?<\/h2>/.exec(html.slice(html.search(/<main\b/i)))?.[0];
    assert.ok(h2, `${route} : aucun <h2> témoin`);
    red('titre déplacé', route, inMain(html, (m) => m.replace(h2, '').replace(/<\/main>$/i, `${h2}</main>`)), html, /titres|texte du <main>/);
    red('titre changé de niveau', route, inMain(html, (m) => m.replace(h2, h2.replace(/^<h2/, '<h3').replace(/<\/h2>$/, '</h3>'))), html, /titres du <main>/);
    red('titre devenu paragraphe', route, inMain(html, (m) => m.replace(h2, h2.replace(/^<h2/, '<p').replace(/<\/h2>$/, '</p>'))), html, /titres du <main>/);
  }
  // Image : alt changé, dimensions retirées, source changée.
  {
    const route = '/projects/droit-de-retard/';
    const html = ok(route);
    red('alt changé', route, html.replace(/(<img\b[^>]*\salt=")([^"]*)/, '$1x$2'), html, /images du <main>/);
    red('dimensions retirées', route, html.replace(/(<img\b[^>]*?)\s+width="\d+"/, '$1'), html, /images du <main>/);
    red('source changée', route, html.replace(/(<img\b[^>]*\ssrc=")\/images\/droit-de-retard\.[a-z]+/, '$1/images/droit-de-retard-sombre.png'), html, /images du <main>/);
    red('carte de partage du récit changée', route, html.split('/images/droit-de-retard-social.jpg').join('/og.png'), html, /og:image|twitter:image/);
  }
  // Métadonnées : og:title, description, canonique, hreflang retiré, twitter:description.
  {
    const route = '/fr/experiences/bpce/';
    const html = ok(route);
    red('og:title changé', route, html.replace(/(<meta\b[^>]*property="og:title"[^>]*content=")/, '$1x'), html, /og:title/);
    red('description changée', route, html.replace(/(<meta\b[^>]*name="description"[^>]*content=")/, '$1x'), html, /description/);
    red('canonique changée', route, html.replace(/(<link\b[^>]*rel="canonical"[^>]*href="[^"]*)\/"/, '$1"'), html, /canonical/);
    red('hreflang retiré', route, html.replace(/<link\b[^>]*hrefLang="x-default"[^>]*>/i, ''), html, /alternate:x-default/);
    red('twitter:description changée', route, html.replace(/(<meta\b[^>]*name="twitter:description"[^>]*content=")/, '$1x'), html, /twitter:description/);
    red('<title> changé', route, html.replace(/<title>/, '<title>x'), html, /métadonnée title/);
  }
  // 404 bilingue : la partie française retirée.
  {
    const html = ok('/404.html');
    red('404 sans sa partie française', '/404.html', html.replace(/<div lang="fr">[\s\S]*?<\/div>/, ''), html, /texte du <main>|titres/);
  }
});

test('Q3 (témoins) : en-tête, pied, classes, enveloppes, préchargements et image de partage par défaut changés ne font pas rougir ; la carte droit-de-retard reste figée', () => {
  assertDistExists();
  for (const route of ['/fr/projects/', '/experiences/bnp-paribas/', '/404.html']) {
    const html = page(route);
    const mutated = html
      .replace(/<header\b[\s\S]*?<\/header>/i, '<header data-site-header=""><a data-site-name="" href="/">Arnaud Durand</a></header>')
      .replace(/<footer\b[\s\S]*?<\/footer>/i, '<footer data-site-footer=""><span>autre</span></footer>')
      .replace(/\sclass="[^"]*"/g, ' class="sombre"')
      .replace(/<main\b([^>]*)>/i, '<main$1><div class="enveloppe">')
      .replace(/<\/main>/i, '</div></main>')
      .replace(/<link\b[^>]*rel="preload"[^>]*>/gi, '')
      .split('https://wesper-dev.github.io/og.jpg')
      .join('https://wesper-dev.github.io/og-arbre.png')
      .replace(/(<meta\b[^>]*property="og:image:width"[^>]*content=")\d+/, '$1600');
    assert.notEqual(mutated, html);
    assert.deepEqual(diffsOf(route, mutated), [], `${route} : changement de présentation pris à tort pour un changement de contenu`);
  }
  // Une balise de texte en ligne devenue bloc (span → div) ne change ni les mots ni les signes.
  const sk = page('/fr/skills/');
  assert.deepEqual(diffsOf('/fr/skills/', sk.replace(/<span class="skill-name">([^<]*)<\/span>/g, '<div class="skill-name">$1</div>')), []);
  for (const route of OWN_SHARE_IMAGE) assert.ok(diffsOf(route, page(route).split('droit-de-retard-social.jpg').join('og.jpg')).some((d) => /og:image/.test(d)), `${route} : la carte propre au récit doit rester figée`);
});
