// Shaders of the tree scene (contract D6), in GLSL ES 1.0 syntax: ShaderMaterial of three r187
// translates attribute, varying and gl_FragColor for WebGL2. No colour-space or tone-mapping chunk
// is included: colours go to the GPU as raw encoded sRGB components and come out unchanged, as in
// the three r147 prototype (legacy colour management). Port of proto:622-683, 737-746, 1023-1030,
// with the wind removed and the sap lit by real distances.
import type { Palette } from '../../content/palettes.ts';
import { hexToRgb } from './color.ts';
import type { RGB } from './color.ts';

// Head widths of the sap front (scene units) and spatial frequency of the sap pulse (per unit).
export const SAP_HEAD_PARTICLES = 1.0;
export const SAP_HEAD_LINE = 1.3;
export const SAP_PULSE_FREQ = 2.0;
// Size attenuation numerators: gl_PointSize = size x uPx x (scale / -mv.z).
export const POINT_SCALE = Object.freeze({ tree: 36, sap: 38, leaf: 34, backdrop: 30 } as const);

// GLSL float literal (always with a decimal point).
const f = (x: number): string => (Number.isInteger(x) ? x.toFixed(1) : String(x));

// Round, soft-edged point; shared by the tree, the sap particles and the backdrop.
const DISC = `
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);`;

// ---- Tree (proto:622-653), with uFly = 1 and no wind ----

export const TREE_VERTEX = `
attribute vec3 aStart;
attribute vec3 aColor;
attribute float aDelay;
attribute float aSize;
attribute float aHi;
attribute float aSapD;
uniform float uProg;
uniform float uTime;
uniform float uHiMix;
uniform float uPx;
uniform float uGain;
uniform float uFront;
uniform vec3 uWarm;
varying vec3 vCol;
varying float vA;
void main() {
  float t = clamp((uProg - aDelay) / 0.45, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(aStart, position, t);
  p += vec3(sin(uTime * 0.7 + aStart.x * 3.1), cos(uTime * 0.5 + aStart.z * 2.3), sin(uTime * 0.6 + aStart.y * 4.0)) * (0.18 * (1.0 - t) + 0.012);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float lit = aHi * uHiMix * step(aSapD, uFront);
  vCol = mix(aColor * uGain, uWarm * 1.15, lit * 0.9);
  vA = mix(1.0, 0.28 + lit * 0.95, uHiMix) * (0.55 + 0.45 * t);
  gl_PointSize = aSize * uPx * (1.0 + lit * 0.6) * (${f(POINT_SCALE.tree)} / -mv.z) * mix(1.6, 1.0, t);
}`;

export const TREE_FRAGMENT = `
varying vec3 vCol;
varying float vA;
void main() {${DISC}
  gl_FragColor = vec4(vCol * a * 1.05, a * vA);
}`;

// ---- Sap line (proto:658-664), real distances ----

export const SAP_LINE_VERTEX = `
attribute float aD;
varying float vD;
void main() {
  vD = aD;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const SAP_LINE_FRAGMENT = `
