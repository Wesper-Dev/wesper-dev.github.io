// Durcissement après l'audit astra du lot 2a (audit-lot2a-astra.md, arbitrage-audit-lot2a.md, l'arbitrage fait foi) :
// les cinq mutations acceptées à tort, le contraste des liens et boutons par état, IBM Plex Mono officielle, l'atelier
// absent du JS public, le type MIME des PDF de l'aperçu.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { previewScriptPath } from './helpers.ts';
import { allFiles, pageHtml, requireDist } from './helpers-scene.ts';
import {
  E31_CARDS,
  E31_CASE_LINK,
  E33_HOME_UI,
  HOME_ROUTES,
  type HNode,
  ancestors,
  byAttr,
  cmapCodepoints,
  distDir,
  docOrder,
  expectedRole,
  exportCss,
  fingerprint,
  fontNames,
  homeDoc,
  homeMods,
  homeRoot,
  inRanges,
  listDir,
  localeOf,
  parseHtml,
  parseUnicodeRange,
  readBaseline,
  sha256,
  siteDir,
  textOf,
  walk,
} from './helpers-home.ts';
import { DESKTOP, PHONE, type State, cascade, complexMatch, inherited, specificity, statesFor } from './helpers-cascade.ts';
import { measureContrast } from './helpers-contrast.ts';

const children: { kill: () => void }[] = [];
after(() => {
  for (const c of children.splice(0)) c.kill();
});

// ---------------- Mutation 1 : paragraphe ajouté dans une fiche ----------------

// Tour W (contrat-relecture-w.md, W2) : les fiches BPCE et École 42 prennent les libellés de lien de la FAQ.
const W2_CARD_LINK: Record<string, Record<string, string>> = {
  bpce: { fr: 'Lire le cas BPCE', en: 'Read the BPCE case' },
  'ecole-42': { fr: 'Voir la formation', en: 'See the curriculum' },
};

test('E6.2 (audit) : le texte de chaque fiche ne contient que rôle · dates, nom, résultat, sous-titre, compétences, libellé du lien et Fermer', async () => {
  // Audit, mutation acceptée : « un paragraphe ajouté dans l'article passe ». Tout le texte est comparé aux chaînes permises.
  const { EXPERIENCES, litSkills, skillLabel } = await homeMods.tree();
  for (const route of HOME_ROUTES) {
    const l = localeOf(route);
    for (const e of EXPERIENCES as { id: string; name: Record<string, string> }[]) {
      const art = byAttr(homeDoc(route), 'data-card', e.id)[0];
      assert.ok(art, `${route} : fiche ${e.id} absente`);
      const c = E31_CARDS[e.id]?.[l];
      assert.ok(c);
      const allowed = [expectedRole(e.id, l), c.role, c.dates, e.name[l], c.result, c.subtitle, ...(litSkills(e.id) as string[]).map((s) => skillLabel(s, l) as string), E31_CASE_LINK[l], E33_HOME_UI[l].storyLink, W2_CARD_LINK[e.id]?.[l], E33_HOME_UI[l].close]
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .sort((a, b) => b.length - a.length);
      let rest = textOf(art);
      for (const s of allowed) rest = rest.split(s).join(' ');
      assert.match(rest, /^[\s·,;:|/•–—\-()↗→]*$/u, `${route} : ${e.id} : texte de fiche d'origine inconnue « ${rest.replace(/\s+/g, ' ').trim()} »`);
    }
  }
});

// ---------------- Mutation 2 : fiche rendue visible par CSS avant ready ----------------

