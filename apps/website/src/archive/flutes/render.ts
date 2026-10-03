// Static fluted-glass renderer (drawn ONCE per size, never animated).
//
// Recreates copy-paste/fluxa web/flutes.png. What the reference shows, and what
// this models:
//   - diagonal seams (53deg above the horizontal), a constant perpendicular
//     period, drawn as hairlines by CSS;
//   - the colour lives in "blades" hugging each flute's LEFT seam: a blue edge
//     on the seam, a purple body, and a sharp tip at the top. The blade widens
//     downward (so its far edge is a slanted line, edged in thin red) until it
//     fills the flute;
//   - blade tips lie on a line descending to the right (~17deg);
//   - the bodies dissolve softly at the bottom and fade out towards the right,
//     where a separate dim cluster appears at the lower right.
//
// Coordinates are "reference units" (the design's 2000px-wide frame, seams 156
// apart) scaled by k = period / 156, so the artwork follows the hero's width.
//
// Pure functions (no DOM) so the same code renders in Node for offline
// comparison against the reference image.

export interface FluteParams {
  /** Seam angle above the horizontal. Reference: 53. */
  angleDeg: number;
  /** Perpendicular distance between seams, CSS px. Reference: 7.8% of the width. */
  period: number;
  /** Bottom edge of the fixed navbar in CSS px: nothing is drawn beneath it. */
  navBottom: number;
}

export const DEFAULT_FLUTES: FluteParams = {
  angleDeg: 53,
  period: 156,
  navBottom: 93,
};

const REF_PERIOD = 156;
const REF_SEAM_PHASE = 91; // measured position of a seam along the normal
const RAD = Math.PI / 180;

// ---- artwork constants, reference units -----------------------------------
const TIP_SLOPE = 0.31; // tips descend to the right (~17deg)
const TIP_INTERCEPT = 2.5;
const TIP_LENGTH = 330; // distance below the tip line over which the blade opens (S curve) to its full width
const BLADE_MAX_WIDTH = 0.93; // the blade stops widening here; the rest of the flute (right side) is the dark gap
const COS_TIP = Math.cos(Math.atan(TIP_SLOPE));
const BODY_FADE_X = 650; // horizontal fall-off of the main bodies
const BOTTOM_START = 470; // where the bodies start dissolving (at x = 0) ...
const BOTTOM_END = 700; // ... and where they are gone
const BOTTOM_SLOPE = 0.3;
const CLUSTER = { cx: 1780, cy: 930, rx: 270, ry: 240, strength: 0.9 };
const MID_PATCH = { cx: 1000, cy: 620, rx: 240, ry: 330, strength: 0.09 };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Screen-space brightness of the main bodies (0..1) at a reference-unit point. */
function bodyBrightness(x: number, y: number): number {
  const bottom = 1 - smooth(BOTTOM_START + BOTTOM_SLOPE * x, BOTTOM_END + BOTTOM_SLOPE * x, y);
  const xr = x / BODY_FADE_X;
  // brightest a little below the tips, softer near the top and bottom
  const bump = 0.6 + 0.4 * Math.exp(-Math.pow((y - (330 + BOTTOM_SLOPE * x)) / 220, 2));
  return bottom * Math.exp(-xr * xr) * bump;
}

function blob(x: number, y: number, b: { cx: number; cy: number; rx: number; ry: number; strength: number }) {
  const dx = (x - b.cx) / b.rx, dy = (y - b.cy) / b.ry;
  return Math.exp(-2 * (dx * dx + dy * dy)) * b.strength;
}

/** Purple ramp: dim = blue-leaning, full = the violet plateau. */
function colour(i: number, out: number[]): void {
  out[0] = 58 * Math.pow(i, 1.4);
  out[1] = 15 * i;
  out[2] = 12 + 100 * Math.pow(i, 0.85);
}

/**
 * Soft shade under the navbar along a 45deg "/" diagonal (x + y), like a real shadow: a long penumbra
 * that never reaches pure black (returns 1 = no shade .. TOP_SHADOW_FLOOR = darkest).
 */
