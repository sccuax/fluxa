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
  dispose(): void;
}

export interface MountGlassLiquidOptions {
  // Threaded straight into the WebGL context - see GlassLiquidCanvas.tsx's
  // own comment for why apps/preset-admin needs this (thumbnail capture)
  // and the published-site runtime doesn't (never read back).
  preserveDrawingBuffer?: boolean;
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

  // These three are read fresh every frame inside animate() (a closure that
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
      uGlowColor1: { value: hexToVec3(initialConfig.glowColor1) },
      uGlowColor2: { value: hexToVec3(initialConfig.glowColor2) },
      uGlow: { value: hexToVec3(initialConfig.glowColor) },
      uGlowStrength: { value: initialConfig.glowStrength },
    },
  });
  const simScene = new THREE.Scene();
  simScene.add(new THREE.Mesh(geometry, simMaterial));

  // --- Display pass: the fixed fluted glass, refracting the trail.
  const displayMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uRefraction: { value: initialConfig.refraction },
      uFlutesAngle: { value: (initialConfig.flutesAngle * Math.PI) / 180 },
      uFlutesFrequency: { value: initialConfig.flutesFrequency },
      uGrainStrength: { value: initialConfig.grainStrength },
      uHighlightStrength: { value: initialConfig.highlightStrength },
      uResolutionY: { value: 1 },
      uEdgeStrength: { value: initialConfig.edgeStrength },
      uEdgeWidth: { value: initialConfig.edgeWidth },
      uEdgeTrailMod: { value: initialConfig.edgeTrailMod },
      uWobbleAmount: { value: initialConfig.wobbleAmount },
      uScrollSpeed: { value: initialConfig.scrollSpeed },
      uFluteVariation: { value: initialConfig.fluteVariation },
      uSeamScroll: { value: initialConfig.seamScroll ? 1 : 0 },
      uSeamWobble: { value: initialConfig.seamWobble ? 1 : 0 },
      uConfine: { value: initialConfig.confine ? 1 : 0 },
      uAA: { value: initialConfig.edgeAA ? 1 : 0 },
      uGrainOnEdge: { value: initialConfig.grainOnEdge ? 1 : 0 },
      uIsolate: { value: initialConfig.isolateLines ? 1 : 0 },
      uBaseColor: { value: hexToVec3(initialConfig.baseColor) },
      uHighlight: { value: hexToVec3(initialConfig.highlightColor) },
      uEdgeColor: { value: hexToVec3(initialConfig.edgeColor) },
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
  let rafId = requestAnimationFrame(animate);

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
    simMaterial.uniforms.uGlowColor1.value.copy(hexToVec3(config.glowColor1));
    simMaterial.uniforms.uGlowColor2.value.copy(hexToVec3(config.glowColor2));
    simMaterial.uniforms.uGlow.value.copy(hexToVec3(config.glowColor));
    simMaterial.uniforms.uGlowStrength.value = config.glowStrength;

    displayMaterial.uniforms.uRefraction.value = config.refraction;
    displayMaterial.uniforms.uFlutesAngle.value = (config.flutesAngle * Math.PI) / 180;
    displayMaterial.uniforms.uFlutesFrequency.value = config.flutesFrequency;
    displayMaterial.uniforms.uGrainStrength.value = config.grainStrength;
    displayMaterial.uniforms.uHighlightStrength.value = config.highlightStrength;
    displayMaterial.uniforms.uEdgeStrength.value = config.edgeStrength;
    displayMaterial.uniforms.uEdgeWidth.value = config.edgeWidth;
    displayMaterial.uniforms.uEdgeTrailMod.value = config.edgeTrailMod;
    displayMaterial.uniforms.uWobbleAmount.value = config.wobbleAmount;
    displayMaterial.uniforms.uScrollSpeed.value = config.scrollSpeed;
    displayMaterial.uniforms.uFluteVariation.value = config.fluteVariation;
    displayMaterial.uniforms.uSeamScroll.value = config.seamScroll ? 1 : 0;
    displayMaterial.uniforms.uSeamWobble.value = config.seamWobble ? 1 : 0;
    displayMaterial.uniforms.uConfine.value = config.confine ? 1 : 0;
    displayMaterial.uniforms.uAA.value = config.edgeAA ? 1 : 0;
    displayMaterial.uniforms.uGrainOnEdge.value = config.grainOnEdge ? 1 : 0;
    displayMaterial.uniforms.uIsolate.value = config.isolateLines ? 1 : 0;
    displayMaterial.uniforms.uBaseColor.value.copy(hexToVec3(config.baseColor));
    displayMaterial.uniforms.uHighlight.value.copy(hexToVec3(config.highlightColor));
    displayMaterial.uniforms.uEdgeColor.value.copy(hexToVec3(config.edgeColor));
  }

  function dispose() {
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    window.removeEventListener("mousemove", handleMouseMove);
    simMaterial.dispose();
    displayMaterial.dispose();
    geometry.dispose();
    trailTargets[0].dispose();
    trailTargets[1].dispose();
    renderer.dispose();
  }

  return { setConfig, dispose };
}
