// Section 5 (FAQ) hero object: the Fluxa mark as a solid, beveled 3D body (like the extension's welcome logo) that
// morphs mark -> liquid orb -> question mark and back, and reacts to the pointer (`timeline()`, `mountLiquidMark()`).
// Everything is painted with the hero logo's own "brandmark" look (lib/gradient/brandmarkScene.ts): same colours, same
// grain.
//
// How it is drawn, and what it costs (it is all GPU work, one canvas):
//  - Bake (every other frame): the brandmark scene into a 256x256 texture, and, only while some of the body is the
//    orb, the liquid displacement field of the orb ("Orbe de Agua" reference, faq/orbField.ts) into a 512x256 texture.
//  - Body: ONE sphere-traced analytic signed-distance field (stadium + two circles for the mark, strokes for the "?", a
//    displaced sphere for the orb, extruded with a small bevel), lit with the baked texture. Analytic, so edges are exact.
//    The march is bounded by a tight sphere that grows only while the body stretches.
//  - Progressive blur (0 at the middle of the container -> 40px at the bottom) as a GL post-process on half-resolution
//    targets, instead of CSS backdrop-filter layers.
//  - It stops completely when off-screen / tab hidden, runs at the display rate, lowers its own resolution if frames
//    arrive late, and compiles its shaders off-thread when the browser can.
//  - WebGPU / WebAssembly were considered and NOT used: it is a single GPU-bound pass (WebGPU would only add
//    device-init cost and lose Safari/Firefox parity) and there is no CPU work worth compiling to WASM.
// Dev: `?lmT=<seconds>` freezes the timeline (for screenshots); `?lmStats` logs the GPU ms per frame.
import { BRANDMARK_GLOW, BRANDMARK_GLSL, BRANDMARK_WAVE } from "@/lib/gradient/brandmarkScene";
import { ORB_DISP_FRAG, ORB_DISP_H, ORB_DISP_W, ORB_VERT } from "./orbField";

const BAKE = 256; // resolution of the baked surface texture

// ---------------------------------------------------------------- shaders