function topFadeAt(params: FluteParams, X: number, Y: number): number {
  const shade = smooth(
    params.navBottom - 90 - TOP_FADE_SLOPE * X,
    params.navBottom + 330 - TOP_FADE_SLOPE * X,
    Y,
  );
  return TOP_SHADOW_FLOOR + (1 - TOP_SHADOW_FLOOR) * shade;
}

/** Hue position along a flute: 0 = blue end (near the tips) .. 1 = pink end (lower down). */
function mixDepth(dTip: number, ax: number, ay: number): number {
  const dBottom = (BOTTOM_START + BOTTOM_SLOPE * ax - ay) * COS_TIP;
  const depth = dTip / (dTip + Math.max(dBottom, 1));
  return smooth(MIX_T_FROM, MIX_T_TO, depth);
}

/**
 * Renders into an RGBA buffer of `cw` x `ch` pixels covering `cssW` x `cssH`
 * CSS px. Returns non-premultiplied RGBA (canvas ImageData layout).
 */
export function computeFlutes(
  cw: number,
  ch: number,
  cssW: number,
  cssH: number,
  params: FluteParams,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(cw * ch * 4);
  const th = params.angleDeg * RAD;
  const nx = Math.sin(th), ny = Math.cos(th); // across the seams (right/down)
  const P = params.period;
  const k = P / REF_PERIOD; // reference units -> CSS px
  const seamPhase = REF_SEAM_PHASE * k;
  const sx = cssW / cw, sy = cssH / ch;
  const tmp = [0, 0, 0];

  for (let y = 0; y < ch; y++) {
    const Y = (y + 0.5) * sy;
    for (let x = 0; x < cw; x++) {
      const X = (x + 0.5) * sx;
      const topFade = topFadeAt(params, X, Y);
      const u = X * nx + Y * ny - seamPhase;
      const f = u / P - Math.floor(u / P); // 0 at the left seam .. 1 at the right one

      // Reference-unit position of the pixel and of its anchor on the left seam.
      const rx = X / k, ry = Y / k;
      const ax = rx - f * REF_PERIOD * nx, ay = ry - f * REF_PERIOD * ny;

      // Blade width (in flute widths): 0 at the tip line, growing downward.
      const dTip = (ay - (TIP_INTERCEPT + TIP_SLOPE * ax)) * COS_TIP;
      const wRaw = dTip / TIP_LENGTH;
      // No cone / no tip: the band keeps a constant width and BOTH ends (top and bottom) dissolve the
      // same way, with the same length and softness (TOP_SOFT below mirrors the bottom fade).
      const w = BLADE_MAX_WIDTH;
      // Top end dissolves gradually below the tip line, like the bottom does (no abrupt start).
      const topSoft = wRaw > 0 ? smooth(0, TOP_SOFT, dTip) : 0;
      // Coverage across the flute: plateau up to ~w, then a soft fall-off.
      const cover = wRaw <= 0 ? 0 : 1 - smooth(w - 0.18, w + 0.1, f);

      const env = bodyBrightness(ax, ay);
      // Brighter in the middle of the blade, darker towards its two sides (as in the reference).
      const across = wRaw <= 0 ? 0 : 0.68 + 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, f / (w + 0.12))), 0.8);
      const main = cover * env * across * topSoft;
      // The lower-right cluster and the dim patch fill whole flutes.
      const full = 1 - smooth(0.78, 1.0, f);
      const clusterEnv = blob(rx, ry, CLUSTER) + blob(rx, ry, MID_PATCH);
      let I = main * 2.0 + clusterEnv * full;

      // A soft glow band along the RIGHT side of each flute, hugging the seam and following its slant.
      // Its hue runs along the line (blue up, pink down). The crisp blue/pink EDGES themselves are a
      // separate device-resolution pass (computeEdges), so this one is allowed to be blurry.
      const lineGap = smooth(0.7, 2.4, Math.min(f, 1 - f) * P); // thin dark gap right at the seam
      const t = mixDepth(dTip, ax, ay);
      const rightBand = Math.pow(smooth(0.42, 0.97, f), 1.15);
      const haze = env * topSoft * rightBand * lineGap * topFade;
      const aBlue = haze * (1 - t) * HAZE_ALPHA * BLUE_HAZE_SCALE;
      const aPink = haze * t * HAZE_ALPHA * PINK_HAZE_SCALE;
      const glowA = aBlue + aPink;
      if (I < 0.004 && glowA < 0.004) continue;

      const noise = valueNoise(rx / 240, ry / 240);
      I = (1 - Math.exp(-1.7 * I * (0.85 + 0.3 * noise))) * topFade;
      colour(I, tmp);
      // Magenta tint: the purple drifts towards pink at the blade's far edge.
      const farEdge = wRaw > 0 ? smooth(w - 0.1, w + 0.03, f) : 0;
      tmp[0]! += MIX_TINT * farEdge * I;
      tmp[2]! *= 1 - 0.1 * farEdge;

      // Premultiplied sum of the body light and the glow light (no double counting).
      const gs = aBlue + aPink;
      const gr = gs > 0 ? (MIX_BLUE[0] * aBlue + MIX_PINK[0] * aPink) / gs : 0;
      const gg = gs > 0 ? (MIX_BLUE[1] * aBlue + MIX_PINK[1] * aPink) / gs : 0;
      const gb = gs > 0 ? (MIX_BLUE[2] * aBlue + MIX_PINK[2] * aPink) / gs : 0;
      const A = Math.min(1, I + glowA);
      const i = (y * cw + x) * 4;
      out[i] = (tmp[0]! * I + gr * glowA) / A;
      out[i + 1] = (tmp[1]! * I + gg * glowA) / A;
      out[i + 2] = (tmp[2]! * I + gb * glowA) / A;
      out[i + 3] = A * 255;
    }
  }
  return blurRgba(out, cw, ch, Math.max(1, Math.round((BLUR_REF * k) / Math.max(sx, sy))));
}

