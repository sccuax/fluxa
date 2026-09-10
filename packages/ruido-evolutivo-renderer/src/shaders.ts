import * as THREE from "three";
import { RUIDO_EVOLUTIVO_MAX_COLORS } from "@fluxa/gradient-core";

// The "ruidoEvolutivo" gallery preset kind's GLSL - a real 3D liquid
// surface (PerspectiveCamera + a subdivided PlaneGeometry, vertex-displaced
// by an fBm height field with real per-vertex normals via central
// differences) whose color is three independently-drifting "wave fronts"
// that collide and mix, sampled through a domain-warped fBm field.
//
// Ported verbatim from sandbox/src/experiments/RuidoEvolutivo.tsx (built and
// tuned there first - see copy-paste/paste.txt "Guía Técnica: Ruido
// Dinámico Evolutivo (fBm)" for the reference material). The only change on
// the way out of the sandbox: every value that was a hardcoded constant in
// that file (octave count, lacunarity/gain, warp/turbulence amounts, wave
// directions, sharpen exponent, light direction, ...) is now a uniform fed
// from ruidoEvolutivoConfigSchema, so the whole thing is a real control
// panel instead of a fixed look. The schema's DEFAULT_* values reproduce
// the sandbox file's original constants exactly.
//
// Same framework-agnostic extraction pattern as @fluxa/glass-liquid-renderer:
// this module + mount.ts are shared verbatim by the Designer Extension's
// React wrapper and (once built) the self-hosted published-site runtime.

// snoise + fbm are duplicated into both stages (WebGL1 GLSL has no shared
// includes) - the vertex stage needs fbm for real displacement, the
// fragment stage for the color field and domain warp.
const NOISE_GLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p3 = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p3 * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// Parameterized fBm. MAX_OCTAVES is the compile-time loop bound GLSL ES 1.0
// requires; `if (float(i) >= uOctaves) break;` is the actual, runtime-
// variable octave count (a `break` inside a constant-bounded loop is legal,
// a `uniform`-bounded loop is not). uEvolution scales the per-octave time
// rate spread: 0 => every octave evolves at the same rate (big shapes and
// fine detail move together), 1 => fine detail evolves ~2x faster than the
// big shapes. The sandbox default of `float(i) * 0.05` is reproduced at
// uEvolution = 0.5.
const FBM_GLSL = `
  const int MAX_OCTAVES = 6;
  uniform float uOctaves;
  uniform float uGain;
  uniform float uLacunarity;
  uniform float uEvolution;

  float fbm(vec2 p, float time) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < MAX_OCTAVES; i++) {
      if (float(i) >= uOctaves) break;
      vec2 shift = vec2(float(i) * 2.3, float(i) * -1.5);
      float octaveRate = 0.15 + float(i) * 0.1 * uEvolution;
      value += amplitude * snoise(p * frequency + shift + time * octaveRate);
      frequency *= uLacunarity;
      amplitude *= uGain;
    }
    return value;
  }
`;

