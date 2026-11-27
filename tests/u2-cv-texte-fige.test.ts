// Lot 5, U2 (tmp/refonte-arbre/arbitrage-audit-lot5.md ; audit C2) : le texte complet extrait de chaque PDF public est figé
// dans tests/fixtures/cv-public-texte-{fr,en}.txt ; toute différence de mot, de chiffre ou de ponctuation est rouge, et la
// référence ne change que par une mise à jour explicite (tests/fixtures/figer-cv-texte.ts), relue par le propriétaire.
// Les coupures de ligne et les césures ne comptent pas (forme compacte de helpers-u.ts) : U8 peut déplacer une coupure.
// La référence a été figée sur les PDF servis du 24/11 (commit 734c3e0), que U1, U3, U4 et U8 ne changent pas d'un mot
// (vérifié sur une copie conforme). Rouge attendu après le code seulement si un mot du CV change.
// Témoins : les huit réécritures de fond de l'audit (série 1 à 3), le texte caché de l'en-tête et le numéro entre
// parenthèses, appliqués à la référence, rougissent ; une remise en page (coupures, césure, espaces insécables) ne rougit pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { assertDistExists } from './helpers.ts';
import { AVAILABILITY, CV_NAME, LANGS, LINE_42, SUMMARY, TITLE, exportedPdf, has, pdfText, servedPdf, type Lang } from './helpers-pdf.ts';
import { FIGER_CV, cvCompact, firstDiff, readReference } from './helpers-u.ts';

// Réécritures de l'audit (mutations.py, séries 1 à 3), telles que pdftotext les rendrait. [nom, avant, après].
const MUTATIONS: Record<Lang, [string, string, string][]> = {
  fr: [
    ['staging-retire', 'l’hôte de staging des outils', 'l’hôte des outils'],
    ['binome-retire-puce-bnp', 'dans une application React faite en binôme.', 'dans mon application React.'],
    ['bpce-fr-sans-poc', 'Conçu une sandbox Docker de POC', 'Conçu la sandbox Docker'],
    ['croix-rouge-rag-seul', 'et co-construit son RAG', 'et développé son RAG'],
    ['bnp-95-precision', 'env. 95 % d’accord des analystes', '95 % de précision'],
    ['langfuse-15-poc', 'adopté par 5 POC', 'adopté par 15 POC'],
    ['ligne-42-niveau-7', 'UNIX/POSIX, concurrence.', 'UNIX/POSIX, concurrence. Niveau 7.'],
    ['texte-cache-en-tete', 'github.com/Wesper-Dev', 'github.com/Wesper-Dev Terraform AWS Rust Go'],
    ['numero-entre-parentheses', 'tutoriel d’équipe.', 'tutoriel d’équipe. Tél. (+33) 1 00 00 00 00'],
    ['tiret-de-plage-en-trait-union', 'de 3–5 à 1–3 min', 'de 3-5 à 1-3 min'],
  ],
  en: [
    ['staging-retire', 'Managed the staging host', 'Managed the host'],
    ['binome-retire-puce-bnp', 'in a React app built with a colleague.', 'in my React app.'],
    ['bpce-en-runtime-live-sans-poc', 'for an agent-runtime PoC', 'of the live agent runtime'],
    ['croix-rouge-rag-seul', 'and co-built its RAG', 'and its RAG'],
    ['bnp-95-precision', 'about 95% analyst agreement', '95% accuracy'],
    ['langfuse-15-poc', 'adopted by 5 PoCs', 'adopted by 15 PoCs'],
    ['ligne-42-graduated', 'C/C++, POSIX, concurrency.', 'C/C++, POSIX, concurrency. Graduated 2026.'],
    ['texte-cache-en-tete', 'github.com/Wesper-Dev', 'github.com/Wesper-Dev Terraform AWS Rust Go'],
    ['numero-entre-parentheses', 'wrote a team tutorial.', 'wrote a team tutorial. Tel. (+33) 1 00 00 00 00'],
    ['tiret-de-plage-en-trait-union', 'from 3–5 to 1–3 minutes', 'from 3-5 to 1-3 minutes'],
  ],
};
// Remise en page sans changer un mot : retour à la ligne à 60 signes, césure, espace insécable, sans saut de page final.
const rewrap = (t: string): string => {
  const out: string[] = [];
  let cur = '';
  for (const w of t.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + w).length > 60) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  return [...out, cur].join('\n');
};
const LAYOUT: Record<Lang, [string, (t: string) => string][]> = {
  fr: [
    ['retour à la ligne à 60 signes', rewrap],
    ['césure « plani-/fication »', (t) => t.replace('planification', 'plani-\nfication')],
    ['espace insécable devant « : »', (t) => t.split(' : ').join(' : ')],
    ['sans saut de page final', (t) => t.replace(/\f/g, '')],
  ],
  en: [
    ['retour à la ligne à 60 signes', rewrap],
    ['césure « infra-/structure »', (t) => t.replace('infrastructure', 'infra-\nstructure')],
    ['espaces doublés', (t) => t.replace(/ /g, '  ')],
    ['sans saut de page final', (t) => t.replace(/\f/g, '')],
  ],
};