const SEAM_ALPHA = 0.16; // hairline strength (white-ish)
const SEAM_HALF_WIDTH = 0.9; // CSS px
const SEAM_TOP_FADE = 260; // CSS px from the top over which the lines fade in (mirrors the ~160px bottom fade of the hero)
const SEAM_RGB = [215, 218, 226] as const; // the text-white token
// The "mix" (colours of light, strengths):
const MIX_BLUE = [36, 32, 235] as const;
const MIX_PINK = [150, 30, 115] as const;
const BLUE_HAZE_SCALE = 1.5; // the soft side band's blue part
const PINK_HAZE_SCALE = 0.45; // the soft side band's pink part (kept low: it read as a glow)
// Crisp edges (computeEdges): each starts NEARLY SOLID right at the seam and then blurs progressively
// into a glow: a thin core + a wider exponential tail (both in fractions of the period).
const LEFT_BLUE_SHARE = 0.7; // left edge = 70% blue, 30% pink
const EDGE_CORE_W = 0.024; // core thickness (fraction of a period; ~3.6px at 150px): a more solid start
const EDGE_TAIL_W = 0.05; // tail length (fraction of a period; ~7.5px at 150px): a much smaller blur
const EDGE_CORE = 0.85; // core opacity: near-solid at the start
const EDGE_TAIL = 0.3; // tail opacity where it takes over from the core
const EDGE_LEFT_STRENGTH = 0.8;
const EDGE_RIGHT_BLUE_STRENGTH = 0.8; // right edge, blue end (upper)
const EDGE_RIGHT_PINK_STRENGTH = 0.4; // right edge, pink end (lower)
const MIX_T_FROM = 0.45; // depth (0..1) where blue starts turning pink (moved LOWER: the blue sits lower) ...
const MIX_T_TO = 0.95; // ... and where it is fully pink
const MIX_TINT = 10; // the body itself turns magenta towards its far edge
const TOP_FADE_SLOPE = 1; // 1 = a 45deg diagonal
const TOP_SHADOW_FLOOR = 0.6; // how much colour survives at the darkest part of the top shadow
// Length over which the TOP end dissolves in = exactly the length of the bottom fade, so both ends match.
const TOP_SOFT = (BOTTOM_END - BOTTOM_START) * COS_TIP;
const HAZE_ALPHA = 0.2; // strength of the blue->pink glow band along each flute's right side
const BLUR_REF = 3; // reference units: softens tips/edges to the reference's fuzz

