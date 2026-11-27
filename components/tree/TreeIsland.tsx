'use client';
// Client island of the tree block (contract D3, lot 2a E5.4, E6). After the HTML is painted it checks WebGL2,
// creates the canvas and loads the scene module on demand; three never reaches this chunk. States are written on
// [data-tree-hero] (data-tree-state, data-tree-reason, data-tree-profile) and announced with an arbre:state event.
// The experience list and the cards come from the server as children ([data-tree-ui], hidden and inert): the
// island shows them once the scene is ready and owns their aria-pressed and hidden attributes (E6.4).
import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { Locale } from '../../content/home';
import type { TreeUiCopy } from '../../content/tree-ui';
import { PALETTES } from '../../content/palettes';
import { chooseProfile, readFlags } from '../../lib/tree/guard.ts';
import { paintPage } from '../../lib/tree/page-colors.ts';
import type { Flags } from '../../lib/tree/guard.ts';
import { FALLBACK } from '../../lib/tree/reasons.ts';
import type { FallbackReason } from '../../lib/tree/reasons.ts';
import type { DeviceProfile } from '../../lib/tree/cloud.ts';

type TreeState = 'loading' | 'ready' | 'fallback' | 'disposed';
export type TreeSelection = { kind: 'experience' | 'skill'; id: string } | null;

// Shape of the handle returned by mountScene (lib/tree/scene.ts), declared here so that the
// island never imports the scene module statically, not even for its types.
export interface TreeHandle {
  dispose(): void;
  select(sel: TreeSelection): void;
  // Workshop commands, preview build only.
  setPalette?(id: Flags['palette']): void;
  setBackdrop?(kind: Flags['backdrop']): void;
  setGrowth?(mode: 'simple' | 'natural'): void;
  toggleAscii(v?: boolean): void;
}

export interface AtelierProps {
  handle: TreeHandle;
  flags: Flags;
  profile: DeviceProfile;
  label: string;
}

const FPS_STORAGE_KEY = 'arbre:repli';

