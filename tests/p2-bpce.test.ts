// Contrat du lot 2b, P2 : page BPCE (FR /fr/experiences/bpce/, EN /experiences/bpce/). Textes de FAITS.md §2
// (ou de la copie versionnée, F12) : h1, rôle et dates, paragraphe sandbox, bloc séparé sous son titre exact ;
// métadonnées cohérentes avec la page BNP ; interdits dans le texte visible, les métadonnées et le JS ; aucun logo.
// Les témoins négatifs mutent une page conforme synthétique (helpers-2b.ts) : ils ne dépendent pas du code à venir.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bpceReference } from './helpers-faits.ts';
import { assertDistExists, cleanupTempDirs, distDir, makeSandbox, pageScriptUrls } from './helpers.ts';
import type { Sandbox } from './helpers.ts';
import { parseHtml } from './helpers-home.ts';
import type { HNode } from './helpers-home.ts';
import {
  BPCE_SPECS,
  bodyHtml,
  bpceForbiddenErrors,
  conformingPage,
  escHtml,
  headErrors,
  headings,
  inlineText,
  logoErrors,
  paragraphs,
  readPage,
  textLines,
  whitelistErrors,
} from './helpers-2b.ts';
import type { DetailSpec } from './helpers-2b.ts';

after(cleanupTempDirs);

// Rôle, dates, paragraphe sandbox, titre du bloc séparé et paragraphe de planification.
function bpceStructureErrors(s: DetailSpec, html: string): string[] {
  const r = bpceReference();
  const l = s.lang;
  const errors: string[] = [];
  const need = (ok: boolean, msg: string): void => {
    if (!ok) errors.push(`${s.route} : ${msg}`);
  };
  const lines = textLines(bodyHtml(html));
  need(lines.some((x) => x.includes(r.role[l])), `rôle de FAITS §2 « ${r.role[l]} » absent du texte`);
  need(lines.some((x) => x.includes(r.dates[l])), `dates de FAITS §2 « ${r.dates[l]} » absentes du texte`);

  const doc = parseHtml(bodyHtml(html));
  const ps = paragraphs(doc);
  const sandbox = ps.filter((p) => inlineText(p) === r.sandbox[l]);
  const training = ps.filter((p) => inlineText(p) === r.training[l]);
  need(sandbox.length === 1, `un <p> au texte exact du paragraphe sandbox (FAITS §2 « Page, sandbox ${l.toUpperCase()} ») attendu, reçu ${sandbox.length}`);
  need(training.length === 1, `un <p> au texte exact du bloc de planification (FAITS §2) attendu, reçu ${training.length}`);
  need(!ps.some((p) => inlineText(p).includes(r.sandbox[l]) && inlineText(p).includes(r.training[l])), 'sandbox et planification dans le même paragraphe');
  const titles = headings(doc).filter((h) => h.tag !== 'h1' && inlineText(h) === r.trainingTitle[l]);
  need(titles.length === 1, `un titre (h2 à h6) au texte exact « ${r.trainingTitle[l]} » attendu, reçu ${titles.length}`);
  if (sandbox.length === 1 && training.length === 1 && titles.length === 1) {
    // Ordre du document entre paragraphes et titres : le titre précède directement la planification et sépare les deux blocs.
    const seq: HNode[] = [...ps, ...headings(doc)].sort((a, b) => a.start - b.start);
    const ti = seq.indexOf(titles[0] as HNode);
    const si = seq.indexOf(sandbox[0] as HNode);
    const pi = seq.indexOf(training[0] as HNode);
    need(pi === ti + 1, `le titre « ${r.trainingTitle[l]} » doit précéder directement le paragraphe de planification`);
    need(Math.min(si, pi) < ti && ti < Math.max(si, pi), 'les blocs sandbox et planification se suivent sans le titre entre eux');
  }
  return errors;
}

function pageOrError(s: DetailSpec): string {
  assertDistExists();
  const html = readPage(distDir, s.dir);
  if (html === null) assert.fail(`${s.route} : page absente (${s.dir}/index.html) : contrat lot 2b, P2`);
  return html;
}

