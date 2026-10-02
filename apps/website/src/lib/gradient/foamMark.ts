// Animated "foamy clay" gradient for the hero logo mark, drawn by a WebGL2 fragment shader.
// One canvas, two looks blended by `getMix()` (0..1):
//   A (0) - the fluxa-logo.png palette, the original layered radial gradients over a 200deg ramp,
//           rotating slowly (same geometry as the CSS fallback in Hero.astro).
//   B (1) - the brandmark: the design's Figma wave composition (lavender / pink / indigo band), undulating.
//   C (getMix2, 0..1, blended over the A/B result) - the orange "gradient-3" of the rounded square (Hero-Animation-4):
//           soft colour blobs + one big red lobe, drifting slowly.
// Both are domain-warped by noise so the colour visibly flows. Returns null when WebGL2 is missing
// (the CSS fallback underneath stays visible).

// Scene B is the design's Figma composition (copy-paste/fluxa web/copy paste.txt), rebuilt in the shader:
// one big "wave" shape repeated at different offsets/colours/blend modes, each edge softened by that
// layer's blur, plus a few ellipses. Shapes live in the design's 1400x1400 space (y down).
import { BRANDMARK_GLSL, BRANDMARK_GLOW, BRANDMARK_WAVE } from "./brandmarkScene";

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
uniform float uMix;
uniform float uMix2;

${BRANDMARK_GLSL}

