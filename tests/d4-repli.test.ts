// Contrat D4 (lot 1c) : contenu du repli [data-tree-fallback] rendu côté serveur, textes d'interface dans content/tree-ui.ts.
// La visibilité selon l'état (D4.2) est un scénario [B] hors de cette suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readManifest } from './helpers.ts';
import { PORTFOLIO_HOME, homeComponents } from './helpers-home.ts';
import { HOME_ROUTES, anchorsOf, elementsWithAttr, engine, load1c, pageHtml, readSrc, siteDir, stripCode, visibleText } from './helpers-scene.ts';

const localeOf = (route: string): 'fr' | 'en' => (route.startsWith('/fr/') ? 'fr' : 'en');

function fallbackOf(route: string): string {
  const fb = elementsWithAttr(pageHtml(route), 'data-tree-fallback');
  assert.equal(fb.length, 1, `${route} : exactement un [data-tree-fallback] attendu, reçu ${fb.length}`);
  return fb[0]?.inner ?? '';
}

test('D4.1 : le repli liste chaque expérience dans l\'ordre de EXPERIENCES, avec les libellés de litSkills sous son nom (FR et EN)', async () => {
  // D4.1 : nom dans la langue, puis skillLabel(id, locale) de chaque compétence allumée, jusqu'au nom suivant.
  const { EXPERIENCES, litSkills, skillLabel } = await engine.tree();
  for (const route of HOME_ROUTES) {
    const loc = localeOf(route);
    const text = visibleText(fallbackOf(route));
    let from = 0;
    const starts: number[] = [];
    for (const e of EXPERIENCES) {
      const at = text.indexOf(e.name[loc], from);
      assert.ok(at >= 0, `${route} : nom « ${e.name[loc]} » absent du repli ou hors de l'ordre de EXPERIENCES`);
      starts.push(at);
      from = at + e.name[loc].length;
    }
    EXPERIENCES.forEach((e: { id: string; name: Record<string, string> }, i: number) => {
      const seg = text.slice((starts[i] ?? 0) + e.name[loc].length, starts[i + 1] ?? text.length);
      for (const s of litSkills(e.id) as string[]) {
        const label = skillLabel(s, loc) as string;
        assert.ok(seg.includes(label), `${route} : libellé « ${label} » (${s}) absent sous ${e.name[loc]}`);
      }
    });
  }
});

test('D4.1 (mis à jour au lot 2b, P4) : le repli a un lien /(fr/)<href> pour chaque expérience dont href figure dans routes.json, soit les cinq', async () => {
  // D4.1 : pas de lien cassé ; au lot 2b, BPCE et École 42 ont leur page (contrat-lot2b P1, P4).
  const { EXPERIENCES } = await engine.tree();
  const paths = new Set(readManifest().paths);
  for (const route of HOME_ROUTES) {
    const prefix = localeOf(route) === 'fr' ? '/fr/' : '/';
    const want = (EXPERIENCES as { href: string }[]).filter((e) => paths.has(e.href)).map((e) => prefix + e.href).sort();
    for (const slug of ['bpce', 'ecole-42']) assert.ok(want.includes(`${prefix}experiences/${slug}/`), `routes.json doit contenir experiences/${slug}/ (lot 2b)`);
    const got = anchorsOf(fallbackOf(route)).map((a) => a.href).sort();
    assert.deepEqual(got, want, `${route} : liens du repli`);
  }
});