export const VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec2 vP;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uFrequency;
  uniform float uRelief;

  ${NOISE_GLSL}
  ${FBM_GLSL}

  float surfaceHeight(vec2 p, float time) {
    return fbm(p * uFrequency, time * 0.5) * uRelief;
  }

  void main() {
    vUv = uv;
    vP = position.xy;

    float t = uTime * uSpeed;
    float h = surfaceHeight(position.xy, t);

    float eps = 0.04;
    float hL = surfaceHeight(position.xy - vec2(eps, 0.0), t);
    float hR = surfaceHeight(position.xy + vec2(eps, 0.0), t);
    float hD = surfaceHeight(position.xy - vec2(0.0, eps), t);
    float hU = surfaceHeight(position.xy + vec2(0.0, eps), t);
    vec3 tangentX = normalize(vec3(2.0 * eps, 0.0, hR - hL));
    vec3 tangentY = normalize(vec3(0.0, 2.0 * eps, hU - hD));
    vNormal = normalize(cross(tangentX, tangentY));

    vec3 displaced = vec3(position.xy, position.z + h);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vP;
  varying vec3 vNormal;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uWarpAmount;
  uniform float uWarpScale;
  uniform float uWaveScale;
  uniform float uDistortion;
  uniform float uContrast;
  uniform float uColorMix;
  uniform float uFlowAngle;
  uniform float uFlowSpread;
  uniform float uShimmer;
  uniform float uGrain;
  uniform float uGrainScale;
  uniform float uLightAngle;
  uniform float uLightStrength;
  uniform float uSaturation;

  #define MAX_COLORS ${RUIDO_EVOLUTIVO_MAX_COLORS}
  uniform vec3 uColors[MAX_COLORS];
  uniform float uColorCount;
  // Per-front opacity 0..1 (from the picker's colorsOpacity, /100). Scales
  // each front's blend WEIGHT below, so a low-opacity colour contributes
  // less to both the weighted sum and its divisor - the result shifts toward
  // the other colours rather than toward black - and can't win the hard-pick
  // (uColorMix 0) either. All 1.0 = identical to before this existed.
  uniform float uColorAlpha[MAX_COLORS];

  ${NOISE_GLSL}
  ${FBM_GLSL}

  // Per-front constants. Indices 0-2 are the sandbox file's original
  // dir1/dir2/dir3 angles + per-front spatial frequency / phase speed /
  // turbulence sample offset & rate, so a 2- or 3-colour config renders
  // exactly as it did before the colours became an array. Indices 3-4 are
  // hand-picked to sit between the first three without lining up in
  // lockstep.
  float frontBaseAngle(float i) {
    if (i < 0.5) return 0.3398;
    if (i < 1.5) return 2.1112;
    if (i < 2.5) return -1.3258;
    if (i < 3.5) return 3.7000;
    return 5.4000;
  }
  float frontFreq(float i) {
    if (i < 0.5) return 1.00;
    if (i < 1.5) return 1.30;
    if (i < 2.5) return 0.85;
    if (i < 3.5) return 1.13;
    return 0.72;
  }
  float frontSpeed(float i) {
    if (i < 0.5) return 0.110;
    if (i < 1.5) return 0.150;
    if (i < 2.5) return 0.085;
    if (i < 3.5) return 0.128;
    return 0.066;
  }
  vec2 frontTurbOffset(float i) {
    if (i < 0.5) return vec2(9.1, 2.7);
    if (i < 1.5) return vec2(-3.3, 6.5);
    if (i < 2.5) return vec2(5.8, -4.2);
    if (i < 3.5) return vec2(-7.4, -1.6);
    return vec2(2.9, 8.3);
  }
  float frontTurbRate(float i) {
    if (i < 0.5) return 0.18;
    if (i < 1.5) return 0.21;
    if (i < 2.5) return 0.16;
    if (i < 3.5) return 0.19;
    return 0.15;
  }

  // Domain-warps the color sample point through two independent fbm fields
  // so the gradient boundaries flow and twist instead of just sliding.
  vec2 warp(vec2 p, float time) {
    float n1 = fbm(p * uWarpScale, time * 0.4);
    float n2 = fbm(p * uWarpScale + vec2(4.3, 2.1), time * 0.35);
    return p + vec2(n1, n2) * 0.2 * uWarpAmount;
  }

  // One rotated dot-screen channel: ink coverage (0..1) at this pixel for a
  // channel of overall density 'amount' (0 = blank, 1 = solid). Works in
  // screen space (gl_FragCoord) like a real print screen / like the
  // THREE.HalftonePass shadergradient runs as a post-process, so the dots
  // stay pinned to the viewport while the camera moves.
  float halftoneInk(vec2 fragPx, float angle, float cell, float amount) {
    float s = sin(angle);
    float c = cos(angle);
    vec2 rot = vec2(fragPx.x * c - fragPx.y * s, fragPx.x * s + fragPx.y * c);
    vec2 inCell = mod(rot, cell) - 0.5 * cell;
    float dist = length(inCell) / (0.5 * cell);
    float radius = sqrt(clamp(amount, 0.0, 1.0)) * 1.42;
    return 1.0 - smoothstep(radius - 0.25, radius + 0.25, dist);
  }

  // CMY halftone reconstruction of col, per-channel rotations matching
  // shadergradient's HalftonePass (PI/12, 2*PI/12, 3*PI/12).
  vec3 halftone(vec2 fragPx, vec3 col, float cell) {
    float inkC = halftoneInk(fragPx, 0.2617994, cell, 1.0 - col.r);
    float inkM = halftoneInk(fragPx, 0.5235988, cell, 1.0 - col.g);
    float inkY = halftoneInk(fragPx, 0.7853982, cell, 1.0 - col.b);
    return vec3(1.0 - inkC, 1.0 - inkM, 1.0 - inkY);
  }

  void main() {
    vec2 p = vP;
    float t = uTime * uSpeed;
    float ct = t * 0.15;

    vec2 wp = warp(p, ct);

    // One "wave front" per colour (uColorCount of them, 2..MAX_COLORS).
    // Each travels in its own direction at its own speed with its own
    // turbulence sample, so their relative phases keep drifting instead of
    // repeating in lockstep - that drift is the "collision"/mix look.
    // frontBaseAngle(0) is the reference the fan spreads out from, so
    // uFlowSpread=1 reproduces the sandbox file's original dir1/dir2/dir3
    // for the first three fronts and uFlowAngle rotates the whole set.
    float count = clamp(uColorCount, 2.0, float(MAX_COLORS));
    float a0 = frontBaseAngle(0.0);

    vec3 weightedSum = vec3(0.0);
    float wSum = 0.0001;
    float bestW = -1.0;
    vec3 dominant = uColors[0];

    for (int i = 0; i < MAX_COLORS; i++) {
      float fi = float(i);
      if (fi >= count) break;

      float ang = uFlowAngle + a0 + (frontBaseAngle(fi) - a0) * uFlowSpread;
      vec2 dir = vec2(cos(ang), sin(ang));
      float turb = fbm(wp * 1.4 + frontTurbOffset(fi), t * frontTurbRate(fi));
      float wave = sin(dot(wp, dir) * frontFreq(fi) * uWaveScale + t * frontSpeed(fi) + turb * uDistortion) * 0.5 + 0.5;
      // Sharpen each front before blending - keeps crests reading as a real
      // colour instead of everything washing to a flat average. Then scale
      // by the front's own opacity (uColorAlpha).
      float w = pow(wave, uContrast) * uColorAlpha[i];

      weightedSum += uColors[i] * w;
      wSum += w;
      if (w > bestW) {
        bestW = w;
        dominant = uColors[i];
      }
    }

    vec3 avg = weightedSum / wSum;
    // uColorMix lerps between the strongest front's colour hard-picked (0)
    // and the smooth weighted average of every front (1).
    vec3 color = mix(dominant, avg, uColorMix);

    // Post-blend saturation restore - averaging many fronts pulls toward a
    // desaturated centroid; uSaturation=1 is a no-op.
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, uSaturation);

    // Independent higher-frequency fbm modulates brightness slightly - the
    // "micro-distortions that breathe" texture on top of the big shapes.
    float fineDetail = fbm(p * 3.0 + wp, t * 0.2);
    color *= 1.0 + fineDetail * uShimmer;

    // Diffuse shading off the real displaced-surface normal.
    vec3 sceneLightDir = normalize(vec3(cos(uLightAngle), sin(uLightAngle), 0.65));
    vec3 faceNormal = gl_FrontFacing ? vNormal : -vNormal;
    float surfaceDiffuse = dot(faceNormal, sceneLightDir);
    color *= 1.0 + surfaceDiffuse * uLightStrength;

    // Halftone "grain" - blend toward a rotated CMY dot-screen
    // reconstruction of the image, the same look shadergradient's own grain
    // prop produces (a THREE.HalftonePass post-process there). In bright
    // areas the dots shrink to nothing so it also lightens slightly, like
    // the SCREEN blend that pass uses. uGrain is intensity, off at 0.
    if (uGrain > 0.0) {
      vec3 ht = halftone(gl_FragCoord.xy, clamp(color, 0.0, 1.0), max(uGrainScale, 1.0));
      color = mix(color, ht, uGrain);
    }

    // Ordered dither (interleaved-gradient-noise) - a raw ShaderMaterial
    // doesn't get three.js's built-in dithering chunk, and this shader's
    // smooth color ramps band visibly on the 8-bit backbuffer without it.
    float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    color += (dither - 0.5) / 255.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function hexToVec3(hex: string): THREE.Vector3 {
  const int = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

export const DEG2RAD = Math.PI / 180;
