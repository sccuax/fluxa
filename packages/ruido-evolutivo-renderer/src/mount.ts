import * as THREE from "three";
import {
  type RuidoEvolutivoConfig,
  RUIDO_EVOLUTIVO_MAX_COLORS,
  padRuidoColors,
} from "@fluxa/gradient-core";
import { VERTEX_SHADER, FRAGMENT_SHADER, hexToVec3, DEG2RAD } from "./shaders";

export interface RuidoEvolutivoHandle {
  setConfig(config: RuidoEvolutivoConfig): void;
  dispose(): void;
}

export interface MountRuidoEvolutivoOptions {
  // Threaded straight into the WebGL context - apps/preset-admin passes true
  // so its thumbnail-capture button can read the canvas's real pixels; the
  // Designer Extension and the published-site runtime leave it unset (a
  // small compositing cost not worth paying for nothing). Same contract as
  // @fluxa/glass-liquid-renderer's mount.
  preserveDrawingBuffer?: boolean;
}

const PLANE_HALF_SIZE = 1.3;
const FOV = 45;

// Framework-agnostic mount for the "ruidoEvolutivo" shader - the SAME
// Three.js scene/render-loop apps/designer-extension/src/components/
// RuidoEvolutivoCanvas.tsx (a React wrapper) and the self-hosted
// published-site runtime both call, so there's one implementation instead
// of two copies that could drift. `setConfig` recomputes every uniform
// from a fresh full config object each call (cheap - only fired on real
// config changes, never per-frame).
export function mountRuidoEvolutivo(
  canvas: HTMLCanvasElement,
  initialConfig: RuidoEvolutivoConfig,
  options: MountRuidoEvolutivoOptions = {},
): RuidoEvolutivoHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: options.preserveDrawingBuffer,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const baseDistance = PLANE_HALF_SIZE / Math.tan((FOV * Math.PI) / 360) + 0.4;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 20);
  camera.position.set(0, 0, baseDistance);

  const scene = new THREE.Scene();

  // A fixed-length array of Vector3s backing the GLSL `uniform vec3
  // uColors[MAX_COLORS]` - padRuidoColors repeats the last colour into the
  // unused tail slots, and the shader's uColorCount is what actually stops
  // the blend loop, so those tail slots are never read. Mutated in place by
  // applyColors (never reallocated) so three keeps uploading the same
  // uniform binding.
  const colorVecs: THREE.Vector3[] = Array.from(
    { length: RUIDO_EVOLUTIVO_MAX_COLORS },
    () => new THREE.Vector3(),
  );
  const applyColors = (colors: string[]) => {
    const padded = padRuidoColors(colors);
    for (let i = 0; i < RUIDO_EVOLUTIVO_MAX_COLORS; i++) {
      colorVecs[i].copy(hexToVec3(padded[i]));
    }
  };
  applyColors(initialConfig.colors);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    wireframe: initialConfig.wireframe,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: initialConfig.speed },
      uFrequency: { value: initialConfig.frequency },
      uRelief: { value: initialConfig.relief },
      uOctaves: { value: initialConfig.detail },
      uGain: { value: initialConfig.roughness },
      uLacunarity: { value: initialConfig.lacunarity },
      uEvolution: { value: initialConfig.evolution },
      uWarpAmount: { value: initialConfig.warp },
      uWarpScale: { value: initialConfig.warpScale },
      uWaveScale: { value: initialConfig.waveScale },
      uDistortion: { value: initialConfig.distortion },
      uContrast: { value: initialConfig.contrast },
      uColorMix: { value: initialConfig.colorMix },
      uFlowAngle: { value: initialConfig.flowAngle * DEG2RAD },
      uFlowSpread: { value: initialConfig.flowSpread },
      uShimmer: { value: initialConfig.shimmer },
      uGrain: { value: initialConfig.grain },
      uGrainScale: { value: initialConfig.grainScale },
      uLightAngle: { value: initialConfig.lightAngle * DEG2RAD },
      uLightStrength: { value: initialConfig.lightStrength },
      uSaturation: { value: initialConfig.saturation },
      uColors: { value: colorVecs },
      uColorCount: { value: initialConfig.colors.length },
    },
  });

  // Rebuilt (not just resized) whenever gridDensity changes - PlaneGeometry's
  // subdivision count is fixed at construction. Cheap since it only fires on
  // a real config change, never per-frame.
  let currentGridDensity = Math.round(initialConfig.gridDensity);
  let geometry = new THREE.PlaneGeometry(
    PLANE_HALF_SIZE * 2,
    PLANE_HALF_SIZE * 2,
    currentGridDensity,
    currentGridDensity,
  );
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Read fresh every frame inside animate() (a closure that outlives any
  // single setConfig call), so tracked as plain mutable locals. `animate`
  // is an "on"/"off" enum on the config - coerce to a real boolean here (a
  // bare `if ("off")` is truthy).
  let animating = initialConfig.animate === "on";
  let orbit = initialConfig.orbit;
  let zoom = initialConfig.zoom;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const clock = new THREE.Clock();
  let elapsed = 0;
  let rafId = requestAnimationFrame(loop);

  function loop() {
    const delta = clock.getDelta();
    if (animating) elapsed += delta;
    material.uniforms.uTime.value = elapsed;

    const distance = baseDistance * zoom;
    if (orbit) {
      camera.position.x = Math.sin(elapsed * 0.15) * 0.18;
      camera.position.y = Math.cos(elapsed * 0.11) * 0.1;
    } else {
      camera.position.x = 0;
      camera.position.y = 0;
    }
    camera.position.z = distance;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }

  function setConfig(config: RuidoEvolutivoConfig) {
    animating = config.animate === "on";
    orbit = config.orbit;
    zoom = config.zoom;

    material.wireframe = config.wireframe;

    const nextGrid = Math.round(config.gridDensity);
    if (nextGrid !== currentGridDensity) {
      currentGridDensity = nextGrid;
      geometry.dispose();
      geometry = new THREE.PlaneGeometry(PLANE_HALF_SIZE * 2, PLANE_HALF_SIZE * 2, nextGrid, nextGrid);
      mesh.geometry = geometry;
    }

    const u = material.uniforms;
    u.uSpeed.value = config.speed;
    u.uFrequency.value = config.frequency;
    u.uRelief.value = config.relief;
    u.uOctaves.value = config.detail;
    u.uGain.value = config.roughness;
    u.uLacunarity.value = config.lacunarity;
    u.uEvolution.value = config.evolution;
    u.uWarpAmount.value = config.warp;
    u.uWarpScale.value = config.warpScale;
    u.uWaveScale.value = config.waveScale;
    u.uDistortion.value = config.distortion;
    u.uContrast.value = config.contrast;
    u.uColorMix.value = config.colorMix;
    u.uFlowAngle.value = config.flowAngle * DEG2RAD;
    u.uFlowSpread.value = config.flowSpread;
    u.uShimmer.value = config.shimmer;
    u.uGrain.value = config.grain;
    u.uGrainScale.value = config.grainScale;
    u.uLightAngle.value = config.lightAngle * DEG2RAD;
    u.uLightStrength.value = config.lightStrength;
    u.uSaturation.value = config.saturation;

    applyColors(config.colors);
    u.uColorCount.value = config.colors.length;
  }

  function dispose() {
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    material.dispose();
    geometry.dispose();
    renderer.dispose();
  }

  return { setConfig, dispose };
}