// Rendu d'un nœud dans l'état exporté (attributs hidden et inert présents) : display: none sur lui ou un ancêtre, ou
// visibility héritée hidden, ou opacity 0 sur lui ou un ancêtre.
function renderedInExport(n: HNode, rules = exportCss().rules, env = DESKTOP): boolean {
  const c = cascade(rules, { states: new Map(), env });
  for (const x of [n, ...ancestors(n)]) {
    if (x.tag === '#root') break;
    if (/^none\b/.test(c.get(x, 'display') ?? '')) return false;
    if (parseFloat(c.get(x, 'opacity') ?? '1') === 0) return false;
  }
  const vis = inherited(c, n, 'visibility');
  return !(vis && /^(hidden|collapse)\b/.test(vis.value));
}

// État ready sans sélection, tel que l'îlot le pose (E5.4) : data-tree-state="ready", hidden et inert retirés de
// [data-tree-ui] ; chaque fiche garde son attribut hidden (F14 : témoin C14 de l'audit Fable).
function readyDoc(route: string): HNode {
  const html = pageHtml(route).replace(/(<section\b[^>]*\bdata-tree-state=")html(")/, '$1ready$2').replace(/(<div\b[^>]*\bdata-tree-ui="")([^>]*?)\shidden=""([^>]*?)\sinert=""/, '$1$2$3');
  assert.ok(/data-tree-state="ready"/.test(html) && !/<div\b[^>]*data-tree-ui=""[^>]*\shidden/.test(html), `${route} : état ready non simulé`);
  return parseHtml(html);
}

test('E5.4 (audit, complété F14) : en ready sans sélection, [data-tree-ui] est rendu et aucune fiche ne l\'est (PC et téléphone)', () => {
  for (const route of HOME_ROUTES) {
    const doc = readyDoc(route);
    const ui = byAttr(doc, 'data-tree-ui')[0];
    assert.ok(ui);
    for (const env of [DESKTOP, PHONE]) {
      assert.equal(renderedInExport(ui, exportCss().rules, env), true, `${route} (${env === DESKTOP ? 'PC' : 'téléphone'}) : [data-tree-ui] non rendu en ready (contrôle sans objet)`);
      const shown = byAttr(doc, 'data-card').filter((t) => renderedInExport(t, exportCss().rules, env)).map((t) => t.attrs['data-card']);
      assert.deepEqual(shown, [], `${route} (${env === DESKTOP ? 'PC' : 'téléphone'}) : fiches rendues en ready sans sélection`);
    }
  }
});

test('E5.4 (audit) : dans l\'état exporté, aucune fiche ni [data-tree-ui] n\'est rendue par le CSS (display, visibility, opacity), PC et téléphone', () => {
  // Audit, mutation acceptée : « deux règles CSS rendent la fiche BNP visible avant ready malgré les attributs ».
  // Vérification statique (cascade du test) ; le Worker retenu est un scénario [B] (verif-2a, E5.4-loading).
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    const targets = [...byAttr(doc, 'data-card'), ...byAttr(doc, 'data-tree-ui')];
    assert.ok(targets.length >= 6, `${route} : fiches et [data-tree-ui] attendus`);
    for (const env of [DESKTOP, PHONE]) {
      const shown = targets.filter((t) => renderedInExport(t, exportCss().rules, env)).map((t) => t.attrs['data-card'] ?? 'data-tree-ui');
      assert.deepEqual(shown, [], `${route} (${env === DESKTOP ? 'PC' : 'téléphone'}) : rendus avant ready malgré hidden`);
    }
  }
});