for (const s of BPCE_SPECS) {
  test(`P2 (${s.lang}) : ${s.route} : un h1 « BPCE », lang, canonique, hreflang, <title>, description, og:* et twitter:* cohérents avec la page BNP`, () => {
    assert.deepEqual(headErrors(distDir, s, pageOrError(s)), []);
  });

  test(`P2 (${s.lang}) : ${s.route} : rôle et dates de FAITS §2, paragraphe sandbox exact, bloc séparé sous son titre exact`, () => {
    assert.deepEqual(bpceStructureErrors(s, pageOrError(s)), []);
  });

  test(`P2 (${s.lang}) : ${s.route} : aucun interdit (mieux optimisé, POC terminé/livré/abouti, Kubernetes hors contribution, OpenShift, Kata, gVisor, Podman, LangChain, LangGraph, solveur) dans le texte, les métadonnées et le JS`, () => {
    assert.deepEqual(bpceForbiddenErrors(distDir, s, pageOrError(s)), []);
  });

  test(`P2 (${s.lang}) : ${s.route} : tout le texte vient de FAITS §2 ou de la coquille commune à la page BNP`, () => {
    assert.deepEqual(whitelistErrors(distDir, s, pageOrError(s)), []);
  });

  test(`P2 (${s.lang}) : ${s.route} : aucun logo ni emblème (ni image, ni SVG, ni objet, ni style en ligne avec image)`, () => {
    assert.deepEqual(logoErrors(s, pageOrError(s)), []);
  });
}

// ---- Témoins négatifs : page conforme synthétique, puis mutations ----

let box: Sandbox | null = null;
const sandbox = (): Sandbox => (box ??= makeSandbox());
function place(s: DetailSpec, html: string): string {
  const sb = sandbox();
  mkdirSync(join(sb.artifact, s.dir), { recursive: true });
  writeFileSync(join(sb.artifact, s.dir, 'index.html'), html);
  return sb.artifact;
}
function allErrors(s: DetailSpec, html: string): string[] {
  const root = place(s, html);
  return [...headErrors(root, s, html), ...bpceStructureErrors(s, html), ...bpceForbiddenErrors(root, s, html), ...whitelistErrors(root, s, html), ...logoErrors(s, html)];
}

for (const s of BPCE_SPECS) {
  test(`P2 témoin (${s.lang}) : la page conforme synthétique (textes de FAITS §2, coquille de la page BNP) passe tous les contrôles`, () => {
    assert.deepEqual(allErrors(s, conformingPage(sandbox().artifact, s)), []);
  });
}

