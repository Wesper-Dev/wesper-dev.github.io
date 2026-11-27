// Workshop panel of the tree (contract D3.4, D13.10, lot 2a E11), preview build only: the island imports it
// with import() inside `if (__TREE_ATELIER__ && …)`, so it is absent from the public export. Palette buttons show
// PALETTES[id].name; the other labels come from content/atelier.ts, imported by this file alone. The chosen
// palette is written in the address (palette=<id>, atelier kept), so that a reload or the same address opened on
// a phone gives the same palette. The panel can be folded on phone.
import { useEffect, useRef, useState } from 'react';
import { ATELIER_LABELS } from '../../content/atelier';
import { PALETTE_ORDER, PALETTES } from '../../content/palettes';
import type { PaletteId } from '../../content/palettes';
import type { AtelierProps } from './TreeIsland';

const BACKDROPS = ['halo', 'foret', 'ciel'] as const;
const GROWTHS = [
  { value: 'simple', mode: 'simple' },
  { value: 'naturelle', mode: 'natural' },
] as const;

function remember(id: PaletteId): void {
  const url = new URL(location.href);
  url.searchParams.set('palette', id);
  if (!url.searchParams.has('atelier')) url.searchParams.set('atelier', '');
  history.replaceState(history.state, '', url.pathname + url.search.replace(/atelier=(&|$)/, 'atelier$1') + url.hash);
}

export default function AtelierPanel({ handle, flags, profile, label }: AtelierProps) {
  const [palette, setPalette] = useState<PaletteId>(flags.palette);
  const [backdrop, setBackdrop] = useState(flags.backdrop);
  const [growth, setGrowth] = useState<'simple' | 'natural'>(profile === 'phone' ? 'simple' : flags.growth ?? 'natural');
  const [ascii, setAscii] = useState(flags.ascii);
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  // The ASCII rendering can also be toggled by the A key: the button follows the state announced by the scene.
  useEffect(() => {
    const hero = ref.current?.closest('[data-tree-hero]');
    if (!hero) return;
    const ac = new AbortController();
    hero.addEventListener('arbre:ascii', (e) => setAscii((e as CustomEvent<{ ascii: boolean }>).detail.ascii), { signal: ac.signal });
    return () => ac.abort();
  }, []);
  return (
    <div ref={ref} data-tree-atelier="" className="tree-atelier" role="group" aria-label={label} data-open={open ? 'true' : 'false'}>
      <button type="button" className="tree-atelier-fold" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      <div className="tree-atelier-rows" hidden={!open}>
        <div className="tree-atelier-row">
          {PALETTE_ORDER.map((id) => (
            <button key={id} type="button" data-palette={id} aria-pressed={palette === id} onClick={() => { handle.setPalette?.(id); setPalette(id); remember(id); }}>
              {PALETTES[id].name}
            </button>
          ))}
        </div>
        <div className="tree-atelier-row">
          {BACKDROPS.map((kind) => (
            <button key={kind} type="button" data-backdrop={kind} aria-pressed={backdrop === kind} onClick={() => { handle.setBackdrop?.(kind); setBackdrop(kind); }}>
              {ATELIER_LABELS.backdrops[kind]}
            </button>
          ))}
          {profile === 'desktop'
            ? GROWTHS.map((g) => (
                <button key={g.value} type="button" data-growth={g.value} aria-pressed={growth === g.mode} onClick={() => { handle.setGrowth?.(g.mode); setGrowth(g.mode); }}>
                  {ATELIER_LABELS.growth[g.value]}
                </button>
              ))
            : null}
          <button type="button" data-ascii="" aria-pressed={ascii} onClick={() => handle.toggleAscii()}>
            {ATELIER_LABELS.ascii}
          </button>
        </div>
      </div>
    </div>
  );
}
