import type { RuidoEvolutivoConfig } from "@fluxa/gradient-core";
import { fetchPublishedPresetsSafe } from "@/lib/api/presets";

// The "inferno" gallery preset (a ruidoEvolutivo, made in Fluxa Studio) is the orange gradient of the hero's
// square and of the central gradient card - the real product shader, not a recreation. The build reads the live
// published preset so tuning it in Studio + a redeploy is enough; this snapshot (2026-09-29) is only the fallback
// when the API is unreachable at build time.
export const INFERNO_FALLBACK: RuidoEvolutivoConfig = {
  warp: 0,
  zoom: 0.35,
  grain: 0,
  orbit: true,
  speed: 1.1,
  colors: ["#fddaba", "#f7912f", "#ee4236"],
  detail: 3,
  relief: 0.64,
  animate: "on",
  shimmer: 0.05,
  colorMix: 1,
  contrast: 4,
  evolution: 0.2,
  flowAngle: 206,
  frequency: 0.5,
  roughness: 0.7,
  warpScale: 0.2,
  waveScale: 1.4,
  wireframe: false,
  distortion: 0,
  flowSpread: 0,
  grainScale: 2,
  lacunarity: 2.25,
  lightAngle: 218,
  saturation: 1,
  gridDensity: 128,
  colorsOpacity: [],
  lightStrength: 0.18,
};

export async function loadInfernoConfig(): Promise<RuidoEvolutivoConfig> {
  const presets = await fetchPublishedPresetsSafe();
  const found = presets.find((p) => p.kind === "ruidoEvolutivo" && p.name.trim().toLowerCase() === "inferno");
  return found && found.kind === "ruidoEvolutivo" ? found.config : INFERNO_FALLBACK;
}