/** Separable 2-pass box blur on premultiplied RGBA, returns straight (non-premultiplied) RGBA. */
function blurRgba(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray<ArrayBuffer> {
  const n = w * h;
  let a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const al = src[i * 4 + 3]! / 255;
    a[i * 4] = src[i * 4]! * al;
    a[i * 4 + 1] = src[i * 4 + 1]! * al;
    a[i * 4 + 2] = src[i * 4 + 2]! * al;
    a[i * 4 + 3] = al;
  }
  let b = new Float32Array(n * 4);
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w;
    const stride = horizontal ? 4 : w * 4, lineStride = horizontal ? w * 4 : 4;
    const inv = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += from[base + Math.min(len - 1, Math.max(0, i)) * stride + c]!;
        for (let i = 0; i < len; i++) {
          to[base + i * stride + c] = sum * inv;
          sum += from[base + Math.min(len - 1, i + r + 1) * stride + c]! - from[base + Math.max(0, i - r) * stride + c]!;
        }
      }
    }
  };
  for (let round = 0; round < 2; round++) {
    pass(a, b, true);
    pass(b, a, false);
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const al = a[i * 4 + 3]!;
    if (al < 0.002) continue;
    out[i * 4] = a[i * 4]! / al;
    out[i * 4 + 1] = a[i * 4 + 1]! / al;
    out[i * 4 + 2] = a[i * 4 + 2]! / al;
    out[i * 4 + 3] = al * 255;
  }
  return out;
}

/** Canvas front-end: renders at `scale` of the CSS size (soft image, so 0.5 is plenty). */
export function renderFlutes(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  params: FluteParams,
  scale = 0.5,
): void {
  const cw = Math.max(1, Math.round(cssW * scale));
  const ch = Math.max(1, Math.round(cssH * scale));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(new ImageData(computeFlutes(cw, ch, cssW, cssH, params), cw, ch), 0, 0);
}

/**
 * The blue/pink edges hugging both sides of every seam, at DEVICE resolution (`scale` px per CSS px).
 * Kept out of the blades pass on purpose: that one is low-res and blurred, which smeared the edges
 * into a glow from the very first pixel. Here they start almost solid at the seam and blur out
 * progressively. Returns non-premultiplied RGBA.
 */
