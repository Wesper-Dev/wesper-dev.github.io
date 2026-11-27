// Lot 5, T2 (tmp/refonte-arbre/contrat-lot5.md) : contrôle de chaque PDF servi, FR et EN, dans public/cv et dans
// l'export (dist/client/cv). Contrôles K1 à K12 et K14 de deliverables/refonte-arbre/CV-PUBLIC-SPEC.md §5.1, chacun avec
// ses témoins (un PDF qui doit échouer). Lecture : Poppler pour le texte, les pages et les images ; lecteur Node versionné
// pour les liens (helpers-pdf.ts). Poppler absent = rouge qui nomme poppler-utils (la CI doit l'installer, voir t2).
// Rouge attendu avant le code : les PDF servis sont encore ceux du 29/09 (titre « Applied AI Engineer », disponibilité
// au 16 octobre, sans résumé, logos BPCE/BNP/Croix-Rouge en FR, « contributing », « 121 deterministic tests »).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertDistExists, distDir, siteDir } from './helpers.ts';
import {
  AVAILABILITY, BULLETS, CV_NAME, EXPECTED_URIS, LANGS, LINE_42, OLD_LINE_42, SUMMARY, TITLE, type Lang,
  candidatePdfs, check42, checkBpce, checkProduction, cleanLines, cleanupPdfs, count, deliverablePdf, exportedPdf, flat,
  forbiddenHits, has, mask, pdfImageCount, pdfImageObjects, pdfPages, pdfText, pdfUris, pfPdf, phoneHits, servedPdf,
  telUris, writeTestPdf,
} from './helpers-pdf.ts';

after(cleanupPdfs);
const sha = (f: string): string => createHash('sha256').update(readFileSync(f)).digest('hex');
// Les deux copies contrôlées : celle du dépôt du site et celle de l'export servi.
const copies = (l: Lang): [string, string][] => {
  assertDistExists();
  return [[`public/cv/${CV_NAME(l)}`, servedPdf(l)], [`export /cv/${CV_NAME(l)}`, exportedPdf(l)]];
};
const each = (fn: (label: string, file: string, l: Lang) => string[]): string[] =>
  LANGS.flatMap((l) => copies(l).flatMap(([label, file]) => (existsSync(file) ? fn(label, file, l).map((m) => `${label} : ${m}`) : [`${label} : fichier absent`])));
// En-tête : texte avant « Paris, France » (K3 : le titre est dans la ligne du nom).
const header = (t: string): string => flat(t).split(/Paris, France/)[0] ?? '';

// ---------------- Outillage et témoins du lecteur ----------------

test('T2 (outillage) : Poppler répond, le lecteur Node lit les liens littéraux et hexadécimaux, pdfimages et le lecteur voient une image ; témoins écrits à l\'exécution', () => {
  const w = writeTestPdf('outil.pdf', { lines: ['Arnaud DURAND | Témoin', 'Contact'], links: [{ label: 'Contact', uri: 'tel:0100000000' }, { label: 'x', uri: 'mailto:a@exemple.fr' }], image: true });
  assert.equal(pdfPages(w), 1);
  assert.ok(pdfText(w).includes('Arnaud DURAND | Témoin'), 'pdftotext ne rend pas le texte du témoin');
  assert.deepEqual(pdfUris(w), ['tel:0100000000', 'mailto:a@exemple.fr']);
  assert.equal(pdfImageCount(w), 1, 'pdfimages : 1 image attendue sur le témoin');
  assert.equal(pdfImageObjects(w), 1, 'lecteur : 1 objet image attendu sur le témoin');
  const h = writeTestPdf('hex.pdf', { lines: ['a'], hexUri: true, links: [{ label: 'a', uri: 'TEL:+33100000000' }] });
  assert.deepEqual(pdfUris(h), ['TEL:+33100000000'], 'URI hexadécimale non décodée');
  assert.equal(pdfPages(writeTestPdf('deux.pdf', { lines: ['a'], pages: 2 })), 2);
});

// ---------------- K14 : copies identiques ----------------

