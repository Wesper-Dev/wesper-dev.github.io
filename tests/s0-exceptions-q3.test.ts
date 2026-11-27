// Lot 4, décisions S1 à S3 (tmp/refonte-arbre/contrat-lot4-s.md) : « Q3 reste la garde : la référence a040fb0 vaut
// toujours pour tout le reste ; les exceptions sont listées une à une ». Les exceptions sont dans
// fixtures/exceptions-s.json et appliquées par helpers-4.ts (revertNamedExceptions, revertNamedExceptionsHtml) à Q3
// et à l'empreinte des accueils (Q2). Ce fichier prouve qu'elles sont exactes et étroites :
// - la liste est figée (4 exceptions nommées : S1-en, S1-fr, S3-en, S3-fr) et chaque « ancien » est bien la valeur
//   a040fb0 de chaque route listée ;
// - la valeur nouvelle passe Q3 et Q2 sur sa route ; une troisième formulation, la valeur nouvelle sur une autre
//   route, dans l'autre langue, en double, ou l'alt nouveau sur la carte droit-de-retard rougissent.
// Lot 5 (contrat-lot5.md, T4) : la liste figée compte aussi les 14 exceptions « T3-… » (t0-exceptions-lot5.test.ts les
// contrôle) ; les témoins des accueils partent de la page dont les valeurs T3 sont ramenées à a040fb0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PAGES, HOME_ROUTES_4, NOT_FOUND, OWN_SHARE_IMAGE, contentDiffs, homeDigest, pageContent, readBaseline4, readNamedExceptions, readRoute, revertNamedExceptionsHtml } from './helpers-4.ts';
import type { NamedException } from './helpers-4.ts';
import { assertDistExists, distDir, exportModeOf } from './helpers.ts';
import { withoutFaqSection } from './helpers-6.ts';

