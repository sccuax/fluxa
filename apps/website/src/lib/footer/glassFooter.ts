// Footer scene: the Rive animation (hero.riv) behind a blurred rectangular mask, with the "Fluxa" wordmark as a glass
// layer on top - all composited in ONE WebGL2 pass so the glass refracts exactly what is behind it.
//
//   Rive canvas (invisible, on TOP only so the pointer reaches the state machine that listens to it)
//        -> texture each frame -> fragment shader:
//             scene = Rive frame, faded to the page colour by the mask (a 1097x380 box blurred by Figma's 160 = sigma 80,
//                     evaluated analytically, no mask image)
//             glass = the letters' signed-distance field: bevel normal -> refraction (+ dispersion), frost blur,
//                     a rim light at -45deg (and a weaker opposite one), soft layer-blur edge, bottom fade
//
// Figma's Glass values are the DEFAULTS below (refraction 80, depth 20, dispersion 50, frost 4, light 80%, angle -45deg,
// layer blur 24). Figma's blur value is twice the Gaussian sigma. In dev, `window.__footerGlass.set({...})` re-tunes live.
import { Rive, Layout, Fit } from "@rive-app/canvas";
import riveUrl from "@/assets/hero.riv?url";
import { FRAME, distanceToZeros, fillLetters } from "./wordmark";

export interface GlassParams {
  refraction: number; // 0..100
  depth: number; // px, width of the bevel
  dispersion: number; // 0..100
  frost: number; // px, backdrop blur radius
  light: number; // 0..1 rim light intensity
  lightAngle: number; // degrees (Figma: -45)
  layerBlur: number; // Figma layer blur of the glass body (sigma = value / 2)
  fadeFrom: number; // 0..1 of the wordmark height where the glass starts to dissolve
  fadeTo: number;
  maskBlur: number; // Figma layer blur of the mask (sigma = value / 2)
  overlay: number; // 0..1 opacity of the #0B0D12 layer over the Rive scene (Figma: the mask's own fill)
  desaturate: number; // 0..1 how much colour the overlay drains from the scene
}

export const DEFAULTS: GlassParams = {
  refraction: 80,
  depth: 20,
  dispersion: 50,
  frost: 4,
  light: 0.8,
  lightAngle: -45,
  layerBlur: 24,
  fadeFrom: 0.5,
  fadeTo: 1,
  maskBlur: 160,
  overlay: 0.5,
  desaturate: 0.2,
};

const MASK = { w: 1097, h: 380, centerY: 0.54 } as const; // Figma px; sigma = blur / 2
const PAGE_RGB: [number, number, number] = [11 / 255, 13 / 255, 18 / 255]; // background-dark #0b0d12
const SM = "State Machine 1";
// hero.riv opens with a "RIVE" splash (~0.5s) and a black beat before the scene grows in: the scene is hidden for this long
// after it starts playing, then fades in.
const MELT_MS = 2600; // letters: melted -> solid
const ALPHA_MS = 700; // ...and they fade in over the first part of it
const HIDE_MS = 1000;
// The splash lives in the file's STATE MACHINE (its individual animations have none), so it cannot be skipped from code.
// Instead the scene is pre-played, unseen, for this long as soon as it has loaded (long before the footer opens), then
// paused on a settled frame: when the entrance runs there is no splash and no wait.
const PREWARM_MS = 1300;
const FADE_MS = 600;
const PAD = 48; // css px of SDF around the wordmark (rim light + soft edge need room)

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;   // Rive frame
uniform sampler2D uSdf;     // signed distance to the letters' outline, css px (+ inside)
uniform vec2 uSize;         // footer css size
uniform float uDpr;
uniform vec2 uWmOrigin;     // wordmark frame top-left, css px
uniform vec2 uWmSize;       // wordmark frame size, css px
uniform vec2 uMaskCenter;
uniform vec2 uMaskHalf;
uniform float uMaskSigma;
uniform vec3 uPage;
uniform float uOverlay, uDesat, uGain, uMelt, uAlpha;
uniform float uRefr, uDepth, uDisp, uFrost, uLight, uLayer, uFadeFrom, uFadeTo;
uniform vec2 uLightDir;
uniform float uPad;
out vec4 outColor;

