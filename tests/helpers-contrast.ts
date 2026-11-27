// Contraste du texte des liens et boutons de l'accueil par état (repos, survol, focus, actif), calculé sur le DOM
// exporté avec la cascade de helpers-cascade.ts (audit du lot 2a, bloquant 2). Formule WCAG du test (helpers-tree).
import { wcagContrast } from './helpers-tree.ts';
import type { CssRule, HNode } from './helpers-home.ts';
import { ancestors, findAll, has } from './helpers-home.ts';
import { type Env, type RGBA, type State, backgroundColorOf, cascade, evalColor, inherited, over, statesFor } from './helpers-cascade.ts';

export interface Measure { target: string; node: string; state: State; env: string; ratio: number; fg: string; bg: string }

const hex = (c: number[]): string => '#' + c.slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
export const label = (n: HNode): string => {
  const keys = Object.keys(n.attrs).filter((k) => k.startsWith('data-') || k === 'href' || k === 'class').map((k) => (n.attrs[k] ? `${k}="${n.attrs[k]}"` : k));
  return `<${n.tag} ${keys.join(' ')}>`.slice(0, 110);
};

// Cibles : liens et boutons rendus côté serveur dans [data-home].
export function interactiveTargets(home: HNode): HNode[] {
  return findAll(home, (n) => (n.tag === 'a' && has(n, 'href')) || n.tag === 'button');
}
// Nœuds porteurs de texte d'une cible (elle-même et ses descendants qui ont du texte propre), hors <svg>.
function textNodes(t: HNode): HNode[] {
  const out: HNode[] = [];
  const visit = (n: HNode): void => {
    if (n.tag === 'svg') return;
    if (n.children.some((c) => c.tag === '#text' && c.text.trim())) out.push(n);
    for (const c of n.children) if (c.tag !== '#text') visit(c);
  };
  visit(t);
  return out;
}

export function measureContrast(home: HNode, rules: CssRule[], palette: Record<string, string>, paletteVars: Record<string, string>, env: Env, envName: string, states: State[]): { measures: Measure[]; unsupported: Set<string>; errors: string[] } {
  const measures: Measure[] = [];
  const errors: string[] = [];
  const unsupported = new Set<string>();
  const pageBacks: [string, number[]][] = [['bg', evalColor(palette.bg ?? '', new Map()).slice(0, 3)], ['bg2', evalColor(palette.bg2 ?? '', new Map()).slice(0, 3)]];
  for (const state of states) {
    for (const target of interactiveTargets(home)) {
      const c = cascade(rules, { states: statesFor(target, state), env });
      // Variables connues pour un nœud : déclarées du haut vers le bas ; la palette testée remplace celles de [data-home].
      const varsFor = (n: HNode): Map<string, string> => {
        const chain = [n, ...ancestors(n)].filter((x) => x.tag !== '#text' && x.tag !== '#root').reverse();
        const vars = new Map<string, string>();
        for (const x of chain) {
          for (const [k, d] of c.props(x)) if (k.startsWith('--')) vars.set(k, d.value);
          if (has(x, 'data-home')) for (const [k, v] of Object.entries(paletteVars)) vars.set(k, v);
        }
        return vars;
      };
      for (const node of textNodes(target)) {
        try {
          const vars = varsFor(node);
          let fgRaw = inherited(c, node, 'color');
          // currentColor / inherit : remonter au parent qui déclare une vraie couleur.
          let guard = 0;
          while (fgRaw && /^currentcolor$/i.test(fgRaw.value) && fgRaw.from.parent && guard++ < 20) fgRaw = inherited(c, fgRaw.from.parent, 'color');
          if (!fgRaw) continue;
          let fg: RGBA = evalColor(fgRaw.value, varsFor(fgRaw.from));
          let op = 1;
          for (const x of [node, ...ancestors(node)]) {
            const o = c.get(x, 'opacity');
            if (o !== undefined && Number.isFinite(parseFloat(o))) op *= parseFloat(o);
            if (x === target) break;
          }
          fg = [fg[0], fg[1], fg[2], fg[3] * op];
          // Fond : couches du nœud vers [data-home] inclus ; image ou dégradé → bg et bg2 de la palette.
          const layers: RGBA[] = [];
          let base: [string, number[]][] | null = null;
          for (const x of [node, ...ancestors(node)]) {
            if (x.tag === '#root') break;
            const raw = c.get(x, 'background-color') ?? c.get(x, 'background');
            if (raw !== undefined) {
              const col = backgroundColorOf(raw, varsFor(x));
              if (col === 'image') break;
              if (col && col[3] > 0) {
                if (col[3] >= 0.999) { base = [['fond local', col.slice(0, 3)]]; break; }
                layers.push(col);
              }
            }
            if (has(x, 'data-home')) break;
          }
          const backs = (base ?? pageBacks).map(([n, b]) => [n, layers.reduceRight((acc, l) => over(l, acc), b)] as [string, number[]]);
          for (const [bn, b] of backs) {
            const ratio = wcagContrast(over(fg, b), b);
            measures.push({ target: label(target), node: node === target ? '' : label(node), state, env: envName, ratio, fg: hex(over(fg, b)), bg: `${bn} ${hex(b)}` });
          }
        } catch (e) {
          errors.push(`${label(target)} ${state} : ${(e as Error).message}`);
        }
      }
      for (const u of c.unsupported) unsupported.add(u);
    }
  }
  return { measures, unsupported, errors };
}