// ---- Scene C: gradient-3 (orange / red rounded square) -------------------------------------------
// Fitted to copy-paste/fluxa web/gradient-3.png (uv 0..1, y down) with an offline hill-climber (mean error ~3.2/255):
// a normalised sum of Gaussian colour blobs (the peach / orange / red-brown field) plus one big red lobe on top.
// The fit tooling was not kept; re-create it (same math in JS, at t = 0) if the reference changes. Blobs and the lobe drift on the particle-field flow,
// measured against t = 0 so the rest position is the reference.
vec3 c255(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
void blob(inout vec3 sum, inout float wsum, vec2 uv, vec2 c, vec3 col, float s, float k) {
  c += 0.05 * uAmp * (fieldDir(c * 2.0, uT * 0.55 + k) - fieldDir(c * 2.0, k));
  vec2 d = uv - c;
  float w = exp(-dot(d, d) / (2.0 * s * s));
  sum += col * w;
  wsum += w;
}
vec3 sceneC(vec2 uv) {
  vec2 q = uv + 0.03 * uAmp * (flow(uv * 0.9, uT * 0.3) - flow(uv * 0.9, 0.0));
  vec3 sum = c255(245.0, 137.0, 60.0) * 1e-3;
  float ws = 1e-3;
  blob(sum, ws, q, vec2(-0.01, -0.001), c255(203.3, 64.2, 51.3), 0.194, 1.0);
  blob(sum, ws, q, vec2(0.586, -0.1), c255(254.2, 211.3, 124.9), 0.249, 2.0);
  blob(sum, ws, q, vec2(1.203, 0.137), c255(244.8, 144.4, 7.3), 0.265, 3.0);
  blob(sum, ws, q, vec2(0.678, 0.492), c255(235.1, 54.8, -10.4), 0.171, 4.0);
  blob(sum, ws, q, vec2(-0.166, 0.506), c255(246.4, 168.2, 99.4), 0.168, 5.0);
  blob(sum, ws, q, vec2(0.066, 0.445), c255(252.6, 200.0, 151.3), 0.075, 6.0);
  blob(sum, ws, q, vec2(0.284, 0.689), c255(236.8, 49.3, 22.1), 0.172, 7.0);
  blob(sum, ws, q, vec2(0.444, 1.558), c255(225.5, 182.4, 101.0), 0.049, 8.0);
  blob(sum, ws, q, vec2(0.807, 1.09), c255(248.0, 130.2, -137.1), 0.176, 9.0);
  blob(sum, ws, q, vec2(0.886, 0.681), c255(239.7, 107.8, 116.8), 0.108, 10.0);
  vec3 col = sum / ws;
  // the red lobe (an ellipse; fitted numbers)
  vec2 lc = vec2(0.569, 0.708) + 0.03 * uAmp * (fieldDir(vec2(0.3, 0.6), uT * 0.5 + 9.0) - fieldDir(vec2(0.3, 0.6), 9.0));
  vec2 lr = vec2(0.408, 0.466) * (1.0 + 0.03 * uAmp * sin(uT * 0.7));
  float sd = (1.0 - length((q - lc) / lr)) * min(lr.x, lr.y);
  float edge = mix(0.126, 0.287, smoothstep(0.55, 0.95, q.x));
  float t = clamp(dot(q - vec2(0.3, 0.55), normalize(vec2(1.0, 0.6))) / 0.8, 0.0, 1.0);
  vec3 inner = mix(c255(238.8, 81.0, 60.6), c255(256.5, 241.3, 155.7), t * t);
  inner = mix(inner, c255(250.2, 206.5, 105.7), smoothstep(0.55, 0.95, q.y) * (1.0 - q.x) * 0.885);
  col = mix(col, inner, cover(sd, max(edge, 0.001)));
  // thin cream light along the top and bottom edges
  col = mix(col, c255(252.0, 220.0, 192.0), (1.0 - smoothstep(0.0, 0.055, q.y)) * 1.037);
  col = mix(col, c255(252.0, 214.0, 184.0), smoothstep(0.845, 1.0, q.y) * 1.019);
  return clamp(col, 0.0, 1.0);
}

// approximate outline of the clover mark in 0..1 space: a wide top capsule + two bottom circles
float sdClover(vec2 p) {
  vec2 c = vec2(clamp(p.x, 0.25, 0.75), 0.25);
  float top = length(p - c) - 0.25;
  float bl = length(p - vec2(0.25, 0.75)) - 0.25;
  float br = length(p - vec2(0.75, 0.75)) - 0.25;
  return min(top, min(bl, br));
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  // glass / metal (only on the brandmark look): a slow diagonal sheen sweeping over the surface, soft speculars
  // and a gentle S-curve for a satin-metal depth. No edge or refraction terms, so nothing draws along the seams
  // between the lobes. GLASS = 0.0 turns it off.
  const float GLASS = 1.0;
  vec3 col = mix(sceneA(uv), sceneB(uv), uMix);
  if (uMix2 > 0.0) col = mix(col, sceneC(uv), uMix2);
  float glass = uMix * (1.0 - 0.6 * uMix2); // the satin / noise passes belong to the brandmark look; C keeps a lighter touch
  float along = dot(uv - 0.5, vec2(0.62, 0.78)) + 0.06 * sin(uT * 0.5);
  float sheen = exp(-pow((along - 0.12 * sin(uT * 0.35 + 1.0)) / 0.11, 2.0)) * 0.55 + exp(-pow((along + 0.28) / 0.07, 2.0)) * 0.25;
  vec2 s1 = uv - vec2(0.2, 0.13), s2 = uv - vec2(0.15, 0.62), s3 = uv - vec2(0.62, 0.62);
  float spec = exp(-dot(s1, s1) / 0.004) + 0.7 * exp(-dot(s2, s2) / 0.003) + 0.7 * exp(-dot(s3, s3) / 0.003);
  vec3 satin = col * col * (3.0 - 2.0 * col);
  col = mix(col, satin, 0.35 * GLASS * glass);
  col += vec3(1.0, 0.98, 1.0) * (sheen * 0.11 + spec * 0.07) * GLASS * glass;
  // soft static noise (smooth, cloudy - not per-pixel grain), only on the brandmark look
  vec2 nf = gl_FragCoord.xy;
  col += (vnoise(nf * 0.5) * 0.6 + vnoise(nf * 1.3) * 0.4 - 0.5) * 0.07 * glass;
  outColor = vec4(col, 1.0);
}`;

export function mountFoamMark(canvas: HTMLCanvasElement, getMix: () => number, animate = true, getMix2: () => number = () => 0) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: import.meta.env.DEV });
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
    console.warn("[foamMark]", error);
    canvas.remove(); // an opaque, never-drawn canvas would cover the CSS fallback
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const size = 448;
  canvas.width = size;
  canvas.height = size;
  gl.viewport(0, 0, size, size);

  gl.uniform2fv(gl.getUniformLocation(program, "uW"), BRANDMARK_WAVE);
  gl.uniform2fv(gl.getUniformLocation(program, "uL"), BRANDMARK_GLOW);
  const uT = gl.getUniformLocation(program, "uT");
  const uMix = gl.getUniformLocation(program, "uMix");
  const uMix2 = gl.getUniformLocation(program, "uMix2");
  const uAmp = gl.getUniformLocation(program, "uAmp");

  // Dev only: ?foamT=<seconds>&foamMix=<0..1> freezes the look for comparing against the design.
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  const fixedT = dev?.has("foamT") ? Number(dev.get("foamT")) : null;
  const fixedMix = dev?.has("foamMix") ? Number(dev.get("foamMix")) : null;
  const fixedMix2 = dev?.has("foamMix2") ? Number(dev.get("foamMix2")) : null; // ?foamMix=1&foamMix2=1 previews gradient-3
  const draw = (seconds: number) => {
    gl.uniform1f(uT, fixedT ?? seconds);
    gl.uniform1f(uMix, fixedMix ?? getMix());
    gl.uniform1f(uMix2, fixedMix2 ?? getMix2());
    gl.uniform1f(uAmp, dev?.has("foamFlat") ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let raf = 0;
  let visible = true;
  const t0 = performance.now();
  const loop = (now: number) => {
    raf = 0;
    if (!visible) return;
    draw((now - t0) / 1000);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (animate && !raf) raf = requestAnimationFrame(loop);
  };

  draw(0);
  // Only spend GPU time while the mark is on screen.
  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) start();
  });
  observer.observe(canvas);
  start();

  return {
    redraw: () => draw((performance.now() - t0) / 1000),
    destroy: () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    },
  };
}
