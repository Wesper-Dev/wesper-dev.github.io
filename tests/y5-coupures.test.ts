// Tour Y, Y5 (constat 8) : titres h1, h2, h3 équilibrés (text-wrap: balance) ; aucune plage de dates coupée au milieu
// (espaces insécables ; ni abréviation ni réécriture des dates).
// Statique : la cascade de la feuille exportée (bureau 1440 et téléphone 390) donne text-wrap-style « balance » à chaque
// h1, h2, h3 des 21 pages ; chaque plage de dates du texte des 21 pages ne contient aucun blanc sécable. Le rendu réel
// (une plage sur une seule ligne, Chromium et WebKit, de 320 à 1440 px) est contrôlé par verif-7 (Y5).
import assert from 'node:assert/strict';
import test from 'node:test';
import { DESKTOP, PHONE, cascade } from './helpers-cascade.ts';
import { byTag, exportCss, parseCss, parseHtml } from './helpers-home.ts';
import { DATE_RANGE_RE, bodyY, dateRangesIn, dateRangesOf, docY, pages21, readDepartY, showBlanks, textWrapStyle } from './helpers-y.ts';

test('Y5 : chaque h1, h2, h3 des 21 pages a text-wrap-style « balance » (cascade exportée, bureau et téléphone)', () => {
  const css = exportCss();
  const errs: string[] = [];
  let n = 0;
  for (const env of [DESKTOP, PHONE]) {
    const c = cascade(css.rules, { states: new Map(), env });
    for (const r of pages21()) {
      const body = bodyY(docY(r));
      for (const h of ['h1', 'h2', 'h3'].flatMap((t) => byTag(body, t))) {
        n++;
        const v = textWrapStyle(c, h);
        if (v !== 'balance') errs.push(`${r} ${env.width}px <${h.tag}${h.attrs.class ? ` class="${h.attrs.class}"` : ''}> : text-wrap-style ${v}`);
      }
    }
  }
  assert.ok(n >= 150, `${n} titres seulement (vert à vide ?)`);
  assert.deepEqual([...new Set(errs)], [], `contrat-recette-y.md, Y5 :\n${[...new Set(errs)].slice(0, 30).join('\n')}${errs.length > 30 ? '\n…' : ''}`);
});

test('Y5 : aucune plage de dates à blancs des 21 pages ne peut se couper (blancs insécables ; après un tiret, parent nowrap ou U+2060)', () => {
  const dep = readDepartY();
  const errs: string[] = [];
  let spaced = 0;
  for (const r of pages21()) {
    const ranges = dateRangesOf(r);
    const withBlank = ranges.filter((x) => /[\s  ]/.test(x.range));
    spaced += withBlank.length;
    if (withBlank.length < (dep.plages[r] ?? 0)) errs.push(`${r} : ${withBlank.length} plage(s) de dates à blancs, ${dep.plages[r]} au départ (plage réécrite ou abrégée ?)`);
    for (const x of ranges.filter((y) => /[\s\u00a0\u202f]/.test(y.range))) if (x.breakable) errs.push(`${r} : « ${showBlanks(x.range)} » : ${x.why} (␠ = espace sécable)`);
  }
  if (spaced < 14) errs.push(`${spaced} plages de dates à blancs trouvées, 14 au moins (vert à vide ?)`);
  assert.deepEqual(errs, [], `contrat-recette-y.md, Y5 :\n${errs.join('\n')}`);
});

test('Y5 (témoins) : le motif des plages reconnaît les formes du site et la cascade lit balance, pretty et l\'héritage', () => {
  const found = (s: string): string[] => [...s.matchAll(DATE_RANGE_RE)].map((m) => m[0]);
  for (const s of ['14 juin 2025 – 15 juin 2025', 'avr. 2026 – oct. 2026', 'Sep 2025 – Mar 2026', '14 Jun 2025 – 15 Jun 2025', '2019–2026', '4–5 April 2025', '4 et 5 avril 2025', 'sept. 2025 – mars 2026']) assert.deepEqual(found(`x ${s} y`), [s], `plage non reconnue : ${s}`);
  for (const s of ['de 3–5 à 1–3 minutes', '15–20 participants', '€0.30–0.40', '1,500–3,000 employees', '10–15 captures']) assert.deepEqual(found(s), [], `faux positif : ${s}`);
  const runs = parseHtml('<body><p>avr. 2026 – oct. 2026</p><p>avr.\u00a02026\u00a0–\u00a0oct.\u00a02026</p><p>avr.\u00a02026\u00a0–\u2060\u00a0oct.\u00a02026</p><p><span class="nw">avr.\u00a02026\u00a0–\u00a0oct.\u00a02026</span></p><p>4–5\u00a0April\u00a02025</p><p>4–\u20605\u00a0April\u00a02025</p></body>');
  assert.deepEqual(dateRangesIn(runs, (el) => el.attrs.class === 'nw').map((x) => x.breakable), [true, true, false, false, true, false], 'espace sécable, insécable après le tiret, U+2060, parent nowrap');
  const doc = parseHtml('<body><h1>a</h1><div class="x"><h2>b</h2></div><section style="text-wrap:balance"><h3>c</h3></section></body>');
  const wrapOf = (cssText: string, tag: string): string => textWrapStyle(cascade(parseCss(cssText).rules, { states: new Map(), env: DESKTOP }), byTag(doc, tag)[0]!);
  assert.equal(wrapOf('h1,h2,h3{text-wrap:balance}', 'h1'), 'balance');
  assert.equal(wrapOf('h1,h2,h3{text-wrap:balance}.x h2{text-wrap:pretty}', 'h2'), 'pretty', 'règle plus précise en pretty non vue');
  assert.equal(wrapOf('h1,h2,h3{text-wrap-style:balance}h2{text-wrap:wrap}', 'h2'), 'auto', 'raccourci text-wrap postérieur non vu');
  assert.equal(wrapOf('p{color:red}', 'h3'), 'balance', 'héritage du style en ligne non vu');
  assert.equal(wrapOf('p{color:red}', 'h1'), 'auto');
});
