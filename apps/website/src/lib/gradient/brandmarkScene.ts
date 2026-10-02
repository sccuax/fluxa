// The hero logo mark's "brandmark" look (scene B: the Figma wave composition rebuilt in GLSL), shared by the hero mark
// (gradient/foamMark.ts) and the FAQ's 3D object (faq/liquidMark.ts) so both paint the exact same surface.
// BRANDMARK_GLSL declares uT / uAmp / uW / uL and exposes: hash, vnoise, fbm, warp, fieldDir, flow, hex3, sceneA(uv),
// sceneB(uv) (uv = 0..1 over the mark's square, y down). Feed uW / uL with BRANDMARK_WAVE / BRANDMARK_GLOW (vec2[28]).

type P = [number, number];
// Cubic segments of the wave (start 952.245,911.331) and of the luminosity glow (start 843.256,204.319).
const WAVE_START: P = [952.245, 911.331];
const WAVE_SEGS: number[][] = [
  [509.822, 1277.4, 356.336, 752.716, -36.3474, 554.998],
  [-271.645, 270.621, -335.574, -65.3237, 106.849, -431.391],
  [549.271, -797.457, 1800.27, 53.076, 2035.57, 337.453],
  [2270.86, 621.83, 1394.67, 545.265, 952.245, 911.331],
];
const GLOW_START: P = [843.256, 204.319];
const GLOW_SEGS: number[][] = [
  [423.318, 551.782, 434.279, 243.086, 187.18, 207.248],
  [78.9956, 76.4978, 111.783, -129.41, 531.721, -476.873],
  [951.659, -824.336, 1685.82, -564.828, 1794.01, -434.078],
  [1902.19, -303.328, 1263.19, -143.144, 843.256, 204.319],
];
const POLY_N = 7; // samples per cubic segment
function samplePath(start: P, segs: number[][]): Float32Array {
  const out: number[] = [];
  let [x0, y0] = start;
  for (const [x1, y1, x2, y2, x3, y3] of segs) {
    for (let i = 0; i < POLY_N; i++) {
      const t = i / POLY_N;
      const u = 1 - t;
      out.push(
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      );
    }
    x0 = x3;
    y0 = y3;
  }
  return new Float32Array(out);
}

export const BRANDMARK_WAVE = samplePath(WAVE_START, WAVE_SEGS);
export const BRANDMARK_GLOW = samplePath(GLOW_START, GLOW_SEGS);