test('D4.1 (étendu au 2a, E15.3) : aucun texte du repli ne vient d\'ailleurs que de content/tree.ts, content/experiences.ts ou des résultats de EXPERIENCE_CARDS', async () => {
  // D4.1 : le texte restant, une fois retirés noms, résultats de fiche (E5.5) et libellés, n'est que ponctuation et espaces.
  const { EXPERIENCES, SKILLS, skillLabel } = await engine.tree();
  const { experiences } = await engine.experiences();
  const { EXPERIENCE_CARDS } = await load1c('content/cards.ts');
  for (const route of HOME_ROUTES) {
    const loc = localeOf(route);
    const allowed: string[] = [
      ...(EXPERIENCES as { name: Record<string, string> }[]).map((e) => e.name[loc] ?? ''),
      ...(SKILLS as { id: string }[]).map((s) => skillLabel(s.id, loc) as string),
      ...Object.values(experiences as Record<string, Record<string, { title: string; description: string }>>).flatMap((x) => [x[loc]?.title ?? '', x[loc]?.description ?? '']),
      ...Object.values(EXPERIENCE_CARDS as Record<string, Record<string, { result: string }>>).map((c) => c[loc]?.result ?? ''),
    ].filter(Boolean).sort((a, b) => b.length - a.length);
    let rest = visibleText(fallbackOf(route));
    for (const s of allowed) rest = rest.split(s).join(' ');
    assert.match(rest, /^[\s·,;:|/•–—\-()]*$/u, `${route} : texte du repli d'origine inconnue : « ${rest.trim()} »`);
  }
});

// Feuilles de texte d'un module, appariées FR/EN.
async function pairedTexts(rel: string, minFr: number): Promise<void> {
  const mod = await load1c(rel);
  const leaves = new Map<string, string>();
  const walk = (v: unknown, path: string[]): void => {
    if (typeof v === 'string') leaves.set(path.join('.'), v);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, [...path, k]);
  };
  for (const [k, v] of Object.entries(mod as Record<string, unknown>)) walk(v, [k]);
  const fr = [...leaves.keys()].filter((k) => k.split('.').includes('fr'));
  const en = [...leaves.keys()].filter((k) => k.split('.').includes('en'));
  assert.ok(fr.length >= minFr, `${rel} : au moins ${minFr} textes FR attendus, reçu ${fr.length}`);
  assert.deepEqual(en.map((k) => k.replace(/(^|\.)en(\.|$)/, '$1fr$2')).sort(), fr.sort(), `${rel} : chaque texte FR doit avoir son équivalent EN`);
  for (const k of [...fr, ...en]) assert.ok((leaves.get(k) ?? '').trim().length > 0, `${rel} : texte vide : ${k}`);
}

test('D4.3 (réécrit au 2a, E15.3) : content/tree-ui.ts et content/home-ui.ts portent leurs textes d\'interface en FR et EN, avec le commentaire « à valider par Arnaud »', async () => {
  // D4.3 / E3.3 : textes d'interface proposés par le contrat, soumis à Arnaud.
  for (const rel of ['content/tree-ui.ts', 'content/home-ui.ts']) {
    assert.match(readSrc(rel), /à valider par Arnaud/, `${rel} : commentaire « à valider par Arnaud » absent`);
  }
  await pairedTexts('content/tree-ui.ts', 2);
  await pairedTexts('content/home-ui.ts', 5);
});