const vert = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Pass 1: the hero's brandmark look (scene B + its satin / sheen pass), over the mark's square.
const bakeFrag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
${BRANDMARK_GLSL}
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 col = sceneB(uv);
  float along = dot(uv - 0.5, vec2(0.62, 0.78)) + 0.06 * sin(uT * 0.5);
  float sheen = exp(-pow((along - 0.12 * sin(uT * 0.35 + 1.0)) / 0.11, 2.0)) * 0.55 + exp(-pow((along + 0.28) / 0.07, 2.0)) * 0.25;
  vec3 satin = col * col * (3.0 - 2.0 * col);
  col = mix(col, satin, 0.35);
  col += vec3(1.0, 0.98, 1.0) * sheen * 0.11;
  outColor = vec4(col, 1.0);
}`;

// Pass 2: the body.
const frag = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uT;
uniform float uA;     // 0 = mark, 1 = orb (and ? when uQ = 1)
uniform float uQ;     // 0 = whatever uA says, 1 = question mark
uniform float uLiq;   // 0..1 extra liquid wobble
uniform float uTide;  // 0..1 internal waves (orb look)
uniform float uStr;   // stretch amount along uDir
uniform vec2 uDir;
uniform vec2 uTilt;   // yaw, pitch
uniform sampler2D uBrand;
uniform sampler2D uOrbDisp;   // baked liquid displacement (equirectangular), see orbField.ts
uniform float uFloatTex;      // 1 when uOrbDisp is a float texture (else it stores rel * 2 + 0.5)
out vec4 outColor;

const float H = 0.15;   // half thickness of the extruded shapes (the welcome logo: depth ~0.2 of its width)
const float R = 0.045;  // bevel radius (must stay below the "?" stroke half width, 0.135)

float ext(float d2, float z) {
  vec2 w = vec2(d2 + R, abs(z) - H + R);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - R;
}

// ---- 2D shapes, analytic. Object space: the mark is 1.6 wide (32 units of 0.05), y up.
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
// The logo: a wide stadium on top and two circles below (same construction as the hero's sdClover).
float sdMark(vec2 p) {
  vec2 u = p / 0.05;
  vec2 q = u - vec2(0.0, 8.0);
  float top = length(max(abs(q) - vec2(8.0, 0.0), 0.0)) - 8.0;
  float c1 = length(u - vec2(-8.0, -8.0)) - 8.0;
  float c2 = length(u - vec2(8.0, -8.0)) - 8.0;
  // The circles only touch the stadium (and each other) at a point: fuse them like soft clay, and fill the little
  // triangular gap between the three (the logo has no hole there; only the notch at the bottom stays).
  vec2 g = abs(u - vec2(0.0, -3.5)) - vec2(5.5, 3.5);
  float fill = length(max(g, 0.0)) + min(max(g.x, g.y), 0.0);
  float d = smin(smin(top, c1, 3.0), c2, 3.0);
  return smin(d, fill, 3.0) * 0.05;
}
// A thick, round "?": a semicircular hook that flows into an S-shaped tail (cubic, sampled as short round capsules,
// tangent-continuous with the hook) down to the stem, plus the dot.
float sdQuestion(vec2 p) {
  vec2 u = p / 0.05;
  vec2 q = u - vec2(0.0, 5.4);
  const float RR = 6.8;
  float ring = q.y > 0.0 ? abs(length(q) - RR) : length(q - vec2(-RR, 0.0));
  const vec2 P0 = vec2(6.8, 5.4);
  const vec2 P1 = vec2(6.8, 0.0);
  const vec2 P2 = vec2(0.0, 1.4);
  const vec2 P3 = vec2(0.0, -5.0);
  float tail = 1e9;
  vec2 prev = P0;
  for (int i = 1; i <= 10; i++) {
    float t = float(i) / 10.0;
    float w = 1.0 - t;
    vec2 pt = w * w * w * P0 + 3.0 * w * w * t * P1 + 3.0 * w * t * t * P2 + t * t * t * P3;
    tail = min(tail, sdSeg(u, prev, pt));
    prev = pt;
  }
  float stroke = min(ring, tail) - 2.7;
  float dotd = length(u - vec2(0.0, -12.3)) - 2.7;
  return min(stroke, dotd) * 0.05;
}

vec3 spin(vec3 p) {
  float cy = cos(uTilt.x), sy = sin(uTilt.x);
  p.xz = mat2(cy, -sy, sy, cy) * p.xz;
  float cx = cos(uTilt.y), sx = sin(uTilt.y);
  p.yz = mat2(cx, -sx, sx, cx) * p.yz;
  return p;
}

vec3 warp(vec3 p) {
  float t = uT;
  p += uLiq * 0.09 * vec3(
    sin(p.y * 3.3 + t * 1.9 + sin(p.z * 2.1 + t)),
    sin(p.x * 2.9 - t * 1.6 + sin(p.y * 2.0)),
    sin(p.x * 2.3 + p.y * 2.7 + t * 1.4));
  float s = 1.0 + uStr;
  float al = dot(p.xy, uDir);
  vec2 along = uDir * al;
  vec2 pr = p.xy - along;
  vec2 perp = vec2(-uDir.y, uDir.x);
  p.xy = along / s + pr * (1.0 + 0.45 * uStr);
  p.xy += perp * uStr * 0.05 * sin(al * 6.0 - t * 9.0);
  return p;
}

const float ORB_R = 0.74;
// The reference mesh is tilted 30deg about z and 15deg about x; the baked fields live in that local frame.
vec3 orbTilt(vec3 d) {
  float cz = 0.8660254, sz = 0.5;
  d = vec3(cz * d.x - sz * d.y, sz * d.x + cz * d.y, d.z);
  float cx = 0.9659258, sx = 0.2588190;
  return vec3(d.x, cx * d.y - sx * d.z, sx * d.y + cx * d.z);
}
vec2 dirUV(vec3 d) {
  return vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5);
}
float orbDisp(vec3 p) {
  float v = textureLod(uOrbDisp, dirUV(orbTilt(normalize(p))), 0.0).r;
  float rel = uFloatTex > 0.5 ? v : (v - 0.5) * 0.5;
  return rel * ORB_R * (0.35 + 0.65 * uTide); // the waves calm down while the orb is still forming
}

float map(vec3 p0) {
  vec3 p = spin(warp(p0));
  float orb = length(p) - ORB_R;
  if (uA > 0.001 && uQ < 0.999) orb -= orbDisp(p);
  float d = orb;
  if (uA < 0.999 && uQ < 0.999) d = mix(ext(sdMark(p.xy), p.z), orb, uA);
  if (uQ > 0.001) d = mix(d, ext(sdQuestion(p.xy), p.z), uQ);
  return d * 0.8;
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.003;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// The logo / "?" : the hero's brandmark colours, lit like the extension's welcome logo.
vec3 markShade(vec3 q, vec3 n, vec3 rd) {
  // The hero logo's brandmark colours, projected through the body (x,y of the mark's square; y down in the scene).
  vec3 base = texture(uBrand, clamp(q.xy / 1.6 + 0.5, 0.0, 1.0)).rgb;

  // Lights as in the extension's welcome logo: ambient + a key light + a fill, slightly metallic.
  vec3 l1 = normalize(vec3(1.0, 1.0, 1.0));
  vec3 l2 = normalize(vec3(-1.0, -0.5, 0.5));
  float lit = 0.55 + 0.9 * max(dot(n, l1), 0.0) + 0.45 * max(dot(n, l2), 0.0);
  vec3 col = base * lit * 0.8;
  vec3 hv = normalize(l1 - rd);
  col += vec3(1.0, 0.97, 1.0) * pow(max(dot(n, hv), 0.0), 42.0) * 0.28;
  col += vec3(1.0, 0.96, 1.0) * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.1;
  return col;
}

// A rectangular "window" light seen in the reflection (centre direction c, half-sizes in tangent space, soft edge).
float windowLight(vec3 R, vec3 c, vec2 hs, float soft) {
  float d = dot(R, c);
  if (d <= 0.0) return 0.0;
  vec3 u = normalize(cross(c, vec3(0.0, 1.0, 0.0)));
  vec3 v = cross(c, u);
  vec2 xy = vec2(dot(R, u), dot(R, v)) / d;
  return smoothstep(hs.x + soft, hs.x, abs(xy.x)) * smoothstep(hs.y + soft, hs.y, abs(xy.y));
}

// The orb: the logo's own brandmark colours (same texture as the mark, so same palette and grain) on the liquid
// surface of orbField.ts, wet-looking: a soft dome + sharp "window" lights reflected by the displaced surface (they
// draw the glossy streaks along the crests), fresnel and a clearcoat glint. No tone-mapping, so the palette is kept.
vec3 orbShade(vec3 q, vec3 n, vec3 rd) {
  // the colours bend a little with the surface normal, as if seen through the liquid
  vec3 base = texture(uBrand, clamp(q.xy / 1.6 + 0.5 + n.xy * 0.06, 0.0, 1.0)).rgb;
  vec3 V = -rd;
  float ndv = clamp(dot(n, V), 0.0, 1.0);
  vec3 L = normalize(vec3(3.0, 5.0, 4.0));
  float lit = 0.6 + 0.5 * max(dot(n, L), 0.0) + 0.25 * max(dot(n, normalize(vec3(-1.0, -0.5, 0.5))), 0.0);

  vec3 R = reflect(rd, n);
  float win = windowLight(R, normalize(vec3(0.35, 0.75, 0.55)), vec2(0.42, 0.08), 0.07) * 1.5
            + windowLight(R, normalize(vec3(-0.75, 0.25, 0.6)), vec2(0.07, 0.34), 0.08) * 1.1
            + windowLight(R, normalize(vec3(0.15, -0.1, 1.0)), vec2(0.22, 0.06), 0.07) * 0.9
            + windowLight(R, normalize(vec3(0.8, 0.1, 0.5)), vec2(0.06, 0.22), 0.07) * 0.7;
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
  float glint = pow(max(dot(n, normalize(L + V)), 0.0), 70.0) * 1.0;

  vec3 col = base * lit * 0.85 + vec3(1.0, 0.98, 1.0) * win * (0.3 + fres) + vec3(0.9, 0.86, 1.0) * fres * 0.12 + glint;
  return min(col, vec3(1.0));
}

vec3 shade(vec3 p, vec3 rd) {
  vec3 n = normalAt(p);
  vec3 q = spin(warp(p)); // object space: the surface colour travels with the body
  float w = uA * (1.0 - uQ); // how much of the body is the orb right now
  if (w < 0.001) return markShade(q, n, rd);
  if (w > 0.999) return orbShade(q, n, rd);
  return mix(markShade(q, n, rd), orbShade(q, n, rd), smoothstep(0.0, 1.0, w));
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// The hero mark's grain: soft, cloudy value noise (not per-pixel static), tied to the screen.
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 4.2);
  vec3 rd = normalize(vec3(uv, -1.4));

  float b = dot(ro, rd);
  // bounding sphere: tight around the body (0.95 covers the mark, the orb and the "?"), growing only while it stretches
  float bound = 0.95 + 0.75 * uStr + 0.25 * uLiq + 0.15 * uQ;
  float h = b * b - (dot(ro, ro) - bound * bound);
  if (h < 0.0) { outColor = vec4(0.0); return; }
  float sq = sqrt(h);
  float t = -b - sq;
  float tEnd = -b + sq;

  float px = 3.0 / uRes.y; // world size of one pixel at the object
  float minD = 1e3;
  float tMin = t;
  bool hit = false;
  for (int i = 0; i < 56; i++) {
    float d = map(ro + rd * t);
    if (d < minD) { minD = d; tMin = t; }
    if (d < 0.0015) { hit = true; break; }
    t += d;
    if (t > tEnd) break;
  }

  // Coverage from the closest approach (not the hit flag) so grazing rays do not flip pixel by pixel.
  float cover = 1.0 - smoothstep(0.002, 0.002 + 1.2 * px, minD);
  if (cover < 0.002) { outColor = vec4(0.0); return; }

  vec3 col = shade(ro + rd * (hit ? t : tMin), rd);
  // same grain size as on the hero's 448px mark (there the mark spans 280px per world unit; here uRes.y / 3)
  vec2 nf = gl_FragCoord.xy * (840.0 / uRes.y);
  col += (vnoise(nf * 0.5) * 0.6 + vnoise(nf * 1.3) * 0.4 - 0.5) * 0.07;
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col * cover, cover);
}`;