test('E5.4 (audit, réécrit après l\'audit Fable F14) : témoins tirés des survivantes C14 (en ready) et C8 (état exporté), sans règle qui pose elle-même opacity', () => {
  // Audit Fable T4 : l'ancien témoin ajoutait une règle avec opacity:1, seule à pouvoir passer le lecteur CSS qui prenait
  // @starting-style pour une règle ordinaire. Les deux témoins rejouent ici les mutations de l'audit sur le CSS réel.
  const doc = homeDoc('/fr/');
  const bnp = byAttr(doc, 'data-card', 'bnp-paribas')[0];
  const ui = byAttr(doc, 'data-tree-ui')[0];
  assert.ok(bnp && ui);
  const rules = exportCss().rules;
  assert.equal(renderedInExport(bnp, rules), false, 'témoin : sans mutation, la fiche BNP n\'est pas rendue');
  assert.equal(renderedInExport(ui, rules), false, 'témoin : sans mutation, [data-tree-ui] n\'est pas rendu');
  // C14 : « [data-home] [hidden]{display:none!important} supprimé (les cinq fiches peintes ensemble) ».
  const c14 = rules.filter((r) => !(r.selectors.length === 1 && r.selectors[0] === '[data-home] [hidden]' && /^none\b/.test(r.decls.get('display') ?? '')));
  assert.equal(c14.length, rules.length - 1, 'règle [data-home] [hidden]{display:none} introuvable dans l\'export');
  const readyBnp = byAttr(readyDoc('/fr/'), 'data-card', 'bnp-paribas')[0];
  assert.ok(readyBnp);
  assert.equal(renderedInExport(readyBnp, rules), false, 'témoin : en ready sans sélection, la fiche BNP n\'est pas rendue');
  for (const env of [DESKTOP, PHONE]) assert.equal(renderedInExport(readyBnp, c14, env), true, `C14 (${env === DESKTOP ? 'PC' : 'téléphone'}) : en ready, la fiche BNP doit être vue rendue sans la règle [hidden]`);
  // C8 : « [data-home] [data-tree-ui][hidden] en visibility:visible ».
  let hit = 0;
  const c8 = rules.map((r) => {
    if (!r.selectors.includes('[data-home] [data-tree-ui][hidden]') || !/^hidden\b/.test(r.decls.get('visibility') ?? '')) return r;
    hit++;
    const list = r.declList.map(([k, v]) => [k, k === 'visibility' ? 'visible' : v] as [string, string]);
    return { ...r, declList: list, decls: new Map(list) };
  });
  assert.equal(hit, 1, 'règle [data-home] [data-tree-ui][hidden]{visibility:hidden} introuvable dans l\'export');
  for (const env of [DESKTOP, PHONE]) assert.equal(renderedInExport(ui, c8, env), true, `C8 (${env === DESKTOP ? 'PC' : 'téléphone'}) : [data-tree-ui] doit être vu rendu en visibility:visible`);
});

// ---------------- Mutation 3 : data-home sur un alias .html ----------------

test('E1.1 (audit) : aucun fichier .html de l\'export hors des accueils (alias compris) ne contient data-home', () => {
  // Audit, mutation acceptée : « data-home sur le seul alias /fr/skills.html passe ».
  requireDist();
  homeRoot('/');
  const homes = new Set(['index.html', 'fr/index.html', 'fr.html']);
  const bad = allFiles(distDir).filter((f) => f.endsWith('.html')).map((f) => f.slice(distDir.length + 1)).filter((r) => !homes.has(r) && /<[a-z][^>]*\sdata-home(?=[\s=/>])/i.test(readFileSync(join(distDir, r), 'utf8')));
  assert.deepEqual(bad, [], `data-home hors des accueils : ${bad.join(', ')}`);
});

test('E15.1 (audit) : chaque alias à plat (X.html) d\'une route secondaire a le même <body> normalisé que sa page X/index.html', () => {
  // Audit : comparer aussi les alias.
  requireDist();
  const routes = readBaseline().pages.preview;
  const diffs: string[] = [];
  let n = 0;
  for (const route of Object.keys(routes)) {
    if (route === '/404.html') continue;
    const alias = join(distDir, route.slice(1, -1) + '.html');
    if (!existsSync(alias)) continue;
    n++;
    const a = fingerprint(readFileSync(alias, 'utf8')).body;
    const d = fingerprint(readFileSync(join(distDir, route.slice(1) + 'index.html'), 'utf8')).body;
    if (a !== d) diffs.push(route);
  }
  assert.ok(n >= 10, `alias à plat attendus dans l'export (${n})`);
  assert.deepEqual(diffs, [], `alias différents de leur page : ${diffs.join(', ')}`);
});

