// WebGL2 scene of the tree (contract D7, D10, D12): the only module of the site that imports three.
// It is loaded on demand by the client island once the HTML is painted. Every colour sent to the
// GPU is a raw encoded sRGB component (color.ts, shaders.ts, backdrop.ts): no Color object, no
// colour-space chunk in the shaders, NoToneMapping, which reproduces the r147 chain of the
// prototype. Time comes from requestAnimationFrame timestamps, with dt capped at 0.05 s.
import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Group,
  Line,
  NoToneMapping,
  OneFactor,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Sphere,
  SRGBColorSpace,
  SrcAlphaFactor,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { IUniform } from 'three';
import type { Locale } from '../../content/home.ts';
import { PALETTES } from '../../content/palettes.ts';
import type { Palette, PaletteId } from '../../content/palettes.ts';
// Resolved public data only (audit astra H11): no question id, condition or discarded variant reaches this module.
import { SKILL_LAYOUT as SKILLS } from '../../content/tree-layout.ts';
import { LIT } from '../../content/tree-public.ts';
import type { ExperienceId, SkillId } from '../../content/tree.ts';
import { asciiCell, asciiGrid, due } from './ascii.ts';
import { buildForest, buildGround, buildSky, paintBackdrop } from './backdrop.ts';
import type { BackdropData, BackdropPart } from './backdrop.ts';
import { buildTreeData, sapMask } from './build.ts';
import type { TreeData, TreeTimings } from './build.ts';
import { CAMERA, fovFor, frameCamera, gestureLock, idleStep, orientToward, smoothing } from './camera.ts';
import { PROFILES } from './cloud.ts';
import type { DeviceProfile } from './cloud.ts';
import { applyPalette } from './color.ts';
import { paintPage } from './page-colors.ts';
import type { RGB } from './color.ts';
import { createFireflies, createSprites } from './fireflies.ts';
import { createFpsGuard } from './guard.ts';
import type { BackdropKind, Flags, GuardVerdict } from './guard.ts';
import { createLabels } from './labels-dom.ts';
import type { LabelItem, TreeLabels } from './labels-dom.ts';
import { createLeaves } from './leaves.ts';
import { FALLBACK } from './reasons.ts';
import type { FallbackReason } from './reasons.ts';
import type { Leaves } from './leaves.ts';
import { frontDistance, litInto, sapParticles } from './sap.ts';
import type { SapPath } from './sap.ts';
import {
  FOREST_FRAGMENT, FOREST_VERTEX, GROUND_FRAGMENT, GROUND_VERTEX, LEAF_FRAGMENT, LEAF_VERTEX, SAP_HEAD_LINE,
  SAP_LINE_FRAGMENT, SAP_LINE_VERTEX, SAP_POINTS_FRAGMENT, SAP_POINTS_VERTEX, SKY_FRAGMENT, SKY_VERTEX,
  TREE_FRAGMENT, TREE_VERTEX, uniformColors,
} from './shaders.ts';
import type { GrowthMode } from './skeleton.ts';
// URL of the bundled Worker module. vinext rewrites import.meta.url of application modules to a
// build-independent file:// URL, so new URL('./build.worker.ts', import.meta.url) cannot be used.
import buildWorkerUrl from './build.worker.ts?worker&url';

export type SceneState = 'loading' | 'ready' | 'fallback' | 'disposed';

export interface MountOptions {
  root: HTMLElement; // [data-tree-hero]
  canvas: HTMLCanvasElement; // already in [data-tree-stage], with its WebGL2 context
  context: WebGL2RenderingContext;
  locale: Locale;
  profile: DeviceProfile;
  reducedMotion: boolean;
  flags: Flags;
  // 'ready' once the first frame is drawn; 'fallback' first thing of a release (D10.2).
  onState(state: 'ready' | 'fallback', reason?: FallbackReason): void;
  // Called on every change of the selection, whatever its origin (label, list, Escape) (lot 2a, E6.4).
  onSelect?(sel: Selection): void;
}

export type Selection = { kind: 'experience' | 'skill'; id: string } | null;

export interface SceneHandle {
  dispose(): void;
  select(sel: Selection): void;
  // Workshop commands: preview build only (absent from the public JS, lot 2a E11.5).
  setPalette?(id: PaletteId): void;
  setBackdrop?(kind: BackdropKind): void;
  setGrowth?(mode: GrowthMode): void;
  toggleAscii(v?: boolean): void;
}

const TIMING_KEYS: readonly (keyof TreeTimings)[] = ['skeleton', 'anchors', 'cloud', 'colors', 'sapD'];
const FPS_STORAGE_KEY = 'arbre:repli';

// ---- Diagnostic (preview build only) ----

const deepFreeze = <T>(v: T): T => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v as Record<string, unknown>)) deepFreeze(x);
  }
  return v;
};

// Reader of the current scene, shared by every mount of the page.
const diagnostic: { read: (() => unknown) | null } = { read: null };

function installDiagnostic(read: () => unknown): void {
  if (!__TREE_DIAG__) return;
  diagnostic.read = read;
  if (!Object.getOwnPropertyDescriptor(window, '__arbre')) {
    // Read-only accessor: every read returns a deep-frozen snapshot of plain data.
    Object.defineProperty(window, '__arbre', { configurable: false, enumerable: false, get: () => diagnostic.read?.() });
  }
}

// Reader of a frozen value, built outside mountScene so that it keeps no scene alive.
const constant = (v: unknown): (() => unknown) => () => v;

const vec = (c: RGB): Vector3 => new Vector3(c[0], c[1], c[2]);
const arr = (v: Vector3): number[] => [v.x, v.y, v.z];

// Additive blending of three r147 for a non-premultiplied material: gl.blendFunc(SRC_ALPHA, ONE)
// on colour AND alpha, so the canvas alpha accumulates the source alpha squared. r187's
// AdditiveBlending adds the source alpha unsquared, which hides more of the CSS halo behind the
// points; the factors are therefore set explicitly (D7.3 as amended after the audit).
function pointsMaterial(vertexShader: string, fragmentShader: string, uniforms: Record<string, IUniform>): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    blendSrcAlpha: SrcAlphaFactor,
    blendDstAlpha: OneFactor,
  });
}