export default function TreeIsland({ locale, ui, children }: { locale: Locale; ui: TreeUiCopy; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atelier, setAtelier] = useState<{ Panel: ComponentType<AtelierProps>; props: AtelierProps } | null>(null);

  useEffect(() => {
    const island = ref.current;
    const hero = island?.closest('[data-tree-hero]');
    const stage = island?.closest('[data-tree-stage]');
    const commands = island?.querySelector('[data-tree-ui]');
    if (!(hero instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(commands instanceof HTMLElement)) return;
    const copy = hero.querySelector<HTMLElement>('[data-tree-copy]');
    const deck = commands.querySelector<HTMLElement>('[data-tree-card]');
    const ac = new AbortController();
    const { signal } = ac;
    let alive = true;
    let handle: TreeHandle | null = null;
    let fellBack = false;
    let canvas: HTMLCanvasElement | null = null;
    let context: WebGL2RenderingContext | null = null;
    let timer = 0;
    let opener: HTMLElement | null = null; // control that opened the current card, which gets the focus back

    // ---- Commands: visible and operable in the ready state only (E5.4) ----
    const setCommands = (on: boolean): void => {
      commands.hidden = !on;
      commands.inert = !on;
    };
    const phoneLayout = matchMedia('(max-width: 1199px), (pointer: coarse)');
    const openCard = (): HTMLElement | null =>
      deck?.querySelector<HTMLElement>('article:not([hidden])') ?? hero.querySelector<HTMLElement>('article[data-card-skill]');
    const shown = (e: Element): boolean =>
      e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden],[inert]');
    // Focus inside the BNP copy when the copy gets hidden (open card in its place, phone layout): the focus goes to
    // a visible link with the same destination, or else to the button of the open experience, never to <body>
    // (audit astra C3). Run while the focused element is still the hidden one, or just after the browser blurred it.
    const keepCopyFocus = (active: Element | null = document.activeElement): void => {
      if (!copy || !(active instanceof HTMLElement) || !copy.contains(active) || shown(copy)) return;
      const href = active.getAttribute('href');
      const twin = href ? [...hero.querySelectorAll<HTMLElement>('a[href]')].find((a) => !copy.contains(a) && a.getAttribute('href') === href && shown(a)) : undefined;
      const pressed = commands.querySelector<HTMLElement>('[data-experience][aria-pressed="true"]');
      const target = twin ?? (pressed && shown(pressed) ? pressed : opener?.isConnected && shown(opener) ? opener : null);
      target?.focus();
    };
    // Height of the block at the bottom on phone (BNP copy, or the open card), followed by the row of experiences.
    // On desktop, an open card that would cover the BNP copy (narrow or low window, enlarged text spacing) takes
    // its place, as on phone: the copy is hidden until the card closes (audit Opus 4).
    // The block grows when its commands need more than the first screen (enlarged text spacing, small or low window,
    // audit astra H2, H6): on desktop the open card, top included, stays inside the block, whose overflow is hidden;
    // on phone the row of experiences and the bottom block keep under them 45 % of the first screen for the tree,
    // so that no point of a label lies under another control. Nothing changes when the room is enough.
    const row = commands.querySelector<HTMLElement>('[data-tree-experiences]');
    const fit = (open: HTMLElement | null): void => {
      const hb = hero.getBoundingClientRect();
      let need = 0;
      if (phoneLayout.matches) {
        const r = row && shown(row) ? row.getBoundingClientRect() : null;
        if (r && r.height > 0) need = Math.ceil(hb.bottom - r.top + 8);
      } else if (open) {
        const box = (open.closest<HTMLElement>('.tree-card') ?? open).getBoundingClientRect();
        if (box.height > 0) need = Math.ceil(box.bottom - hb.top + 28);
      }
      const value = need > 0 ? `${need}px` : '';
      if (hero.style.getPropertyValue('--tree-fit-h') !== value) {
        if (value) hero.style.setProperty('--tree-fit-h', value);
        else hero.style.removeProperty('--tree-fit-h');
      }
    };
    const measure = (): void => {
      const open = openCard();
      const h = (open ?? copy)?.offsetHeight ?? 0;
      if (h > 0) hero.style.setProperty('--tree-bottom-h', `${h}px`);
      fit(open);
      let cover = false;
      if (open && copy && !phoneLayout.matches) {
        const a = open.getBoundingClientRect();
        const b = copy.getBoundingClientRect();
        cover = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > -8;
      }
      hero.toggleAttribute('data-tree-cover', cover);
      keepCopyFocus();
    };
    const sizes = new ResizeObserver(measure);
    if (copy) sizes.observe(copy);
    if (deck) sizes.observe(deck);
    if (row) sizes.observe(row);
    signal.addEventListener('abort', () => sizes.disconnect(), { once: true });
    addEventListener('resize', measure, { signal });
    // The phone menu (popover) open when the layout becomes wide would stay in the top layer, out of the header:
    // it is closed (audit Opus 3; without JavaScript the menu still opens and closes natively). The Menu button
    // disappears in the wide layout: its focus goes to the first link of the navigation (audit astra C3). The other
    // way, a navigation link that disappears into the closed menu gives its focus to the Menu button (audit astra H9).
    const narrow = matchMedia('(max-width: 760px)');
    narrow.addEventListener('change', () => {
      const menu = document.getElementById('site-menu');
      if (!narrow.matches && menu?.matches(':popover-open')) menu.hidePopover();
      const active = document.activeElement;
      if (!narrow.matches && active?.matches('[data-site-menu]')) focusFirstLink();
      else if (narrow.matches && active?.matches('[data-site-link]') && !shown(active)) focusMenu();
      measure();
    }, { signal });
    const focusFirstLink = (): void => {
      [...document.querySelectorAll<HTMLElement>('[data-site-link]')].find(shown)?.focus();
    };
    const focusMenu = (): void => {
      const button = document.querySelector<HTMLElement>('[data-site-menu]');
      if (button && shown(button)) button.focus();
    };
    // The browser may blur a control hidden by a layout change before the change events above run: the focus
    // that fell to <body> from the Menu button, a navigation link or the BNP copy is moved the same way.
    document.addEventListener('focusout', (e) => {
      const from = e.target;
      if (e.relatedTarget || !(from instanceof Element)) return;
      queueMicrotask(() => {
        const active = document.activeElement;
        if (active && active !== document.body) return;
        if (from.matches('[data-site-menu]') && !shown(from)) focusFirstLink();
        else if (from.matches('[data-site-link]') && !shown(from)) focusMenu();
        else keepCopyFocus(from);
      });
    }, { signal });

    // Selection made anywhere (list, label, Escape): the island reflects it on the list and the cards (E6.3, E6.5).
    const reflect = (sel: TreeSelection): void => {
      for (const b of commands.querySelectorAll<HTMLElement>('[data-experience]')) b.setAttribute('aria-pressed', String(sel?.kind === 'experience' && b.dataset.experience === sel.id));
      for (const a of commands.querySelectorAll<HTMLElement>('article[data-card]')) a.hidden = !(sel?.kind === 'experience' && a.dataset.card === sel.id);
      if (sel) hero.setAttribute('data-tree-open', sel.kind);
      else hero.removeAttribute('data-tree-open');
      const skill = hero.querySelector<HTMLElement>('article[data-card-skill]');
      if (skill) sizes.observe(skill);
      measure();
    };
    const close = (): void => {
      const back = opener;
      opener = null;
      handle?.select(null);
      if (back?.isConnected) back.focus();
    };
    commands.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const exp = t?.closest<HTMLElement>('[data-experience]');
      if (exp && handle) {
        const again = exp.getAttribute('aria-pressed') === 'true';
        opener = again ? null : exp;
        handle.select(again ? null : { kind: 'experience', id: exp.dataset.experience ?? '' });
      }
    }, { signal });
    // Close buttons of the experience cards and of the skill card (built by the scene after the labels).
    hero.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('[data-card-close]')) close();
    }, { signal });
    // A click on a label opens the skill card: the label gets the focus back on close.
    stage.addEventListener('click', (e) => {
      const label = e.target instanceof Element ? e.target.closest<HTMLElement>('.tree-label') : null;
      if (label) opener = label;
    }, { capture: true, signal });
    // Escape is listened on the document: a browser may leave the focus on <body> after a click on a button
    // (WebKit), and the card or the menu must close all the same (audit Fable F6). The open phone menu goes first
    // and gives the focus back to its button; a card closes when the focus is in the block or nowhere, never from
    // another part of the page, where the focus sent back to its opener would scroll the page up.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const active = document.activeElement;
      const nowhere = !active || active === document.body || active === document.documentElement;
      const menu = document.getElementById('site-menu');
      if (menu?.matches(':popover-open')) {
        const button = document.querySelector<HTMLElement>('[data-site-menu]');
        if (!(nowhere || menu.contains(active)) || !button || !shown(button)) return; // native light dismiss
        e.preventDefault();
        menu.hidePopover();
        button.focus();
        return;
      }
      if (hero.hasAttribute('data-tree-open') && (nowhere || hero.contains(active))) close();
    }, { signal });

    const fallbackBox = hero.querySelector<HTMLElement>('[data-tree-fallback]');
    const report = (state: TreeState, reason?: FallbackReason): void => {
      // Focus on a control that is about to disappear (E12.5, audit): the drawn fallback on the way to ready,
      // the commands, the canvas or a label on the way to the fallback.
      const active = document.activeElement;
      const inFallback = !!fallbackBox && fallbackBox.contains(active);
      const inScene = stage.contains(active) && !inFallback;
      hero.setAttribute('data-tree-state', state);
      if (reason) hero.setAttribute('data-tree-reason', reason);
      else hero.removeAttribute('data-tree-reason');
      if (state === 'ready') {
        setCommands(true);
        if (canvas) canvas.tabIndex = 0;
        if (inFallback) commands.querySelector<HTMLElement>('[data-experience]')?.focus();
      } else {
        setCommands(false);
        reflect(null);
        if (inScene && state === 'fallback') fallbackBox?.querySelector<HTMLElement>('a')?.focus();
      }
      hero.dispatchEvent(new CustomEvent('arbre:state', { bubbles: true, detail: { state, reason: reason ?? null } }));
    };
    // Fallback before the scene exists: release the context we created and remove the canvas. Once only: a module
    // delivered or refused after a context loss changes nothing (audit astra C5).
    const fallbackEarly = (reason: FallbackReason): void => {
      if (!alive || fellBack) return;
      fellBack = true;
      if (context && !context.isContextLost()) context.getExtension('WEBGL_lose_context')?.loseContext();
      canvas?.remove();
      canvas = null;
      context = null;
      report('fallback', reason);
    };

    const start = (): void => {
      if (!alive) return;
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const profile = chooseProfile({ narrow: matchMedia('(max-width: 760px)').matches, coarse: matchMedia('(pointer: coarse)').matches });
      hero.setAttribute('data-tree-profile', profile);
      const flags = readFlags(location.search, __TREE_ATELIER__);
      // Palette of the preview URL, painted before the WebGL test: loading and fallback show it too (audit).
      if (__TREE_ATELIER__) paintPage(hero, PALETTES[flags.palette], flags.backdrop, profile);
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(FPS_STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (stored === 'fps') return fallbackEarly(FALLBACK.fps);
      canvas = document.createElement('canvas');
      canvas.className = 'tree-canvas';
      canvas.tabIndex = -1; // tabbable once the scene is ready (audit)
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', ui.canvas);
      stage.appendChild(canvas);
      context = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'high-performance' });
      if (!context) return fallbackEarly(FALLBACK.noWebgl2);
      // A context lost while the scene module is still on its way (D13.4, audit astra C5): the scene listens to
      // the loss itself once mounted, this listener covers the time before.
      const early = new AbortController();
      signal.addEventListener('abort', () => early.abort(), { once: true });
      canvas.addEventListener('webglcontextlost', () => fallbackEarly(FALLBACK.contextLost), { signal: early.signal });
      report('loading');
      import('../../lib/tree/scene.ts').then(
        (mod) => {
          if (!alive || fellBack || !canvas || !context) return;
          if (context.isContextLost()) return fallbackEarly(FALLBACK.contextLost);
          early.abort();
          try {
            handle = mod.mountScene({
              root: hero, canvas, context, locale, profile, reducedMotion, flags,
              onSelect: (sel) => {
                if (alive) reflect(sel);
              },
              onState: (state, reason) => {
                if (!alive) return;
                if (state === 'fallback') {
                  // The scene has released itself: forget its handle so that nothing keeps it alive.
                  fellBack = true;
                  handle = null;
                  setAtelier(null);
                }
                report(state, reason);
              },
            });
            if (fellBack) handle = null;
          } catch {
            return fallbackEarly(FALLBACK.error);
          }
          if (__TREE_ATELIER__ && flags.atelier && handle) {
            const props: AtelierProps = { handle, flags, profile, label: ui.atelier };
            import('./AtelierPanel.tsx').then(
              (m) => {
                if (alive && hero.getAttribute('data-tree-state') !== 'fallback') setAtelier({ Panel: m.default, props });
              },
              () => undefined, // the workshop is optional: the tree works without it
            );
          }
        },
        () => fallbackEarly(FALLBACK.import),
      );
    };

    // Start after the first paint of the HTML (D3.3).
    // Two frames: the first rAF can run before the HTML is presented when hydration precedes the first paint,
    // so the second one makes sure the BNP sentence is on screen before the scene is requested (D13.1, E14.5).
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        timer = window.setTimeout(start, 0);
      });
    });
    return () => {
      alive = false;
      ac.abort();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (handle) handle.dispose();
      else {
        context?.getExtension('WEBGL_lose_context')?.loseContext();
        canvas?.remove();
      }
      report('disposed');
    };
  }, [locale, ui]);

  const Panel = atelier?.Panel;
  return (
    <div ref={ref} data-tree-island="" className="tree-island">
      {children}
      {Panel && atelier ? <Panel {...atelier.props} /> : null}
    </div>
  );
}
