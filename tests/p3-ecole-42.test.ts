// Contrat du lot 2b, P3 : page École 42 (FR /fr/experiences/ecole-42/, EN /experiences/ecole-42/). Textes de FAITS.md
// §4 (ou de la copie versionnée, F12) : h1 « École 42 Paris », ligne de formation exacte seule sur sa ligne,
// paragraphe exact présenté séparément ; métadonnées cohérentes avec la page BNP ; interdits (titre ou niveau de
// diplôme, RNCP, Alumni, Master, bac+, binôme / pair, étudiant). Témoins négatifs sur une page conforme synthétique.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ecole42Reference } from './helpers-faits.ts';
import { assertDistExists, cleanupTempDirs, distDir, makeSandbox } from './helpers.ts';
import type { Sandbox } from './helpers.ts';
import { docOrder, parseHtml } from './helpers-home.ts';
import { E42_SPECS, bodyHtml, conformingPage, e42ForbiddenErrors, escHtml, headErrors, inlineText, paragraphs, readPage, textLines, whitelistErrors } from './helpers-2b.ts';
import type { DetailSpec } from './helpers-2b.ts';

after(cleanupTempDirs);

// Ligne de formation seule sur sa ligne (lignes de texte : coupure aux blocs et à <br>) ; paragraphe exact dans un
// <p> qui ne contient pas la ligne ; aucun élément de bloc ne porte à la fois la ligne et le paragraphe.
function e42StructureErrors(s: DetailSpec, html: string): string[] {
  const r = ecole42Reference();
  const l = s.lang;
  const errors: string[] = [];
  const need = (ok: boolean, msg: string): void => {
    if (!ok) errors.push(`${s.route} : ${msg}`);
  };
  const lines = textLines(bodyHtml(html));
  need(lines.includes(r.line), `ligne de formation « ${r.line} » seule sur sa ligne attendue (FAITS §4) ; lignes contenant « 2019 » : ${JSON.stringify(lines.filter((x) => x.includes('2019')))}`);
  need(!lines.some((x) => x !== r.line && x.includes(r.line)), `la ligne de formation partage sa ligne avec un autre texte : ${JSON.stringify(lines.filter((x) => x !== r.line && x.includes(r.line)))}`);
  const doc = parseHtml(bodyHtml(html));
  const ps = paragraphs(doc).filter((p) => inlineText(p) === r.paragraph[l]);
  need(ps.length === 1, `un <p> au texte exact du paragraphe de FAITS §4 « Page de détail » (${l.toUpperCase()}) attendu, reçu ${ps.length}`);
  const blocks = docOrder(doc).filter((n) => /^(p|div|li|section|header|dd|dt|blockquote|h[1-6])$/.test(n.tag));
  need(!blocks.some((b) => b.tag !== 'div' && b.tag !== 'section' && b.tag !== 'header' && inlineText(b).includes(r.line) && inlineText(b).includes(r.paragraph[l])), 'ligne de formation et paragraphe dans le même élément de texte');
  return errors;
}

function pageOrError(s: DetailSpec): string {
  assertDistExists();
  const html = readPage(distDir, s.dir);
  if (html === null) assert.fail(`${s.route} : page absente (${s.dir}/index.html) : contrat lot 2b, P3`);
  return html;
}

for (const s of E42_SPECS) {
  test(`P3 (${s.lang}) : ${s.route} : un h1 « École 42 Paris », lang, canonique, hreflang, <title>, description, og:* et twitter:* cohérents avec la page BNP`, () => {
    assert.deepEqual(headErrors(distDir, s, pageOrError(s)), []);
  });

  test(`P3 (${s.lang}) : ${s.route} : ligne « École 42 Paris, 2019–2026 » seule sur sa ligne et paragraphe exact de FAITS §4, présenté séparément`, () => {
    assert.deepEqual(e42StructureErrors(s, pageOrError(s)), []);
  });

  test(`P3 (${s.lang}) : ${s.route} : ni titre ni niveau de diplôme, ni RNCP, Alumni, Master, bac+, binôme / pair, étudiant (texte, métadonnées, charge RSC)`, () => {
    assert.deepEqual(e42ForbiddenErrors(distDir, s, pageOrError(s)), []);
  });

  test(`P3 (${s.lang}) : ${s.route} : tout le texte vient de FAITS §4 ou de la coquille commune à la page BNP`, () => {
    assert.deepEqual(whitelistErrors(distDir, s, pageOrError(s)), []);
  });
}

// ---- Témoins négatifs ----

