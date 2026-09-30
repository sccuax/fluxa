// Gradient cards (hero final scene): a small WebGL2 fragment shader that draws one fitted preset
// (see cardPresets.ts) as a piece of cloth. Two parts:
//   - colour: a normalised sum of 12 Gaussian colour blobs, then 2 soft-edged elliptical "layers" over it
//     (the layer edges are where the crests are);
//   - relief: the layers' coverage is a height field; its slope gives a normal, so one side of every crest
//     catches light and the other falls into shade (diffuse + a small specular), like a cloth lifted at a point.
// Stills (cards at rest) are rendered ONCE through a single shared context into 2D canvases - zero GPU cost
// afterwards. The live version only runs in the fullscreen view. At t = 0 with uAmp = 0 nothing moves, so a
// still and frame 0 of the live view are identical.
import type { CardPreset } from "./cardPresets";

const NB = 12;
const NL = 2;
// Live playback speed (time multiplier); raise for a faster cloth. Stills sit at t = 0, so they never change.
export const CARD_SPEED = 1.3;
const SPEED = CARD_SPEED;

const vert = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const frag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uT;
uniform float uAmp;
uniform float uLight;
uniform vec2 uCrop; // (1,1) = the whole card; (0.563,1) = its centre square crop (the hero logo)
uniform vec4 uBA[${NB}]; // blob: x, y, sigma, -
uniform vec3 uBC[${NB}]; // blob colour
uniform vec4 uLA[${NL}]; // layer: cx, cy, rx, ry
uniform vec4 uLB[${NL}]; // layer: rot, edge, opacity, direction angle
uniform vec3 uL0[${NL}];
uniform vec3 uL1[${NL}];

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}
vec2 flow(vec2 p, float t) {
  return vec2(fbm(p * 2.2 + vec2(0.0, t)) - 0.5, fbm(p * 2.2 + vec2(5.2, -t)) - 0.5) * 2.0;
}
// same particle-field flow as the logo mark: sum of sines -> angle -> unit vector
vec2 fieldDir(vec2 p, float t) {
  float a = sin(p.x * 2.3 + t * 0.35) + cos(p.y * 2.7 - t * 0.28) + sin((p.x + p.y) * 1.7 + t * 0.2);
  float ang = a * 1.5707963;
  return vec2(cos(ang), sin(ang));
}
float cover(float sd, float sigma) { return 1.0 / (1.0 + exp(-1.702 * sd / sigma)); }

// The crest moves as a rigid body (both layers share one offset, zero at t = 0): it sways, it never deforms.
vec2 crestShift() {
  return 0.06 * uAmp * (vec2(sin(uT * 0.55), 0.6 * sin(uT * 0.4 + 1.0)) - vec2(0.0, 0.6 * sin(1.0)));
}

// --- the swell -------------------------------------------------------------------------------------------
// Two long crossing waves travel through the cloth like a sea swell (asymmetric crests: sin - 0.22 sin 2x).
// They do two things and nothing else: they tilt the surface (light and shade roll with them) and they carry the
// colours along (Gerstner-style horizontal displacement: the colour field sloshes with each wave). The crest layers
// are NOT displaced, so their shape never changes.
const vec2 WD1 = vec2(0.92, -0.38);
const vec2 WD2 = vec2(0.70, 0.71);
float swell(float x) { return sin(x) - 0.22 * sin(2.0 * x); }
float ph1(vec2 p) { return dot(p, WD1) * 17.0 - uT * 2.2; }
float ph2(vec2 p) { return dot(p, WD2) * 10.0 - uT * 1.5 + 1.3; }
// eased in from t = 0 and off in stills (uAmp = 0), so frame 0 of the live view equals the still
float waveRamp() { return uAmp * smoothstep(0.0, 1.5, uT); }
vec2 waveShift(vec2 p) {
  return waveRamp() * (0.03 * WD1 * cos(ph1(p)) + 0.02 * WD2 * cos(ph2(p)));
}