test('D4.3 (étendu au 2a, E15.3) : aucun littéral de texte en français ou en anglais dans les JSX de components/tree et components/home', () => {
  // D4.3 : textes JSX et attributs visibles (aria-label, title, alt, placeholder) tirés de content/*.
  const problems: string[] = [];
  let found = 0;
  const list = homeComponents();
  for (const rel of ['components/tree/TreeHero.tsx', 'components/tree/TreeIsland.tsx', 'components/tree/TreeFallback.tsx']) if (!list.includes(rel)) problems.push(`${rel} absent`);
  for (const rel of list) {
    if (!existsSync(join(siteDir, rel))) continue;
    found++;
    const code = stripCode(readSrc(rel));
    for (const m of code.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ]{2,}[^<>{}]*)</g)) {
      const t = (m[1] ?? '').trim();
      // Les fragments de code (génériques, comparaisons) contiennent presque toujours l'un de ces signes.
      if (t && !/[(){}=;&|?:,[\]]/.test(t)) problems.push(`${rel} : texte JSX « ${t} »`);
    }
    for (const m of code.matchAll(/\b(aria-label|aria-description|title|alt|placeholder|aria-roledescription)\s*=\s*(["'])([^"']*[A-Za-zÀ-ÿ][^"']*)\2/g)) {
      problems.push(`${rel} : ${m[1]}="${m[3]}" en littéral`);
    }
    for (const m of code.matchAll(/\b(aria-label|title|alt|placeholder)\s*=\s*\{\s*(["'`])([^"'`]*[A-Za-zÀ-ÿ][^"'`]*)\2\s*\}/g)) {
      problems.push(`${rel} : ${m[1]}={"${m[3]}"} en littéral`);
    }
  }
  assert.ok(found >= 3, 'TreeHero, TreeIsland et TreeFallback attendus dans components/tree');
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('D4.3 (étendu au 2a, E15.3) : components/portfolio-home.tsx ne contient aucune formule interdite de E16.2', () => {
  // contrat-lot2a-tests §3 : portfolio-home.tsx garde ses littéraux existants, mais aucun texte interdit.
  const code = stripCode(readSrc(PORTFOLIO_HOME));
  const forbidden: (string | RegExp)[] = [/\bMaster\b/, 'bac+5', 'diplôm', 'degree', 'PyTorch', 'OpenShift', 'gVisor', 'Podman', 'déterministe', 'deterministic', 'mes systèmes', 'tournent vraiment', 'actually run', 'Applied AI Engineer', '121 tests', '300+', '300 membres', '15+ séances', '15+ fitness sessions', 'victoires', 'podiums', '16 octobre 2026', '16 October 2026'];
  const found = forbidden.filter((f) => (typeof f === 'string' ? code.includes(f) : f.test(code))).map(String);
  assert.deepEqual(found, [], `${PORTFOLIO_HOME} : formules interdites`);
  assert.ok(homeComponents().length >= 3, 'composants de l\'accueil introuvables');
});

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('D4.1 (audit, réécrit au 2a, E15.3) : sous chaque expérience, après son résultat, la liste des libellés est exactement litSkills, dans l\'ordre, sans doublon ni ajout', async () => {
  // Audit : un <li>Docker</li> ajouté à chaque expérience passait. Comparaison exacte par expérience et par langue ;
  // au 2a, le résultat de la fiche (E5.5) s'intercale entre le nom et les libellés, qui restent comparés seuls.
  const { EXPERIENCES, litSkills, skillLabel } = await engine.tree();
  const { EXPERIENCE_CARDS } = await load1c('content/cards.ts');
  for (const route of HOME_ROUTES) {
    const loc = localeOf(route);
    const html = fallbackOf(route);
    const text = visibleText(html);
    const exps = EXPERIENCES as { id: string; name: Record<string, string> }[];
    const names = exps.map((e) => e.name[loc] ?? '');
    const results = exps.map((e) => (EXPERIENCE_CARDS[e.id]?.[loc]?.result ?? '') as string);
    const SEP = '[\\s,;·•|/–—\\-]*';
    const pattern = '^' + SEP + exps.map((e, i) =>
      escapeRe(e.name[loc] ?? '') + SEP + escapeRe(results[i] ?? '') + SEP + (litSkills(e.id) as string[]).map((s) => escapeRe(skillLabel(s, loc) as string)).join(SEP) + SEP,
    ).join('') + '$';
    assert.match(text, new RegExp(pattern, 'u'), `${route} : le repli doit être exactement « nom, résultat, libellés » par expérience. Reçu : « ${text} »`);
    // <li> les plus internes seulement (ceux qui ne contiennent pas d'autre <li>), hors nom et résultat.
    const items = [...html.matchAll(/<li\b[^>]*>((?:(?!<li\b)[\s\S])*?)<\/li>/gi)].map((m) => visibleText(m[1] ?? ''));
    if (items.length > 0) {
      const want = exps.flatMap((e) => (litSkills(e.id) as string[]).map((s) => skillLabel(s, loc) as string));
      const leaf = items.filter((t) => !names.some((n) => t.startsWith(n)) && !results.includes(t));
      assert.deepEqual(leaf, want, `${route} : éléments <li> de libellés différents de litSkills`);
    }
  }
});
