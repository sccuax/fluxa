import { create } from "zustand";
import {
  DEFAULT_GLASS_LIQUID_CONFIG,
  type GlassLiquidConfig,
} from "@fluxa/gradient-core";

interface GlassLiquidStore {
  config: GlassLiquidConfig;
  setConfig: (patch: Partial<GlassLiquidConfig>) => void;
  reset: () => void;
}

// Mirrors gradientStore.ts's own shape exactly, minus `colorModalOpen` -
// that field exists there only because ShaderGradientCanvas (R3F) has no
// way to pause its render loop from outside, forcing EditorTab.tsx to fully
// unmount GradientCanvas while ShaderGradient's own heavy FullViewModal
// color picker is open. GlassLiquidCanvas's render loop is a plain
// requestAnimationFrame this file's own component owns directly (cancelable
// from inside itself if ever needed), and its ColorSwatchControl is already
// a lightweight portal popover, not a FullViewModal - there's nothing here
// that needs a shared "is a heavy modal open" flag.
export const useGlassLiquidStore = create<GlassLiquidStore>((set) => ({
  config: DEFAULT_GLASS_LIQUID_CONFIG,
  setConfig: (patch) =>
    set((state) => ({ config: { ...state.config, ...patch } })),
  reset: () => set({ config: DEFAULT_GLASS_LIQUID_CONFIG }),
}));