test('T2 (K14, Q-R8) : public/cv contient exactement les deux PDF aux mêmes noms, copiés à l\'octet dans l\'export ; identiques à PF/ et à deliverables/cv/ quand le dépôt complet est là', (t) => {
  assertDistExists();
  const want = LANGS.map(CV_NAME).sort();
  assert.deepEqual(readdirSync(join(siteDir, 'public', 'cv')).filter((f) => f.endsWith('.pdf')).sort(), want, 'public/cv');
  assert.deepEqual(readdirSync(join(distDir, 'cv')).filter((f) => f.endsWith('.pdf')).sort(), want, 'export /cv');
  for (const l of LANGS) assert.equal(sha(exportedPdf(l)), sha(servedPdf(l)), `${CV_NAME(l)} : export ≠ public/cv`);
  const full = LANGS.every((l) => existsSync(pfPdf(l)));
  if (!full) {
    t.diagnostic('dépôt limité à site/ : comparaison à PF/ et deliverables/cv/ non applicable ici');
    return;
  }
  for (const l of LANGS) {
    assert.equal(sha(servedPdf(l)), sha(pfPdf(l)), `${CV_NAME(l)} ≠ deliverables/cv/source/cv-public-platform-${l}.pdf (K14)`);
    assert.equal(sha(deliverablePdf(l)), sha(pfPdf(l)), `deliverables/cv/cv-public-platform-${l}.pdf ≠ PF/ (K14)`);
  }
});

// ---------------- K1, K2 : une page, texte, ligatures, accents ----------------

test('T2 (K1, K2) : une page ; texte extrait non vide (≥ 300 mots) ; aucune ligature U+FB00–U+FB4F ni accent décomposé ; accents et apostrophe typographique lus', () => {
  const witness = writeTestPdf('deux-pages.pdf', { lines: cleanLines('fr'), pages: 2 });
  assert.equal(pdfPages(witness), 2, 'témoin à deux pages');
  assert.ok(/[ﬀ-ﭏ]/.test('conﬁné') && !/[ﬀ-ﭏ]/.test('confiné'), 'témoin du motif de ligature');
  // Apostrophe EN : au moins une ’ entre deux lettres, aucune apostrophe droite entre deux lettres.
  const badApostrophe = (t: string): boolean => !/\p{L}’\p{L}/u.test(t) || /\p{L}'\p{L}/u.test(t);
  assert.ok(!badApostrophe('the team’s tools') && badApostrophe("the team's tools") && badApostrophe('the teams tools') && badApostrophe("the team’s tools, the app's"), 'témoins du motif d’apostrophe');
  const accents: Record<Lang, string[]> = { fr: ['Ingénieur logiciel', 'Expérience professionnelle', 'École 42 Paris', 'Disponible immédiatement', 'équipe'], en: ['École 42 Paris', 'Professional Experience'] };
  const bad = each((_, f, l) => {
    const t = pdfText(f);
    const out: string[] = [];
    if (pdfPages(f) !== 1) out.push(`${pdfPages(f)} pages (K1 : une attendue)`);
    if (t.split(/\s+/).filter(Boolean).length < 300) out.push('texte extrait trop court (K2)');
    const lig = t.match(/[ﬀ-ﭏ]/g);
    if (lig) out.push(`ligature(s) dans le texte extrait : ${[...new Set(lig)].map((c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase()).join(', ')} (K2)`);
    if (/[̀-ͯ]/.test(t)) out.push('accent décomposé (caractère combinant) dans le texte extrait');
    for (const w of accents[l]) if (!t.normalize('NFC').includes(w)) out.push(`« ${w} » absent du texte brut (accents)`);
    if (l === 'en' && badApostrophe(t)) out.push('apostrophe typographique ’ non lue, ou apostrophe droite entre deux lettres');
    return out;
  });
  assert.deepEqual(bad, []);
});

// ---------------- K3, K4 : titre et disponibilité ----------------