export function computeEdges(
  cw: number,
  ch: number,
  scale: number,
  params: FluteParams,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(cw * ch * 4);
  const th = params.angleDeg * RAD;
  const nx = Math.sin(th), ny = Math.cos(th);
  const P = params.period;
  const k = P / REF_PERIOD;
  const seamPhase = REF_SEAM_PHASE * k;
  const coreW = Math.max(1.1, EDGE_CORE_W * P);
  const tailW = EDGE_TAIL_W * P;
  const reach = tailW * 3.2; // beyond this the tail is negligible

  for (let y = 0; y < ch; y++) {
    const Y = (y + 0.5) / scale;
    for (let x = 0; x < cw; x++) {
      const X = (x + 0.5) / scale;
      const u = X * nx + Y * ny - seamPhase;
      const f = u / P - Math.floor(u / P);
      const dL = f * P, dR = (1 - f) * P; // CSS px to the seam on each side
      if (Math.min(dL, dR) > reach) continue;

      const rx = X / k, ry = Y / k;
      const ax = rx - f * REF_PERIOD * nx, ay = ry - f * REF_PERIOD * ny;
      const dTip = (ay - (TIP_INTERCEPT + TIP_SLOPE * ax)) * COS_TIP;
      if (dTip <= 0) continue;
      const topSoft = smooth(0, TOP_SOFT, dTip);
      const e =
        Math.min(1, bodyBrightness(ax, ay) * 1.6 + (blob(rx, ry, CLUSTER) + blob(rx, ry, MID_PATCH)) * 0.9) *
        topSoft *
        topFadeAt(params, X, Y);
      if (e < 0.004) continue;

      const t = mixDepth(dTip, ax, ay);
      const profile = (d: number) => EDGE_CORE * Math.exp(-d / coreW) + EDGE_TAIL * Math.exp(-d / tailW);
      const gap = (d: number) => smooth(0.4, 1.5, d); // thin dark gap right at the seam
      const aL = e * gap(dL) * profile(dL) * EDGE_LEFT_STRENGTH;
      const aR =
        e * gap(dR) * profile(dR) * (EDGE_RIGHT_BLUE_STRENGTH * (1 - t) + EDGE_RIGHT_PINK_STRENGTH * t);
      const a = aL + aR;
      if (a < 0.004) continue;

      // Left edge: 70% blue / 30% pink. Right edge: blue (upper) -> pink (lower).
      const lp = 1 - LEFT_BLUE_SHARE;
      const rl = MIX_BLUE[0] * (1 - lp) + MIX_PINK[0] * lp, gl = MIX_BLUE[1] * (1 - lp) + MIX_PINK[1] * lp,
        bl = MIX_BLUE[2] * (1 - lp) + MIX_PINK[2] * lp;
      const rr = MIX_BLUE[0] * (1 - t) + MIX_PINK[0] * t, gr = MIX_BLUE[1] * (1 - t) + MIX_PINK[1] * t,
        br = MIX_BLUE[2] * (1 - t) + MIX_PINK[2] * t;
      const i = (y * cw + x) * 4;
      out[i] = (rl * aL + rr * aR) / a;
      out[i + 1] = (gl * aL + gr * aR) / a;
      out[i + 2] = (bl * aL + br * aR) / a;
      out[i + 3] = Math.min(1, a) * 255;
    }
  }
  return out;
}

export function renderEdges(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  params: FluteParams,
  scale: number,
): void {
  const cw = Math.max(1, Math.round(cssW * scale));
  const ch = Math.max(1, Math.round(cssH * scale));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(new ImageData(computeEdges(cw, ch, scale, params), cw, ch), 0, 0);
}

/**
 * Hairline seams on their own canvas, drawn at device resolution so they stay crisp (the blades
 * canvas is deliberately lower-res and soft). Same axis, period and phase as the blades.
 */
export function renderSeams(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  params: FluteParams,
  dpr: number,
): void {
  const cw = Math.max(1, Math.round(cssW * dpr));
  const ch = Math.max(1, Math.round(cssH * dpr));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(cw, ch);
  const th = params.angleDeg * RAD;
  const nx = Math.sin(th), ny = Math.cos(th);
  const P = params.period;
  const seamPhase = REF_SEAM_PHASE * (P / REF_PERIOD);
  for (let y = 0; y < ch; y++) {
    const Y = (y + 0.5) / dpr;
    for (let x = 0; x < cw; x++) {
      const X = (x + 0.5) / dpr;
      const u = X * nx + Y * ny - seamPhase;
      const f = u / P - Math.floor(u / P);
      const dist = Math.min(f, 1 - f) * P; // CSS px to the nearest seam
      // The lines dissolve towards the top the same way they do at the bottom (where the hero fades out).
      const h = SEAM_ALPHA * smooth(SEAM_HALF_WIDTH, 0, dist) * smooth(0, SEAM_TOP_FADE, Y);
      if (h < 0.004) continue;
      const i = (y * cw + x) * 4;
      image.data[i] = SEAM_RGB[0];
      image.data[i + 1] = SEAM_RGB[1];
      image.data[i + 2] = SEAM_RGB[2];
      image.data[i + 3] = h * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}
