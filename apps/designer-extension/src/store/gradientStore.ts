import { create } from "zustand";
import {
  DEFAULT_GRADIENT_CONFIG,
  type GradientConfig,
} from "@fluxa/gradient-core";

interface GradientStore {
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
  reset: () => void;
}

export const useGradientStore = create<GradientStore>((set) => ({
  config: DEFAULT_GRADIENT_CONFIG,
  setConfig: (patch) =>
    set((state) => ({ config: { ...state.config, ...patch } })),
  reset: () => set({ config: DEFAULT_GRADIENT_CONFIG }),
}));