test('T2 (K3, Q-R10) : en-tête « Arnaud DURAND | Ingénieur logiciel » / « … | Software Engineer » ; ni « Applied AI Engineer » ni « Python » dans le titre', () => {
  for (const [l, line, ok] of [['fr', 'Arnaud DURAND | Applied AI Engineer', false], ['en', 'Arnaud DURAND | Software Engineer (Python)', false], ['en', 'Arnaud DURAND | Software Engineer', true]] as const) {
    const t = pdfText(writeTestPdf(`titre-${l}.pdf`, { lines: [line, 'Paris, France'] }));
    const pass = has(header(t), TITLE[l]) && !/applied ai|python/i.test(header(t));
    assert.equal(pass, ok, `témoin « ${line} »`);
  }
  const bad = each((_, f, l) => {
    const h = header(pdfText(f));
    const out: string[] = [];
    if (!/arnaud\s+durand/i.test(h)) out.push('nom absent de l\'en-tête');
    if (!has(h, TITLE[l])) out.push(`titre « ${TITLE[l]} » absent de l'en-tête (reçu « ${h.replace(/\s+/g, ' ').trim().slice(0, 80)} »)`);
    if (/applied\s+ai|python/i.test(h)) out.push('« Applied AI » ou « Python » dans le titre');
    return out;
  });
  assert.deepEqual(bad, []);
});

test('T2 (K4, Q-R7) : disponibilité exacte, cadratin compris ; ni « à partir du 16 », ni « from 16 October », ni aucune date de disponibilité', () => {
  const stale = (t: string): boolean => /16\s*(?:octobre|oct\.?\b|october)|(?:october|oct\.?)\s*16\b|à\s+partir\s+du|available\s+from/i.test(flat(t));
  assert.ok(stale(pdfText(writeTestPdf('dispo.pdf', { lines: ['Recherche un CDI | Disponible à partir du 16 octobre 2026'] }))), 'témoin FR');
  assert.ok(stale('Available from 16 October 2026'), 'témoin EN');
  const bad = each((_, f, l) => {
    const t = pdfText(f);
    const out: string[] = [];
    if (!has(t, AVAILABILITY[l])) out.push(`« ${AVAILABILITY[l]} » absent`);
    else if (!/(?:immédiatement|now)\s*—\s*(?:CDI|permanent)/.test(t.normalize('NFC'))) out.push('cadratin (U+2014) de la disponibilité perdu à l\'extraction');
    if (stale(t)) out.push('ancienne disponibilité datée');
    return out;
  });
  assert.deepEqual(bad, []);
});

// ---------------- K8, K9 : aucun numéro, liens ----------------

test('T2 (K8, témoins) : numéros fictifs compact, espacé, par paires à tirets, à points, 0033 espacé, +33 (0), coupé par un saut de ligne → détectés ; mesures et années du CV → non', () => {
  for (const s of ['01 00 00 00 00', '0100000000', '01-00-00-00-00', '01.00.00.00.00', '0033 1 00 00 00 00', '+33 (0)1 00 00 00 00', '01 00 00 00 00']) {
    assert.equal(phoneHits(pdfText(writeTestPdf('num.pdf', { lines: [`Contact ${s}`] }))).length, 1, `témoin « ${mask(s)} » non détecté dans un PDF`);
  }
  assert.equal(phoneHits('Contact 01 00 00\n00 00').length, 1, 'numéro coupé par un saut de ligne');
  for (const s of ['1 500 à 3 000 collaborateurs', '2019–2026', '0,30–0,40 €', '600 Go', '75+ conteneurs', '+33.5 %', '3–5 à 1–3 min']) assert.deepEqual(phoneHits(s), [], `faux positif « ${s} »`);
});

test('T2 (K8, K9) : aucun numéro dans le texte, aucune URI tel: (casse ignorée) ; témoins réels (CV de candidature, si présents) détectés, messages masqués', (t) => {
  const bad = each((_, f) => [...phoneHits(pdfText(f)).map((m) => `numéro dans le texte : ${m}`), ...telUris(pdfUris(f)).map((u) => `annotation ${u}`)]);
  assert.deepEqual(bad, []);
  const cands = candidatePdfs();
  if (!cands.length) t.diagnostic('CV de candidature absents (dépôt limité à site/) : témoins synthétiques seulement');
  for (const f of cands) {
    assert.ok(phoneHits(pdfText(f)).length >= 1, `témoin réel ${f.split('/').pop()} : numéro non détecté`);
    assert.ok(telUris(pdfUris(f)).length >= 1, `témoin réel ${f.split('/').pop()} : annotation tel: non détectée`);
  }
  const w = writeTestPdf('contact.pdf', { lines: ['Contact'], links: [{ label: 'Contact', uri: 'Tel:+33100000000' }] });
  const hits = telUris(pdfUris(w));
  assert.equal(hits.length, 1, 'témoin : tel: sous un libellé « Contact »');
  assert.ok(hits[0]!.startsWith('Tel:') && !/\d/.test(hits[0]!), `message non masqué : ${hits[0]}`);
});

