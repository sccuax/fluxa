import * as THREE from "three";
import type { GlassLiquidConfig } from "@fluxa/gradient-core";
import {
  VERTEX_SHADER,
  SIM_FRAGMENT_SHADER,
  FRAGMENT_SHADER,
  hexToVec3,
  createTrailTarget,
  FADE_EPSILON,
} from "./shaders";

export interface GlassLiquidHandle {
  setConfig(config: GlassLiquidConfig): void;
  // Stops/restarts the requestAnimationFrame render loop without tearing
  // down the WebGL context or losing the trail buffer's current contents -
  // for a published site with several shaders on one page, the embed script
  // calls this via an IntersectionObserver so an off-screen instance costs
  // no GPU/compositor time at all, not just reduced quality.
  pause(): void;
  resume(): void;
  dispose(): void;
}

export interface MountGlassLiquidOptions {
  // Threaded straight into the WebGL context - see GlassLiquidCanvas.tsx's
  // own comment for why apps/preset-admin needs this (thumbnail capture)
  // and the published-site runtime doesn't (never read back).
  preserveDrawingBuffer?: boolean;
}

// flutesDepthMask enum -> the shader's numeric uFlutesMask (0 full / 1
// zones / 2 random). Falls back to "full" for a preset saved before the
// field existed.
function flutesMaskToNum(mask: GlassLiquidConfig["flutesDepthMask"] | undefined): number {
  return mask === "random" ? 2 : mask === "zones" ? 1 : 0;
}

// Per-colour opacity (0-100, from the picker) is applied by PREMULTIPLYING
// the colour here in JS - `hexToVec3(hex) * (opacity/100)` - rather than
// threading 8 alpha uniforms + multiply sites through the shader. This
// shader is additive/blend everywhere the colour lands (`color += refracted`
// / `+ edgeLine` / `baseGlass = base + highlight`, and `mix(a, b, t)` for
// the trail/ambient stops), so a dimmed colour reads exactly as "this colour
// contributes less" i.e. more transparent. `?? 100` guards a preset saved
// before the *Opacity fields existed.
function colorVec(hex: string, opacityPct: number | undefined): THREE.Vector3 {
  return hexToVec3(hex).multiplyScalar((opacityPct ?? 100) / 100);
}

