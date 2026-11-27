// DOM labels of the skills (contract D17), their tooltip and the skill card (lot 2a, E6.5, E6.6). Labels follow
// their anchors, projected by the scene; sizes are measured once per key (createSizeCache) and the layout is the
// pure layoutLabels of labels.ts, run inside the usable area of the stage. No three here: the scene passes NDC
// coordinates. The experience list is server-rendered and owned by the island (lot 2a, E5.4).
import type { Locale } from '../../content/home.ts';
import { homeUi } from '../../content/home-ui.ts';
// Resolved public texts only (audit astra H11): no question id, condition or discarded variant reaches this module.
import { SKILL_LAYOUT as SKILLS } from '../../content/tree-layout.ts';
import { SKILL_TEXT } from '../../content/tree-public.ts';
import type { SkillId } from '../../content/tree.ts';
import type { DeviceProfile } from './cloud.ts';
import { createSizeCache, layoutLabels, placeTooltip, projectToScreen } from './labels.ts';
import type { LabelInput, Size, Viewport } from './labels.ts';
import type { SkillAnchor } from './skeleton.ts';

// rest: no selection; dim: outside the selection; pending: selected, front not arrived; lit: arrived.
export type LabelState = 'rest' | 'dim' | 'pending' | 'lit';

export interface LabelItem {
  id: SkillId;
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
  side: 'left' | 'right';
  state: LabelState;
  anchor: { x: number; y: number }; // projected skill point, in CSS px of the stage
}

const PRIORITY: Readonly<Record<LabelState, number>> = { lit: 3, pending: 2, rest: 1, dim: 0 };

export interface TreeLabels {
  // ndc: 3 values per skill (SKILLS order); worldX: x of each anchor after the group rotation; area: part of
  // the stage where the labels are laid out (the whole stage when absent).
  update(ndc: Float32Array, worldX: Float32Array, vp: Viewport, area?: { x: number; y: number; w: number; h: number }): void;
  setState(id: SkillId, state: LabelState): void;
  arrive(id: SkillId): void;
  setAnchors(anchors: readonly SkillAnchor[]): void;
  setSkill(id: SkillId | null): void;
  showSkillCard(id: SkillId | null): void;
  setReducedMotion(v: boolean): void;
  // Drops the measured sizes (a label box changed size after load): the next update measures them again.
  invalidateSizes(): void;
  readonly items: readonly LabelItem[];
  readonly measurements: number;
  remove(): void;
}

