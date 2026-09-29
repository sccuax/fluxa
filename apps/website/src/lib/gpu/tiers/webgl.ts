// WebGL tier: reuses the product's own self-authored renderer, so the marketing
// hero is literally the same shader customers ship (no second implementation).
import { DEFAULT_RUIDO_EVOLUTIVO_CONFIG } from "@fluxa/gradient-core";
import { mountRuidoEvolutivo } from "@fluxa/ruido-evolutivo-renderer";
import type { StageHandle } from "../types";

// Brand palette (design-tokens: accent, accent-2, dark).
const HERO_COLORS = ["#e23f8c", "#6ff5f1", "#20242d"];

export function mountWebglStage(canvas: HTMLCanvasElement): StageHandle {
  const handle = mountRuidoEvolutivo(canvas, {
    ...DEFAULT_RUIDO_EVOLUTIVO_CONFIG,
    colors: HERO_COLORS,
    // The renderer frames a roughly square plane. The hero is ~3:1, so move the
    // camera in to the minimum distance and stop the orbit drift (it shifts the
    // camera sideways and exposes the plane's edges as black gaps).
    zoom: 0.35,
    orbit: false,
  });
  return {
    pause: () => handle.pause(),
    resume: () => handle.resume(),
    dispose: () => handle.dispose(),
  };
}
