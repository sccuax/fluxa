// The FAQ orb's liquid surface, after the "Orbe de Agua" reference (copy-paste/fluxa web/copy paste.txt): a sphere whose
// surface is pushed in and out by domain-warped simplex noise (smooth crests and grooves). Only the SHAPE comes from the
// reference: the orb is painted with the logo's own brandmark colours and grain (see liquidMark.ts).
//
// The reference evaluates the noise per vertex on a 256x256 sphere mesh. Here it is BAKED once per (other) frame into one
// small equirectangular texture (direction -> relative radial displacement, 512x256) and the ray-marched body only does a
// texture fetch: ~0.65M simplex evaluations per frame, versus ~1500 PER PIXEL if the field were evaluated inside the march.
// Only baked while some of the body is the orb.

export const ORB_DISP_W = 512;
export const ORB_DISP_H = 256;

const RADIUS_REF = 2.2; // the reference's sphere radius (its AMP_* are in these units)

const NOISE = `
vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const FIELD = `
uniform float uTime;
const float FREQ       = 0.600;
const float WARP       = 1.900;
const float AMP_CREST  = 0.200;
const float CREST_SOFT = 0.800;
const float AMP_SWELL  = 0.050;

// x = radial displacement (reference units), y = groove depth (1 = bottom of a groove, 0 = crest top)
vec2 field(vec3 dir, float t){
  float ang = t * 0.2;
  float ca = cos(ang), sa = sin(ang);
  vec3 d = vec3(ca*dir.x - sa*dir.z, dir.y, sa*dir.x + ca*dir.z);
  vec3 p = d * vec3(1.0, 0.6, 1.0) * FREQ;
  vec3 q = vec3(
    snoise(p * 0.8 + vec3(0.0, t * 0.20, 0.0)),
    snoise(p * 0.8 + vec3(5.2, 1.3 - t * 0.15, 2.8)),
    snoise(p * 0.8 + vec3(1.7, 9.2, t * 0.12))
  );
  float s = snoise(p + q * WARP + vec3(0.0, 0.0, t * 0.08));
  float crest = smoothstep(-CREST_SOFT, CREST_SOFT, s);
  crest = crest * crest * (3.0 - 2.0 * crest);
  float swell = snoise(p * 0.5 + vec3(0.0, t * 0.2, 0.0));
  float disp = (crest - 0.5) * AMP_CREST + swell * AMP_SWELL;
  return vec2(disp, 1.0 - crest);
}

// equirectangular texel -> unit direction (matches dirUV() in the body shader)
vec3 dirFromFrag(vec2 fc, vec2 size){
  vec2 uv = fc / size;
  float lon = (uv.x - 0.5) * 6.2831853;
  float lat = (uv.y - 0.5) * 3.14159265;
  return vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
}
`;

export const ORB_VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** Pass A: relative radial displacement. RGBA16F holds it directly; RGBA8 fallback stores rel * 2 + 0.5. */
export const ORB_DISP_FRAG = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uFloatTex;
${NOISE}
${FIELD}
out vec4 outColor;
void main() {
  vec3 dir = dirFromFrag(gl_FragCoord.xy, uSize);
  float rel = field(dir, uTime).x / ${RADIUS_REF.toFixed(1)};
  outColor = vec4(uFloatTex > 0.5 ? rel : rel * 2.0 + 0.5, 0.0, 0.0, 1.0);
}`;