// ---------------------------------------------------------------- progressive blur (post-process)
// The design blurs the lower half of the object progressively (0 at the middle of the container, BLUR_MAX_CSS px at its
// bottom edge). It used to be a stack of CSS backdrop-filter layers over the canvas, which is by far the most expensive
// way to do it (7 full-size blurs of a canvas that repaints every frame). Here it is a variable-radius separable blur
// done in GL on half-resolution targets: two 15-tap passes, a few percent of the cost, same look.

const BLUR_MAX_CSS = 40;
const ORB_SPEED = 0.55; // how fast the orb's liquid field evolves (the reference runs at 0.35 and also orbits the camera)

const blurFrag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uDir;     // (1,0) horizontal pass, (0,1) vertical
uniform vec2 uTexel;   // 1 / source size
uniform float uMaxRad; // blur radius at the bottom, in SOURCE texels
uniform float uInset;  // fraction of the canvas below the container's bottom edge
float ramp(float v) { return clamp((0.5 - v) / (0.5 - uInset), 0.0, 1.0); }
void main() {
  float r = uMaxRad * ramp(vUv.y);
  if (r < 0.35) { outColor = texture(uTex, vUv); return; }
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i = -7; i <= 7; i++) {
    float f = float(i);
    float w = exp(-0.125 * f * f); // gaussian, sigma = 2 taps = r / 2
    sum += texture(uTex, vUv + uDir * uTexel * (f * r * 0.25)) * w;
    wsum += w;
  }
  outColor = sum / wsum;
}`;

const composeFrag = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform float uInset;
void main() {
  float rp = clamp((0.5 - vUv.y) / (0.5 - uInset), 0.0, 1.0);
  outColor = mix(texture(uSharp, vUv), texture(uBlur, vUv), clamp(rp * 6.0, 0.0, 1.0));
}`;