test('P2 témoins : chaque mutation de la page synthétique est refusée (FR et EN)', () => {
  const r = bpceReference();
  const failures: string[] = [];
  for (const s of BPCE_SPECS) {
    const l = s.lang;
    const ok = conformingPage(sandbox().artifact, s);
    const title = `<h2>${escHtml(r.trainingTitle[l])}</h2>`;
    const sandboxP = `<p>${escHtml(r.sandbox[l])}</p>`;
    const trainingP = `<p>${escHtml(r.training[l])}</p>`;
    const add = (html: string, text: string): string => html.replace('</article>', `<p>${escHtml(text)}</p></article>`);
    const cases: [string, string, RegExp][] = [
      ['titre du bloc retiré', ok.replace(title, ''), /titre/],
      ['titre déplacé avant la sandbox', ok.replace(title, '').replace(sandboxP, title + sandboxP), /précéder|sans le titre/],
      ['les deux blocs dans un seul paragraphe', ok.replace(title, '').replace(sandboxP + trainingP, `<p>${escHtml(r.sandbox[l])} ${escHtml(r.training[l])}</p>`), /même paragraphe|attendu/],
      ['titre modifié', ok.replace(title, `<h2>${escHtml(r.trainingTitle[l])} :</h2>`), /titre/],
      ['paragraphe sandbox tronqué', ok.replace(sandboxP, `<p>${escHtml(r.sandbox[l].slice(0, -12))}</p>`), /sandbox/],
      ['rôle retiré', ok.replace(escHtml(r.role[l]), ''), /rôle/],
      ['dates retirées', ok.replace(escHtml(r.dates[l]), ''), /dates/],
      ['h1 changé', ok.replace(/<h1>[^<]*<\/h1>/, '<h1>BPCE (témoin)</h1>'), /h1/],
      ['« mieux optimisé »', add(ok, 'Un planning mieux optimisé qu\'à la main.'), /mieux optimis/],
      ['« better optimised »', add(ok, 'A better optimised schedule.'), /optimi/],
      ['POC terminé', add(ok, 'Le POC était terminé.'), /terminé/],
      ['POC livré', add(ok, 'POC livré.'), /livré/],
      ['PoC completed', add(ok, 'The PoC was completed.'), /completed/],
      ['Kubernetes hors contribution', add(ok, 'Le POC tournait sur Kubernetes.'), /Kubernetes/],
      ['OpenShift dans la méta-description', ok.replace(/(<meta name="description" content=")/, '$1OpenShift. '), /openshift/i],
      ['Kata dans le texte', add(ok, 'Kata Containers.'), /kata/i],
      ['LangGraph dans un script en ligne', ok.replace('</body>', '<script>self.x="LangGraph"</script></body>'), /langgraph/i],
      ['LangChain dans le texte', add(ok, 'LangChain'), /langchain/i],
      ['gVisor et Podman', add(ok, 'gVisor, Podman'), /gvisor|podman/i],
      ['nom de solveur', add(ok, 'Solveur OR-Tools.'), /or-\?tools|absent de FAITS/],
      ['solveur dans twitter:description', ok.replace(/(<meta name="twitter:description" content=")/, '$1Gurobi '), /gurobi|twitter:description/],
      ['logo en <img>', ok.replace('<h1>', '<img src="/images/bpce.png" alt=""/><h1>'), /<img>/],
      ['emblème en <svg>', ok.replace('<h1>', '<svg viewBox="0 0 1 1"><circle r="1"/></svg><h1>'), /<svg>/],
      ['logo en style en ligne', ok.replace('<article class="story">', '<article class="story" style="background-image:url(/logo.png)">'), /style en ligne/],
      ['texte hors FAITS', add(ok, 'Phrase témoin absente de la référence.'), /absent de FAITS/],
      ['<title> hors gabarit', ok.replace(/<title>[^<]*<\/title>/, '<title>BPCE</title>'), /<title>/],
      ['og:image changée', ok.replace(/(<meta property="og:image" content=")[^"]*/, '$1https://wesper-dev.github.io/images/bpce-logo.png'), /og:image/],
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

test('P2 témoins : un interdit dans le fichier .rsc de la page ou dans un module JS qu\'elle atteint est refusé (FR et EN)', () => {
  const sb = makeSandbox(); // bac à sable propre : les modules du bac partagé restent intacts
  for (const s of BPCE_SPECS) {
    const ok = conformingPage(sb.artifact, s);
    mkdirSync(join(sb.artifact, s.dir), { recursive: true });
    writeFileSync(join(sb.artifact, s.dir, 'index.html'), ok);
    writeFileSync(join(sb.artifact, s.rsc), '1:["$","p",null,{"children":"Sandbox Docker."}]\n');
    assert.deepEqual(bpceForbiddenErrors(sb.artifact, s, ok), [], `${s.route} : base saine`);
    writeFileSync(join(sb.artifact, s.rsc), '1:["$","p",null,{"children":"Avec LangChain, le POC était livré."}]\n');
    const rsc = bpceForbiddenErrors(sb.artifact, s, ok);
    assert.ok(rsc.some((e) => e.includes('fichier .rsc') && /langchain/i.test(e)), `${s.route} : LangChain dans le .rsc non refusé : ${JSON.stringify(rsc)}`);
    assert.ok(rsc.some((e) => e.includes('fichier .rsc') && /livré/.test(e)), `${s.route} : « livré » dans le .rsc non refusé : ${JSON.stringify(rsc)}`);
    writeFileSync(join(sb.artifact, s.rsc), '1:["$","p",null,{"children":"Sandbox Docker."}]\n');
  }
  const s = BPCE_SPECS[0] as DetailSpec;
  const ok = conformingPage(sb.artifact, s);
  const url = pageScriptUrls(ok).find((u) => u.endsWith('.js'));
  assert.ok(url, 'aucun module JS référencé par la page synthétique');
  const file = join(sb.artifact, url.replace(/^\//, ''));
  writeFileSync(file, readFileSync(file, 'utf8') + '\nself.__x="OpenShift";\n');
  const js = bpceForbiddenErrors(sb.artifact, s, ok);
  assert.ok(js.some((e) => e.includes('JS de la page') && /openshift/i.test(e)), `OpenShift dans un module atteint non refusé : ${JSON.stringify(js)}`);
});