export function createLabels(o: {
  stage: HTMLElement;
  locale: Locale;
  anchors: readonly SkillAnchor[];
  profile: DeviceProfile;
  reducedMotion: boolean;
  signal: AbortSignal;
  onSkill(id: SkillId): void;
}): TreeLabels {
  const { stage, locale, profile, signal } = o;
  let reducedMotion = o.reducedMotion;
  const sideOf = new Map<SkillId, 'left' | 'right' | null>();
  const setAnchors = (anchors: readonly SkillAnchor[]): void => {
    for (const a of anchors) sideOf.set(a.id as SkillId, a.side);
  };
  setAnchors(o.anchors);

  // ---- Labels ----
  const layer = document.createElement('div');
  layer.className = 'tree-labels';
  // Hidden until the first placement, so that no label is ever painted at its unplaced position.
  layer.style.visibility = 'hidden';
  const buttons = new Map<SkillId, HTMLButtonElement>();
  let focused: SkillId | null = null; // its label shows its text on phone too
  const states = new Map<SkillId, LabelState>();
  for (const s of SKILLS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tree-label';
    b.dataset.skill = s.id;
    b.dataset.state = 'rest';
    // The accessible name never depends on the visible text, which is hidden at rest on phone.
    b.setAttribute('aria-label', SKILL_TEXT[s.id].label[locale]);
    b.setAttribute('aria-pressed', 'false');
    const text = document.createElement('span');
    text.className = 'tree-label-text';
    text.textContent = SKILL_TEXT[s.id].label[locale];
    b.appendChild(text);
    b.addEventListener('click', () => o.onSkill(s.id), { signal });
    b.addEventListener('animationend', () => b.classList.remove('arrive'), { signal });
    b.addEventListener('focus', () => {
      focused = s.id;
    }, { signal });
    b.addEventListener('blur', () => {
      if (focused === s.id) focused = null;
    }, { signal });
    layer.appendChild(b);
    buttons.set(s.id, b);
    states.set(s.id, 'rest');
  }

  // ---- Tooltip (E6.6): mouse hover (hover: hover, pointer: fine) and keyboard focus, never on touch ----
  const icon = (id: SkillId): HTMLElement => {
    const i = document.createElement('span');
    i.setAttribute('data-card-icon', '');
    i.setAttribute('aria-hidden', 'true');
    i.innerHTML = SKILL_TEXT[id].icon; // constant monochrome SVG of content/tree.ts (currentColor)
    return i;
  };
  const tip = document.createElement('div');
  tip.setAttribute('data-tree-tip', '');
  tip.setAttribute('role', 'tooltip');
  tip.id = `tree-tip-${locale}`;
  tip.hidden = true;
  let tipFor: SkillId | null = null;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const placeTip = (): void => {
    const b = tipFor ? buttons.get(tipFor) : null;
    if (!b) return;
    const s = stage.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    const p = placeTooltip({ left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height }, { width: tip.offsetWidth, height: tip.offsetHeight }, { width: s.width, height: s.height });
    tip.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    tip.style.transformOrigin = `${p.origin} center`;
  };
  const showTip = (id: SkillId): void => {
    const b = buttons.get(id);
    if (!b) return;
    if (tipFor && tipFor !== id) buttons.get(tipFor)?.removeAttribute('aria-describedby');
    tipFor = id;
    const text = document.createElement('span');
    text.textContent = SKILL_TEXT[id].tooltip[locale];
    const name = document.createElement('b');
    name.textContent = SKILL_TEXT[id].label[locale];
    tip.replaceChildren(icon(id), name, text);
    tip.hidden = false;
    b.setAttribute('aria-describedby', tip.id);
    placeTip();
    tip.setAttribute('data-on', '');
  };
  const hideTip = (id?: SkillId): void => {
    if (!tipFor || (id && id !== tipFor)) return;
    buttons.get(tipFor)?.removeAttribute('aria-describedby');
    tipFor = null;
    tip.hidden = true;
    tip.removeAttribute('data-on');
  };
  // The tooltip stays open while the pointer goes from the label to the bubble (WCAG 1.4.13, audit): leaving the
  // label or the bubble closes it after a short delay, cancelled by entering the other one. Escape closes it from
  // anywhere; it then reopens only on a new entry (pointerenter or focus).
  let hideTimer = 0;
  const cancelHide = (): void => {
    clearTimeout(hideTimer);
    hideTimer = 0;
  };
  const hideSoon = (id: SkillId): void => {
    cancelHide();
    hideTimer = window.setTimeout(() => {
      const b = buttons.get(id);
      if (!b?.matches(':focus-visible')) hideTip(id);
    }, 120);
  };
  for (const [id, b] of buttons) {
    b.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !fine.matches) return;
      cancelHide();
      if (tipFor !== id) showTip(id);
    }, { signal });
    b.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') hideSoon(id);
    }, { signal });
    b.addEventListener('focus', () => {
      if (b.matches(':focus-visible')) showTip(id);
    }, { signal });
    b.addEventListener('blur', () => hideTip(id), { signal });
  }
  tip.addEventListener('pointerenter', cancelHide, { signal });
  tip.addEventListener('pointerleave', () => {
    if (tipFor) hideSoon(tipFor);
  }, { signal });
  // Escape closes an open card first (handled by the island), then the tooltip. Captured on the document before
  // the island closes the card, so that one key press closes one thing.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tipFor && !stage.closest('[data-tree-open]')) {
      cancelHide();
      hideTip();
    }
  }, { capture: true, signal });

  // ---- Skill card (E6.5): built here, in a container placed after the labels, so that Tab goes from the label
  // that opened it to its Close button without leaving the block (audit Opus 7). Same place as the cards. ----
  const slot = document.createElement('div');
  slot.className = 'tree-card tree-skill-card';
  slot.setAttribute('data-tree-skill-card', '');
  slot.setAttribute('aria-live', 'polite');
  const showSkillCard = (id: SkillId | null): void => {
    if (!id) {
      slot.replaceChildren();
      return;
    }
    const art = document.createElement('article');
    art.setAttribute('data-card-skill', id);
    const h = document.createElement('h2');
    h.textContent = SKILL_TEXT[id].label[locale];
    const p = document.createElement('p');
    p.setAttribute('data-card-tip', '');
    p.textContent = SKILL_TEXT[id].tooltip[locale];
    const actions = document.createElement('div');
    actions.setAttribute('data-card-actions', '');
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('data-card-close', '');
    close.textContent = homeUi[locale].close;
    actions.appendChild(close);
    for (const n of [icon(id), h, p, actions]) art.appendChild(n);
    slot.replaceChildren(art);
  };

  // On phone only lit labels show their text (proto:87-88): the measured size depends on it.
  // The layout follows the media query of the profile live (a window resized from PC to phone width, a rotation,
  // audit): the number of points stays the one of the mount, the labels follow the layout.
  const phoneLayout = matchMedia('(max-width: 1199px), (pointer: coarse)');
  void profile;
  const textShown = (id: SkillId): boolean => !phoneLayout.matches || states.get(id) === 'lit' || focused === id;
  const sizes = createSizeCache<SkillId>(
    (id): Size => {
      const b = buttons.get(id);
      return b ? { width: b.offsetWidth, height: b.offsetHeight } : { width: 0, height: 0 };
    },
    (id) => `${id}|${textShown(id) ? 'text' : 'dot'}`,
  );
  document.fonts?.addEventListener('loadingdone', () => sizes.invalidate(), { signal });
  phoneLayout.addEventListener('change', () => sizes.invalidate(), { signal });

  stage.appendChild(layer);
  stage.appendChild(tip);
  stage.appendChild(slot);

  let items: LabelItem[] = [];
  const inputs: LabelInput[] = SKILLS.map((s) => ({ id: s.id, x: 0, y: 0, visible: false, side: 'right', width: 0, height: 0 }));

  return {
    update(ndc: Float32Array, worldX: Float32Array, vp: Viewport, area?: { x: number; y: number; w: number; h: number }): void {
      const ax = area?.x ?? 0;
      const ay = area?.y ?? 0;
      const inner: Viewport = area ? { width: area.w, height: area.h } : vp;
      SKILLS.forEach((s, k) => {
        const p = projectToScreen([ndc[3 * k], ndc[3 * k + 1], ndc[3 * k + 2]], vp);
        p.x -= ax;
        p.y -= ay;
        const size = sizes.get(s.id);
        const it = inputs[k];
        it.x = p.x;
        it.y = p.y;
        it.visible = p.visible;
        it.side = sideOf.get(s.id) ?? (worldX[k] < 0 ? 'left' : 'right');
        it.width = size.width;
        it.height = size.height;
        it.priority = PRIORITY[states.get(s.id) ?? 'rest'];
      });
      const placed = layoutLabels(inputs, inner);
      items = placed.map((pl, k) => {
        const id = SKILLS[k].id;
        const b = buttons.get(id);
        if (b) {
          b.style.transform = `translate3d(${pl.left + ax}px, ${pl.top + ay}px, 0)`;
          b.dataset.side = pl.side;
          b.style.visibility = pl.visible ? '' : 'hidden';
        }
        return { id, left: pl.left + ax, top: pl.top + ay, width: inputs[k].width, height: inputs[k].height, visible: pl.visible, side: pl.side, state: states.get(id) ?? 'rest', anchor: { x: inputs[k].x + ax, y: inputs[k].y + ay } };
      });
      layer.style.visibility = '';
      if (tipFor) placeTip();
    },
    setState(id: SkillId, state: LabelState): void {
      if (states.get(id) === state) return;
      states.set(id, state);
      const b = buttons.get(id);
      if (b) {
        b.dataset.state = state;
        if (state !== 'lit') b.classList.remove('arrive');
      }
    },
    arrive(id: SkillId): void {
      if (reducedMotion) return;
      const b = buttons.get(id);
      // The class is cleared at the end of the pulse and on every state change, so it restarts here.
      b?.classList.add('arrive');
    },
    setAnchors,
    setSkill(id: SkillId | null): void {
      for (const [sid, b] of buttons) b.setAttribute('aria-pressed', String(sid === id));
    },
    showSkillCard,
    setReducedMotion(v: boolean): void {
      reducedMotion = v;
    },
    invalidateSizes(): void {
      sizes.invalidate();
    },
    get items(): readonly LabelItem[] {
      return items;
    },
    get measurements(): number {
      return sizes.measurements;
    },
    remove(): void {
      cancelHide();
      hideTip();
      showSkillCard(null);
      layer.remove();
      tip.remove();
      slot.remove();
    },
  };
}