let box: Sandbox | null = null;
const sandbox = (): Sandbox => (box ??= makeSandbox());
function allErrors(s: DetailSpec, html: string): string[] {
  const root = sandbox().artifact;
  mkdirSync(join(root, s.dir), { recursive: true });
  writeFileSync(join(root, s.dir, 'index.html'), html);
  return [...headErrors(root, s, html), ...e42StructureErrors(s, html), ...e42ForbiddenErrors(root, s, html), ...whitelistErrors(root, s, html)];
}

for (const s of E42_SPECS) {
  test(`P3 témoin (${s.lang}) : la page conforme synthétique (textes de FAITS §4, coquille de la page BNP) passe tous les contrôles`, () => {
    assert.deepEqual(allErrors(s, conformingPage(sandbox().artifact, s)), []);
  });
}

test('P3 témoins : chaque mutation de la page synthétique est refusée (FR et EN)', () => {
  const r = ecole42Reference();
  const failures: string[] = [];
  for (const s of E42_SPECS) {
    const l = s.lang;
    const ok = conformingPage(sandbox().artifact, s);
    const line = escHtml(r.line);
    const para = `<p>${escHtml(r.paragraph[l])}</p>`;
    const add = (html: string, text: string): string => html.replace('</article>', `<p>${escHtml(text)}</p></article>`);
    const cases: [string, string, RegExp][] = [
      ['ligne et paragraphe dans un même <p>', ok.replace(para, '').replace(/<p class="intro">[\s\S]*?<\/p>/, `<p class="intro">${line} ${escHtml(r.paragraph[l])}</p>`), /seule sur sa ligne|partage|même élément|<p>/],
      ['ligne suivie d\'un titre', ok.replace(`${line}<br/>`, `${line} — Master<br/>`), /seule sur sa ligne|Master/],
      ['ligne en 2019-2024', ok.replace(line, 'École 42 Paris, 2019–2024'), /seule sur sa ligne/],
      ['paragraphe tronqué', ok.replace(para, `<p>${escHtml(r.paragraph[l].replace(/ ?;? ?Inception[\s\S]*$/, '.'))}</p>`), /paragraphe/],
      ['RNCP dans la méta-description', ok.replace(/(<meta name="description" content=")/, '$1RNCP 7. '), /rncp/i],
      ['Alumni', add(ok, 'Alumni'), /alumni/i],
      ['bac+5', add(ok, 'Bac +5'), /bac/i],
      ['binôme dans un script en ligne', ok.replace('</body>', '<script>self.x="fait en binôme"</script></body>'), /binôme/],
      ['pair', add(ok, 'Minishell, built as a pair.'), /pair/],
      ['étudiant', add(ok, 'Toujours étudiant.'), /étudiant/],
      ['student', add(ok, 'Still a student.'), /student/],
      ['niveau de diplôme', add(ok, 'Titre de niveau 7.'), /niveau|titre/i],
      ['diplôme', add(ok, 'Diplôme en cours.'), /diplôm/i],
      ['texte hors FAITS', add(ok, 'Piscine de 2016.'), /absent de FAITS/],
      ['h1 changé', ok.replace(/<h1>[^<]*<\/h1>/, '<h1>École 42</h1>'), /h1/],
    ];
    for (const [label, html, want] of cases) {
      if (html === ok) {
        failures.push(`${s.lang} ${label} : mutation sans effet sur la page synthétique`);
        continue;
      }
      const errors = allErrors(s, html);
      if (!errors.some((e) => want.test(e))) failures.push(`${s.lang} ${label} : non refusé (${JSON.stringify(errors).slice(0, 300)})`);
    }
  }
  assert.deepEqual(failures, []);
});

test('P3 témoin : un interdit dans le fichier .rsc de la page est refusé (FR et EN)', () => {
  const sb = makeSandbox();
  for (const s of E42_SPECS) {
    const ok = conformingPage(sb.artifact, s);
    mkdirSync(join(sb.artifact, s.dir), { recursive: true });
    writeFileSync(join(sb.artifact, s.dir, 'index.html'), ok);
    writeFileSync(join(sb.artifact, s.rsc), '1:["$","p",null,{"children":"Minishell."}]\n');
    assert.deepEqual(e42ForbiddenErrors(sb.artifact, s, ok), [], `${s.route} : base saine`);
    writeFileSync(join(sb.artifact, s.rsc), '1:["$","p",null,{"children":"Minishell, fait en binôme ; titre RNCP."}]\n');
    const errors = e42ForbiddenErrors(sb.artifact, s, ok);
    assert.ok(errors.some((e) => e.includes('fichier .rsc') && /binôme/.test(e)), `${s.route} : binôme dans le .rsc non refusé : ${JSON.stringify(errors)}`);
    assert.ok(errors.some((e) => e.includes('fichier .rsc') && /rncp/i.test(e)), `${s.route} : RNCP dans le .rsc non refusé : ${JSON.stringify(errors)}`);
  }
});
