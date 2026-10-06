// Hero "camera orbit": a scroll-scrubbed WebGL transition through a few stills of the same scene taken from different angles
// (assets/hero-cuts). There are no in-between frames, so the orbit is faked per pair of neighbouring stills: the outgoing
// one pushes in and drifts one way, the incoming one settles from the other side, and each is displaced by the OTHER's
// luminance while they cross-fade (a classic displacement transition). Nothing runs on its own: `render(p)` is called by
// the hero's scroll timeline (p = 0..N-1, the integer parts are the stills, the fraction is the transition between them).
//
// The canvas is laid out like the Rive stage (HeroScene.astro): max 1440px wide, 1500x844, bottom-aligned.
//
// Returns null when WebGL is unavailable, so the Rive scene underneath simply stays (the canvas is invisible until the
// timeline fades it in, and nothing fades in if this returned null).

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uT;
uniform vec2 uScale; // cover-fit of a still inside the canvas
uniform vec2 uSize; // canvas css size
// The Rive scene's blurred mask, copied from lib/footer/glassFooter.ts: a 1097x380 box (css px) centred at 54% of the height,
// Gaussian-blurred with sigma 80 - evaluated analytically (a box blurred by a Gaussian is a product of two erf differences).
vec2 erf1(vec2 x) {
  vec2 s = sign(x); x = abs(x);
  vec2 t = 1.0 + x * (0.278393 + x * (0.230389 + x * (0.000972 + x * 0.078108)));
  t *= t; t *= t;
  return s * (1.0 - 1.0 / t);
}
float maskAt(vec2 p) {
  vec2 q = p - vec2(uSize.x * 0.5, uSize.y * 0.54);
  float k = 1.0 / (80.0 * 1.41421356);
  vec2 h = vec2(1097.0, 380.0) * 0.5;
  vec2 a = 0.5 * (erf1((q + h) * k) - erf1((q - h) * k));
  return a.x * a.y;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec2 cover(vec2 p) { return (p - 0.5) * uScale + 0.5; }
void main() {
  float t = uT * uT * (3.0 - 2.0 * uT);
  vec2 c = vUv - 0.5;
  // outgoing: pushes in and drifts left; incoming: settles from the right, a touch zoomed
  vec2 pa = 0.5 + c * (0.88 - 0.08 * t) + vec2(-0.04 * t, 0.0);
  vec2 pb = 0.5 + c * (0.88 - 0.08 * (1.0 - t)) + vec2(0.04 * (1.0 - t), 0.0);
  float lb = lum(texture(uB, cover(pb)).rgb);
  float la = lum(texture(uA, cover(pa)).rgb);
  vec2 da = vec2(lb - 0.5, 0.5 - lb) * 0.05 * t;
  vec2 db = vec2(la - 0.5, 0.5 - la) * -0.05 * (1.0 - t);
  vec3 a = texture(uA, cover(clamp(pa + da, 0.0, 1.0))).rgb;
  vec3 b = texture(uB, cover(clamp(pb + db, 0.0, 1.0))).rgb;
  vec3 col = mix(a, b, smoothstep(0.1, 0.9, t));
  col *= 1.0 + 0.1 * sin(3.14159 * t); // a faint swell of light mid-transition
  // The Rive scene's own look (lib/footer/glassFooter.ts): desaturate 0.2, 50% of the page colour #0b0d12, then the blurred mask
  // that fades the scene into the page colour at its edges - so the hand-over between the Rive and the stills is invisible.
  col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), 0.2);
  vec3 page = vec3(11.0, 13.0, 18.0) / 255.0;
  col = mix(col, page, 0.5);
  col = mix(page, col, maskAt(vec2(vUv.x, 1.0 - vUv.y) * uSize));
  outColor = vec4(col, 1.0);
}`;

export interface HeroOrbit {
  /** Draw the transition at position p (0..count-1). Safe to call before the stills have loaded (it just waits). */
  render(p: number): void;
}

export function createHeroOrbit(canvas: HTMLCanvasElement, urls: string[]): HeroOrbit | null {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl || urls.length < 2) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    console.warn("[heroOrbit] shader failed to compile");
    return null;
  }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uT = gl.getUniformLocation(prog, "uT");
  const uScale = gl.getUniformLocation(prog, "uScale");
  const uSize = gl.getUniformLocation(prog, "uSize");
  gl.uniform1i(gl.getUniformLocation(prog, "uA"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "uB"), 1);

  const textures: (WebGLTexture | null)[] = urls.map(() => null);
  let imgAspect = 16 / 9;
  let lastP = 0;

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  };

  const draw = (p: number) => {
    lastP = p;
    const last = urls.length - 1;
    const clamped = Math.min(Math.max(p, 0), last);
    const i = Math.min(Math.floor(clamped), last - 1);
    const a = textures[i];
    const b = textures[i + 1];
    if (!a || !b) return; // still loading: the load handler draws again once it is there
    size();
    const ca = canvas.width / canvas.height;
    gl.uniform2f(uScale, ca > imgAspect ? 1 : ca / imgAspect, ca > imgAspect ? imgAspect / ca : 1);
    gl.uniform2f(uSize, canvas.clientWidth, canvas.clientHeight);
    gl.uniform1f(uT, clamped - i);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // Load the stills once the page is idle (they are ~200-400 KB each, off the intro's critical path).
  const load = () => {
    urls.forEach((url, i) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const tex = gl.createTexture();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // image rows run top-down, GL's v runs bottom-up
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        textures[i] = tex;
        imgAspect = img.naturalWidth / img.naturalHeight;
        draw(lastP);
      };
      img.src = url;
    });
  };
  if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 2500 });
  else setTimeout(load, 800);

  window.addEventListener("resize", () => draw(lastP));
  return { render: draw };
}