test('T2 (K9) : liens actifs = courriel, site, LinkedIn, GitHub, dépôts droit-de-retard, Minishell, CroixRouge-Hackathon, My-BankBot, post Datacenter (ni plus ni moins, casse ignorée) ; mailto valide', () => {
  const want = [...new Set(EXPECTED_URIS.map((u) => u.toLowerCase()))].sort();
  const missingWitness = writeTestPdf('liens.pdf', { lines: ['a'], links: EXPECTED_URIS.filter((u) => !/minishell/i.test(u)).map((uri) => ({ label: 'a', uri })) });
  assert.notDeepEqual([...new Set(pdfUris(missingWitness).map((u) => u.toLowerCase()))].sort(), want, 'témoin sans Minishell');
  const bad = each((_, f) => {
    const got = [...new Set(pdfUris(f).map((u) => u.trim().toLowerCase()))].sort();
    const out: string[] = [];
    const miss = want.filter((u) => !got.includes(u));
    const extra = got.filter((u) => !want.includes(u)).map((u) => (u.startsWith('tel:') ? mask(u) : u));
    if (miss.length) out.push(`liens absents : ${miss.join(', ')}`);
    if (extra.length) out.push(`liens en trop : ${extra.join(', ')}`);
    for (const m of pdfUris(f).filter((u) => /^mailto:/i.test(u))) if (!/^mailto:[^\s@?]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(m)) out.push(`mailto invalide : ${m}`);
    return out;
  });
  assert.deepEqual(bad, []);
});

// ---------------- K10 : images ----------------

test('T2 (K10) : aucune image matricielle (pdfimages -list) ni objet image (lecteur Node), dans les deux langues ; témoin à une image', () => {
  const w = writeTestPdf('logo.pdf', { lines: ['BPCE'], image: true });
  assert.equal(pdfImageCount(w) + pdfImageObjects(w), 2, 'témoin à une image');
  const bad = each((_, f) => {
    const n = pdfImageCount(f);
    const o = pdfImageObjects(f);
    return n || o ? [`${n} image(s) (pdfimages), ${o} objet(s) image : aucun logo de banque ni emblème attendu (K10)`] : [];
  });
  assert.deepEqual(bad, []);
});

// ---------------- K5 : ligne 42 ----------------