vec2 erf1(vec2 x) {
  vec2 s = sign(x); x = abs(x);
  vec2 t = 1.0 + x * (0.278393 + x * (0.230389 + x * (0.000972 + x * 0.078108)));
  t *= t; t *= t;
  return s * (1.0 - 1.0 / t);
}
// A box blurred by a Gaussian is a product of two erf differences (exact).
float maskAt(vec2 p) {
  vec2 q = p - uMaskCenter;
  float k = 1.0 / (uMaskSigma * 1.41421356);
  vec2 a = 0.5 * (erf1((q + uMaskHalf) * k) - erf1((q - uMaskHalf) * k));
  return a.x * a.y;
}
vec3 behind(vec2 p) {
  vec2 uv = clamp(p / uSize, 0.0, 1.0);
  vec3 s = texture(uScene, uv).rgb;
  s = mix(s, vec3(dot(s, vec3(0.2126, 0.7152, 0.0722))), uDesat);
  s = mix(s, uPage, uOverlay);
  s = mix(uPage, s, uGain); // hides the file's first moments (see HIDE_MS)
  return mix(uPage, s, maskAt(p));
}
// The letters "melt" in: while uMelt > 0 the field they are read from sags (more at the bottom, in waves) and wobbles.
vec2 warp(vec2 p) {
  if (uMelt <= 0.0) return p;
  float v = clamp((p.y - uWmOrigin.y) / uWmSize.y, 0.0, 1.0);
  float wave = 0.6 + 0.4 * sin(p.x * 0.045 + 1.3);
  float sag = (24.0 + 120.0 * smoothstep(0.15, 1.0, v)) * wave;
  return p + vec2(uMelt * 16.0 * sin(p.y * 0.03 + p.x * 0.012), -uMelt * sag);
}
float sdfAt(vec2 pw) {
  vec2 p = warp(pw);
  vec2 uv = (p - uWmOrigin + uPad) / (uWmSize + 2.0 * uPad);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -64.0;
  return texture(uSdf, uv).r;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec3 col = behind(p);

  float sd = sdfAt(p);
  if (sd > -(uLayer * 0.5 + 2.0 + uMelt * 20.0)) {
    // outline normal (points INTO the letter) from the SDF's gradient
    vec2 g = vec2(sdfAt(p + vec2(1.0, 0.0)) - sdfAt(p - vec2(1.0, 0.0)), sdfAt(p + vec2(0.0, 1.0)) - sdfAt(p - vec2(0.0, 1.0))) * 0.5;
    float gl = length(g);
    vec2 n = gl > 1e-4 ? g / gl : vec2(0.0);

    float t = clamp(sd / uDepth, 0.0, 1.0);
    float bend = pow(1.0 - t, 2.0) * step(0.0, sd + 0.5);
    float R = uRefr * 0.01 * uDepth * 1.2 * (1.0 + 0.6 * uMelt);

    // refraction + chromatic dispersion + frost (a small disc blur), per channel
    vec3 glass;
    float d = uDisp * 0.01;
    float ks[3] = float[3](1.0 - 0.5 * d * 2.0, 1.0, 1.0 + 0.5 * d * 2.0);
    for (int c = 0; c < 3; c++) {
      vec2 q = p + n * bend * R * ks[c];
      float acc = 0.0;
      for (int i = 0; i < 5; i++) {
        vec2 o = i == 0 ? vec2(0.0) : vec2(cos(1.5708 * float(i - 1) + 0.785), sin(1.5708 * float(i - 1) + 0.785)) * uFrost;
        acc += behind(q + o)[c];
      }
      glass[c] = acc / 5.0;
    }

    // rim light: bright on the edges facing the light, weaker on the opposite ones
    vec2 nOut = -n;
    // Like the navbar's glass border: a narrow lobe facing the light, a weaker one opposite, and low-frequency gaps along
    // the contour, so only some stretches of the outline catch light and the rest almost disappear.
    float facing = pow(max(dot(nOut, uLightDir), 0.0), 1.8) + 0.5 * pow(max(dot(nOut, -uLightDir), 0.0), 1.8);
    float gaps = smoothstep(0.05, 0.6, 0.5 + 0.28 * sin(p.x * 0.011 + p.y * 0.017) + 0.22 * sin(p.x * 0.0047 - p.y * 0.013 + 1.7));
    float rim = 1.0 - smoothstep(0.0, 1.6, sd);
    float soft = pow(1.0 - t, 3.0) * 0.12;
    float hl = facing * gaps * (rim + soft) * uLight * (1.0 - uMelt);

    float v = (p.y - uWmOrigin.y) / uWmSize.y;
    float fade = (1.0 - clamp((v - uFadeFrom) / (uFadeTo - uFadeFrom), 0.0, 1.0)) * uAlpha; // linear, like the hero's letters
    float coverCrisp = smoothstep(-0.6, 0.6, sd);
    float feather = max(uLayer * 0.25, 0.5) + uMelt * 18.0;
    float coverBody = smoothstep(-feather, feather, sd);

    vec3 body = mix(col, glass + 0.025, coverBody * fade);
    col = body + vec3(hl) * coverCrisp * fade * step(0.0, sd + 0.6);
  }
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // dither: the dark gradients band otherwise
  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
  return s;
}

