import { create } from "zustand";
import {
  DEFAULT_RUIDO_EVOLUTIVO_CONFIG,
  type RuidoEvolutivoConfig,
} from "@fluxa/gradient-core";

interface RuidoEvolutivoStore {
  config: RuidoEvolutivoConfig;
  setConfig: (patch: Partial<RuidoEvolutivoConfig>) => void;
  reset: () => void;
}

// Mirrors glassLiquidStore.ts exactly - the "ruidoEvolutivo" gallery preset
// kind's live config, driven by RuidoEvolutivoControlPanel.tsx and read by
// RuidoEvolutivoCanvas.tsx. Like GlassLiquidCanvas, RuidoEvolutivoCanvas's
// render loop is a plain requestAnimationFrame the component owns directly,
// so there's no need for gradientStore's `colorModalOpen` escape hatch (see
// glassLiquidStore.ts's own comment for that field's history).
export const useRuidoEvolutivoStore = create<RuidoEvolutivoStore>((set) => ({
  config: DEFAULT_RUIDO_EVOLUTIVO_CONFIG,
  setConfig: (patch) =>
    set((state) => ({ config: { ...state.config, ...patch } })),
  reset: () => set({ config: DEFAULT_RUIDO_EVOLUTIVO_CONFIG }),
}));