vec3 albedo(vec2 q) {
  vec3 sum = vec3(0.0);
  float ws = 1e-3;
  vec2 qb = q + waveShift(q); // the blob colours are carried by the waves; no independent drift
  for (int i = 0; i < ${NB}; i++) {
    vec2 c = uBA[i].xy;
    vec2 d = qb - c;
    float w = exp(-dot(d, d) / (2.0 * uBA[i].z * uBA[i].z));
    sum += uBC[i] * w;
    ws += w;
  }
  vec3 col = sum / ws;
  for (int l = 0; l < ${NL}; l++) {
    vec2 c = uLA[l].xy + crestShift(); // rigid: the crest slides as one piece, its curve never deforms
    vec2 r = uLA[l].zw;
    float cs = cos(uLB[l].x), sn = sin(uLB[l].x);
    vec2 d = q - c;
    vec2 e = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
    float sd = (1.0 - length(e / r)) * min(r.x, r.y);
    float m = cover(sd, max(uLB[l].y, 0.001)) * clamp(uLB[l].z, 0.0, 1.0);
    float t = clamp((d.x * cos(uLB[l].w) + d.y * sin(uLB[l].w)) / (2.0 * max(r.x, r.y)) + 0.5, 0.0, 1.0);
    col = mix(col, mix(uL0[l], uL1[l], t), m);
  }
  return col;
}

// height field of the cloth: the layers' coverage (their soft edges are the crests)
float height(vec2 q) {
  float h = 0.0;
  for (int l = 0; l < ${NL}; l++) {
    vec2 c = uLA[l].xy + crestShift(); // rigid: the crest slides as one piece, its curve never deforms
    vec2 r = uLA[l].zw;
    float cs = cos(uLB[l].x), sn = sin(uLB[l].x);
    vec2 d = q - c;
    vec2 e = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
    float sd = (1.0 - length(e / r)) * min(r.x, r.y);
    h += cover(sd, max(uLB[l].y * 0.3, 0.008)) * clamp(uLB[l].z, 0.0, 1.0) * (l == 0 ? 0.9 : 0.65);
  }
  h += waveRamp() * (0.9 * swell(ph1(q)) + 0.55 * swell(ph2(q)));
  return h;
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  uv = (uv - 0.5) * uCrop + 0.5;
  vec2 q = uv; // no warp: the crest curve stays put
  vec3 col = albedo(q);

  const float E = 0.004;
  float hx = (height(q + vec2(E, 0.0)) - height(q - vec2(E, 0.0))) / (2.0 * E);
  float hy = (height(q + vec2(0.0, E)) - height(q - vec2(0.0, E))) / (2.0 * E);
  vec3 n = normalize(vec3(-hx * 0.009, -hy * 0.009, 1.0));
  vec3 L = normalize(vec3(-0.55, -0.6, 0.58));
  float shade = dot(n, L) - L.z; // + on the lit flank of a crest, - on the shaded one
  col *= 1.0 + shade * 2.8 * uLight;
  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 28.0) - pow(hv.z, 28.0);
  col += vec3(1.0, 0.96, 0.92) * max(spec, 0.0) * 0.6 * uLight;

  // soft static grain (cloudy, not per-pixel), like the logo mark
  vec2 nf = gl_FragCoord.xy;
  col += (vnoise(nf * 0.5) * 0.6 + vnoise(nf * 1.3) * 0.4 - 0.5) * 0.03;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export interface CardRenderer {
  setPreset(preset: CardPreset): void;
  /** t seconds, amp 0 (still) .. 1 (full motion), light 0 (flat) .. 1 (full relief) */
  draw(t: number, amp?: number, light?: number): void;
  resize(width: number, height: number): void;
  setCrop(x: number, y: number): void;
  canvas: HTMLCanvasElement;
  destroy(): void;
}