// Framework-agnostic mount for the "glassLiquid" shader - the SAME Three.js
// scene/render-loop logic apps/designer-extension/src/components/GlassLiquidCanvas.tsx
// (a React wrapper around this) and apps/glass-liquid-runtime (the
// self-hosted published-site bundle, no React at all) both call, so there's
// exactly one implementation instead of two copies that could drift apart.
// `setConfig` recomputes every uniform from a fresh full config object each
// call - simpler than tracking ~20 individual per-field diffs, and cheap
// enough since it's only called on real config changes, never per-frame.
export function mountGlassLiquid(
  canvas: HTMLCanvasElement,
  initialConfig: GlassLiquidConfig,
  options: MountGlassLiquidOptions = {},
): GlassLiquidHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: options.preserveDrawingBuffer,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);

  // Starts far off-canvas so nothing deposits until the cursor actually
  // enters. `mouseTarget` is the raw, live cursor position (mutated
  // directly by the mousemove listener below). `mouse` EASES toward it
  // every frame (see animate()) - that's what makes the trail trace a
  // smooth curve regardless of how sparsely real mousemove events arrive.
  // `prevMouse` is a snapshot of `mouse` as of the END of the previous
  // rendered frame. `velocity` spikes on each raw pointer move and decays
  // every frame.
  const mouseTarget = new THREE.Vector2(-10, -10);
  const mouse = new THREE.Vector2(-10, -10);
  const prevMouse = new THREE.Vector2(-10, -10);
  let velocity = 0;

  // These are read fresh every frame inside animate() (a closure that
  // outlives any single setConfig call), so they're tracked as plain
  // mutable locals updated by setConfig rather than captured by value.
  let fadeDuration = initialConfig.fadeDuration;
  let velocityDecay = initialConfig.velocityDecay;
  let floorPerSecond = initialConfig.floorPerSecond;

  // --- Simulation pass: ping-ponged trail accumulation buffer.
  let trailTargets = [createTrailTarget(1, 1), createTrailTarget(1, 1)];
  let currentTrail = 0;
  const simMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: SIM_FRAGMENT_SHADER,
    uniforms: {
      uPrevTrail: { value: trailTargets[0].texture },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uMouse: { value: mouse },
      uPrevMouse: { value: prevMouse },
      uVelocity: { value: 0 },
      uDecay: { value: 1 },
      uDecaySubtract: { value: 0 },
      uCeil: { value: initialConfig.ceiling },
      uDepositRadius: { value: initialConfig.cursorRadius },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uGlowColor1: { value: colorVec(initialConfig.glowColor1, initialConfig.glowColor1Opacity) },
      uGlowColor2: { value: colorVec(initialConfig.glowColor2, initialConfig.glowColor2Opacity) },
      uGlow: { value: colorVec(initialConfig.glowColor, initialConfig.glowColorOpacity) },
      uGlowStrength: { value: initialConfig.glowStrength },
    },
  });
  const simScene = new THREE.Scene();
  simScene.add(new THREE.Mesh(geometry, simMaterial));

  // --- Display pass: the fixed fluted glass, refracting the trail.
  // The surface-texture mode ("noise" halftone / "grain" film / "off") is a
  // compile-time #define, not a runtime uniform branch - the inactive
  // mode's GLSL is dead-code-eliminated, so "off" adds nothing per frame and
  // the two modes never both cost register pressure. Recompiled only when
  // the preset's grainMode actually changes (see setConfig).
  // Both grain modes are halftone dot-screens (see shaders.ts):
  // "grain" = GRAIN_HALFTONE, the production v6 dots (half-step radius,
  // device px). "noise" = GRAIN_HALFTONE_MERGE, the closer-to-shaderGradient
  // variant (full-step radius so dots merge, scatter jitter, CSS-px grid).
  // "off" = neither. Default "grain" so a preset with a grainStrength but no
  // grainMode field (everything published so far) renders exactly as v6.
  const grainDefines = (mode: GlassLiquidConfig["grainMode"]): Record<string, string> =>
    mode === "grain" ? { GRAIN_HALFTONE: "1" } : mode === "noise" ? { GRAIN_HALFTONE_MERGE: "1" } : {};
  // All compile-time #defines for the display shader in one place - the
  // grain variant plus the optional AMBIENT_GRADIENT layer (a slow moving
  // colour gradient refracted through the flutes, independent of the cursor
  // trail). Recompiled from setConfig only when one of these actually
  // changes.
  const displayDefines = (c: GlassLiquidConfig): Record<string, string> => ({
    ...grainDefines(c.grainMode ?? "grain"),
    ...(c.ambientGradient ? { AMBIENT_GRADIENT: "1" } : {}),
  });
  let grainMode: GlassLiquidConfig["grainMode"] = initialConfig.grainMode ?? "grain";
  let ambientGradient = initialConfig.ambientGradient ?? false;
  const displayMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    defines: displayDefines(initialConfig),
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uRefraction: { value: initialConfig.refraction },
      uFlutesAngle: { value: (initialConfig.flutesAngle * Math.PI) / 180 },
      uFlutesFrequency: { value: initialConfig.flutesFrequency },
      uGrainStrength: { value: initialConfig.grainStrength },
      // `?? 4` guards a preset saved before grainScale existed (a raw
      // stored config missing this key entirely, not run back through the
      // zod schema's own default on read) - see gradient-core's
      // glassLiquidConfigSchema comment on grainStrength/grainScale.
      uGrainScale: { value: initialConfig.grainScale ?? 4 },
      // Only the "noise" (GRAIN_HALFTONE_MERGE) variant reads this - it puts
      // its dot grid in CSS-px space (gl_FragCoord is device px). Kept in
      // sync in resize().
      uPixelRatio: { value: renderer.getPixelRatio() },
      uHighlightStrength: { value: initialConfig.highlightStrength },
      uResolutionY: { value: 1 },
      uEdgeStrength: { value: initialConfig.edgeStrength },
      uEdgeWidth: { value: initialConfig.edgeWidth },
      uEdgeTrailMod: { value: initialConfig.edgeTrailMod },
      uWobbleAmount: { value: initialConfig.wobbleAmount },
      uScrollSpeed: { value: initialConfig.scrollSpeed },
      uFluteVariation: { value: initialConfig.fluteVariation },
      uFlutesDepth: { value: initialConfig.flutesDepth ?? 0 },
      uFlutesMask: { value: flutesMaskToNum(initialConfig.flutesDepthMask) },
      uSeamScroll: { value: initialConfig.seamScroll ? 1 : 0 },
      uSeamWobble: { value: initialConfig.seamWobble ? 1 : 0 },
      uConfine: { value: initialConfig.confine ? 1 : 0 },
      uAA: { value: initialConfig.edgeAA ? 1 : 0 },
      uIsolate: { value: initialConfig.isolateLines ? 1 : 0 },
      uBaseColor: { value: colorVec(initialConfig.baseColor, initialConfig.baseColorOpacity) },
      uHighlight: { value: colorVec(initialConfig.highlightColor, initialConfig.highlightColorOpacity) },
      uEdgeColor: { value: colorVec(initialConfig.edgeColor, initialConfig.edgeColorOpacity) },
      // Read only when AMBIENT_GRADIENT is defined (see displayDefines).
      uAmbientColor1: { value: colorVec(initialConfig.ambientColor1 ?? "#4073f2", initialConfig.ambientColor1Opacity) },
      uAmbientColor2: { value: colorVec(initialConfig.ambientColor2 ?? "#8c26d9", initialConfig.ambientColor2Opacity) },
      uAmbientStrength: { value: initialConfig.ambientStrength ?? 0.35 },
      uTrailTex: { value: trailTargets[0].texture },
    },
  });
  const displayScene = new THREE.Scene();
  displayScene.add(new THREE.Mesh(geometry, displayMaterial));

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    renderer.setSize(rect.width, rect.height, false);
    const aspect = rect.width / rect.height;
    simMaterial.uniforms.uAspect.value = aspect;
    displayMaterial.uniforms.uAspect.value = aspect;

    // Trail targets are recreated (not just resized) so a container
    // resize doesn't leave stretched-old-resolution content behind -
    // simplest correct behavior is to reset the trail to black on
    // resize, same as a fresh mount.
    trailTargets[0].dispose();
    trailTargets[1].dispose();
    const pixelRatio = renderer.getPixelRatio();
    const targetWidth = rect.width * pixelRatio;
    const targetHeight = rect.height * pixelRatio;
    trailTargets = [createTrailTarget(targetWidth, targetHeight), createTrailTarget(targetWidth, targetHeight)];
    simMaterial.uniforms.uTexel.value.set(1 / targetWidth, 1 / targetHeight);
    // Real physical pixel height (post devicePixelRatio) - the edge
    // line's uEdgeWidth is expressed in pixels of this resolution, not
    // CSS pixels, so it stays a consistent on-screen thickness regardless
    // of the display's own pixel density.
    displayMaterial.uniforms.uResolutionY.value = targetHeight;
    displayMaterial.uniforms.uPixelRatio.value = pixelRatio;
    currentTrail = 0;
    renderer.setRenderTarget(trailTargets[0]);
    renderer.clear();
    renderer.setRenderTarget(trailTargets[1]);
    renderer.clear();
    renderer.setRenderTarget(null);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  // Listens on `window`, not `canvas` - this canvas is meant to sit BEHIND a
  // target element's real content (z-index:-1, see applyGlassLiquid.ts), so
  // a canvas-level listener would only ever fire over the fraction of the
  // target with nothing else painted on top of it. `window` always receives
  // mousemove regardless of what's on top; bounds-checking against the
  // canvas's own rect (computed fresh per event, so it's correct even if the
  // canvas has moved/resized since the last frame) recovers the same
  // "on canvas" / "left canvas" semantics a canvas-level listener would give.
  const handleMouseMove = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = 1 - (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      mouseTarget.set(-10, -10);
      return;
    }
    const dx = x - mouseTarget.x;
    const dy = y - mouseTarget.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    mouseTarget.set(x, y);
    velocity = Math.min(dist * 80, 6);
  };
  window.addEventListener("mousemove", handleMouseMove);

  const clock = new THREE.Clock();
  let elapsed = 0;
  let rafId: number | null = requestAnimationFrame(animate);

  function animate() {
    // getDelta() is called exactly once per frame, here - THREE.Clock's
    // getElapsedTime() calls getDelta() internally too, so calling both
    // would silently consume two deltas per frame. `elapsed` is instead
    // accumulated by hand from this single getDelta() call.
    const delta = clock.getDelta();
    elapsed += delta;
    simMaterial.uniforms.uTime.value = elapsed;
    displayMaterial.uniforms.uTime.value = elapsed;

    // Real-time decay, recomputed from the live "Fade duration" value every
    // frame - raising it to the power of this frame's own delta keeps the
    // fade duration accurate regardless of the display's actual frame rate.
    const decayPerSecond = Math.pow(FADE_EPSILON, 1 / fadeDuration);
    simMaterial.uniforms.uDecay.value = Math.pow(decayPerSecond, delta);
    // Same real-time scaling for the subtractive floor - a flat per-frame
    // constant would subtract more per real second at a higher frame rate
    // than a lower one.
    simMaterial.uniforms.uDecaySubtract.value = floorPerSecond * delta;

    // Snapshot BEFORE easing (so it holds last frame's eased position),
    // then ease `mouse` toward `mouseTarget` and decay `velocity`. The sim
    // shader then sees "current" (post-easing) vs. "as of last rendered
    // frame", which is what makes the deposit capsule span exactly one
    // frame's worth of smooth movement instead of jumping between raw,
    // sparsely-sampled points.
    prevMouse.copy(mouse);
    mouse.lerp(mouseTarget, 0.2);
    velocity *= Math.pow(velocityDecay, delta);
    simMaterial.uniforms.uVelocity.value = velocity;

    const readTarget = trailTargets[currentTrail];
    const writeTarget = trailTargets[1 - currentTrail];
    simMaterial.uniforms.uPrevTrail.value = readTarget.texture;
    renderer.setRenderTarget(writeTarget);
    renderer.render(simScene, camera);
    renderer.setRenderTarget(null);

    currentTrail = 1 - currentTrail;
    displayMaterial.uniforms.uTrailTex.value = trailTargets[currentTrail].texture;
    renderer.render(displayScene, camera);

    rafId = requestAnimationFrame(animate);
  }

  function setConfig(config: GlassLiquidConfig) {
    fadeDuration = config.fadeDuration;
    velocityDecay = config.velocityDecay;
    floorPerSecond = config.floorPerSecond;

    simMaterial.uniforms.uCeil.value = config.ceiling;
    simMaterial.uniforms.uDepositRadius.value = config.cursorRadius;
    simMaterial.uniforms.uGlowColor1.value.copy(colorVec(config.glowColor1, config.glowColor1Opacity));
    simMaterial.uniforms.uGlowColor2.value.copy(colorVec(config.glowColor2, config.glowColor2Opacity));
    simMaterial.uniforms.uGlow.value.copy(colorVec(config.glowColor, config.glowColorOpacity));
    simMaterial.uniforms.uGlowStrength.value = config.glowStrength;

    displayMaterial.uniforms.uRefraction.value = config.refraction;
    displayMaterial.uniforms.uFlutesAngle.value = (config.flutesAngle * Math.PI) / 180;
    displayMaterial.uniforms.uFlutesFrequency.value = config.flutesFrequency;
    displayMaterial.uniforms.uGrainStrength.value = config.grainStrength;
    displayMaterial.uniforms.uGrainScale.value = config.grainScale ?? 4;
    const nextGrainMode = config.grainMode ?? "grain";
    const nextAmbient = config.ambientGradient ?? false;
    if (nextGrainMode !== grainMode || nextAmbient !== ambientGradient) {
      grainMode = nextGrainMode;
      ambientGradient = nextAmbient;
      displayMaterial.defines = displayDefines(config);
      // Forces a one-time shader recompile - only ever on a real mode/toggle
      // change in the live editor; the published embed's are fixed at mount.
      displayMaterial.needsUpdate = true;
    }
    displayMaterial.uniforms.uHighlightStrength.value = config.highlightStrength;
    displayMaterial.uniforms.uEdgeStrength.value = config.edgeStrength;
    displayMaterial.uniforms.uEdgeWidth.value = config.edgeWidth;
    displayMaterial.uniforms.uEdgeTrailMod.value = config.edgeTrailMod;
    displayMaterial.uniforms.uWobbleAmount.value = config.wobbleAmount;
    displayMaterial.uniforms.uScrollSpeed.value = config.scrollSpeed;
    displayMaterial.uniforms.uFluteVariation.value = config.fluteVariation;
    displayMaterial.uniforms.uFlutesDepth.value = config.flutesDepth ?? 0;
    displayMaterial.uniforms.uFlutesMask.value = flutesMaskToNum(config.flutesDepthMask);
    displayMaterial.uniforms.uSeamScroll.value = config.seamScroll ? 1 : 0;
    displayMaterial.uniforms.uSeamWobble.value = config.seamWobble ? 1 : 0;
    displayMaterial.uniforms.uConfine.value = config.confine ? 1 : 0;
    displayMaterial.uniforms.uAA.value = config.edgeAA ? 1 : 0;
    displayMaterial.uniforms.uIsolate.value = config.isolateLines ? 1 : 0;
    displayMaterial.uniforms.uBaseColor.value.copy(colorVec(config.baseColor, config.baseColorOpacity));
    displayMaterial.uniforms.uHighlight.value.copy(colorVec(config.highlightColor, config.highlightColorOpacity));
    displayMaterial.uniforms.uEdgeColor.value.copy(colorVec(config.edgeColor, config.edgeColorOpacity));
    displayMaterial.uniforms.uAmbientColor1.value.copy(colorVec(config.ambientColor1 ?? "#4073f2", config.ambientColor1Opacity));
    displayMaterial.uniforms.uAmbientColor2.value.copy(colorVec(config.ambientColor2 ?? "#8c26d9", config.ambientColor2Opacity));
    displayMaterial.uniforms.uAmbientStrength.value = config.ambientStrength ?? 0.35;
  }

  function pause() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function resume() {
    if (rafId !== null) return;
    // Discards whatever real time passed while paused rather than feeding
    // one huge `delta` into the next animate() call - clock.getDelta()
    // measures time since its OWN last call, not since the loop stopped, so
    // without this the first post-resume frame would jump the whole visual
    // (uTime-driven wobble, decay math) forward by the entire paused
    // duration in one step.
    clock.getDelta();
    rafId = requestAnimationFrame(animate);
  }

  function dispose() {
    pause();
    resizeObserver.disconnect();
    window.removeEventListener("mousemove", handleMouseMove);
    simMaterial.dispose();
    displayMaterial.dispose();
    geometry.dispose();
    trailTargets[0].dispose();
    trailTargets[1].dispose();
    renderer.dispose();
  }

  return { setConfig, pause, resume, dispose };
}
