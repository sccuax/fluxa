// The footer wordmark: "Fluxa" in the 1191x362 frame of the design (copy-paste/fluxa web/copy paste.txt).
//
// The design file that was pasted only carries the logo mark (the "x", 264px square). The F / l / u / a letterforms are
// the hero wordmark's own paths (config/wordmark.ts, the same design) re-placed into this frame: each letter gets its own
// x offset (the footer spaces them wider than the hero) and everything shares one scale so the baseline lands on the
// mark's bottom (y = 361.5). The offsets were measured from footer.png, so they are close but not pixel-exact: replace
// LETTERS with the real paths if the full SVG is ever pasted.
import { WORDMARK_SUBPATHS } from "@/config/wordmark";

export const FRAME = { w: 1191, h: 362 } as const;

// The mark ("x" slot), exactly as pasted (1191x362 space).
const MARK =
  "M926.937 295.76C926.937 332.093 897.489 361.5 861.198 361.5C824.906 361.5 795.458 332.052 795.458 295.76C795.458 332.093 766.01 361.5 729.719 361.5C693.427 361.5 663.938 332.052 663.938 295.76C663.938 259.469 693.386 230.021 729.677 230.021C693.386 229.979 663.938 200.573 663.938 164.24C663.938 146.073 671.279 129.649 683.182 117.745C695.086 105.841 711.511 98.5 729.677 98.5H861.156C897.448 98.5 926.896 127.948 926.896 164.24C926.896 182.406 919.555 198.831 907.651 210.734C895.747 222.638 879.323 229.979 861.156 229.979C897.448 229.979 926.896 259.427 926.896 295.719L926.937 295.76Z";

const SCALE = 0.985; // hero letters (x-height 268) -> footer frame (mark 263)
const DY = 361.5 - 352 * SCALE; // hero baseline 352 -> footer baseline 361.5

interface Letter {
  id: string;
  subpaths: readonly number[];
  /** x of the letter's left edge in the footer frame; the hero paths are shifted to land there. */
  left: number;
  /** x of the same edge in the hero's own paths. */
  heroLeft: number;
}

const LETTER_DEFS: readonly Letter[] = [
  { id: "F", subpaths: [0, 1, 2], left: 1, heroLeft: 23.4 },
  { id: "l", subpaths: [3], left: 271, heroLeft: 259.8 },
  { id: "u", subpaths: [4], left: 379, heroLeft: 346.8 },
  { id: "a", subpaths: [5, 6], left: 956, heroLeft: 861.9 },
];

export interface PlacedPath {
  d: string;
  /** SVG/canvas transform: footer frame = scale * hero + (dx, DY). */
  dx: number;
  dy: number;
  scale: number;
}

export const LETTERS: readonly PlacedPath[] = [
  ...LETTER_DEFS.map((l) => ({
    d: l.subpaths.map((i) => WORDMARK_SUBPATHS[i]).join(""),
    dx: l.left - l.heroLeft * SCALE,
    dy: DY,
    scale: SCALE,
  })),
  { d: MARK, dx: 0, dy: 0, scale: 1 },
];

/** Every letter as SVG path elements' attributes (for the no-WebGL fallback). */
export const FALLBACK_PATHS = LETTERS.map((p) => ({
  d: p.d,
  transform: `translate(${p.dx} ${p.dy}) scale(${p.scale})`,
}));

/** Fill the letters (opaque white) into a 2D context whose origin is the frame's top-left, `px` device pixels per frame unit. */
export function fillLetters(ctx: CanvasRenderingContext2D, px: number, pad: number): void {
  ctx.fillStyle = "#fff";
  for (const p of LETTERS) {
    ctx.setTransform(px * p.scale, 0, 0, px * p.scale, (p.dx + pad) * px, (p.dy + pad) * px);
    ctx.fill(new Path2D(p.d));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Exact Euclidean distance transform (Felzenszwalb & Huttenlocher). `inside[i]` = 1 where the pixel belongs to the
 * shape. Returns, for every pixel, the distance (in pixels) to the nearest pixel of the OTHER kind: inside pixels get
 * their distance to the outline, outside pixels get 0.
 */
export function distanceToZeros(w: number, h: number, isShape: Uint8Array): Float32Array {
  const INF = 1e20;
  const f = new Float32Array(Math.max(w, h));
  const d = new Float32Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float32Array(Math.max(w, h) + 1);
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = isShape[i] ? INF : 0;

  const pass = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = 0;
      for (;;) {
        const p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
        if (s <= z[k] && k > 0) k--;
        else break;
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d[q] = (q - p) * (q - p) + f[p];
    }
  };

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    pass(h);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    pass(w);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
  }
  return g;
}