export function mountScene(o: MountOptions): SceneHandle {
  const { root, canvas, context, locale, profile, flags } = o;
  const stage = canvas.parentElement ?? root;
  const ac = new AbortController();
  const { signal } = ac;
  const errors: string[] = [];
  let state: SceneState = 'loading';
  let reason: FallbackReason | null = null;
  let released = false;
  // Reduced motion is read at mount on the query that the scene listens to (D10.4): the value passed by the island
  // was read before the module import, and a change made while it was loading would be lost (audit astra H3).
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  let paletteId: PaletteId = flags.palette;
  let palette: Palette = PALETTES[paletteId];
  let backdrop: BackdropKind = flags.backdrop;
  let mode: GrowthMode = profile === 'phone' ? 'simple' : flags.growth ?? PROFILES[profile].mode;
  const seed = flags.seed;
  let ascii = flags.ascii;

  // ---- Renderer (D7.1) ----
  const renderer = new WebGLRenderer({ canvas, context });
  // Layout of the page, followed live (resize from PC to phone width, rotation): the number of points stays the
  // one of the mount profile; the framing, the usable area and the pixel-ratio cap follow the layout (audits).
  const phoneLayout = matchMedia('(max-width: 1199px), (pointer: coarse)');
  const layout = (): DeviceProfile => (phoneLayout.matches ? 'phone' : 'desktop');
  const pixelRatio = (): number => Math.min(devicePixelRatio, layout() === 'phone' ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio());
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.debug.onShaderError = (): void => {
    errors.push('shader compilation failed');
    queueMicrotask(() => release(FALLBACK.error));
  };
  // GPU of the diagnostic (preview build only), read on the first read of the diagnostic, never at load: Firefox
  // warns on every read of WEBGL_debug_renderer_info (audit Fable F7).
  let gpu: { renderer: string; vendor: string; maxPointSize: number } | null = null;
  const readGpu = __TREE_DIAG__
    ? (): void => {
        if (gpu || context.isContextLost()) return;
        const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
        const pointRange = context.getParameter(context.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
        gpu = {
          renderer: String(debugInfo ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)),
          vendor: String(debugInfo ? context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : context.getParameter(context.VENDOR)),
          maxPointSize: pointRange ? pointRange[1] : 1,
        };
      }
    : null;

  const scene = new Scene();
  const group = new Group();
  scene.add(group);
  const camera = new PerspectiveCamera(fovFor(1), 1, CAMERA.near, CAMERA.far);

  // ---- Uniforms: uPx is shared by every material, colours are raw encoded sRGB vectors ----
  const colorsU = uniformColors(palette);
  const uPx = { value: renderer.getPixelRatio() };
  const uPxSap = { value: renderer.getPixelRatio() }; // scaled apart in ASCII mode (D16.4)
  const uTime = { value: 0 }; // ambient clock: shimmer of the tree, forest and sky, frozen at rest (WCAG 2.2.2)
  const uSapTime = { value: 0 }; // clock of the sap pulse, started by a selection: never frozen
  const uFront = { value: 0 };
  const uHiMix = { value: 0 };
  const uGain = { value: PROFILES[profile].gain };
  const uProg = { value: 1 }; // the tree is formed from the first frame; lot 3 animates the entry
  const uWarm = { value: vec(colorsU.uWarm) };
  const uSapA = { value: vec(colorsU.uSapA) };
  const uSapB = { value: vec(colorsU.uSapB) };

  const treeMat = pointsMaterial(TREE_VERTEX, TREE_FRAGMENT, { uProg, uTime, uHiMix, uPx, uGain, uFront, uWarm });
  const sapLineMat = pointsMaterial(SAP_LINE_VERTEX, SAP_LINE_FRAGMENT, { uFront, uSapA, uSapB });
  const sapPtsMat = pointsMaterial(SAP_POINTS_VERTEX, SAP_POINTS_FRAGMENT, { uFront, uTime: uSapTime, uPx: uPxSap, uSapA, uSapB });
  const groundMat = pointsMaterial(GROUND_VERTEX, GROUND_FRAGMENT, { uPx });
  const forestMat = pointsMaterial(FOREST_VERTEX, FOREST_FRAGMENT, { uTime, uPx });
  const skyMat = pointsMaterial(SKY_VERTEX, SKY_FRAGMENT, { uTime, uPx });
  const leafMat = pointsMaterial(LEAF_VERTEX, LEAF_FRAGMENT, { uPx });
  const materials = [treeMat, sapLineMat, sapPtsMat, groundMat, forestMat, skyMat, leafMat];

  // ---- State of the scene ----
  let data: TreeData | null = null;
  let treeGeo: BufferGeometry | null = null;
  let treeObj: Points | null = null;
  const sapGroup = new Group();
  group.add(sapGroup);
  let paths: SapPath[] = [];
  let sapCounts = 0;
  let maxFront = 0;
  let startedAt: number | null = null;
  let arrivedAt: number | null = null;
  let sapFrames = 0;
  let litBuf = new Uint8Array(0);
  const litLabels = new Set<SkillId>();
  let hiTarget = 0;
  const selection: { experience: ExperienceId | null; skill: SkillId | null } = { experience: null, skill: null };

  const backdropObjs: Partial<Record<BackdropPart, { data: BackdropData; colors: Float32Array; geo: BufferGeometry; obj: Points }>> = {};
  let leaves: Leaves | null = null;
  let leafGeo: BufferGeometry | null = null;
  let leafObj: Points | null = null;
  let leafUploads = 0;

  let labels: TreeLabels | null = null;
  const ndc = new Float32Array(3 * SKILLS.length);
  const worldX = new Float32Array(SKILLS.length);
  const tmp = new Vector3();

  let rotY: number = CAMERA.rotStart;
  let targetRot: number = CAMERA.rotStart;
  let idle = 0;
  // Seconds since the last interaction (selection, drag, arrow, A), selection open or not: once the idle rotation
  // has stopped (idleDelay + idleStop), every automatic motion stops with it and the image stays still until the next
  // interaction (audit astra H4, WCAG 2.2.2). The sap of a selection, started by the user, keeps its own clock.
  let rest = 0;
  let drag: { id: number; x0: number; y0: number; lastX: number; lock: 'pending' | 'rotate' | 'scroll' } | null = null;
  const camTarget = { fov: camera.fov, r: 20, y: 4, look: 4 };
  const camCur = { ...camTarget };
  let stageW = 1;
  let stageH = 1;

  let raf = 0;
  let lastTs = 0;
  let frames = 0;
  let points = 0;
  let drawCalls = 0;
  let offscreen = false;
  let hidden = document.hidden;
  const guard = createFpsGuard();
  let verdict: GuardVerdict = 'pending';
  const timings = { skeleton: 0, anchors: 0, cloud: 0, colors: 0, sapD: 0, upload: 0, firstFrame: 0 };
  let resizeObserver: ResizeObserver | null = null;
  let viewObserver: IntersectionObserver | null = null;
  let worker: Worker | null = null;
  let request = 0;
  let growth = 0; // number of the latest growth request: an older result is dropped
  let finalSnapshot: unknown = null;
  let releasedInfo: { geometries: number; programs: number; raf: boolean; listeners: 'aborted' | 'active'; canvas: boolean } | null = null;

  // ---- Overlays: ASCII and fireflies (2D canvases, after the WebGL canvas in the DOM) ----
  const overlayRatio = (): number => Math.min(devicePixelRatio, 2);
  const asciiCanvas = document.createElement('canvas');
  asciiCanvas.className = 'tree-overlay tree-ascii';
  asciiCanvas.setAttribute('aria-hidden', 'true');
  const asciiCtx = asciiCanvas.getContext('2d');
  const flyCanvas = document.createElement('canvas');
  flyCanvas.className = 'tree-overlay tree-fireflies';
  flyCanvas.setAttribute('aria-hidden', 'true');
  const flyCtx = flyCanvas.getContext('2d');
  canvas.parentNode?.insertBefore(flyCanvas, canvas.nextSibling);
  canvas.parentNode?.insertBefore(asciiCanvas, flyCanvas);
  let grid = asciiGrid(1, 1, profile);
  let asciiRt: WebGLRenderTarget | null = null;
  let asciiBuf = new Uint8Array(0);
  let asciiBusy = false;
  let asciiLast = -Infinity;
  let asciiFrames = 0;

  const fireflies = createFireflies({ reducedMotion: false, palette, seed });
  const makeSprite = (w: number, h: number): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  // ---- Diagnostic snapshot (D12.2): preview build only, absent from the public JS (audit Fable F11) ----
  const snapshot = __TREE_DIAG__
    ? (): unknown => {
      if (finalSnapshot) return finalSnapshot;
      readGpu?.();
      const back = (part: BackdropPart): number => backdropObjs[part]?.data.count ?? 0;
      const expected = {
        tree: data?.cloud.count ?? 0,
        ground: back('ground'),
        forest: back('forest'),
        sky: back('sky'),
        leaves: leaves?.capacity ?? 0,
        sap: sapCounts,
        total: 0,
      };
      expected.total = expected.tree + expected.ground + expected.forest + expected.sky + expected.leaves + expected.sap;
      const lit = SKILLS.map((x) => x.id).filter((id) => litLabels.has(id));
      const attr = (name: string): { type: string; length: number; itemSize: number; normalized: boolean } | null => {
        const a = treeGeo?.getAttribute(name);
        return a && a instanceof BufferAttribute ? { type: a.array.constructor.name, length: a.array.length, itemSize: a.itemSize, normalized: a.normalized } : null;
      };
      return deepFreeze({
        version: 1,
        state,
        reason,
        profile,
        mode,
        seed,
        palette: paletteId,
        backdrop,
        ascii,
        reducedMotion,
        paused: pauseReason() !== null,
        pauseReason: pauseReason(),
        frames,
        points,
        drawCalls,
        expectedPoints: expected,
        pixelRatio: renderer.getPixelRatio(),
        canvas: { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight },
        rotation: rotY,
        targetRotation: targetRot,
        camera: { fov: camera.fov, r: camCur.r, y: camCur.y, look: camCur.look },
        // Shape of onSelect (lot 2a, E6.4), plus the experience and skill fields of the 1c diagnostic.
        selection: selection.experience
          ? { kind: 'experience', id: selection.experience, experience: selection.experience, skill: null }
          : selection.skill ? { kind: 'skill', id: selection.skill, experience: null, skill: selection.skill } : null,
        sap: { front: uFront.value, maxFront, lit, startedAt, arrivedAt, frames: sapFrames, complete: paths.length > 0 && arrivedAt !== null },
        fpsGuard: { frames: guard.frames, fps: guard.fps, verdict },
        timings: { ...timings },
        // anchor: projected point of each skill, in CSS px of the page (client coordinates of the stage added).
        labels: (() => {
          const r = canvas.getBoundingClientRect();
          return { measurements: labels?.measurements ?? 0, items: (labels?.items ?? []).map((i: LabelItem) => ({ ...i, anchor: { x: i.anchor.x + r.left, y: i.anchor.y + r.top } })) };
        })(),
        uniforms: {
          uWarm: arr(uWarm.value), uSapA: arr(uSapA.value), uSapB: arr(uSapB.value),
          uGain: uGain.value, uPx: uPx.value, uFront: uFront.value, uHiMix: uHiMix.value, uProg: uProg.value, uTime: uTime.value,
        },
        attributes: Object.fromEntries(['position', 'aStart', 'aColor', 'aDelay', 'aSize', 'aSapD', 'aHi'].map((n) => [n, attr(n)])),
        gpu: gpu ? { ...gpu } : null,
        memory: { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0 },
        leaves: { capacity: leaves?.capacity ?? 0, live: leaves?.live ?? 0, uploads: leafUploads },
        fireflies: { capacity: fireflies.capacity, live: fireflies.live },
        asciiFrames,
        released: releasedInfo ? { ...releasedInfo } : null,
        errors: [...errors],
      });
    }
    : null;

  let sprites: HTMLCanvasElement[] = [];
  let fliesDrawn = false;
  try {
    if (!asciiCtx || !flyCtx) throw new Error('2d canvas context unavailable');
    sprites = createSprites(palette, makeSprite);
  } catch (e) {
    // Failure during the initialisation: release what was acquired (renderer, overlays) right away.
    errors.push(`init: ${String(e)}`);
    if (snapshot) installDiagnostic(snapshot);
    release(FALLBACK.error);
    return handle();
  }

  // ---- Release (D10.2), in order, without re-entry ----
  function release(why: FallbackReason | null): void {
    if (released) return;
    released = true;
    state = why ? 'fallback' : 'disposed';
    reason = why;
    if (why) o.onState('fallback', why); // 1
    // A drag in progress ends with the scene: its listeners are about to be removed, so the block must not keep the
    // drag class (no text selection, grabbing cursor) over the fallback (audit Fable F5).
    drag = null;
    canvas.classList.remove('drag');
    root.classList.remove('tree-dragging');
    ac.abort(); // 2
    if (raf) cancelAnimationFrame(raf); // 3
    raf = 0;
    resizeObserver?.disconnect(); // 4
    viewObserver?.disconnect();
    worker?.terminate();
    worker = null;
    clearSap(); // 5
    treeGeo?.dispose();
    leafGeo?.dispose();
    for (const part of Object.keys(backdropObjs) as BackdropPart[]) disposeBackdrop(part);
    asciiRt?.dispose();
    for (const m of materials) m.dispose();
    if (readGpu) readGpu(); // before the context goes, if the diagnostic exists
    const geometries = renderer.info.memory.geometries;
    const programs = renderer.info.programs?.length ?? 0;
    const lost = context.isContextLost();
    renderer.dispose(); // 6
    if (!lost) renderer.forceContextLoss(); // a context already lost has nothing left to release
    canvas.remove(); // 7
    asciiCanvas.remove();
    flyCanvas.remove();
    labels?.remove();
    labels = null;
    releasedInfo = { geometries, programs, raf: raf !== 0, listeners: signal.aborted ? 'aborted' : 'active', canvas: canvas.isConnected };
    if (snapshot) finalSnapshot = snapshot();
    // Drop the CPU arrays and let the diagnostic read a value that keeps nothing of the scene alive.
    data = null;
    treeGeo = null;
    treeObj = null;
    leaves = null;
    leafGeo = null;
    leafObj = null;
    paths = [];
    scene.clear();
    if (snapshot && diagnostic.read === snapshot) diagnostic.read = constant(finalSnapshot);
  }

  // ---- Tree data (D15.6): built in a module Worker, on the main thread if the Worker fails ----
  function record(d: TreeData, t0: number): TreeData {
    let t = t0;
    for (const k of TIMING_KEYS) {
      timings[k] = d.timings[k];
      if (__TREE_DIAG__) performance.measure(`arbre:${k}`, { start: t, duration: d.timings[k] });
      t += d.timings[k];
    }
    return d;
  }
  function generateHere(m: GrowthMode): TreeData {
    const t0 = performance.now();
    return record(buildTreeData({ profile, mode: m, seed, palette, now: () => performance.now() }), t0);
  }
  function generate(m: GrowthMode): Promise<TreeData> {
    if (!worker) {
      try {
        worker = new Worker(buildWorkerUrl, { type: 'module' });
      } catch {
        return Promise.resolve(generateHere(m));
      }
    }
    const w = worker;
    const id = ++request;
    const t0 = performance.now();
    const asked = paletteId;
    return new Promise<TreeData>((resolve) => {
      const done = (d: TreeData | null): void => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        // The palette may have changed while the Worker was busy: colours follow the current one.
        if (d && asked !== paletteId) applyPalette(d.cloud, d.skeleton.bounds, palette, d.colors);
        resolve(d ? record(d, t0) : generateHere(m));
      };
      const onMessage = (e: MessageEvent<{ id: number; data?: TreeData; error?: string }>): void => {
        if (e.data.id !== id) return;
        if (e.data.error) errors.push(`worker: ${e.data.error}`);
        done(e.data.data ?? null);
      };
      const onError = (e: ErrorEvent): void => {
        e.preventDefault();
        worker?.terminate();
        worker = null;
        done(null);
      };
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      w.postMessage({ id, profile, mode: m, seed, palette: paletteId });
    });
  }

  function setTree(d: TreeData): void {
    if (treeObj) group.remove(treeObj);
    treeGeo?.dispose();
    data = d;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(d.cloud.positions, 3));
    g.setAttribute('aStart', new BufferAttribute(d.cloud.start, 3));
    g.setAttribute('aColor', new BufferAttribute(d.colors, 3));
    g.setAttribute('aDelay', new BufferAttribute(d.cloud.delay, 1));
    g.setAttribute('aSize', new BufferAttribute(d.cloud.size, 1));
    g.setAttribute('aHi', new BufferAttribute(d.hi, 1, true));
    g.setAttribute('aSapD', new BufferAttribute(d.sapD, 1));
    g.boundingSphere = new Sphere(new Vector3(0, 6, 0), 40); // proto:621
    treeGeo = g;
    treeObj = new Points(g, treeMat);
    group.add(treeObj);
    labels?.setAnchors(d.anchors);
    reframe();
  }

  // ---- Backdrop parts (D16.1): ground always, forest and sky on demand ----
  function ensureBackdrop(part: BackdropPart): void {
    if (backdropObjs[part]) return;
    const d = part === 'ground' ? buildGround(profile, seed) : part === 'forest' ? buildForest(profile, seed) : buildSky(profile, seed);
    const colors = paintBackdrop(part, d, palette, new Float32Array(3 * d.count));
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(d.positions, 3));
    geo.setAttribute('aR', new BufferAttribute(d.rand, 1));
    geo.setAttribute('aC', new BufferAttribute(colors, 3));
    if (part === 'forest') geo.setAttribute('aT', new BufferAttribute(d.type, 1));
    const obj = new Points(geo, part === 'ground' ? groundMat : part === 'forest' ? forestMat : skyMat);
    obj.rotation.y = Math.sin(rotY) * 0.22;
    scene.add(obj);
    backdropObjs[part] = { data: d, colors, geo, obj };
  }
  function disposeBackdrop(part: BackdropPart): void {
    const b = backdropObjs[part];
    if (!b) return;
    scene.remove(b.obj);
    b.geo.dispose();
    delete backdropObjs[part];
  }
  function applyBackdrop(): void {
    ensureBackdrop('ground');
    paintBlock();
    if (backdrop === 'foret') ensureBackdrop('forest');
    else disposeBackdrop('forest');
    if (backdrop === 'ciel') ensureBackdrop('sky');
    else disposeBackdrop('sky');
  }

  // ---- Leaves (D16.2): not created in reduced motion ----
  function setLeaves(): void {
    if (leafObj) group.remove(leafObj);
    leafGeo?.dispose();
    leafGeo = null;
    leafObj = null;
    leaves = null;
    if (reducedMotion || !data) return;
    const l = createLeaves({ profile, reducedMotion, seed, palette, cloud: data.cloud });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(l.position, 3));
    g.setAttribute('aRot', new BufferAttribute(l.rotation, 1));
    g.setAttribute('aA', new BufferAttribute(l.alpha, 1));
    g.setAttribute('aC', new BufferAttribute(l.color, 3));
    g.setAttribute('aS', new BufferAttribute(l.size, 1));
    const obj = new Points(g, leafMat);
    obj.frustumCulled = false;
    group.add(obj);
    leaves = l;
    leafGeo = g;
    leafObj = obj;
  }

  // ---- Sap (D7.7) ----
  function clearSap(): void {
    for (const child of [...sapGroup.children]) {
      sapGroup.remove(child);
      (child as Points | Line).geometry.dispose();
    }
    sapCounts = 0;
  }

  function select(skills: readonly SkillId[], experience: ExperienceId | null, skill: SkillId | null): void {
    if (!data) return;
    const changed = selection.experience !== experience || selection.skill !== skill;
    selection.experience = experience;
    selection.skill = skill;
    labels?.setSkill(skill);
    labels?.showSkillCard(skill);
    if (changed) o.onSelect?.(experience ? { kind: 'experience', id: experience } : skill ? { kind: 'skill', id: skill } : null);
    clearSap();
    paths = [];
    arrivedAt = null;
    startedAt = null;
    sapFrames = 0;
    idle = 0;
    rest = 0;
    litLabels.clear();
    if (!skills.length) {
      // The mask and the front stay as they are while uHiMix fades out.
      hiTarget = 0;
      for (const s of SKILLS) labels?.setState(s.id, 'rest');
      return;
    }
    const r = sapMask(data, skills);
    for (let k = 0; k < r.hi.length; k++) data.hi[k] = r.hi[k] * 255; // normalised Uint8: 255 is 1.0
    const hiAttr = treeGeo?.getAttribute('aHi');
    if (hiAttr) hiAttr.needsUpdate = true;
    paths = r.paths;
    litBuf = new Uint8Array(paths.length);
    const density = PROFILES[profile].sapDensity;
    for (const p of paths) {
      const lineGeo = new BufferGeometry();
      lineGeo.setAttribute('position', new BufferAttribute(p.points, 3));
      lineGeo.setAttribute('aD', new BufferAttribute(p.distances, 1));
      sapGroup.add(new Line(lineGeo, sapLineMat));
      const part = sapParticles(p, density, seed);
      const ptsGeo = new BufferGeometry();
      ptsGeo.setAttribute('position', new BufferAttribute(part.positions, 3));
      ptsGeo.setAttribute('aD', new BufferAttribute(part.distance, 1));
      ptsGeo.setAttribute('aR', new BufferAttribute(part.rand, 1));
      sapGroup.add(new Points(ptsGeo, sapPtsMat));
      sapCounts += part.count;
    }
    maxFront = Math.max(...paths.map((p) => p.length)) + SAP_HEAD_LINE;
    startedAt = performance.now();
    uFront.value = reducedMotion ? maxFront : 0;
    hiTarget = 1;
    const chosen = new Set<string>(skills);
    for (const s of SKILLS) labels?.setState(s.id, chosen.has(s.id) ? 'pending' : 'dim');
    // Face the canopy anchors of the selection, or all its anchors (proto:853-855).
    const anchors = data.anchors.filter((a) => chosen.has(a.id));
    const canopy = anchors.filter((a) => a.layer === 'canopy');
    const a = orientToward((canopy.length ? canopy : anchors).map((x) => x.position), targetRot);
    if (a !== null) targetRot = a;
  }

  const selectSkill = (id: SkillId): void => {
    if (selection.skill === id) select([], null, null);
    else select([id], null, id);
  };
  // Selection asked by the island (list, Close, Escape); unknown ids are ignored.
  function selectFrom(sel: Selection): void {
    if (released) return;
    if (!sel) select([], null, null);
    else if (sel.kind === 'experience' && Object.hasOwn(LIT, sel.id)) {
      if (selection.experience !== sel.id) select(LIT[sel.id as ExperienceId], sel.id as ExperienceId, null);
    } else if (sel.kind === 'skill' && SKILLS.some((x) => x.id === sel.id)) {
      if (selection.skill !== sel.id) select([sel.id as SkillId], null, sel.id as SkillId);
    }
  }

  // ---- Camera and size (D7.6, D9) ----
  // Usable area of the stage (lot 2a, E5.2, E6.7): the tree and its labels are framed between the columns of
  // the page on desktop (experience list on the left, card and BNP copy on the right), above the row of
  // experiences on phone. The camera keeps the framing of D9 on that area, extended to the whole canvas by a
  // view offset; the area follows the columns smoothly (at once in reduced motion), and takes the new size of the
  // stage at once when the stage itself is resized, so that no label is laid out outside it (audit astra C2).
  const area = { x: 0, y: 0, w: 1, h: 1 };
  const areaTarget = { ...area };
  let areaKey = '';
  function measureArea(snap = false): void {
    const s = canvas.getBoundingClientRect();
    if (!(s.width > 0 && s.height > 0)) return;
    const box = (sel: string): DOMRect | null => {
      const e = root.querySelector(sel);
      const r = e?.getBoundingClientRect();
      return r && r.width > 0 && r.height > 0 ? r : null;
    };
    const list = box('[data-tree-experiences]');
    const copy = box('[data-tree-copy]');
    let x0 = 0;
    let x1 = s.width;
    let y1 = s.height;
    if (layout() === 'phone') {
      // The area ends above the real row of experiences (or the bottom block): no point of a label lies under another
      // control. The island makes the block taller when this would leave the tree less than 45 % of the first screen
      // (audit astra H2).
      const top = list ? list.top : copy ? copy.top - 60 : s.bottom - 240;
      y1 = Math.max(Math.min(s.height, 48), top - s.top - 8);
    } else {
      x0 = list ? list.right - s.left + 12 : Math.min(240, s.width * 0.2);
      const cardCol = box('[data-tree-card]');
      const right = Math.min(copy ? copy.left : s.right, cardCol ? cardCol.left : s.right);
      x1 = Math.max(x0 + s.width * 0.3, right - s.left - 12);
    }
    areaTarget.x = x0;
    areaTarget.y = 0;
    areaTarget.w = x1 - x0;
    areaTarget.h = y1;
    if (snap || frames === 0 || reducedMotion) Object.assign(area, areaTarget);
    reframe();
  }
  function applyView(): void {
    const key = `${area.x.toFixed(1)}|${area.y.toFixed(1)}|${area.w.toFixed(1)}|${area.h.toFixed(1)}|${stageW}|${stageH}`;
    if (key === areaKey) return;
    areaKey = key;
    camera.aspect = area.w / area.h;
    camera.fov = fovFor(stageW / stageH); // the angle follows the canvas (D7.6), the framing the usable area
    camera.setViewOffset(area.w, area.h, -area.x, -area.y, stageW, stageH);
    camera.updateProjectionMatrix();
  }
  function reframe(): void {
    if (!data) return;
    // On desktop the area already leaves the columns out: the tree may take more of its width than D9's 0.42.
    const aspect = areaTarget.w / areaTarget.h;
    const lay = layout();
    const f = frameCamera(data.skeleton.bounds, lay === 'desktop' ? aspect * 1.4 : aspect, lay);
    // frameCamera assumes the angle of its aspect; the camera keeps the angle of the canvas (D7.6): the distance
    // is rescaled so that the tree keeps the size framed for the area.
    const fov = fovFor(stageW / stageH);
    if (f.fov !== fov) {
      const b = data.skeleton.bounds;
      const w = Math.max(b.max[0] - b.min[0] + 1.2, b.max[2] - b.min[2] + 1.2);
      const t = (deg: number): number => Math.tan((deg * Math.PI) / 360);
      f.r = (f.r - 0.3 * w) * (t(f.fov) / t(fov)) + 0.3 * w;
      f.fov = fov;
    }
    if (lay === 'phone') {
      // D9 kept the phone tree high and small to leave room for a card over it; the area now ends above the
      // row of experiences, so the tree is centred in it and a little larger.
      const b = data.skeleton.bounds;
      const shift = 0.12 * (b.max[1] - b.min[1] + 1.2);
      f.look += shift;
      f.y += shift;
      f.r *= 0.86;
    }
    Object.assign(camTarget, f);
    if (frames === 0 || reducedMotion) Object.assign(camCur, f);
  }
  function resize(w: number, h: number): void {
    if (!(w > 0 && h > 0)) return;
    stageW = w;
    stageH = h;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    uPx.value = renderer.getPixelRatio();
    uPxSap.value = renderer.getPixelRatio();
    measureArea(true);
    applyView();
    // The observer runs after this frame's requestAnimationFrame: the labels are placed again now, in the new
    // stage, so that the frame painted after the resize never shows them at their old place.
    placeLabels();
    const r = overlayRatio();
    for (const c of [asciiCanvas, flyCanvas]) {
      c.width = Math.round(w * r);
      c.height = Math.round(h * r);
    }
    grid = asciiGrid(w, h, profile);
    if (asciiRt) {
      asciiRt.setSize(grid.cols, grid.rows);
      asciiBuf = new Uint8Array(grid.cols * grid.rows * 4);
    }
  }
  resizeObserver = new ResizeObserver((entries) => {
    const r = entries[entries.length - 1]?.contentRect;
    if (r) resize(r.width, r.height);
  });
  // The canvas covers the block as soon as it exists (absolute, inset 0): in the loading state on phone the stage is
  // in the flow with the drawn fallback, so the box of the canvas, not of the stage, is the one the scene and its
  // labels are laid out in (audit Fable F8). Same box as the stage in the ready state.
  resizeObserver.observe(canvas);
  // The columns and the row change size with the language, the fonts, the open card and the ready state.
  const layoutObserver = new ResizeObserver(() => measureArea());
  for (const sel of ['[data-tree-experiences]', '[data-tree-copy]', '[data-tree-card]']) {
    const e = root.querySelector(sel);
    if (e) layoutObserver.observe(e);
  }
  // The row of experiences moves without being resized when the bottom block changes (card opened or closed): the
  // island writes the new heights on the block, which the area follows.
  const blockObserver = new MutationObserver(() => measureArea());
  blockObserver.observe(root, { attributes: true, attributeFilter: ['style', 'data-tree-open'] });
  signal.addEventListener('abort', () => {
    layoutObserver.disconnect();
    blockObserver.disconnect();
  }, { once: true });
  phoneLayout.addEventListener('change', () => measureArea(), { signal });
  resize(canvas.clientWidth, canvas.clientHeight);
  paintBlock(); // the palette read from the URL colours the block from the start

  // ---- Pause (D10.3): off screen or hidden tab, no frame requested ----
  function pauseReason(): 'offscreen' | 'hidden' | null {
    return hidden ? 'hidden' : offscreen ? 'offscreen' : null;
  }
  function schedule(): void {
    if (released || raf || state !== 'ready' || pauseReason()) return;
    raf = requestAnimationFrame(frame);
  }
  function pause(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTs = 0;
    guard.reset();
  }
  function updatePause(): void {
    if (pauseReason()) pause();
    else schedule();
  }
  viewObserver = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      if (!e) return;
      offscreen = !e.isIntersecting;
      updatePause();
    },
    { threshold: 0 },
  );
  viewObserver.observe(root);
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    updatePause();
  }, { signal });

  // ---- Reduced motion, followed live (D10.4) ----
  motionQuery.addEventListener('change', () => {
    reducedMotion = motionQuery.matches;
    labels?.setReducedMotion(reducedMotion);
    fireflies.clear();
    setLeaves();
  }, { signal });

  // ---- Context loss (D10.1) ----
  canvas.addEventListener('webglcontextlost', () => release(FALLBACK.contextLost), { signal });

  // ---- Gestures (D7.5): horizontal drag rotates, vertical drag scrolls the page ----
  // Listened on the block, so that a drag that starts on a label turns the tree too (lot 2a, E13.5).
  // Non-interactive surfaces of the block turn the tree too: the BNP sentence and the text of a card, experience
  // or skill (audits);
  // links, buttons and the phone row of experiences keep their own gestures.
  const onTree = (t: EventTarget | null): boolean => {
    if (t === canvas) return true;
    if (!(t instanceof Element)) return false;
    if (t.closest('.tree-label')) return true;
    if (t.closest('a, button, [data-tree-experiences], [data-tree-tip], .tree-atelier')) return false;
    return t.closest('[data-tree-copy], [data-tree-card] article, [data-tree-skill-card] article') !== null;
  };
  root.addEventListener('pointerdown', (e) => {
    if (!onTree(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lock: 'pending' };
  }, { signal });
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // A mouse whose buttons were released where no listener saw it (outside the window, a frame) ends the drag.
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      endDrag(e);
      return;
    }
    if (drag.lock === 'pending') {
      drag.lock = gestureLock(e.clientX - drag.x0, e.clientY - drag.y0);
      if (drag.lock === 'scroll') {
        drag = null;
        return;
      }
      if (drag.lock !== 'rotate') return;
      canvas.setPointerCapture(e.pointerId);
      document.getSelection()?.removeAllRanges(); // a drag that starts on text turns the tree, it selects nothing
      canvas.classList.add('drag');
      root.classList.add('tree-dragging');
      drag.lastX = drag.x0;
    }
    targetRot += (e.clientX - drag.lastX) * CAMERA.drag;
    drag.lastX = e.clientX;
    idle = 0;
    rest = 0;
  }, { signal });
  const endDrag = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    canvas.classList.remove('drag');
    root.classList.remove('tree-dragging');
  };
  // The end of the gesture is listened on the window from the press on: a drag that leaves the block before the
  // pointer is captured and is released in the header must not go on under a released mouse (audit astra H8).
  addEventListener('pointerup', endDrag, { signal });
  addEventListener('pointercancel', endDrag, { signal });
  canvas.addEventListener('lostpointercapture', endDrag, { signal });
  // Arrows only while the focus is inside the block.
  root.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') targetRot -= CAMERA.arrow;
    else if (e.key === 'ArrowRight') targetRot += CAMERA.arrow;
    else return;
    idle = 0;
    rest = 0;
  }, { signal });
  // A toggles the ASCII rendering while the focus is inside the block, except with a modifier or
  // while typing (proto:959; single-key shortcut scoped to the tree, WCAG 2.1.4).
  root.addEventListener('keydown', (e) => {
    // A held key toggles once: its repetitions are ignored (audit Fable F10).
    if ((e.key !== 'a' && e.key !== 'A') || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || t.closest('input, textarea, select'))) return;
    rest = 0;
    toggleAscii();
  }, { signal });
  // Fireflies behind a fast mouse inside the block.
  root.addEventListener('pointermove', (e) => {
    if (reducedMotion || state !== 'ready') return;
    const r = canvas.getBoundingClientRect();
    fireflies.pointerMove({ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp, pointerType: e.pointerType });
  }, { signal });

  // ---- ASCII (D16.4) ----
  function toggleAscii(v?: boolean): void {
    ascii = v ?? !ascii;
    canvas.style.opacity = ascii ? '0' : '';
    asciiCanvas.style.display = ascii ? 'block' : '';
    // The workshop shows the state of the scene, whatever toggled it (its button or the A key, audit astra H10).
    if (__TREE_ATELIER__) root.dispatchEvent(new CustomEvent('arbre:ascii', { detail: { ascii } }));
    if (!ascii) {
      asciiRt?.dispose();
      asciiRt = null;
      asciiCtx?.clearRect(0, 0, asciiCanvas.width, asciiCanvas.height);
    }
  }
  function renderAscii(ts: number): void {
    if (asciiBusy || !due(ts, asciiLast)) return;
    asciiLast = ts;
    if (!asciiRt) {
      asciiRt = new WebGLRenderTarget(grid.cols, grid.rows);
      asciiBuf = new Uint8Array(grid.cols * grid.rows * 4);
    }
    const rt = asciiRt;
    const { cols, rows } = grid;
    const k = cols / stageW;
    const keepPx = uPx.value;
    const keepSap = uPxSap.value;
    const keepGain = uGain.value;
    uPx.value = keepPx * k;
    uPxSap.value = keepSap * k * 1.3;
    uGain.value = keepGain * 0.16;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    points = renderer.info.render.points;
    drawCalls = renderer.info.render.calls;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    uPx.value = keepPx;
    uPxSap.value = keepSap;
    uGain.value = keepGain;
    asciiBusy = true;
    const buf = asciiBuf;
    renderer.readRenderTargetPixelsAsync(rt, 0, 0, cols, rows, buf).then(
      () => {
        asciiBusy = false;
        if (released || !ascii || !asciiCtx || buf !== asciiBuf) return;
        const ratio = overlayRatio();
        asciiCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
        asciiCtx.clearRect(0, 0, stageW, stageH);
        asciiCtx.font = `${grid.ch - 1}px ui-monospace, Menlo, monospace`;
        asciiCtx.textBaseline = 'top';
        for (let y = 0; y < rows; y++) {
          const row = (rows - 1 - y) * cols;
          for (let x = 0; x < cols; x++) {
            const i = (row + x) * 4;
            const cell = asciiCell(buf[i], buf[i + 1], buf[i + 2]);
            if (!cell) continue;
            asciiCtx.fillStyle = `rgb(${cell.color[0]},${cell.color[1]},${cell.color[2]})`;
            asciiCtx.fillText(cell.char, x * grid.cw, y * grid.ch);
          }
        }
        asciiFrames++;
      },
      (e: unknown) => {
        asciiBusy = false;
        errors.push(`ascii: ${String(e)}`);
      },
    );
  }

  // ---- Frame ----
  // Labels follow the projection of their anchors, laid out inside the usable area.
  function placeLabels(): void {
    if (!labels || !data) return;
    const anchors = data.anchors;
    SKILLS.forEach((sk, k) => {
      const a = anchors.find((x) => x.id === sk.id);
      if (!a) return;
      tmp.set(a.position[0], a.position[1], a.position[2]).applyMatrix4(group.matrixWorld);
      worldX[k] = tmp.x;
      tmp.project(camera);
      ndc[3 * k] = tmp.x;
      ndc[3 * k + 1] = tmp.y;
      ndc[3 * k + 2] = tmp.z;
    });
    labels.update(ndc, worldX, { width: stageW, height: stageH }, area);
  }
  function render(ts: number): void {
    // The pixel-ratio cap and the canvas size follow a change of resolution too (a window moved to
    // another screen, a zoom), checked every frame since not every browser reports it by an event;
    // the profile, hence the number of points, stays the one of the first screen.
    if (renderer.getPixelRatio() !== pixelRatio()) resize(stageW, stageH);
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    rest = drag?.lock === 'rotate' ? 0 : rest + dt;
    const still = rest >= CAMERA.idleDelay + CAMERA.idleStop;
    if (!reducedMotion && !still) uTime.value += dt;
    if (!reducedMotion) uSapTime.value += dt;
    const step = idleStep({ idle, dt, active: drag?.lock === 'rotate' || selection.experience !== null || selection.skill !== null, reducedMotion });
    idle = step.idle;
    targetRot += step.dRot;
    // In reduced motion the chosen angle is applied at once, without an animated turn.
    rotY = reducedMotion ? targetRot : rotY + (targetRot - rotY) * smoothing(dt, CAMERA.tauRot);
    group.rotation.y = rotY;
    for (const b of Object.values(backdropObjs)) if (b) b.obj.rotation.y = Math.sin(rotY) * 0.22;
    uHiMix.value = reducedMotion ? hiTarget : uHiMix.value + (hiTarget - uHiMix.value) * smoothing(dt, CAMERA.tauHi);

    // Sap front in real distance; labels light up as it passes their anchor.
    if (paths.length && startedAt !== null) {
      const t = reducedMotion ? Infinity : (ts - startedAt) / 1000;
      uFront.value = reducedMotion ? maxFront : Math.min(frontDistance(t), maxFront);
      const n = litInto(paths, t, litBuf);
      paths.forEach((p, k) => {
        if (!litBuf[k]) return;
        const id = p.id as SkillId;
        if (litLabels.has(id)) return;
        litLabels.add(id);
        labels?.setState(id, 'lit');
        labels?.arrive(id);
      });
      if (arrivedAt === null) {
        sapFrames++;
        if (n === paths.length) arrivedAt = ts;
      }
    }

    // Camera.
    const s = reducedMotion ? 1 : smoothing(dt, CAMERA.tauCam);
    area.x += (areaTarget.x - area.x) * s;
    area.y += (areaTarget.y - area.y) * s;
    area.w += (areaTarget.w - area.w) * s;
    area.h += (areaTarget.h - area.h) * s;
    applyView();
    camCur.r += (camTarget.r - camCur.r) * s;
    camCur.y += (camTarget.y - camCur.y) * s;
    camCur.look += (camTarget.look - camCur.look) * s;
    camCur.fov = camera.fov;
    camera.position.set(0, camCur.y, camCur.r);
    camera.lookAt(0, camCur.look, 0);
    camera.updateMatrixWorld();
    group.updateMatrixWorld();

    placeLabels();

    // Leaves: upload only while one flies or has just landed.
    if (leaves && leafGeo && !still && leaves.step(dt)) {
      for (const name of ['position', 'aRot', 'aA', 'aC', 'aS']) leafGeo.getAttribute(name).needsUpdate = true;
      leafUploads++;
    }

    // Fireflies.
    if (flyCtx && (fireflies.live > 0 || fliesDrawn)) {
      const ratio = overlayRatio();
      flyCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
      flyCtx.clearRect(0, 0, stageW, stageH);
      fireflies.step(dt);
      fireflies.draw(flyCtx, sprites);
      fliesDrawn = fireflies.live > 0;
    }

    if (ascii) renderAscii(ts);
    else {
      renderer.render(scene, camera);
      points = renderer.info.render.points;
      drawCalls = renderer.info.render.calls;
    }
  }

  function frame(ts: number): void {
    raf = 0;
    if (released) return;
    try {
      render(ts);
      frames++;
      verdict = guard.push(ts);
      if (verdict === 'fail') {
        try {
          sessionStorage.setItem(FPS_STORAGE_KEY, 'fps');
        } catch {
          // storage unavailable: the fallback still applies to this page
        }
        release(FALLBACK.fps);
        return;
      }
    } catch (e) {
      errors.push(String(e));
      release(FALLBACK.error);
      return;
    }
    schedule();
  }

  // ---- Palette, backdrop, growth (workshop) ----
  // CSS of the block (custom properties and backdrop gradient), at mount and on every palette change.
  // The tokens of the block always equal those of [data-home], which colour the whole home page, and the
  // background of <html> and <body> follows the palette (lot 2a, E10.1, E10.3, E11.2).
  function paintBlock(): void {
    paintPage(root, palette, backdrop, profile);
  }
  function setPalette(id: PaletteId): void {
    if (released || !Object.hasOwn(PALETTES, id)) return;
    paletteId = id;
    palette = PALETTES[id];
    if (data) {
      applyPalette(data.cloud, data.skeleton.bounds, palette, data.colors);
      const c = treeGeo?.getAttribute('aColor');
      if (c) c.needsUpdate = true;
    }
    const u = uniformColors(palette);
    uWarm.value.set(u.uWarm[0], u.uWarm[1], u.uWarm[2]);
    uSapA.value.set(u.uSapA[0], u.uSapA[1], u.uSapA[2]);
    uSapB.value.set(u.uSapB[0], u.uSapB[1], u.uSapB[2]);
    paintBlock();
    for (const part of Object.keys(backdropObjs) as BackdropPart[]) {
      const b = backdropObjs[part];
      if (!b) continue;
      paintBackdrop(part, b.data, palette, b.colors);
      b.geo.getAttribute('aC').needsUpdate = true;
    }
    leaves?.recolor(palette);
    sprites = createSprites(palette, makeSprite);
  }
  function setBackdrop(kind: BackdropKind): void {
    if (released) return;
    backdrop = kind;
    applyBackdrop();
  }
  // The selection stays on screen during the rebuild; the result of the latest request only is
  // applied, then the selection current at that moment is replayed on the new tree.
  let requestedMode: GrowthMode = mode;
  function setGrowth(m: GrowthMode): void {
    if (released || profile === 'phone' || m === requestedMode || !data) return;
    requestedMode = m;
    const n = ++growth;
    void generate(m).then((d) => {
      if (released || n !== growth) return;
      mode = m;
      setTree(d);
      setLeaves();
      const { experience, skill } = selection;
      if (experience) select(LIT[experience], experience, null);
      else if (skill) select([skill], null, skill);
      else select([], null, null);
    });
  }
  if (snapshot) installDiagnostic(snapshot);

  // ---- Boot: generation, GPU upload, first frame, then ready ----
  async function boot(): Promise<void> {
    const d = await generate(mode);
    if (released) return;
    const tGen = performance.now();
    setTree(d);
    applyBackdrop();
    setLeaves();
    toggleAscii(ascii);
    // Sap materials are compiled up front with placeholder objects, so that the first click does not stall.
    const warm = new Group();
    const warmGeo = new BufferGeometry();
    warm.add(new Line(warmGeo, sapLineMat), new Points(warmGeo, sapPtsMat), new Points(warmGeo, forestMat), new Points(warmGeo, skyMat), new Points(warmGeo, leafMat));
    // compileAsync waits on KHR_parallel_shader_compile and, without it, makes three warn on the console (Firefox):
    // the programs are then compiled at once, as compileAsync would do before its first check (audit Fable F7).
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(warm, camera, scene)]);
    else {
      renderer.compile(scene, camera);
      renderer.compile(warm, camera, scene);
    }
    warmGeo.dispose();
    if (released) return;
    const tUpload = performance.now();
    timings.upload = tUpload - tGen;
    if (__TREE_DIAG__) performance.measure('arbre:upload', { start: tGen, end: tUpload });
    // Labels and navigation appear with the first frame, already placed.
    labels = createLabels({
      stage, locale, anchors: data?.anchors ?? d.anchors, profile, reducedMotion, signal,
      onSkill: selectSkill,
    });
    // Any change of a label's box after load (text spacing or font size set by the user, WCAG 1.4.12, a zoom) drops
    // the measured sizes: the next frame lays the labels out with their real boxes, so that a point opens its own
    // skill (audit astra H1). Moves (transform) are not resizes and do not reach the observer.
    const known = new Map<Element, string>();
    const boxes = new ResizeObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const b = e.borderBoxSize?.[0];
        const k = b ? `${b.inlineSize}|${b.blockSize}` : `${e.contentRect.width}|${e.contentRect.height}`;
        if (known.has(e.target) && known.get(e.target) !== k) changed = true;
        known.set(e.target, k);
      }
      if (changed) labels?.invalidateSizes();
    });
    for (const b of stage.querySelectorAll('.tree-label')) boxes.observe(b);
    signal.addEventListener('abort', () => boxes.disconnect(), { once: true });
    render(performance.now());
    const tFirst = performance.now();
    timings.firstFrame = tFirst - tUpload;
    if (__TREE_DIAG__) performance.measure('arbre:first-frame', { start: tUpload, end: tFirst });
    if (released) return;
    state = 'ready';
    o.onState('ready');
    schedule();
  }
  boot().catch((e: unknown) => {
    errors.push(String(e));
    release(FALLBACK.error);
  });

  return handle();

  function handle(): SceneHandle {
    return {
      dispose: () => release(null),
      select: selectFrom,
      ...(__TREE_ATELIER__ ? { setPalette, setBackdrop, setGrowth } : {}),
      toggleAscii: (v?: boolean) => {
        if (!released) toggleAscii(v);
      },
    };
  }
}