export function createCardRenderer(canvas: HTMLCanvasElement): CardRenderer | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
    return sh;
  };
  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("link error");
  } catch (error) {
    console.warn("[cardShader]", error);
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const uT = u("uT");
  const uAmp = u("uAmp");
  const uLight = u("uLight");
  const uCrop = u("uCrop");
  gl.uniform2f(uCrop, 1, 1);
  const uBA = u("uBA");
  const uBC = u("uBC");
  const uLA = u("uLA");
  const uLB = u("uLB");
  const uL0 = u("uL0");
  const uL1 = u("uL1");

  return {
    canvas,
    setPreset(preset) {
      const p = preset.p;
      const BA = new Float32Array(NB * 4);
      const BC = new Float32Array(NB * 3);
      for (let i = 0; i < NB; i++) {
        const o = i * 6;
        BA.set([p[o], p[o + 1], p[o + 5], 0], i * 4);
        BC.set([p[o + 2] / 255, p[o + 3] / 255, p[o + 4] / 255], i * 3);
      }
      const LA = new Float32Array(NL * 4);
      const LB = new Float32Array(NL * 4);
      const L0 = new Float32Array(NL * 3);
      const L1 = new Float32Array(NL * 3);
      for (let l = 0; l < NL; l++) {
        const o = NB * 6 + l * 14;
        LA.set([p[o], p[o + 1], p[o + 2], p[o + 3]], l * 4);
        LB.set([p[o + 4], p[o + 5], p[o + 6], p[o + 7]], l * 4);
        L0.set([p[o + 8] / 255, p[o + 9] / 255, p[o + 10] / 255], l * 3);
        L1.set([p[o + 11] / 255, p[o + 12] / 255, p[o + 13] / 255], l * 3);
      }
      gl.uniform4fv(uBA, BA);
      gl.uniform3fv(uBC, BC);
      gl.uniform4fv(uLA, LA);
      gl.uniform4fv(uLB, LB);
      gl.uniform3fv(uL0, L0);
      gl.uniform3fv(uL1, L1);
    },
    draw(t, amp = 0, light = 1) {
      gl.uniform1f(uT, t);
      gl.uniform1f(uAmp, amp);
      gl.uniform1f(uLight, light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    setCrop(x, y) {
      gl.uniform2f(uCrop, x, y);
    },
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/**
 * Paints every card once (one shared WebGL context, released right after) into its own 2D canvas.
 * The cards keep no GL context and cost nothing while they sit still.
 */
export function renderCardStills(entries: { canvas: HTMLCanvasElement; preset: CardPreset; t?: number; amp?: number }[]) {
  const off = document.createElement("canvas");
  const renderer = createCardRenderer(off);
  if (!renderer) return false;
  for (const { canvas, preset, t = 0, amp = 0 } of entries) {
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    renderer.resize(canvas.width, canvas.height);
    renderer.setPreset(preset);
    renderer.draw(t, amp, preset.light);
    ctx.drawImage(off, 0, 0); // same task as the draw: the buffer is still valid
  }
  renderer.destroy();
  return true;
}

/** Live version for the fullscreen view: 30 fps, half-ish resolution (the cloth is smooth, so it upscales cleanly). */
export function mountCardLive(canvas: HTMLCanvasElement, preset: CardPreset, width = 960) {
  const renderer = createCardRenderer(canvas);
  if (!renderer) return null;
  renderer.resize(width, Math.round((width * 302) / 535)); // the card's own aspect: frame 0 == the still
  renderer.setPreset(preset);
  renderer.draw(0, 0, preset.light);

  let raf = 0;
  let last = 0;
  let t0 = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; // ~30 fps
    last = now;
    renderer.draw(((now - t0) / 1000) * SPEED, 1, preset.light);
  };
  return {
    start() {
      if (raf) return;
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      renderer.destroy();
    },
  };
}