export const BRANDMARK_GLSL = `
uniform float uT;
uniform float uAmp;
uniform vec2 uW[28];
uniform vec2 uL[28];

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
vec2 warp(vec2 p, float amp, float speed) {
  return p + amp * vec2(fbm(p * 2.2 + vec2(0.0, uT * speed)) - 0.5, fbm(p * 2.2 + vec2(5.2, -uT * speed)) - 0.5) * 2.0;
}
// The particle field's flow: angle = sum of three sines/cosines, direction = (cos, sin) of it.
vec2 fieldDir(vec2 p, float t) {
  float a = sin(p.x * 2.3 + t * 0.35) + cos(p.y * 2.7 - t * 0.28) + sin((p.x + p.y) * 1.7 + t * 0.2);
  float ang = a * 1.5707963;
  return vec2(cos(ang), sin(ang));
}
vec2 flow(vec2 p, float t) {
  return vec2(fbm(p * 2.2 + vec2(0.0, t)) - 0.5, fbm(p * 2.2 + vec2(5.2, -t)) - 0.5) * 2.0;
}
vec3 hex3(int r, int g, int b) { return vec3(float(r), float(g), float(b)) / 255.0; }

// Scene A: the fluxa-logo palette (layers are % of a 1.6x box centred on the mark, as in the CSS fallback).
vec3 sceneA(vec2 uv) {
  float a = uT * 0.5236;
  vec2 q = uv - 0.5;
  q = mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
  q = warp(q + 0.5, 0.07, 0.5) - 0.5;
  vec2 p = q / 1.6 + 0.5; // position inside the oversized layer, 0..1
  // base: linear-gradient(200deg, ...)
  vec2 dir = vec2(-0.342, 0.940);
  float t = dot(p - 0.5, dir) / 1.282 + 0.5;
  vec3 c = mix(hex3(255,143,90), hex3(255,217,160), smoothstep(0.0, 0.30, t));
  c = mix(c, hex3(95,230,208), smoothstep(0.30, 0.55, t));
  c = mix(c, hex3(43,123,255), smoothstep(0.55, 0.78, t));
  c = mix(c, hex3(74,43,214), smoothstep(0.78, 1.0, t));
  // radial layers over it, in the original order
  c = mix(c, hex3(255,79,106),  clamp(1.0 - length((p - vec2(0.30, 0.24)) / 0.38), 0.0, 1.0));
  c = mix(c, hex3(255,163,77),  clamp(1.0 - length((p - vec2(0.70, 0.14)) / 0.34), 0.0, 1.0));
  c = mix(c, hex3(255,242,194), clamp(1.0 - length((p - vec2(0.52, 0.50)) / 0.30), 0.0, 1.0));
  c = mix(c, hex3(111,245,200), clamp(1.0 - length((p - vec2(0.72, 0.62)) / 0.30), 0.0, 1.0));
  c = mix(c, hex3(194,53,196),  clamp(1.0 - length((p - vec2(0.28, 0.78)) / 0.36), 0.0, 1.0));
  c = mix(c, hex3(47,184,255),  clamp(1.0 - length((p - vec2(0.72, 0.88)) / 0.38), 0.0, 1.0));
  return c;
}

// Scene B: the brandmark palette - normalised soft blobs orbiting inside a warped field.
// ---- Scene B: the Figma composition --------------------------------------------------------------
float sdPoly(vec2 p, bool glow) {
  float d = 1e9;
  bool inside = false;
  vec2 a = glow ? uL[27] : uW[27];
  for (int i = 0; i < 28; i++) {
    vec2 b = glow ? uL[i] : uW[i];
    vec2 e = b - a;
    vec2 w = p - a;
    float h = clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, length(w - e * h));
    if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    a = b;
  }
  return inside ? d : -d;
}
// Gaussian-blurred edge coverage (logistic approximation of the normal CDF)
float cover(float sd, float sigma) { return 1.0 / (1.0 + exp(-1.702 * sd / sigma)); }
float ellipseSd(vec2 p, vec2 c, vec2 r, float rot) {
  float cs = cos(rot), sn = sin(rot);
  vec2 q = p - c;
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
  return (1.0 - length(q / r)) * min(r.x, r.y);
}
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lum(c), n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
vec3 softLight(vec3 cb, vec3 cs) {
  vec3 d = mix(sqrt(cb), ((16.0 * cb - 12.0) * cb + 4.0) * cb, step(cb, vec3(0.25)));
  return mix(cb + (2.0 * cs - 1.0) * (d - cb), cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb), step(cs, vec3(0.5)));
}
// mode 0 normal, 1 soft-light, 2 plus-lighter
vec3 layer(vec3 cb, vec3 cs, float a, int mode) {
  if (mode == 1) return mix(cb, softLight(cb, cs), a);
  if (mode == 2) return min(cb + cs * a, 1.0);
  return mix(cb, cs, a);
}
// One copy of the wave shape: offset in design units, colour, opacity, blur sigma, ripple phase.
vec3 waveLayer(vec3 col, vec2 p, vec2 off, vec3 c, float op, float sigma, int mode, float ph) {
  // The wave keeps its shape and place: each layer only glides a few units (own phase), so the bands
  // slide slightly past each other; the deformation is a barely-there ripple.
  vec2 q = p - off - vec2(16.0 * (sin(uT * 1.0 + ph) - sin(ph)), 10.0 * (sin(uT * 0.85 + ph * 1.3) - sin(ph * 1.3))) * uAmp;
  // the soft-light layers are the indigo/blue stripe: they roll like a liquid wave (a crest travelling along x,
  // plus a slow rise and fall), the rest barely ripple
  float roll = mode == 1 ? 1.0 : 0.0;
  // ...driven by the same kind of field as the particle flow we documented: a sum of slow sines -> an angle ->
  // a unit vector (smooth, curling, never repeating exactly). Measured against t = 0 so rest = design position.
  vec2 pn = q / 700.0 - 1.0;
  q += (fieldDir(pn, uT * 2.0) - fieldDir(pn, 0.0)) * (30.0 + 45.0 * roll) * uAmp;
  return layer(col, c, cover(sdPoly(q, false), sigma) * op, mode);
}
vec3 sceneB(vec2 uv) {
  // liquid flow: the whole field is pushed around by slow, low-frequency noise (position stays put on average)
  // (measured against t = 0, so at rest the fitted design position is untouched)
  uv += 0.04 * uAmp * (flow(uv, uT * 0.7) - flow(uv, 0.0));
  // global placement fitted to the brand gradient reference (rotation / stretch / shift of the whole stack)
  vec2 p0 = uv * 1400.0 - 700.0 - vec2(-101.4, -76.41);
  float cs = cos(-0.06), sn = sin(-0.06);
  vec2 p = vec2(cs * p0.x + sn * p0.y, -sn * p0.x + cs * p0.y) / vec2(1.11, 1.09) + 700.0;
  // the soft blobs drift on their own slow field too (zero at rest)
  vec2 pn2 = p / 700.0 - 1.0;
  vec2 pe = p + (fieldDir(pn2, uT * 1.5 + 1.7) - fieldDir(pn2, 1.7)) * 55.0 * uAmp;
  vec3 col = vec3(0.58, 0.47, 0.74);
  col = waveLayer(col, p, vec2(145.81, 168.5), vec3(0.13, 0.27, 0.33), 0.89, 56.55, 1, 0.0);
  col = waveLayer(col, p, vec2(66.74, -288.88), vec3(1.0, 0.18, 0.18), 0.93, 50.44, 2, 1.1);
  col = waveLayer(col, p, vec2(-21.74, -155.3), vec3(0.9, 0.62, 0.62), 0.79, 38.62, 0, 2.2);
  col = waveLayer(col, p, vec2(-26.67, -315.92), vec3(0.79, 0.74, 0.99), 0.69, 42.1, 0, 3.3);
  col = waveLayer(col, p, vec2(680.8, -385.97), vec3(0.64, 0.45, 0.61), 0.65, 159.95, 0, 4.4);
  // luminosity glow
  {
    vec2 q = p - vec2(-368.88, -82.43) + vec2(0.0, 3.0 * sin(uT * 0.6));
    mat2 m = mat2(-544.058, 788.802, -625.931, -0.657213);
    float g = clamp(length(inverse(m) * (q - vec2(909.833, -211.02))), 0.0, 1.0);
    vec3 src = mix(hex3(255, 177, 129), vec3(1.0), g);
    col = mix(col, setLum(col, lum(src)), cover(sdPoly(q, true), 55.57) * 0.89);
  }
  col = waveLayer(col, p, vec2(-147.7, 15.35), vec3(0.02, 0.12, 0.4), 0.79, 33.14, 1, 5.5);
  col = mix(col, vec3(0.89, 1.0, 0.94), cover(ellipseSd(pe, vec2(817.32, 1043.73), vec2(517.14, 253.42), 1.5), 146.31) * 0.31);
  col = mix(col, vec3(0.85, 0.69, 0.92), cover(ellipseSd(pe, vec2(1131.48, 1651.94), vec2(795.16, 412.15), 0.65), 65.26) * 1.0);
  col = mix(col, vec3(0.29, 0.77, 0.69), cover(ellipseSd(pe, vec2(1379.45, 1631.7), vec2(588.74, 380.35), -0.33), 125.4) * 0.61);
  col = waveLayer(col, p, vec2(-234.35, 303.89), vec3(0.46, 0.45, 0.69), 0.95, 12.84, 1, 6.6);
  col = mix(col, vec3(1.0, 0.61, 0.72), cover(ellipseSd(pe, vec2(997.09, -284.24), vec2(30.0, 351.79), 0.47), 116.97) * 0.56);
  col = mix(col, vec3(0.68, 0.62, 0.96), cover(ellipseSd(pe, vec2(658.45, -168.43), vec2(543.48, 275.45), 1.63), 25.03) * 0.72);
  col = mix(col, vec3(1.0, 0.49, 0.84), cover(ellipseSd(pe, vec2(917.45, 1113.37), vec2(180.28, 90.07), 0.05), 50.66) * 0.56);
  col = mix(col, vec3(0.52, 0.65, 1.0), cover(ellipseSd(pe, vec2(1110.62, 1448.71), vec2(324.39, 144.21), 0.06), 49.17) * 0.39);
  col = mix(col, vec3(1.0, 0.68, 0.89), cover(ellipseSd(pe, vec2(581.64, 680.92), vec2(243.89, 175.52), 0.17), 54.63) * 0.39);
  col = mix(col, vec3(0.71, 0.52, 1.0), cover(ellipseSd(pe, vec2(326.75, 1196.55), vec2(350.04, 145.95), 0.61), 76.95) * 0.34);
  return mix(col, vec3(1.0), 0.12);
}
`;
