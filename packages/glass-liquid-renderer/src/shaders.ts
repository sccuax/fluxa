import * as THREE from "three";

// The "glassLiquid" gallery preset kind's actual shader source + small
// helpers - a cursor-interactive fluted-glass shader with a persistent
// liquid trail. Originally built in sandbox/src/experiments/ShaderGlassExperiment.tsx,
// then apps/designer-extension/src/components/GlassLiquidCanvas.tsx (Phase 1)
// - moved here (Phase 2) so both that live-editing React component AND the
// self-hosted published-site runtime (apps/glass-liquid-runtime) share
// exactly one implementation instead of two copies drifting apart. See
// mount.ts for the actual Three.js scene/render-loop logic that uses these.
//
// Reference for the visual target (not this shader's code - it's original):
// https://shaders.com/collection/undertones.

export const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const NOISE_GLSL = `
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
    m = m * m; m = m * m;
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

export const SIM_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uPrevTrail;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uMouse;
  uniform vec2 uPrevMouse;
  uniform float uVelocity;
  uniform float uDecay;
  uniform float uDecaySubtract;
  uniform float uCeil;
  uniform float uDepositRadius;
  uniform vec2 uTexel;
  uniform vec3 uGlowColor1;
  uniform vec3 uGlowColor2;
  uniform vec3 uGlow;
  uniform float uGlowStrength;

  ${NOISE_GLSL}

  // 4-octave fbm - ported from the reference example verbatim (its own
  // recipe, distinct from RuidoEvolutivo.tsx's - shift-per-octave omitted
  // since here it's only ever sampled at one scale for the cloud warp
  // below, not accumulated across octaves at different frequencies of the
  // SAME call site).
  float fbm(vec2 p, float t) {
    float value = 0.0;
    float amp = 0.5;
    float freq = 2.0;
    for (int i = 0; i < 4; i++) {
      value += amp * snoise(p * freq + vec2(t * 0.3, -t * 0.4));
      freq *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  // Distance from p to the segment [a, b] - used so a single frame's
  // deposit is a continuous capsule connecting last frame's cursor
  // position to this frame's, not just a dot at the endpoint. Without
  // this, a fast cursor movement (or a coarse/low-framerate input) leaves
  // GAPS between frames instead of one unbroken "tail".
  float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    return length(p - (a + ab * t));
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= uAspect;
    vec2 mouseP = uMouse - 0.5;
    mouseP.x *= uAspect;
    vec2 prevMouseP = uPrevMouse - 0.5;
    prevMouseP.x *= uAspect;

    // Cap how far back the capsule can reach - otherwise the cursor's
    // first entry (jumping from its off-canvas idle position) would paint
    // one huge stray streak clear across the whole thing. uMouse/uPrevMouse
    // are already an EASED cursor position (JS side), which is what makes
    // the resulting capsule trace a smooth curve regardless of how sparsely
    // real mousemove events arrive.
    vec2 toPrev = prevMouseP - mouseP;
    float segLen = min(length(toPrev), 0.9);
    vec2 cappedPrev = mouseP + (segLen > 0.0001 ? normalize(toPrev) * segLen : vec2(0.0));
    float distSeg = distToSegment(p, cappedPrev, mouseP);

    // A second, independently domain-warped distance field for an organic,
    // non-circular "cloud" around the core - real smoke doesn't have a
    // perfectly round edge.
    float noiseVal = fbm(p * 3.0 + vec2(uTime * 0.2), uTime * 0.5);
    vec2 warpedP = p + vec2(noiseVal * 0.15);
    float distWarped = length(warpedP - mouseP);

    // Gates NEW paint by whether the cursor is actually moving right now -
    // uVelocity decays to ~0 once the cursor goes still (see JS side, its
    // own decay rate is the live "Velocity decay" control). Without this, a
    // motionless-but-still-hovering cursor keeps depositing fresh paint
    // forever - what's ALREADY in the buffer still fades over "Fade
    // duration" regardless (via uDecay below); this only stops adding MORE.
    // Thresholds (0.0005, 0.2) ported from the user's own found reference -
    // opens on virtually any real movement.
    float movingGate = smoothstep(0.0005, 0.2, uVelocity);

    // core: the crisp capsule along the cursor's recent path. cloud: the
    // softer, organically-warped halo around it.
    float core = smoothstep(uDepositRadius, 0.0, distSeg) * movingGate;

    // (1.0 - core) - PROVEN root cause of an earlier pale/whitish-center
    // bug via a controlled A/B test: cloud (uGlowColor2, a DIFFERENT hue
    // from core's uGlowColor1) used to peak in the exact SAME pixels as
    // core's own peak - summing two different hues at similar magnitude in
    // the same spot normalizes toward a higher-luminance, desaturated
    // blend. (1.0 - core) fades cloud to zero exactly where core is
    // strongest, so it only ever shows as an outer halo.
    float cloud = smoothstep(uDepositRadius * 1.8, uDepositRadius * 0.2, distWarped) * 0.4 * movingGate * (1.0 - core);

    // Ported directly from a found reference solution: uGlowStrength mixes
    // BOTH core AND cloud toward uGlow (cloud's own mix dimmed/slowed so it
    // stays secondary, not co-equal). Core's own mix is capped at 0.85, not
    // 1.0 - at a full 1.0, mix(uGlowColor1, uGlow, 1.0) resolves to uGlow
    // exactly, meaning Trail color 1 contributes NOTHING regardless of what
    // it's set to. Capping leaves a guaranteed 15% of Trail color 1 in the
    // mix even at max Glow strength.
    vec3 coreColor = mix(uGlowColor1, uGlow, uGlowStrength * 0.85);
    vec3 cloudColor = mix(uGlowColor2, uGlow * 0.75, uGlowStrength * 0.6);

    vec3 currentEmit = coreColor * core * 0.6 + cloudColor * cloud;

    // Diffusion: noise drift PLUS a small nudge in the direction the cursor
    // is actually moving (uMouse - uPrevMouse) - the persisting smoke feels
    // gently pushed/advected by the cursor's own motion, not just fading in
    // place.
    vec2 driftedUv = vUv + vec2(
      snoise(vUv * 3.0 + uTime * 0.12),
      snoise(vUv * 3.0 + uTime * 0.12 + 9.0)
    ) * 0.0015 + (uMouse - uPrevMouse) * 0.02;

    // Offset by several texels, not one - a single-texel blur is invisible
    // at any real render resolution. This is what actually gives the trail
    // a soft, spreading "cloud" edge instead of a crisp line.
    vec2 blurStep = uTexel * 3.0;
    vec3 blurred =
      texture2D(uPrevTrail, driftedUv).rgb * 0.4 +
      texture2D(uPrevTrail, driftedUv + vec2(blurStep.x, 0.0)).rgb * 0.15 +
      texture2D(uPrevTrail, driftedUv - vec2(blurStep.x, 0.0)).rgb * 0.15 +
      texture2D(uPrevTrail, driftedUv + vec2(0.0, blurStep.y)).rgb * 0.15 +
      texture2D(uPrevTrail, driftedUv - vec2(0.0, blurStep.y)).rgb * 0.15;
    // The subtractive floor (uDecaySubtract, live-controlled by "Floor"),
    // on top of the multiplicative *uDecay - a purely multiplicative decay
    // asymptotically approaches zero but never truly reaches it. Subtracting
    // a small amount every frame forces genuine convergence to exactly
    // black. uDecaySubtract is computed JS-side scaled by real elapsed time
    // (not a flat per-frame constant), so "Floor"'s effect stays consistent
    // regardless of the display's actual frame rate - same principle as
    // uDecay itself. Defaults to 0 (off).
    vec3 prev = max(vec3(0.0), blurred * uDecay - uDecaySubtract);
    vec3 raw = prev + currentEmit * 0.85;

    // Soft-knee tone-map (a smooth, C1-continuous compression curve, like a
    // camera's highlight rolloff). Below the knee (uCeil * 0.5) it's the
    // exact identity (no compression at all); above it, smoothly asymptotes
    // toward uCeil. No hard threshold to flicker across frame-to-frame,
    // unlike a bare clamp()/normalize would. uCeil is a live "Ceiling"
    // control.
    float mx = max(raw.r, max(raw.g, raw.b));
    float KN = uCeil * 0.5;
    float lim = mx < KN ? mx : uCeil - ((uCeil - KN) * (uCeil - KN)) / (mx + uCeil - 2.0 * KN);
    vec3 color = raw * (lim / max(mx, 1e-5));
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uAspect;
  uniform float uRefraction;
  uniform float uFlutesAngle;
  uniform float uFlutesFrequency;
  uniform float uGrainStrength;
  uniform float uGrainScale;
  uniform float uHighlightStrength;
  uniform float uResolutionY;
  uniform float uEdgeStrength;
  uniform float uEdgeWidth;
  uniform float uEdgeTrailMod;
  uniform float uWobbleAmount;
  uniform float uScrollSpeed;
  uniform float uFluteVariation;
  uniform float uSeamScroll;
  uniform float uSeamWobble;
  uniform float uConfine;
  uniform float uAA;
  uniform float uIsolate;
  uniform vec3 uBaseColor;
  uniform vec3 uHighlight;
  uniform vec3 uEdgeColor;
  uniform sampler2D uTrailTex;

  ${NOISE_GLSL}

  // Matches @shadergradient/react's own THREE.HalftonePass mechanics, not a
  // CMY ink-subtraction approximation (an earlier version of this shader
  // used that model, same as @fluxa/ruido-evolutivo-renderer's still does -
  // confirmed by reading the real effect's compiled source
  // (chunk-VJZMGGI7.mjs/chunk-SOFAB2VP.mjs) that it's structurally
  // different: each of R/G/B gets its OWN independently-rotated grid of
  // dots sized by THAT channel's own brightness (not "ink coverage"),
  // composited additively (vR+vG+vB there) - a more "separated colored
  // dots" look than a print-ink reconstruction. pow(channel, 1.125) is
  // their SHAPE_DOT radius curve verbatim; the 4-corner grid-cell sampling
  // and 8x supersampling their pass also does are deliberately not ported -
  // those exist to reduce artifacts when re-sampling a discrete input
  // texture at nearby grid points, meaningless here since col is already
  // one continuous, analytically-computed value at this exact fragment.
  float halftoneDot(vec2 fragPx, float angle, float cell, float channelValue) {
    float s = sin(angle);
    float c = cos(angle);
    vec2 rot = vec2(fragPx.x * c - fragPx.y * s, fragPx.x * s + fragPx.y * c);
    vec2 inCell = mod(rot, cell) - 0.5 * cell;
    float dist = length(inCell);
    float radius = pow(clamp(channelValue, 0.0, 1.0), 1.125) * (0.5 * cell);
    return 1.0 - smoothstep(radius - 0.75, radius + 0.75, dist);
  }

  // Per-channel rotations are the SPECIFIC (non-obvious) assignment
  // @shadergradient/react's own wrapper hardcodes - confirmed by reading
  // chunk-SOFAB2VP.mjs directly: R gets 1x, G gets 3x, B gets 2x (not the
  // R/G/B = 1x/2x/3x order the underlying HalftoneShader's own unused
  // default uniforms would suggest).
  vec3 halftone(vec2 fragPx, vec3 col, float cell) {
    float r = halftoneDot(fragPx, 0.2617994, cell, col.r);
    float g = halftoneDot(fragPx, 0.7853982, cell, col.g);
    float b = halftoneDot(fragPx, 0.5235988, cell, col.b);
    return vec3(r, 0.0, 0.0) + vec3(0.0, g, 0.0) + vec3(0.0, 0.0, b);
  }

  vec2 rotate(vec2 uv, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
  }

  // Periodic glowing streak, period 1 in x - a soft bright band that
  // repeats forever, no discontinuity, so scrolling it with time loops
  // seamlessly. Used for the flutes' own static ridge shading.
  float streak(float x, float sharpness) {
    float wave = cos(x * 6.28318530718) * 0.5 + 0.5;
    return pow(wave, sharpness);
  }

  // Converts an aspect-corrected p-space position back to the trail
  // texture's own 0..1 UV space.
  vec2 toTrailUv(vec2 pos) {
    return vec2(pos.x / uAspect, pos.y) + 0.5;
  }

  // Samples the trail texture at pos, displaced along bendDir by "offset"
  // (the lens-bend amount for one chromatic-aberration channel) - clamped
  // ("Confined", uConfine near 1) so the sample position can never cross
  // into a NEIGHBORING flute's own cell, vs. "Continuous" (uConfine near 0)
  // which lets it read past the cell boundary freely. localPos/cellWidth
  // describe where inside the current flute's cell this pixel sits, so the
  // clamp range is relative to that, not the whole canvas.
  vec3 sampleFlute(vec2 pos, vec2 bendDir, float offset, float localPos, float cellWidth) {
    float eps = cellWidth * 0.02;
    float d = mix(offset, clamp(offset, -localPos + eps, cellWidth - localPos - eps), uConfine);
    return texture2D(uTrailTex, toTrailUv(pos + bendDir * d)).rgb;
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= uAspect;

    // --- Fixed flute/ridge geometry, rotated by uFlutesAngle. barGeo drives
    // the actual lens/refraction geometry AND the seam-line position;
    // barShade drives only the static ridge-highlight shading. They're the
    // SAME coordinate unless uSeamScroll/uSeamWobble are turned on - by
    // default (both off) the seam LINES stay perfectly still while the
    // highlight shading still animates, decoupling "does the visible edge
    // marker move" from "does the color pattern move" (previously always
    // coupled together).
    vec2 rp = rotate(p, uFlutesAngle);
    float bars = rp.x * uFlutesFrequency;
    float scroll = uTime * uScrollSpeed;
    float noiseTerm = snoise(rp * 1.6 + uTime * 0.05) * uWobbleAmount;
    float barGeo = bars + scroll * uSeamScroll + noiseTerm * uSeamWobble;
    float barShade = bars + scroll + noiseTerm;
    float fluteId = floor(barGeo);
    float fluteLocal = fract(barGeo);
    float cellWidth = 1.0 / uFlutesFrequency;
    float localPos = fluteLocal * cellWidth;

    // Cylindrical-lens profile: 0 at a ridge's seam/center, peaking partway
    // across each flute - real fluted/reeded glass bends light sideways by
    // an amount that depends on where across the ridge you're looking.
    float lensShape = sin(fluteLocal * 6.28318530718);
    vec2 bendDir = vec2(cos(uFlutesAngle), sin(uFlutesAngle));

    // Per-flute pseudo-random refraction variation ("Flute variation") -
    // each flute (identified by its own integer fluteId) gets a slightly
    // different effective refraction strength, so the glass reads as real
    // imperfect reeded glass instead of perfectly uniform ridges. At 0 (the
    // default) every flute refracts identically, same as before this
    // control existed.
    float fluteRand = fract(sin(fluteId * 127.1) * 43758.5453123);
    float refr = uRefraction * mix(1.0, 0.55 + 0.9 * fluteRand, uFluteVariation);
    float bend = lensShape * refr;
    float chroma = 0.25;

    vec3 trailR = sampleFlute(p, bendDir, bend * (1.0 + chroma), localPos, cellWidth);
    vec3 trailG = sampleFlute(p, bendDir, bend, localPos, cellWidth);
    vec3 trailB = sampleFlute(p, bendDir, bend * (1.0 - chroma), localPos, cellWidth);
    vec3 refracted = vec3(trailR.r, trailG.g, trailB.b);

    // Hue-preserving compression - dividing by the max channel instead of a
    // per-channel clamp(...,0,1) keeps the trail's actual hue intact even
    // when the accumulated buffer is well above 1.0, instead of every
    // channel independently clipping toward solid white.
    float trailMax = max(refracted.r, max(refracted.g, refracted.b));
    refracted = refracted / max(trailMax, 1.0);
    float trailBright = max(refracted.r, max(refracted.g, refracted.b));

    // --- Seam/edge line - a separate visible line drawn at each flute's own
    // seam (dSeam = distance from the seam, in flute-local units), NOT the
    // same thing as the ridgeHighlight streak below (that's a broad soft
    // glow across the whole flute; this is a crisp line specifically at the
    // seam). uEdgeWidth is in real PIXELS (via pxWidth, derived from
    // uResolutionY) so the line's on-screen thickness stays consistent
    // regardless of uFlutesFrequency or canvas resolution. uAA blends
    // between two different edge-thickness formulas (edgeOld's origin-
    // anchored smoothstep vs edgeNew's width-centered one).
    float pxWidth = uFlutesFrequency / uResolutionY;
    float dSeam = 1.0 - fluteLocal;
    float edgeOld = 1.0 - smoothstep(0.0, pxWidth * uEdgeWidth, dSeam);
    float lineWidth = max(uEdgeWidth, 1.0) * pxWidth;
    float edgeNew = 1.0 - smoothstep(lineWidth - pxWidth * 0.5, lineWidth + pxWidth * 0.5, dSeam);
    float edgeLine = mix(edgeOld, edgeNew, uAA);
    // "Edge trail mod" - when on, the edge line's own brightness follows
    // how bright the refracted trail is nearby (dim baseline + a boost
    // where the trail is bright), instead of a constant strength regardless
    // of the trail.
    float edgeMod = mix(1.0, 0.12 + trailBright * 0.9, uEdgeTrailMod);

    // "Isolate lines" debug/creative mode - shows ONLY the seam lines over a
    // flat background, skipping the refracted trail/highlight/grain
    // entirely.
    if (uIsolate > 0.5) {
      gl_FragColor = vec4(uBaseColor + uEdgeColor * edgeLine * uEdgeStrength * edgeMod, 1.0);
      return;
    }

    // The glass's own static shading - a subtle highlight at each ridge's
    // center, visible even with no cursor nearby.
    float ridgeHighlight = streak(barShade, 3.2) * 0.16;
    vec3 baseGlass = uBaseColor + uHighlight * ridgeHighlight * uHighlightStrength;

    vec3 color = baseGlass;
    color += refracted;

    float maxChannel = max(color.r, max(color.g, color.b));
    color = color / max(maxChannel, 1.0);

    // Halftone "grain" - blend toward a rotated RGB dot-screen
    // reconstruction of the glass surface + refracted trail ONLY, matching
    // the look @shadergradient/react's own grain prop produces. Applied
    // BEFORE the edge line is added below (explicit direction: grain should
    // affect the shader surface, not the seam/ridge lines) - lines render
    // crisp and untouched by the dot pattern regardless of grainStrength.
    if (uGrainStrength > 0.0) {
      vec3 ht = halftone(gl_FragCoord.xy, clamp(color, 0.0, 1.0), max(uGrainScale, 1.0));
      color = mix(color, ht, uGrainStrength);
    }

    color += uEdgeColor * edgeLine * uEdgeStrength * edgeMod;

    // Re-normalize (same hue-preserving compression as above) - adding the
    // edge line on top of an already-normalized color can push a channel
    // back over 1.0.
    float maxChannelFinal = max(color.r, max(color.g, color.b));
    color = color / max(maxChannelFinal, 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function hexToVec3(hex: string): THREE.Vector3 {
  const int = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

export const FADE_EPSILON = 0.02;

export function createTrailTarget(width: number, height: number): THREE.WebGLRenderTarget {
  // HalfFloatType, not the default 8-bit UnsignedByteType - this target
  // gets read back into itself every frame (fade-and-redeposit), and 8-bit
  // precision compounding over many frames banded visibly.
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
  return target;
}