export interface FooterScene {
  destroy(): void;
}

export interface SceneOptions {
  /** false: just the masked Rive scene (the home hero's backdrop), no glass letters. Default true (the footer). */
  glass?: boolean;
  /** The blurred mask box (css px, Figma blur) and where its centre sits (fraction of the height). */
  mask?: Partial<{ w: number; h: number; centerY: number; blur: number }>;
  params?: Partial<GlassParams>;
}

/** Returns null when WebGL2 (or float-texture upload) is unavailable: the caller shows the CSS fallback. */
export function mountFooterScene(
  root: HTMLElement,
  glCanvas: HTMLCanvasElement,
  riveCanvas: HTMLCanvasElement,
  wordmark: HTMLElement,
  reducedMotion: boolean,
  options: SceneOptions = {},
): FooterScene | null {
  const hasGlass = options.glass !== false;
  const mask = { ...MASK, ...options.mask };
  const gl = glCanvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
  if (!gl) return null;

  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
  } catch (err) {
    console.warn("[footer] shader failed, using the CSS fallback", err);
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = {
    scene: U("uScene"), sdf: U("uSdf"), size: U("uSize"), dpr: U("uDpr"), wmO: U("uWmOrigin"), wmS: U("uWmSize"),
    mc: U("uMaskCenter"), mh: U("uMaskHalf"), ms: U("uMaskSigma"), page: U("uPage"), refr: U("uRefr"),
    depth: U("uDepth"), disp: U("uDisp"), frost: U("uFrost"), light: U("uLight"), layer: U("uLayer"),
    ov: U("uOverlay"), gn: U("uGain"), melt: U("uMelt"), alpha: U("uAlpha"), ds: U("uDesat"), ff: U("uFadeFrom"), ft: U("uFadeTo"), ld: U("uLightDir"), pad: U("uPad"),
  };

  const mkTex = (unit: number) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  mkTex(0); // scene
  mkTex(1); // sdf
  gl.uniform1i(u.scene, 0);
  gl.uniform1i(u.sdf, 1);
  gl.uniform3f(u.page, ...PAGE_RGB);

  const params: GlassParams = { ...DEFAULTS, ...options.params, ...(options.mask?.blur ? { maskBlur: options.mask.blur } : {}) };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let visible = false;
  let intersecting = false;
  // On the home page the footer is revealed by a scroll animation (lib/motion/ctaStage.ts): until it opens, the scene sleeps.
  const gateEl = root.closest<HTMLElement>("[data-cta-footer]");
  // `data-scene-hidden` on the root: the home page puts it on the hero's scene once the hero has faded it out.
  const gateOpen = () => gateEl?.dataset.gate !== "closed" && root.dataset.sceneHidden !== "true";
  let raf = 0;
  let destroyed = false;
  let sceneReady = false;
  // Reveal (letters melt in, legal row rises): driven by the home page's footer entrance (fluxa:footer-reveal), or by the
  // footer first showing on screen when there is no entrance (mobile / reduced layout).
  let revealed = false;
  let revealAt = 0;
  const animated = !reducedMotion && hasGlass;
  let forced: [number, number] | null = null; // dev only: freeze [melt, alpha] to inspect a frame
  const pushReveal = () => {
    if (!hasGlass) {
      gl.uniform1f(u.melt, 0);
      gl.uniform1f(u.alpha, 0);
      return;
    }
    if (forced) {
      gl.uniform1f(u.melt, forced[0]);
      gl.uniform1f(u.alpha, forced[1]);
      return;
    }
    if (!animated) {
      gl.uniform1f(u.melt, 0);
      gl.uniform1f(u.alpha, 1);
      return;
    }
    const t = revealed ? performance.now() - revealAt : 0;
    const k = Math.min(Math.max(t / MELT_MS, 0), 1);
    gl.uniform1f(u.melt, revealed ? Math.pow(1 - k, 3) : 1);
    gl.uniform1f(u.alpha, revealed ? Math.min(t / ALPHA_MS, 1) : 0);
  };
  const setReveal = (on: boolean) => {
    if (!animated || on === revealed) return;
    revealed = on;
    revealAt = performance.now();
    root.dataset.footerReveal = String(on);
    pushReveal();
    kick();
  };
  if (animated) root.dataset.footerReveal = "false";
  let prewarming = false;
  let played = 0; // ms the animation has been playing
  let lastTick = 0;
  const setGain = () => gl.uniform1f(u.gn, reducedMotion ? 1 : Math.min(Math.max((played - HIDE_MS) / FADE_MS, 0), 1));
  const wantsPlay = () => visible && !reducedMotion; // plays while the footer is on screen

  const pushParams = () => {
    gl.uniform1f(u.refr, params.refraction);
    gl.uniform1f(u.depth, params.depth);
    gl.uniform1f(u.disp, params.dispersion);
    gl.uniform1f(u.frost, params.frost);
    gl.uniform1f(u.light, params.light);
    gl.uniform1f(u.layer, params.layerBlur);
    gl.uniform1f(u.ms, params.maskBlur / 2);
    gl.uniform1f(u.ov, params.overlay);
    gl.uniform1f(u.ds, params.desaturate);
    gl.uniform1f(u.ff, params.fadeFrom);
    gl.uniform1f(u.ft, params.fadeTo);
    const a = (params.lightAngle * Math.PI) / 180;
    // Figma's angle is measured with y up; -45deg lights the top-left edges in screen space (y down).
    gl.uniform2f(u.ld, -Math.cos(a), Math.sin(a));
  };

  // Signed distance field of the letters, in css px (+ inside), uploaded as a half-float texture.
  const buildSdf = (wmW: number, wmH: number) => {
    const sc = Math.min(window.devicePixelRatio || 1, 1.5);
    const px = (wmW / FRAME.w) * sc; // device px per frame unit
    const tw = Math.ceil((wmW + 2 * PAD) * sc);
    const th = Math.ceil((wmH + 2 * PAD) * sc);
    const c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    fillLetters(ctx, px, PAD / (wmW / FRAME.w)); // pad is in frame units here
    const a = ctx.getImageData(0, 0, tw, th).data;
    const inside = new Uint8Array(tw * th);
    const outside = new Uint8Array(tw * th);
    for (let i = 0; i < tw * th; i++) {
      const on = a[i * 4 + 3] > 127 ? 1 : 0;
      inside[i] = on;
      outside[i] = on ? 0 : 1;
    }
    const dIn = distanceToZeros(tw, th, inside);
    const dOut = distanceToZeros(tw, th, outside);
    const sdf = new Float32Array(tw * th);
    for (let i = 0; i < tw * th; i++) sdf[i] = (inside[i] ? dIn[i] - 0.5 : -(dOut[i] - 0.5)) / sc; // css px
    gl.activeTexture(gl.TEXTURE1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, tw, th, 0, gl.RED, gl.FLOAT, sdf);
  };

  const layout = () => {
    const r = root.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resized = w !== width || h !== height;
    width = w;
    height = h;
    glCanvas.width = Math.round(w * dpr);
    glCanvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    const wm = wordmark.getBoundingClientRect();
    const wo = { x: wm.left - r.left, y: wm.top - r.top, w: wm.width, h: wm.height };
    gl.uniform2f(u.size, w, h);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform2f(u.wmO, wo.x, wo.y);
    gl.uniform2f(u.wmS, wo.w, wo.h);
    gl.uniform1f(u.pad, PAD);
    // The mask box is a fixed 1097x380 (Figma px), centred horizontally and MASK.centerY down the footer (footer.png).
    gl.uniform2f(u.mc, w / 2, h * mask.centerY);
    gl.uniform2f(u.mh, mask.w / 2, mask.h / 2);
    if (hasGlass) buildSdf(wo.w, wo.h);
    pushParams();
    setGain();
    pushReveal();
    rive?.resizeDrawingSurfaceToCanvas();
    void resized;
    draw();
  };

  const draw = () => {
    if (destroyed || !width) return;
    if (sceneReady) {
      gl.activeTexture(gl.TEXTURE0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, riveCanvas);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = () => {
    raf = 0;
    if (!wantsPlay() || destroyed) return;
    const now = performance.now();
    if (lastTick) played += Math.min(now - lastTick, 100);
    lastTick = now;
    setGain();
    pushReveal();
    draw();
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (wantsPlay() && !raf) raf = requestAnimationFrame(loop);
  };
  // Start / stop everything that costs GPU time (Rive's frames and our pass).
  const sync = () => {
    if (wantsPlay()) {
      rive?.play(SM);
      kick();
    } else if (!prewarming) {
      rive?.pause(SM);
      lastTick = 0;
    }
  };

  let rive: Rive | null = new Rive({
    src: riveUrl,
    canvas: riveCanvas,
    autoplay: !reducedMotion,
    stateMachines: SM,
    layout: new Layout({ fit: Fit.Cover }),
    onLoad: () => {
      sceneReady = true;
      rive?.resizeDrawingSurfaceToCanvas();
      root.dataset.ready = "true";
      if (!visible) {
        if (reducedMotion) rive?.pause(SM);
        else {
          prewarming = true; // keep playing, unseen: the file's opening splash goes by before anyone can see it
          setTimeout(() => {
            prewarming = false;
            played = Math.max(played, HIDE_MS + FADE_MS); // already past the splash: no need to hide the scene
            sync();
          }, PREWARM_MS);
        }
      }
      draw();
    },
    onLoadError: (err) => console.warn("[footer] hero.riv failed to load", err),
  });

  const ro = new ResizeObserver(layout);
  ro.observe(root);
  const io = new IntersectionObserver(
    ([e]) => {
      intersecting = e.isIntersecting;
      visible = intersecting && gateOpen();
      if (intersecting && gateEl?.dataset.gate === undefined) setReveal(true); // no entrance animation: reveal on first sight
      sync();
    },
    { rootMargin: "200px" },
  );
  io.observe(root);
  const onGate = () => {
    visible = intersecting && gateOpen();
    sync();
  };
  window.addEventListener("fluxa:footer-gate", onGate);
  window.addEventListener("fluxa:scene-gate", onGate);
  const onReveal = (e: Event) => setReveal((e as CustomEvent<boolean>).detail);
  window.addEventListener("fluxa:footer-reveal", onReveal);
  layout();

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>)[hasGlass ? "__footerGlass" : "__heroGlass"] = {
      params,
      rive: () => rive,
      freeze(melt: number, alpha = 1) {
        forced = [melt, alpha];
        pushReveal();
        draw();
      },
      state: () => ({ playing: rive?.isPlaying, visible, raf, played, revealed, revealAt, now: performance.now(), sceneReady }),
      set(next: Partial<GlassParams>) {
        Object.assign(params, next);
        pushParams();
        draw();
      },
    };
  }

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("fluxa:footer-gate", onGate);
      window.removeEventListener("fluxa:scene-gate", onGate);
      window.removeEventListener("fluxa:footer-reveal", onReveal);
      rive?.cleanup();
      rive = null;
    },
  };
}