// ---------------- Mutation 4 : règle CSS globale non préfixée ----------------

// E15.1 (audit) « les règles CSS qui atteignent une page secondaire sont exactement celles de 4ed945b » et son témoin :
// remplacés au lot 4, qui change à dessein le style des pages secondaires (contrat lot 4, Q1 à Q5). La mutation qu'ils
// gardaient (« h2 { display: none } » global) est attrapée par les scénarios navigateur du lot 4
// (tmp/refonte-arbre/verif-4/verif.mjs : Q3.1 texte visible du <main> mesuré en navigateur, Q4 contrastes et axe-core).

// ---------------- Mutation 5 : @import distant ----------------

test('E9.3 (audit) : aucun @import distant dans les CSS exportés, et chaque @import local existe', () => {
  // Audit, mutation acceptée : « une feuille de police distante introduite par @import "https://…" passe ».
  const css = exportCss();
  const imports = [...css.raw.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)].map((m) => m[1] ?? '');
  assert.deepEqual(imports.filter((u) => /^(https?:)?\/\//i.test(u)), [], '@import distant');
  assert.deepEqual(imports.filter((u) => !/^(https?:)?\/\//i.test(u) && !existsSync(join(distDir, u.replace(/^\//, '')))), [], '@import local absent de l\'export');
});

// ---------------- Bloquant 2 : contraste des liens et boutons par état ----------------

test('E12.7 (audit) : texte de chaque lien et bouton ≥ 4,5 au repos, au survol, au focus et actif, quatre palettes, PC et téléphone, lien d\'évitement compris', async () => {
  // Audit, bloquant 2 : le survol générique remplaçait l'encre sombre sur l'ambre (1,49:1) ; lien d'évitement à 1:1.
  const { PALETTES, PALETTE_ORDER } = await homeMods.palettes();
  const { cssVariables } = await homeMods.color();
  const rules = exportCss().rules;
  const problems: string[] = [];
  let skipMeasured = 0;
  for (const route of HOME_ROUTES) {
    const home = homeRoot(route);
    for (const id of PALETTE_ORDER as string[]) {
      for (const [env, name, states] of [[DESKTOP, 'PC', ['rest', 'hover', 'focus', 'active']], [PHONE, 'téléphone', ['rest', 'focus', 'active']]] as const) {
        const r = measureContrast(home, rules, PALETTES[id], cssVariables(PALETTES[id]), env, name, [...states] as State[]);
        problems.push(...r.errors.map((e) => `${route} ${id} ${name} : ${e}`));
        skipMeasured += r.measures.filter((m) => m.target.includes('href="#main"')).length;
        for (const m of r.measures) if (m.ratio < 4.5) problems.push(`${route} ${id} ${name} ${m.state} ${m.target}${m.node ? ' ' + m.node : ''} : ${m.ratio.toFixed(2)} (${m.fg} sur ${m.bg})`);
      }
    }
  }
  assert.ok(skipMeasured > 0, 'lien d\'évitement non mesuré');
  assert.deepEqual([...new Set(problems)], [], [...new Set(problems)].join('\n'));
});

test('E12.7 (audit) : le calcul par état retrouve 1,49:1 pour un survol clair sur fond ambre (témoin)', () => {
  // Témoin : sans lui, un E12.7 vert ne prouverait rien.
  const doc = parseHtml('<body><div data-home style="--ink:#EAF0EC"><a href="#x" class="k">Lire</a></div></body>');
  const home = byAttr(doc, 'data-home')[0] as HNode;
  const rule = (sel: string, decls: [string, string][], media: string | null = null) => ({ selectors: [sel], selector: sel, decls: new Map(decls), declList: decls, media, file: 'témoin' });
  const rules = [rule('.k', [['background', '#FFB84D'], ['color', '#050A08']]), rule('[data-home] a:hover', [['color', 'var(--ink)']], '(hover:hover) and (pointer:fine)')];
  const pal = { bg: '#050A08', bg2: '#0D1712' };
  const rest = measureContrast(home, rules, pal, { '--ink': '#EAF0EC' }, DESKTOP, 'PC', ['rest']).measures[0];
  const hover = measureContrast(home, rules, pal, { '--ink': '#EAF0EC' }, DESKTOP, 'PC', ['hover']).measures[0];
  assert.ok(rest && Math.abs(rest.ratio - 11.6) < 0.1, `repos ${rest?.ratio}`);
  assert.ok(hover && Math.abs(hover.ratio - 1.49) < 0.01, `survol ${hover?.ratio}`);
  const phone = measureContrast(home, rules, pal, { '--ink': '#EAF0EC' }, PHONE, 'téléphone', ['hover']).measures[0];
  assert.ok(phone && phone.ratio > 11, 'le survol réservé à la souris ne s\'applique pas au téléphone');
  void statesFor;
});

// ---------------- Bloquant 3 : IBM Plex Mono officielle, non modifiée ----------------

// Empreintes SHA-256 des WOFF2 Regular et Medium du paquet @ibm/plex-mono@2.5.0 (fichiers « complete » et « split »),
// calculées le 21/11/2026 sur `npm pack @ibm/plex-mono@2.5.0`.
const PLEX_OFFICIAL: Record<string, string> = {
  ba204497f16b6d334cee9d1e963a831b73e3a56e1d6300a8489d18df7214b350: 'complete/woff2/IBMPlexMono-Regular.woff2',
  '33faf307fa6031fb4062276d7320a6d632de890cbb347576fd80cfa01077bc25': 'complete/woff2/IBMPlexMono-Medium.woff2',
  e8993d946649b9d01abb1ed06d574b19d8ea3e66b5c3948602db335c44c18e56: 'split/woff2/IBMPlexMono-Regular-Latin1.woff2',
  '8c5e48e4c6ee60346744db62fd8bbf530c21e531e1a1498c3a410ed8f7d3986e': 'split/woff2/IBMPlexMono-Regular-Latin2.woff2',
  '1ff2d301f841079fa2ad3908cfb34a60edd80966e8c9dd3b82d8a8ec8e4df947': 'split/woff2/IBMPlexMono-Regular-Latin3.woff2',
  b8002770aa636f544ba43e124da6a227301769754f295eae26e16475b469c767: 'split/woff2/IBMPlexMono-Regular-Pi.woff2',
  '44e877f4d7718832f438809250ec677f75b0bba9dcb3b0076aaf00f08d9385d4': 'split/woff2/IBMPlexMono-Regular-Cyrillic.woff2',
  '41201b658a328b9d00368215c2f1102770f80b15952ab82631e4006255e6365d': 'split/woff2/IBMPlexMono-Medium-Latin1.woff2',
  '86208dbe8e00256a77bc3edd09aa6a584b0da393caa1fb200d44eac1d578512c': 'split/woff2/IBMPlexMono-Medium-Latin2.woff2',
  a90d0ca2314298c0bc32791af9996e2ea2a0c541fee8fbde9601d82556c87d45: 'split/woff2/IBMPlexMono-Medium-Latin3.woff2',
  '92bd18415e8c43a2569f615e4e84a94b1b1c4e0377ba9d8f4d894bbf6ffcc39d': 'split/woff2/IBMPlexMono-Medium-Pi.woff2',
  b7b352381265d31cc4845ca9d6321b869ae5913c4504bf61aed30baedab77a27: 'split/woff2/IBMPlexMono-Medium-Cyrillic.woff2',
};
const plexFiles = (): string[] => listDir('public/fonts').filter((f) => /^ibm-plex-mono-.*\.woff2$/.test(f));

test('E9.1 (audit) : chaque WOFF2 IBM Plex Mono est un fichier officiel non modifié de @ibm/plex-mono (empreinte connue), dont la table name garde la famille « IBM Plex Mono »', () => {
  // Arbitrage, bloquant 3 : pas de sous-ensemble fabriqué par nous (nom réservé « Plex », OFL clause 3).
  const files = plexFiles();
  assert.ok(files.length >= 1, 'aucun ibm-plex-mono-*.woff2');
  for (const f of files) {
    const buf = readFileSync(join(siteDir, 'public', 'fonts', f));
    const names = fontNames(buf);
    assert.equal(names.get(16) ?? names.get(1), 'IBM Plex Mono', `${f} : famille de la table name`);
    const h = sha256(buf);
    assert.ok(PLEX_OFFICIAL[h], `${f} (SHA-256 ${h}) n'est pas un WOFF2 officiel non modifié de @ibm/plex-mono@2.5.0`);
  }
});

test('E9.1 (audit) : le README des polices note la provenance (@ibm/plex-mono) et l\'empreinte SHA-256 de chaque fichier IBM Plex Mono, égale à celle du fichier', () => {
  // Arbitrage, bloquant 3 : provenance et empreinte dans public/fonts/README.md.
  const readme = readFileSync(join(siteDir, 'public', 'fonts', 'README.md'), 'utf8');
  assert.match(readme, /@ibm\/plex-mono|github\.com\/IBM\/plex/, 'provenance IBM (@ibm/plex-mono ou github.com/IBM/plex) absente du README');
  for (const f of plexFiles()) {
    const h = sha256(readFileSync(join(siteDir, 'public', 'fonts', f)));
    const at = readme.indexOf(f);
    assert.ok(at >= 0, `${f} non cité dans le README`);
    assert.ok(readme.slice(at, at + 800).includes(h), `${f} : empreinte SHA-256 ${h} non notée près de son nom dans le README`);
  }
});

test('E9.1 (audit) : Inter Tight : si sa licence réserve un nom, fichier officiel avec empreinte notée ; sinon sous-ensemble déclaré dans le README', () => {
  // Arbitrage, bloquant 3, même vérification pour Inter Tight.
  const lic = readFileSync(join(siteDir, 'public', 'fonts', 'intertight-OFL.txt'), 'utf8');
  const readme = readFileSync(join(siteDir, 'public', 'fonts', 'README.md'), 'utf8');
  const files = listDir('public/fonts').filter((f) => /^inter-tight-.*\.woff2$/.test(f));
  assert.ok(files.length >= 1, 'aucun inter-tight-*.woff2');
  if (/with Reserved Font Name/i.test(lic)) {
    for (const f of files) assert.ok(readme.includes(sha256(readFileSync(join(siteDir, 'public', 'fonts', f)))), `${f} : nom réservé, empreinte du fichier officiel attendue dans le README`);
  } else assert.match(readme, /[Ss]ous-ensemble/, 'sous-ensemble Inter Tight non déclaré dans le README');
});

test('E9.4 (audit) : aucun texte rendu en IBM Plex Mono ne contient un caractère absent de ses fichiers (« → », « ↗ » compris), contenus CSS compris', () => {
  // Arbitrage, bloquant 3 : les flèches absentes du fichier officiel sont rendues par Inter Tight ou la police système.
  const css = exportCss();
  const faces = css.fontFaces.filter((f) => f.family === 'IBM Plex Mono');
  assert.ok(faces.length >= 1, 'aucune @font-face IBM Plex Mono');
  const loaded = faces.map((f) => ({ ranges: parseUnicodeRange(f.unicodeRange || 'U+0-10FFFF'), cmap: new Set<number>(f.urls.flatMap((u) => [...cmapCodepoints(readFileSync(join(distDir, u.replace(/^\//, ''))))])) }));
  const covered = (ch: string): boolean => { const cp = ch.codePointAt(0) ?? 0; return loaded.some((f) => inRanges(cp, f.ranges) && f.cmap.has(cp)); };
  const bad: string[] = [];
  for (const route of HOME_ROUTES) {
    const doc = homeDoc(route);
    homeRoot(route);
    for (const env of [DESKTOP, PHONE]) {
      const c = cascade(css.rules, { states: new Map(), env });
      const fontOf = (n: HNode): string => (inherited(c, n, 'font-family')?.value ?? '').split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? '';
      walk(doc, (t) => {
        if (t.tag !== '#text' || !t.parent || !t.text.trim()) return;
        if (['script', 'style', 'title'].includes(t.parent.tag)) return;
        if (fontOf(t.parent) !== 'IBM Plex Mono') return;
        for (const ch of t.text) if (!/\s/.test(ch) && !covered(ch)) bad.push(`${route} : « ${ch} » dans « ${t.text.trim().slice(0, 40)} » (${t.parent.tag})`);
      });
      // Contenus générés : ::before / ::after dont l'élément porteur est en Plex Mono (ou la règle elle-même).
      for (const r of css.rules) {
        const content = r.decls.get('content');
        if (!content || !/[^\x00-\x7f]/.test(content)) continue;
        const chars = [...content.replace(/^["']|["']$/g, '')].filter((ch) => /[^\x00-\x7f]/.test(ch));
        for (const sel of r.selectors) {
          const host = sel.replace(/::?(before|after|marker)\s*$/, '');
          if (host === sel) continue;
          const ruleFont = (r.decls.get('font-family') ?? '').split(',')[0]?.trim().replace(/^["']|["']$/g, '');
          for (const n of docOrder(doc)) {
            let hit = false;
            try { hit = n.tag !== '#text' && complexMatch(n, host, { states: new Map(), env }); } catch { hit = false; }
            if (!hit) continue;
            if ((ruleFont || fontOf(n)) !== 'IBM Plex Mono') continue;
            for (const ch of chars) if (!covered(ch)) bad.push(`${route} : « ${ch} » en contenu CSS de ${sel}`);
          }
        }
      }
    }
  }
  assert.deepEqual([...new Set(bad)], [], [...new Set(bad)].join('\n'));
});

// ---------------- Atelier absent du JS public ----------------

test('E11.5 (audit) : export public : aucun JS ne contient setPalette, setBackdrop ni setGrowth', (t) => {
  // Arbitrage : méthodes de l'atelier conditionnées à la compilation.
  const mode = requireDist();
  const js = allFiles(distDir).filter((f) => f.endsWith('.js'));
  const hits = js.flatMap((f) => ['setPalette', 'setBackdrop', 'setGrowth'].filter((n) => readFileSync(f, 'utf8').includes(n)).map((n) => `${f.slice(distDir.length)} : ${n}`));
  if (mode === 'preview') {
    t.diagnostic(`aperçu : ${hits.length} occurrence(s) permises (${hits.slice(0, 3).join(', ')})`);
    return;
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});

// ---------------- preview.mjs : PDF ----------------

test('E4.3 (audit) : scripts/preview.mjs sert les PDF du CV en application/pdf', async () => {
  // Arbitrage : les CV étaient servis en application/octet-stream.
  requireDist();
  const port = 41000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, [previewScriptPath, '--port', String(port)], { cwd: siteDir, stdio: 'ignore' });
  children.push(child);
  let res: Response | null = null;
  for (let i = 0; i < 50 && !res; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { res = await fetch(`http://127.0.0.1:${port}/cv/arnaud-durand-cv-platform-fr.pdf`); } catch { res = null; }
  }
  child.kill();
  assert.ok(res, 'preview.mjs ne répond pas');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^application\/pdf\b/, `content-type ${res.headers.get('content-type')}`);
  await res.arrayBuffer();
});

