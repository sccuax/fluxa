import { create } from "zustand";
import {
  DEFAULT_GRADIENT_CONFIG,
  type GradientConfig,
} from "@fluxa/gradient-core";

interface GradientStore {
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
  reset: () => void;
  // Whether a color-editing modal (ColorSwatchPicker's FullViewModal) is
  // currently open - EditorTab.tsx reads this to fully unmount
  // GradientCanvas while it's true. GradientCanvas is otherwise always
  // mounted alongside ControlPanel and keeps its own R3F render loop running
  // continuously regardless of visibility - ShaderGradientCanvas exposes no
  // pause/frameloop prop to stop that loop from outside (checked its own
  // type defs), so unmounting is the only way to actually stop that GPU/CPU
  // cost while it's hidden behind the modal and competing with the modal's
  // own drag-driven re-renders for the same main thread. Lives in this
  // shared store (not local state on ColorSwatchPicker) because
  // GradientCanvas and ColorSwatchPicker are siblings/cousins in the tree
  // (EditorTab vs. deep inside ControlPanel), with no other shared state
  // between them to piggyback on.
  colorModalOpen: boolean;
  setColorModalOpen: (open: boolean) => void;
}

export const useGradientStore = create<GradientStore>((set) => ({
  config: DEFAULT_GRADIENT_CONFIG,
  setConfig: (patch) =>
    set((state) => ({ config: { ...state.config, ...patch } })),
  reset: () => set({ config: DEFAULT_GRADIENT_CONFIG }),
  colorModalOpen: false,
  setColorModalOpen: (open) => set({ colorModalOpen: open }),
}));