test('U2 (référence) : deux fichiers versionnés, sortie complète de pdftotext : en-tête au titre de la langue, disponibilité, résumé, ligne 42 ; au moins 450 mots', () => {
  for (const l of LANGS) {
    const ref = readReference(l);
    const bad: string[] = [];
    if (ref.split(/\s+/).filter(Boolean).length < 450) bad.push('moins de 450 mots : texte incomplet ?');
    for (const want of [`Arnaud DURAND | ${TITLE[l]}`, AVAILABILITY[l], SUMMARY[l], LINE_42[l]]) if (!has(ref, want)) bad.push(`« ${want.slice(0, 50)}… » absent`);
    assert.deepEqual(bad, [], `référence ${l}`);
  }
});

test('U2 (témoins) : chaque réécriture de fond de l\'audit, le texte caché, le numéro et un tiret de plage changé rougissent ; une remise en page (coupures, césure, insécables, espaces) ne rougit pas', () => {
  for (const l of LANGS) {
    const ref = readReference(l);
    for (const [name, from, to] of MUTATIONS[l]) {
      assert.ok(cvCompact(ref).includes(cvCompact(from)), `témoin ${name} (${l}) : « ${from} » absent de la référence, témoin à mettre à jour`);
      const muted = cvCompact(ref).replace(cvCompact(from), cvCompact(to));
      assert.notEqual(muted, cvCompact(ref), `témoin ${name} (${l}) non détecté`);
      assert.ok(firstDiff(muted, ref).startsWith('écart'), `témoin ${name} (${l}) : message d'écart attendu`);
    }
    for (const [name, fn] of LAYOUT[l]) {
      const t = fn(ref);
      assert.notEqual(t, ref, `témoin ${name} (${l}) sans effet`);
      assert.equal(cvCompact(t), cvCompact(ref), `remise en page « ${name} » (${l}) signalée à tort`);
    }
  }
});

test('U2 : chaque PDF servi (public/cv et export /cv), FR et EN, a exactement le texte de la référence (forme compacte) ; toute différence se corrige dans le CV ou par une mise à jour explicite de la référence', () => {
  assertDistExists();
  const bad: string[] = [];
  for (const l of LANGS) {
    const ref = readReference(l);
    for (const [label, file] of [[`public/cv/${CV_NAME(l)}`, servedPdf(l)], [`export /cv/${CV_NAME(l)}`, exportedPdf(l)]] as const) {
      if (!existsSync(file)) {
        bad.push(`${label} : fichier absent`);
        continue;
      }
      const d = firstDiff(pdfText(file), ref);
      if (d) bad.push(`${label} : ${d} (texte voulu ? mettre à jour la référence : « ${FIGER_CV} », puis la faire relire)`);
    }
  }
  assert.deepEqual(bad, []);
});