const page = (route: string): string => {
  const html = readRoute(distDir, route);
  if (!html) throw new Error(`${route} : page absente de l'export (S, exceptions Q3)`);
  return html;
};
const byId = (id: string): NamedException => {
  const e = readNamedExceptions().find((x) => x.id === id);
  if (!e) throw new Error(`exception ${id} absente de fixtures/exceptions-s.json`);
  return e;
};
const ws = (s: string): string => s.replace(/\s+/g, ' ').trim();
// Lot 5 : ids figés des exceptions T3 (contrat-lot5.md, T3), dans l'ordre du fichier.
const T3_IDS = ['T3-python-en texte', 'T3-python-fr texte', 'T3-evals-nom-en texte', 'T3-evals-preuve-en texte', 'T3-evals-nom-fr texte', 'T3-k8s-en texte', 'T3-cv-texte-en texte', 'T3-cv-texte-fr texte', 'T3-cv-libelle-en texte', 'T3-cv-libelle-fr texte', 'T3-croix-rouge-en texte', 'T3-croix-rouge-fr texte', 'T3-description-en description', 'T3-description-fr description'];
// Lot 5, U6 (tmp/refonte-arbre/arbitrage-audit-lot5.md) : phrase de résumé du récit Croix-Rouge (u6-croix-rouge.test.ts).
const U6_IDS = ['U6-croix-rouge-en texte', 'U6-croix-rouge-fr texte'];
// Tour Z (contrat-textes-z.md, décisions d'Arnaud du 25/11) : Z4-note-* en tête du fichier (avant S1-*, elles ramènent la
// note entière), les autres à la fin ; z0-exceptions-z.test.ts les contrôle.
const Z_HEAD_IDS = ['Z4-note-en texte', 'Z4-note-fr texte'];
const Z_IDS = ['Z1-carte-en texte', 'Z1-carte-fr texte', 'Z1-phrase-en texte', 'Z1-phrase-fr texte', 'Z1-detail-en texte', 'Z1-detail-fr texte', 'Z1-description-en description', 'Z1-description-fr description', 'Z4-intro-en texte', 'Z4-intro-fr texte', 'Z4-description-en description', 'Z4-description-fr description'];
// Tour W (contrat-relecture-w.md, 26/11) : exceptions « W… » en fin de fichier (w0-exceptions-w.test.ts les contrôle).
// Elles seules peuvent viser les pages du récit droit-de-retard (graphie « droit-de-retard », W2) : la règle « hors du
// périmètre des décisions S » reste pour toutes les autres. « ancien » vide = insertion (surtitre BNP, W1 C1) ; champ
// « alt » = texte alternatif d'une image du <main>.
const W_IDS = ["W1-B1-git-en texte", "W1-B1-git-fr texte", "W1-B1-cicd-en texte", "W1-B1-cicd-fr texte", "W1-D8-langfuse-en texte", "W1-D8-langfuse-fr texte", "W1-C1-surtitre-en texte", "W1-C1-surtitre-fr texte", "W1-C2-role-en texte", "W1-C2-role-fr texte", "W1-C2-recit-en texte", "W1-C2-recit-fr texte", "W2-tests-ddr-en texte", "W2-tests-ddr-fr texte", "W2-W4-socle-ddr-en texte", "W2-W4-cout-en texte", "W2-cout-fr texte", "W2-fiche-bpce-en texte", "W2-fiche-bpce-fr texte", "W2-fiche-42-en texte", "W2-fiche-42-fr texte", "W2-ddr-accueil-en texte", "W2-ddr-accueil-fr texte", "W2-ddr-projets-en texte", "W2-ddr-projets-fr texte", "W2-ddr-suite-en texte", "W2-ddr-suite-fr texte", "W2-ddr-h1-en texte", "W2-ddr-h1-fr texte", "W2-ddr-recit-en texte", "W2-ddr-recit-fr texte", "W2-ddr-legende-en texte", "W2-ddr-legende-fr texte", "W2-ddr-alt-en alt", "W2-ddr-alt-fr alt", "W2-ddr-og-alt-en og:image:alt", "W2-ddr-og-alt-fr og:image:alt", "W2-ddr-title title", "W2-ddr-og-title og:title", "W2-ddr-twitter-title twitter:title", "W2-frc-accueil-en texte", "W2-frc-projets-en texte", "W2-frc-suite-en texte", "W2-frc-title-en title", "W2-frc-og-title-en og:title", "W2-frc-twitter-title-en twitter:title", "W3-2.5-note-fr texte", "W3-2.7-cdi-fr texte", "W3-3.2-coconstruit-fr texte", "W4-A1-compte-rendu-en texte", "W4-A1-lien-en texte", "W4-A2-lcl-en texte", "W4-A5-role-ddr-en texte", "W4-A5-h2-ddr-en texte", "W4-A5-h2-diary-en texte", "W4-A5-diary-en texte", "W4-A6-coach-en texte", "W4-A6-credits-en texte", "W4-A8-regles-en texte", "W4-A8-service-en texte", "W4-A8-depot-en texte", "W4-A9-stand-en texte", "W4-A9-personnes-en texte", "W4-A9-cadre-en texte", "W4-A9-rang-en texte", "W4-A11-accord-en texte", "W4-A12-annee-en texte", "W4-A12-gemma-en texte", "W4-A12-shipfast-en texte", "W4-A12-stationf-en texte", "W4-A12-lerobot-en texte", "W4-A12-changenow-en texte", "W4-A12-temoignages-en texte", "W4-A13-langues-en texte", "W4-A14-resume-ddr-en texte", "W4-A14-description-ddr-en description", "W4-A14-resume-diary-en texte", "W4-A14-description-diary-en description", "W4-A15-locale-en og:locale", "W4-A19-intro-en texte", "W4-A19-description-en description", "W4-A19-note-en texte"];
// Tour Z : les valeurs Z (phrase et carte BNP des accueils) sont ramenées comme les T3.
const revertT3 = (route: string, html: string): string => revertNamedExceptionsHtml(route, html, readNamedExceptions().filter((e) => e.id.startsWith('T3-') || e.id.startsWith('Z') || e.id.startsWith('W')));
const diffsOf = (route: string, html: string): string[] => {
  const want = readBaseline4().pages[exportModeOf(distDir)][route];
  if (!want) throw new Error(`${route} absente de la référence`);
  return contentDiffs(route, want, pageContent(route, html));
};
// Remplace, dans le <main>, la note a040fb0 par une autre phrase (premier bloc qui la porte).
const inMain = (html: string, fn: (main: string) => string): string => html.replace(/<main\b[\s\S]*?<\/main>/i, (m) => fn(m));
const setAlt = (html: string, v: string): string => html.replace(/(<meta\b[^>]*property="og:image:alt"[^>]*content=")[^"]*/, `$1${v}`);
// Ramène une page (avant OU après le code S) à la valeur a040fb0 de l'exception, pour que les témoins tiennent dans les deux cas.
const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toOld = (html: string, e: NamedException): string => (html.includes(e.ancien) ? html : html.replace(new RegExp(e.nouveau.split(/\s+/).map(esc).join('(?:\\s|&nbsp;)+')), e.ancien));