test('T2 (K5, décision du 24/11) : exactement une ligne 42 de la langue, sans titre ; nulle part rncp, master, bac+5, attendu, expected, alumni, diplôme, degree, titre, obtenu, awarded, T1 2027, Q1 2027 ; témoins : chaque mot seul, ligne en double, seconde mention, titre dit attendu, titre dit obtenu, ligne de l\'autre langue', () => {
  const sample: Record<string, string> = { rncp: 'RNCP 7', master: 'Master', 'bac+5': 'Bac +5', attendu: 'attendu', expected: 'expected', alumni: 'Alumni', 'diplôm': 'Diplômé', degree: 'Degree', titre: 'Titre', obtenu: 'obtenu', awarded: 'awarded', 'T1 2027': 'T1 2027', 'Q1 2027': 'Q1 2027' };
  const word = (w: string): string => `K5 : « ${w} » dans le PDF public`;
  const countMsg = (n: number): string => `K5 : ligne 42 trouvée ${n} fois (1 attendue)`;
  const k5 = (name: string, lines: string[], l: Lang): string[] => check42(pdfText(writeTestPdf(name, { lines })), l);
  for (const l of LANGS) {
    const base = cleanLines(l);
    const other = l === 'fr' ? 'en' : 'fr';
    const swap = (line: string): string[] => base.map((x) => (x === LINE_42[l] ? line : x));
    assert.deepEqual(k5(`42-${l}.pdf`, base, l), [], `témoin propre ${l}`);
    // Chaque mot de la décision, seul, sur une ligne à part : la ligne 42 reste exacte, seul ce mot doit être signalé.
    // La liste vient du test (sample), pas de DEGREE_WORDS : un mot retiré du contrôle garde son témoin.
    for (const [w, line] of Object.entries(sample)) assert.deepEqual(k5(`42w-${l}.pdf`, [...base, line], l), [word(w)], `témoin « ${w} » seul ${l}`);
    assert.deepEqual(k5(`42cut-${l}.pdf`, [...base, 'disponible T1', '2027'], l), [word('T1 2027')], `témoin « T1 2027 » coupé par un retour à la ligne ${l}`);
    assert.deepEqual(k5(`42dup-${l}.pdf`, [...base, LINE_42[l]], l), [countMsg(2)], `témoin ligne 42 en double ${l}`);
    const second = k5(`42b-${l}.pdf`, [...base, l === 'fr' ? 'Master informatique (RNCP 7)' : 'Master’s degree (RNCP 7)'], l);
    for (const w of ['rncp', 'master']) assert.ok(second.includes(word(w)), `témoin seconde mention ${l} : « ${w} » non signalé (${JSON.stringify(second)})`);
    const expected = k5(`42c-${l}.pdf`, swap(OLD_LINE_42[l]), l);
    for (const m of [countMsg(0), word(l === 'fr' ? 'attendu' : 'expected'), word(l === 'fr' ? 'T1 2027' : 'Q1 2027'), word('rncp')]) assert.ok(expected.includes(m), `témoin titre dit attendu (ancienne ligne) ${l} : « ${m} » manquant (${JSON.stringify(expected)})`);
    const awarded = k5(`42d-${l}.pdf`, swap(`${LINE_42[l]} ${l === 'fr' ? 'Titre RNCP 7 obtenu en 2026.' : 'Master’s-level qualification (RNCP 7) awarded in 2026.'}`), l);
    assert.ok(!awarded.some((m) => m.startsWith('K5 : ligne 42')) && awarded.includes(word(l === 'fr' ? 'obtenu' : 'awarded')), `témoin titre dit obtenu ${l} (${JSON.stringify(awarded)})`);
    assert.deepEqual(k5(`42e-${l}.pdf`, swap(LINE_42[other]), l), [countMsg(0)], `témoin ligne de l'autre langue ${l}`);
  }
  const bad = each((_, f, l) => check42(pdfText(f), l));
  assert.deepEqual(bad, []);
});

// ---------------- K6, K7 : BNP et BPCE ----------------

test('T2 (K6, tour Z1) : résumé du §3.3 présent ; BNP « validé pour la production » / « approved for production », aucune autre forme de « production » ; témoins : PDF sans résumé, ancien résumé « en production », « tourne en production », ancienne puce et ancien résumé « mis en production » / « released to production »', () => {
  for (const l of LANGS) {
    const base = cleanLines(l);
    assert.deepEqual(checkProduction(pdfText(writeTestPdf(`k6-${l}.pdf`, { lines: base })), l), [], `témoin propre ${l}`);
    assert.notDeepEqual(checkProduction(pdfText(writeTestPdf(`k6a-${l}.pdf`, { lines: base.filter((x) => x !== SUMMARY[l]) })), l), [], `témoin sans résumé ${l}`);
    const old = l === 'fr' ? 'Développeur Python : un outil LLM en production avec une application React.' : 'Python developer: an LLM tool in production with a React app.';
    assert.notDeepEqual(checkProduction(pdfText(writeTestPdf(`k6b-${l}.pdf`, { lines: [...base, old] })), l), [], `témoin ancien résumé ${l}`);
    const present = l === 'fr' ? 'L’outil tourne en production.' : 'The tool runs in production.';
    assert.notDeepEqual(checkProduction(pdfText(writeTestPdf(`k6c-${l}.pdf`, { lines: [...base, present] })), l), [], `témoin présent ${l}`);
    // Tour Z (Z1) : l'ancienne formulation BNP, ajoutée ou à la place de la nouvelle, est refusée.
    const z1 = l === 'fr' ? 'Mis en production après comité de pilotage, avec env. 95 % d’accord des analystes.' : 'Released to production after steering-committee approval, with about 95% analyst agreement.';
    assert.notDeepEqual(checkProduction(pdfText(writeTestPdf(`k6d-${l}.pdf`, { lines: [...base, z1] })), l), [], `témoin Z1 ancienne puce ajoutée ${l}`);
    const swap = (x: string): string => (l === 'fr' ? x.replace('Validé pour la production par le comité de pilotage', 'Mis en production après comité de pilotage').replace('validé pour la production dans une banque par le comité de pilotage', 'mis en production dans une banque après comité de pilotage') : x.replace('Approved for production by the steering committee', 'Released to production after steering-committee approval').replace('approved for production at a bank by the steering committee', 'released to production at a bank after steering-committee approval'));
    const swapped = base.map(swap);
    assert.notDeepEqual(swapped, base, `témoin Z1 sans effet ${l}`);
    assert.notDeepEqual(checkProduction(pdfText(writeTestPdf(`k6e-${l}.pdf`, { lines: swapped })), l), [], `témoin Z1 ancienne formulation à la place de la nouvelle ${l}`);
  }
  const bad = each((_, f, l) => checkProduction(pdfText(f), l));
  assert.deepEqual(bad, []);
});

