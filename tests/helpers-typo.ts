// Lot 4, corrections d'audit, R1 (tmp/refonte-arbre/arbitrage-audit-lot4.md) : typographie française des blancs.
// Dans un texte français, l'espace devant « : » et à l'intérieur des guillemets devient U+00A0 ; l'espace devant
// « ; », « ? » et « ! » devient U+202F. Seuls les blancs changent : aucun mot, aucun signe.
// FAITS.md (et sa copie versionnée) garde ses espaces ordinaires, comme les chaînes écrites dans les tests. Les tests
// « mot pour mot » des lots précédents restent donc indifférents au TYPE de blanc : les chaînes lues dans content/*
// par les chargeurs de modules des tests (helpers-tree.ts, helpers-scene.ts, helpers-home.ts) y ont U+00A0 et
// U+202F ramenés à l'espace ordinaire, comme le fait déjà la lecture du HTML (\s). Le type exact de chaque blanc est
// exigé par r1-typographie.test.ts seulement.
// Module sans dépendance (importé par les helpers, sans cycle).

export const NBSP = '\u00a0';
export const NNBSP = '\u202f';

// Les deux blancs insécables de R1 ramenés à l'espace ordinaire.
export const untypo = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');

// untypo sur toutes les chaînes d'une valeur (objets simples, tableaux, résultats de fonctions). Une valeur sans
// aucun blanc insécable est rendue telle quelle (même référence : objets gelés et identités conservés).
export function untypoDeep<T>(x: T, seen: Map<object, unknown> = new Map()): T {
  if (typeof x === 'string') return (/[\u00a0\u202f]/.test(x) ? untypo(x) : x) as T;
  if (typeof x === 'function') {
    const fn = x as unknown as (...a: unknown[]) => unknown;
    return function (this: unknown, ...a: unknown[]) {
      return untypoDeep(fn.apply(this, a));
    } as unknown as T;
  }
  if (!x || typeof x !== 'object') return x;
  if (seen.has(x as object)) return seen.get(x as object) as T;
  const proto = Object.getPrototypeOf(x);
  if (Array.isArray(x)) {
    seen.set(x, x);
    const out = x.map((v) => untypoDeep(v, seen));
    const changed = out.some((v, i) => v !== x[i]);
    if (changed && Object.isFrozen(x)) Object.freeze(out);
    seen.set(x, changed ? out : x);
    return (changed ? out : x) as T;
  }
  if (proto !== Object.prototype && proto !== null) return x; // Map, Set, classes : laissés tels quels
  seen.set(x as object, x);
  const entries = Object.entries(x as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'function' ? v : untypoDeep(v, seen)] as const);
  const changed = entries.some(([k, v]) => v !== (x as Record<string, unknown>)[k]);
  const out = changed ? Object.fromEntries(entries) : x;
  if (changed && Object.isFrozen(x)) Object.freeze(out); // E3.3, B8 : un objet gelé reste gelé
  seen.set(x as object, out);
  return out as T;
}

// Module de content/* vu par les tests des lots précédents : chaînes exportées et chaînes rendues par ses fonctions
// sans blanc insécable. Les autres modules (lib/*) sont rendus tels quels.
export function untypoModule<M>(rel: string, mod: M): M {
  if (!/^content\//.test(rel.replace(/^\.?\//, ''))) return mod;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mod as Record<string, unknown>)) out[k] = untypoDeep(v);
  return out as M;
}

// Tour Y (tmp/refonte-arbre/contrat-recette-y.md, Y4) : le site écrit U+2019 entre deux lettres ; FAITS.md (non modifié)
// et sa copie versionnée gardent leurs apostrophes droites. Les références lues dans FAITS par les tests de texte
// (helpers-faits.ts : faitsTree, bnpReference, faitsCommons, bpceReference, ecole42Reference, faitsCorpus ;
// helpers-tree.ts : faitsText) sont donc typographiées : U+0027 entre deux lettres → U+2019, rien d'autre. La copie
// versionnée, l'extracteur et leur comparaison (F12) restent bruts. Le type exact est exigé par y4-apostrophes.test.ts.
export const typoApos = (s: string): string => s.replace(/(?<=\p{L})'(?=\p{L})/gu, '\u2019');
export function typoAposDeep<T>(x: T): T {
  if (typeof x === 'string') return typoApos(x) as T;
  if (Array.isArray(x)) return x.map((v) => typoAposDeep(v)) as T;
  if (x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) return Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, v]) => [k, typoAposDeep(v)])) as T;
  return x;
}

// Tour Y : repli SYMÉTRIQUE des seuls changements que le contrat de recette Y impose au texte et au balisage des pages,
// appliqué des deux côtés (référence et export) par les empreintes des lots précédents (Q2 homeDigest, Q3 contentDiffs,
// V7 docs et accueils). Les références sont recalculées avec ce repli depuis les exports de leurs commits (a040fb0,
// 274537a), jamais depuis un export conforme. Ce que chaque repli efface, un test y* l'exige :
// - Y4 : apostrophe entre deux lettres, droite ou courbe, en clair ou en entité → « ' » (y4-apostrophes) ;
// - Y3 : « ↗ » → « → » (y3-fleches : règle et recensement des flèches par lien) ;
// - Y5 : U+2060 (WORD JOINER, sans chasse) retiré, s'il sert à empêcher la coupure après le tiret d'une plage de dates.
// Les espaces insécables de Y5 n'ont pas besoin de repli : ces empreintes réduisent déjà tout blanc (\s comprend U+00A0
// et U+202F).
export const foldRecetteY = (s: string): string => s.replace(/(?<=\p{L})(?:’|&#x27;|&#39;|&apos;)(?=\p{L})/gu, "'").replace(/↗/g, '→').replace(/\u2060/g, '');
// Balisage (HTML entier), en plus de foldRecetteY :
// - Y6 : aria-current="true" retiré (y6-rubrique-parente l'exige sur « Projets » des six récits) ;
// - Y10 : sur l'accueil, le bloc <div data-tree-copy> (phrase BNP et lien) remis en tête de la section [data-tree-hero],
//   où il était au départ (y10-ordre-tabulation exige qu'il vienne après la scène) ; le bloc ne contient aucun <div> ;
// - Y11 : extension de l'image du récit droit-de-retard ramenée à « .<image> » (y11-image-compressee) ;
// - Y5 : <span class="…nowrap…"> qui enveloppe une plage de dates (texte seul, avec une année) déballé
//   (y5-coupures exige la plage protégée de la coupure).
export function foldRecetteYHtml(html: string): string {
  let out = foldRecetteY(html)
    .replace(/<span class="[^"]*nowrap[^"]*">([^<]*\d{4}[^<]*)<\/span>/g, '$1').replace(/\saria-current=(["'])true\1/g, '').replace(/\/images\/droit-de-retard\.(?:png|webp|avif|jpe?g)\b/g, '/images/droit-de-retard.<image>');
  const copy = /<div\b[^>]*\bdata-tree-copy\b[^>]*>[\s\S]*?<\/div>/.exec(out);
  const hero = /<section\b[^>]*\bdata-tree-hero\b[^>]*>/.exec(out);
  if (copy && hero && copy.index > hero.index) {
    out = out.slice(0, copy.index) + out.slice(copy.index + copy[0].length);
    const at = hero.index + hero[0].length;
    out = out.slice(0, at) + copy[0] + out.slice(at);
  }
  return out;
}