uniform float uFront;
uniform vec3 uSapA;
uniform vec3 uSapB;
varying float vD;
void main() {
  if (vD > uFront) discard;
  float head = smoothstep(uFront - ${f(SAP_HEAD_LINE)}, uFront, vD);
  gl_FragColor = vec4(mix(uSapA, uSapB, head), 0.7 + head * 0.3);
}`;

// ---- Sap particles (proto:666-683), real distances ----

export const SAP_POINTS_VERTEX = `
attribute float aD;
attribute float aR;
uniform float uFront;
uniform float uTime;
uniform float uPx;
varying float vA;
varying float vHead;
void main() {
  float on = step(aD, uFront);
  float head = smoothstep(uFront - ${f(SAP_HEAD_PARTICLES)}, uFront, aD) * on;
  float pulse = 0.55 + 0.45 * sin(aD * ${f(SAP_PULSE_FREQ)} - uTime * 5.0 + aR * 6.28);
  vA = on * mix(pulse * 0.75, 1.0, head);
  vHead = head;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (1.4 + head * 3.2 + aR * 0.8) * (${f(POINT_SCALE.sap)} / -mv.z);
}`;

export const SAP_POINTS_FRAGMENT = `
uniform vec3 uSapA;
uniform vec3 uSapB;
varying float vA;
varying float vHead;
void main() {${DISC}
  vec3 col = mix(uSapA, uSapB, vHead);
  gl_FragColor = vec4(col * a, a * vA);
}`;

// ---- Backdrop (proto:737-746): ground, forest (trees aT = 1, fireflies aT = 3) and sky ----

const BACKDROP_FRAGMENT = `
varying vec3 vC;
varying float vA;
void main() {${DISC}
  gl_FragColor = vec4(vC * a, a * vA);
}`;

export const GROUND_VERTEX = `
attribute vec3 aC;
attribute float aR;
uniform float uPx;
varying vec3 vC;
varying float vA;
void main() {
  vC = aC;
  vA = 0.32;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 0.9 * uPx * (${f(POINT_SCALE.backdrop)} / -mv.z);
}`;
export const GROUND_FRAGMENT = BACKDROP_FRAGMENT;

export const FOREST_VERTEX = `
attribute vec3 aC;
attribute float aR;
attribute float aT;
uniform float uTime;
uniform float uPx;
varying vec3 vC;
varying float vA;
void main() {
  vec3 p = position;
  float size = 2.4;
  float alpha = 0.4;
  if (aT > 2.0) {
    p += vec3(sin(uTime * 0.31 + aR * 40.0), sin(uTime * 0.23 + aR * 17.0) * 0.6, cos(uTime * 0.27 + aR * 29.0)) * 1.4;
    size = 4.0;
    alpha = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.2 + aR * 2.0) + aR * 50.0), 3.0);
  }
  vC = aC;
  vA = alpha;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uPx * (${f(POINT_SCALE.backdrop)} / -mv.z);
}`;
export const FOREST_FRAGMENT = BACKDROP_FRAGMENT;

export const SKY_VERTEX = `
attribute vec3 aC;
attribute float aR;
uniform float uTime;
uniform float uPx;
varying vec3 vC;
varying float vA;
void main() {
  vC = aC;
  vA = 0.9 * (0.6 + 0.4 * sin(uTime * 0.8 + aR * 90.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (2.2 + aR * 1.6) * uPx;
}`;
export const SKY_FRAGMENT = BACKDROP_FRAGMENT;

// ---- Falling leaves (proto:1023-1030) ----

export const LEAF_VERTEX = `
attribute float aRot;
attribute float aA;
attribute vec3 aC;
attribute float aS;
uniform float uPx;
varying float vR;
varying float vA;
varying vec3 vC;
void main() {
  vR = aRot;
  vA = aA;
  vC = aC;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aS * uPx * (${f(POINT_SCALE.leaf)} / -mv.z);
}`;

export const LEAF_FRAGMENT = `
varying float vR;
varying float vA;
varying vec3 vC;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float c = cos(vR);
  float s = sin(vR);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  float w = 0.2 * (1.0 - pow(2.0 * abs(q.y) / 0.9, 2.0));
  if (abs(q.x) > w || abs(q.y) > 0.45) discard;
  float vein = 1.0 - 0.35 * smoothstep(0.03, 0.0, abs(q.x));
  gl_FragColor = vec4(vC * vein, vA);
}`;

// Colour uniforms of a palette, as raw encoded sRGB components (D6.6).
export function uniformColors(p: Palette): { uWarm: RGB; uSapA: RGB; uSapB: RGB } {
  return { uWarm: hexToRgb(p.lit), uSapA: hexToRgb(p.sap[0]), uSapB: hexToRgb(p.sap[1]) };
}