test('T2 (K7) : BPCE au passé (EN « contributed », jamais « contributing ») ; POC jamais dit terminé ni livré ; « mieux optimisé » absent ; puces BPCE du §3.4', () => {
  for (const l of LANGS) {
    const base = cleanLines(l);
    assert.deepEqual(checkBpce(pdfText(writeTestPdf(`k7-${l}.pdf`, { lines: base })), l), [], `témoin propre ${l}`);
    const bpceAt = base.indexOf('BPCE') + 1;
    const add = (x: string): string[] => [...base.slice(0, bpceAt), x, ...base.slice(bpceAt)];
    for (const x of l === 'fr' ? ['POC terminé et livré à l’équipe infra.', 'au résultat mieux optimisé qu’à la main.'] : ['contributing to Kubernetes deployment design.', 'The PoC was completed and delivered.']) {
      assert.notDeepEqual(checkBpce(pdfText(writeTestPdf(`k7x-${l}.pdf`, { lines: add(x) })), l), [], `témoin « ${x} »`);
    }
  }
  const bad = each((_, f, l) => checkBpce(pdfText(f), l));
  assert.deepEqual(bad, []);
});

// ---------------- Contrat T2 et K12 : interdits ; §3.4 : puces publiques ----------------

test('T2 (K12, contrat T2) : ni « Applied AI Engineer », ni date du 16 octobre, ni PyTorch, LeRobot, LangChain, LangGraph, OpenShift, multi-thread, vLLM, Kata, gVisor, Podman, « déterministes », « 121 », « 120+ », Pokémon, « Développeur Python », Alumni', () => {
  assert.deepEqual(forbiddenHits(pdfText(writeTestPdf('k12.pdf', { lines: cleanLines('en') }))), [], 'témoin propre');
  assert.deepEqual(forbiddenHits('PyTorch, LeRobot, 121 deterministic tests, 120+ offline'), ['PyTorch', 'LeRobot', 'déterministe / deterministic', '121 (forme datée du nombre de tests)', '120+'], 'témoin interdits');
  const bad = each((_, f) => forbiddenHits(pdfText(f)).map((n) => `interdit : ${n}`));
  assert.deepEqual(bad, []);
});

test('T2 (§3.4, contrat T2) : « plus de 120 tests » ; puces publiques exactes (droit-de-retard 2, Croix-Rouge 2, BNP 2) ; Minishell et Fitness 42 présents', () => {
  const bad = each((_, f, l) => {
    const t = pdfText(f);
    const out = Object.entries(BULLETS[l]).filter(([, v]) => !has(t, v)).map(([k, v]) => `${k} : « ${v.slice(0, 60)}… » absent`);
    const n = count(t, l === 'fr' ? 'plus de 120 tests hors ligne' : 'more than 120 offline tests');
    if (n < 2) out.push(`« plus de 120 tests hors ligne » trouvé ${n} fois (résumé et puce droit-de-retard attendus)`);
    if (!/50\+\s*(?:séances|sessions)/i.test(flat(t))) out.push('Fitness 42 : « 50+ séances / sessions » absent');
    return out;
  });
  assert.deepEqual(bad, []);
});