test('S (exceptions Q3) : liste figée de 4 exceptions nommées ; chaque « ancien » est la valeur a040fb0 de chaque route listée, dans les deux modes ; aucune ne vise la 404 ni la carte droit-de-retard', () => {
  const list = readNamedExceptions();
  assert.deepEqual(list.map((e) => `${e.id} ${e.champ}`), [...Z_HEAD_IDS, 'S1-en texte', 'S1-fr texte', 'S3-en og:image:alt', 'S3-fr og:image:alt', ...T3_IDS, ...U6_IDS, ...Z_IDS, ...W_IDS], 'exceptions à Q3 : toute exception nouvelle doit être décidée par le propriétaire et nommée ici');
  const ref = readBaseline4();
  const errors: string[] = [];
  for (const e of list) {
    for (const r of e.routes) {
      if (!ALL_PAGES.includes(r)) errors.push(`${e.id} : route inconnue ${r}`);
      if (r === NOT_FOUND || (OWN_SHARE_IMAGE.includes(r) && !e.id.startsWith('W'))) errors.push(`${e.id} : ${r} hors du périmètre des décisions S`);
      if (HOME_ROUTES_4.includes(r)) continue; // accueils : empreinte seulement (Q2), voir le test suivant
      for (const mode of ['preview', 'public'] as const) {
        const p = ref.pages[mode][r];
        if (!p) {
          errors.push(`${e.id} : ${r} absente de la référence ${mode}`);
          continue;
        }
        if (e.champ === 'texte' && e.ancien === '') {
          // Tour W : insertion ; la valeur nouvelle ne doit pas déjà être là.
          if (!e.id.startsWith('W') || p.text.split('\n').map(ws).join('\n').includes(ws(e.nouveau))) errors.push(`${e.id} : insertion « ${e.nouveau} » refusée sur ${r} (${mode})`);
        } else if (e.champ === 'alt') {
          if (!p.images.some((i) => i.alt !== null && ws(i.alt) === ws(e.ancien))) errors.push(`${e.id} : alt « ${e.ancien} » absent des images a040fb0 de ${r} (${mode})`);
        } else if (e.champ === 'texte' && e.id.startsWith('T3-')) {
          // Lot 5 : l'ancien peut être un texte de lien et revenir ailleurs (« Applied AI » est aussi un titre de groupe).
          if (!p.text.split('\n').map(ws).join('\n').includes(ws(e.ancien).trim())) errors.push(`${e.id} : « ${e.ancien} » absent du texte a040fb0 de ${r} (${mode})`);
        } else if (e.champ === 'description') {
          if (JSON.stringify((p.meta.description ?? []).map(ws)) !== JSON.stringify([ws(e.ancien)])) errors.push(`${e.id} : description a040fb0 de ${r} (${mode}) ≠ « ${e.ancien} »`);
        } else if (e.champ === 'texte') {
          const n = p.text.split('\n').map(ws).join('\n').split(ws(e.ancien)).length - 1;
          if (n !== 1) errors.push(`${e.id} : « ${e.ancien} » trouvé ${n} fois dans le texte a040fb0 de ${r} (${mode}), 1 attendu`);
        } else if (JSON.stringify((p.meta[e.champ] ?? []).map(ws)) !== JSON.stringify([ws(e.ancien)])) errors.push(`${e.id} : ${e.champ} a040fb0 de ${r} (${mode}) = ${JSON.stringify(p.meta[e.champ])}, pas « ${e.ancien} »`);
      }
    }
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('S (exceptions Q3, témoins) : la note nouvelle et l\'alt nouveau passent Q3 sur leurs routes ; troisième formulation, autre route, autre langue, double, alt nouveau sur droit-de-retard rougissent', () => {
  assertDistExists();
  const s1fr = byId('S1-fr');
  const s1en = byId('S1-en');
  const s3fr = byId('S3-fr');
  const s3en = byId('S3-en');
  // Les témoins partent de la page ramenée à a040fb0 (avant le code : telle quelle ; après : note nouvelle remise à l'ancienne).
  const fr = toOld(page('/fr/skills/'), s1fr);
  const en = toOld(page('/skills/'), s1en);
  assert.ok(fr.includes(s1fr.ancien) && en.includes(s1en.ancien), 'note de /skills/ ou /fr/skills/ introuvable (ni ancienne ni nouvelle)');
  const nouveauFr = s1fr.nouveau.replace(' ;', ' ;'); // typographie R1, comme availability.fr
  const passes: [string, string, string][] = [
    ['note FR nouvelle', '/fr/skills/', fr.replace(s1fr.ancien, nouveauFr)],
    ['note EN nouvelle', '/skills/', en.replace(s1en.ancien, s1en.nouveau)],
    ['alt FR nouveau', '/fr/projects/', setAlt(page('/fr/projects/'), s3fr.nouveau)],
    ['alt EN nouveau', '/experiences/bpce/', setAlt(page('/experiences/bpce/'), s3en.nouveau)],
  ];
  for (const [label, route, html] of passes) assert.deepEqual(diffsOf(route, html), [], `« ${label} » refusé par Q3 sur ${route}`);
  const reds: [string, string, string][] = [
    ['troisième formulation', '/fr/skills/', fr.replace(s1fr.ancien, nouveauFr.replace('immédiatement', 'dès maintenant'))],
    ['note nouvelle en plus de l\'ancienne', '/fr/skills/', inMain(fr, (m) => m.replace('</main>', `<p>${nouveauFr}</p></main>`))],
    ['note nouvelle deux fois', '/fr/skills/', inMain(fr.replace(s1fr.ancien, nouveauFr), (m) => m.replace('</main>', `<p>${nouveauFr}</p></main>`))],
    ['note nouvelle sur une autre route', '/fr/projects/', inMain(page('/fr/projects/'), (m) => m.replace('</main>', `<p>${nouveauFr}</p></main>`))],
    ['note EN sur la page FR', '/fr/skills/', fr.replace(s1fr.ancien, s1en.nouveau)],
    ['alt EN sur une page FR', '/fr/projects/', setAlt(page('/fr/projects/'), s3en.nouveau)],
    ['troisième alt', '/projects/', setAlt(page('/projects/'), 'Arnaud Durand, AI engineer')],
    ['alt nouveau sur droit-de-retard', '/projects/droit-de-retard/', setAlt(page('/projects/droit-de-retard/'), s3en.nouveau)],
  ];
  for (const [label, route, html] of reds) {
    const d = diffsOf(route, html);
    assert.ok(d.length > 0, `« ${label} » (${route}) non détecté par Q3`);
  }
});

test('S (exceptions Q2, témoins) : sur les accueils, l\'alt nouveau de la langue redonne l\'empreinte a040fb0 ; l\'alt de l\'autre langue ou une troisième formulation la changent', () => {
  assertDistExists();
  const ref = readBaseline4().homes[exportModeOf(distDir)];
  const want = { '/': byId('S3-en'), '/fr/': byId('S3-fr') } as Record<string, NamedException>;
  const other = { '/': byId('S3-fr'), '/fr/': byId('S3-en') } as Record<string, NamedException>;
  for (const route of HOME_ROUTES_4) {
    const e = want[route] as NamedException;
    // Lot 6a (V1) : la section FAQ, imposée par le contrat, est retirée d'abord (q2-coquille fait de même).
    const html = revertT3(route, setAlt(withoutFaqSection(page(route)), e.ancien)); // avant ou après le code S : alt ramené à a040fb0 ; lot 5 : valeurs T3 aussi
    assert.equal(homeDigest(html), ref[route], `${route} : la page ramenée à a040fb0 doit redonner l'empreinte de référence`);
    assert.equal(homeDigest(revertNamedExceptionsHtml(route, setAlt(html, e.nouveau))), ref[route], `${route} : alt nouveau pris pour un changement`);
    assert.notEqual(homeDigest(revertNamedExceptionsHtml(route, setAlt(html, (other[route] as NamedException).nouveau))), ref[route], `${route} : alt de l'autre langue non détecté`);
    assert.notEqual(homeDigest(revertNamedExceptionsHtml(route, setAlt(html, 'Arnaud Durand'))), ref[route], `${route} : troisième alt non détecté`);
  }
});