// ---------------------------------------------------------------- timeline + interaction

const CYCLE = 23.5;
const sm = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t: number, a: number, b: number) => sm((t - a) / (b - a));
const bump = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));

interface Look {
  a: number;
  q: number;
  liq: number;
  tide: number;
  str: number;
}

/** mark (6s) -> orb with tides (4s) -> liquid, stretched, becomes "?" (held) -> back through the orb to the mark. */
function timeline(time: number): Look {
  const T = time % CYCLE;
  const toOrb = seg(T, 6, 7.8);
  const toQ = seg(T, 12.2, 13.8);
  const backQ = seg(T, 20, 21.4);
  const backMark = seg(T, 21.4, 22.8);
  const a = toOrb * (1 - backMark);
  const q = toQ * (1 - backQ);
  const liq = Math.max(
    bump(T, 6, 7.8) * 0.7,
    seg(T, 11.6, 12.8) * (1 - seg(T, 13.8, 15.2)),
    bump(T, 20, 21.4) * 0.8,
    bump(T, 21.4, 22.8) * 0.7,
  );
  const str = seg(T, 11.8, 13.2) * (1 - seg(T, 13.2, 14.8)) * 0.6;
  return { a, q, liq, tide: a * (1 - q), str };
}

export interface LiquidMark {
  destroy(): void;
}

interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  unit: number;
  ok: boolean;
}

/**
 * @param canvas transparent canvas that overlays the object (pointer-events: none)
 * @param hit    the element whose pointer movement drives the hover behaviour (the "hit zone")
 */
export async function mountLiquidMark(canvas: HTMLCanvasElement, hit: HTMLElement): Promise<LiquidMark | null> {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: import.meta.env.DEV,
  });
  if (!gl) return null;

  // ---- programs. Compiling these (the noise-heavy ones especially) used to block the main thread right when the
  // section scrolled into view; with KHR_parallel_shader_compile the driver does it off-thread and we just wait.
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];
  const linkWith = (vertSrc: string, fragSrc: string) => {
    const program = gl.createProgram()!;
    for (const [type, src] of [
      [gl.VERTEX_SHADER, vertSrc],
      [gl.FRAGMENT_SHADER, fragSrc],
    ] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      gl.attachShader(program, sh);
      shaders.push(sh);
    }
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    programs.push(program);
    return program;
  };
  const bake = linkWith(vert, bakeFrag);
  const body = linkWith(vert, frag);
  const orbDispProg = linkWith(ORB_VERT, ORB_DISP_FRAG);
  const blurProg = linkWith(vert, blurFrag);
  const composeProg = linkWith(vert, composeFrag);
  if (parallel) {
    await new Promise<void>((resolve) => {
      const poll = () => (programs.every((p) => gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR)) ? resolve() : setTimeout(poll, 16));
      poll();
    });
  }
  for (const p of programs) {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn("[liquidMark]", gl.getProgramInfoLog(p), shaders.map((s) => gl.getShaderInfoLog(s)).filter(Boolean).join("\n"));
      return null;
    }
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ---- render targets (texture units: 0 brand, 1 orb displacement, 3 scene, 4 blur A, 5 blur B)
  const makeTarget = (unit: number, w: number, h: number, asFloat: boolean, repeatS: boolean): Target => {
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (asFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatS ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, unit, ok };
  };
  const resizeTarget = (t: Target, w: number, h: number) => {
    gl.activeTexture(gl.TEXTURE0 + t.unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  };

  // brandmark surface (unit 0): the same texture the hero logo look is baked into
  const brand = makeTarget(0, BAKE, BAKE, false, false);
  // orb displacement (unit 1): float when the browser can render to it (smooth), RGBA8 otherwise
  let floatTex = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  let dispTarget = makeTarget(1, ORB_DISP_W, ORB_DISP_H, floatTex, true);
  if (floatTex && !dispTarget.ok) {
    floatTex = false;
    dispTarget = makeTarget(1, ORB_DISP_W, ORB_DISP_H, false, true);
  }
  // scene + half-resolution blur targets (sized in resize())
  const scene = makeTarget(3, 64, 64, false, false);
  const blurA = makeTarget(4, 64, 64, false, false);
  const blurB = makeTarget(5, 64, 64, false, false);
  gl.activeTexture(gl.TEXTURE0);

  const bu = (name: string) => gl.getUniformLocation(bake, name);
  gl.useProgram(bake);
  gl.uniform2fv(bu("uW"), BRANDMARK_WAVE);
  gl.uniform2fv(bu("uL"), BRANDMARK_GLOW);
  gl.uniform1f(bu("uAmp"), 1);
  const bakeT = bu("uT");

  const du = (name: string) => gl.getUniformLocation(orbDispProg, name);
  const dispTime = du("uTime");
  gl.useProgram(orbDispProg);
  gl.uniform2f(du("uSize"), ORB_DISP_W, ORB_DISP_H);
  gl.uniform1f(du("uFloatTex"), floatTex ? 1 : 0);

  const u = (name: string) => gl.getUniformLocation(body, name);
  const uRes = u("uRes");
  const uT = u("uT");
  const uA = u("uA");
  const uQ = u("uQ");
  const uLiq = u("uLiq");
  const uTide = u("uTide");
  const uStr = u("uStr");
  const uDir = u("uDir");
  const uTilt = u("uTilt");
  gl.useProgram(body);
  gl.uniform1i(u("uBrand"), 0);
  gl.uniform1i(u("uOrbDisp"), 1);
  gl.uniform1f(u("uFloatTex"), floatTex ? 1 : 0);

  const bl = (name: string) => gl.getUniformLocation(blurProg, name);
  const blTex = bl("uTex");
  const blDir = bl("uDir");
  const blTexel = bl("uTexel");
  const blMax = bl("uMaxRad");
  const blInset = bl("uInset");
  const co = (name: string) => gl.getUniformLocation(composeProg, name);
  gl.useProgram(composeProg);
  gl.uniform1i(co("uSharp"), 3);
  gl.uniform1i(co("uBlur"), 5);
  const coInset = co("uInset");

  // ---- resolution: <= 1x DPR, lowered if frames run slow (the look is soft, grainy and blurred below anyway)
  let quality = 1;
  let cw = 64;
  let ch = 64;
  let hw = 32;
  let hh = 32;
  let devScale = 1; // render pixels per CSS pixel
  let inset = 0; // fraction of the canvas that sticks out below the section (the container's bottom edge is above it)
  const section = canvas.closest("section");
  const resize = () => {
    devScale = Math.min(window.devicePixelRatio || 1, 1) * 0.9 * quality;
    cw = Math.max(64, Math.round(canvas.clientWidth * devScale));
    ch = Math.max(64, Math.round(canvas.clientHeight * devScale));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      hw = Math.ceil(cw / 2);
      hh = Math.ceil(ch / 2);
      resizeTarget(scene, cw, ch);
      resizeTarget(blurA, hw, hh);
      resizeTarget(blurB, hw, hh);
    }
    if (section) {
      const c = canvas.getBoundingClientRect();
      const sc = section.getBoundingClientRect();
      inset = c.height > 0 ? Math.max(0, Math.min(0.3, (c.bottom - sc.bottom) / c.height)) : 0;
    }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---- pointer: inside the hit zone the body goes liquid; moving = stretch along the motion, still = orb with waves
  let hover = false;
  let lastMove = -1e9;
  let px = 0;
  let py = 0;
  let vx = 0;
  let vy = 0;
  let lastPx = 0;
  let lastPy = 0;
  let lastPt = 0;
  let mx = 0;
  let my = 0;
  const local = (e: PointerEvent) => {
    const r = hit.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)] as const;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const [x, y] = local(e);
    const now = performance.now();
    if (hover && now - lastPt < 100 && now > lastPt) {
      const dt = (now - lastPt) / 1000;
      vx = vx * 0.6 + ((x - lastPx) / dt) * 0.4;
      vy = vy * 0.6 + ((y - lastPy) / dt) * 0.4;
    }
    hover = true;
    lastPx = x;
    lastPy = y;
    lastPt = now;
    lastMove = now;
    px = x;
    py = y;
  };
  const onLeave = () => {
    hover = false;
    vx = vy = 0;
  };
  hit.addEventListener("pointermove", onMove);
  hit.addEventListener("pointerenter", onMove);
  hit.addEventListener("pointerleave", onLeave);

  // ---- state, smoothed so every change (timeline or pointer) is liquid
  const s = { a: 0, q: 0, liq: 0, tide: 0, str: 0, dx: 0, dy: 1, yaw: 0, pitch: 0 };
  const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  const fixedT = dev?.has("lmT") ? Number(dev.get("lmT")) : null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let shownTime = 0;
  const step = (time: number, dt: number, now: number) => {
    shownTime = time;
    const tl = timeline(time);
    let { a, q, liq, tide, str } = tl;
    let tdx = 0;
    let tdy = 1;
    if (hover && !reduced) {
      const speed = Math.hypot(vx, vy);
      const moving = now - lastMove < 140 && speed > 0.05;
      if (moving) {
        liq = 1;
        str = Math.min(0.85, speed * 0.45);
        tdx = vx / speed;
        tdy = vy / speed;
      } else {
        a = 1;
        q = 0;
        tide = 1;
        liq = 0.3;
        str = 0;
      }
    }
    s.a = damp(s.a, a, 7, dt);
    s.q = damp(s.q, q, 7, dt);
    s.liq = damp(s.liq, liq, 6, dt);
    s.tide = damp(s.tide, tide, 5, dt);
    s.str = damp(s.str, str, 9, dt);
    if (str > 0.02) {
      // while moving follow the pointer's direction, otherwise the timeline's vertical stretch (dir = 0, 1)
      s.dx = damp(s.dx, tdx, 12, dt);
      s.dy = damp(s.dy, tdy, 12, dt);
      const len = Math.hypot(s.dx, s.dy) || 1;
      s.dx /= len;
      s.dy /= len;
    }
    mx = damp(mx, hover ? px : 0, 4, dt);
    my = damp(my, hover ? py : 0, 4, dt);
    s.yaw = 0.42 * Math.sin(time * 0.52) + mx * 0.28;
    s.pitch = 0.12 * Math.sin(time * 0.37 + 1) - my * 0.2;
  };

  // Dev only: `?lmStats` logs the average GPU time per frame (EXT_disjoint_timer_query_webgl2, when available).
  const timer = dev?.has("lmStats") ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
  let pendingQuery: WebGLQuery | null = null;
  let gpuSum = 0;
  let gpuN = 0;

  const fullQuad = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
  const draw = () => {
    if (timer && !pendingQuery) {
      pendingQuery = gl.createQuery()!;
      gl.beginQuery(timer.TIME_ELAPSED_EXT, pendingQuery);
    }
    // pass 1: bake the surface and the orb's liquid field (every frame: updating them at half rate made the surface,
    // and above all its sharp highlights, step 15 times a second, which reads as vibration)
    {
      gl.bindFramebuffer(gl.FRAMEBUFFER, brand.fb);
      gl.viewport(0, 0, BAKE, BAKE);
      gl.useProgram(bake);
      gl.uniform1f(bakeT, shownTime);
      fullQuad();
      if (s.a * (1 - s.q) > 0.002) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dispTarget.fb);
        gl.viewport(0, 0, ORB_DISP_W, ORB_DISP_H);
        gl.useProgram(orbDispProg);
        gl.uniform1f(dispTime, shownTime * ORB_SPEED);
        fullQuad();
      }
    }
    // pass 2: the body, into the scene target
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(body);
    gl.uniform2f(uRes, cw, ch);
    gl.uniform1f(uT, shownTime);
    gl.uniform1f(uA, s.a);
    gl.uniform1f(uQ, s.q);
    gl.uniform1f(uLiq, s.liq);
    gl.uniform1f(uTide, s.tide);
    gl.uniform1f(uStr, s.str);
    gl.uniform2f(uDir, s.dx, s.dy);
    gl.uniform2f(uTilt, s.yaw, s.pitch);
    fullQuad();
    // pass 3: progressive blur (half resolution): horizontal, then vertical
    gl.useProgram(blurProg);
    gl.uniform1f(blInset, inset);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fb);
    gl.viewport(0, 0, hw, hh);
    gl.uniform1i(blTex, 3);
    gl.uniform2f(blDir, 1, 0);
    gl.uniform2f(blTexel, 1 / cw, 1 / ch);
    gl.uniform1f(blMax, BLUR_MAX_CSS * devScale);
    fullQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fb);
    gl.uniform1i(blTex, 4);
    gl.uniform2f(blDir, 0, 1);
    gl.uniform2f(blTexel, 1 / hw, 1 / hh);
    gl.uniform1f(blMax, BLUR_MAX_CSS * devScale * 0.5);
    fullQuad();
    // pass 4: sharp + blurred, mixed by height, to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(composeProg);
    gl.uniform1f(coInset, inset);
    fullQuad();

    if (timer && pendingQuery) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      const q = pendingQuery;
      const check = () => {
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
          if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
            gpuSum += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
            if (++gpuN === 60) {
              console.info(`[liquidMark] GPU ${(gpuSum / gpuN).toFixed(2)} ms/frame (${cw}x${ch}, orb ${(s.a * (1 - s.q)).toFixed(2)})`);
              gpuSum = gpuN = 0;
            }
          }
          pendingQuery = null;
        } else setTimeout(check, 50);
      };
      check();
    }
  };

  // ---- loop: only while visible, at the display rate (a 30fps cap made the slow motion look choppy)
  let raf = 0;
  let visible = true;
  const t0 = performance.now();
  let last = t0;
  let lastDrawn = t0;
  let intervalSum = 0;
  let intervalN = 0;
  const loop = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = fixedT ?? (now - t0) / 1000;
    step(time, dt, now);
    draw();
    // adaptive quality: if frames keep arriving well later than the target interval, the GPU can't keep up -> drop
    // resolution. (Intervals after a pause / hover change are ignored.)
    const interval = now - lastDrawn;
    lastDrawn = now;
    if (interval < 200) {
      intervalSum += interval;
      if (++intervalN === 45) {
        if (intervalSum / intervalN > 16.7 * 1.5 && quality > 0.5) {
          quality *= 0.85;
          resize();
        }
        intervalSum = intervalN = 0;
      }
    }
  };
  const start = () => {
    if (!raf && !reduced) {
      last = lastDrawn = performance.now();
      intervalSum = intervalN = 0;
      raf = requestAnimationFrame(loop);
    }
  };

  step(fixedT ?? 0, 10, 0); // dt large: the first frame already sits on the timeline (the plain mark)
  draw();

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) start();
  });
  observer.observe(canvas);
  const onVisibility = () => {
    if (!document.hidden) start();
  };
  document.addEventListener("visibilitychange", onVisibility);
  start();

  return {
    destroy() {
      observer.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      hit.removeEventListener("pointermove", onMove);
      hit.removeEventListener("pointerenter", onMove);
      hit.removeEventListener("pointerleave", onLeave);
    },
  };
}
