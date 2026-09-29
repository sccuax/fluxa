// Progressive enhancement for heavy visuals. Every GPU/WASM feature on the
// site picks a *tier* from here and must ship a lower tier that still looks
// intentional. Nothing in this file touches the DOM at import time, so it is
// safe to import from Astro frontmatter (it just reports "none" on the server).

export type RenderTier = "webgpu" | "webgl" | "none";

export interface Capabilities {
  tier: RenderTier;
  prefersReducedMotion: boolean;
  saveData: boolean;
  /** Coarse device class from navigator.hardwareConcurrency/deviceMemory. */
  lowPower: boolean;
  wasm: boolean;
}

interface NetworkInformationLike {
  saveData?: boolean;
}

let cached: Capabilities | null = null;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Real WebGPU check: `navigator.gpu` existing is not enough (it is defined on
 * browsers where no adapter can actually be obtained), so request an adapter.
 */
async function hasWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    return (await navigator.gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

export async function detectCapabilities(): Promise<Capabilities> {
  if (cached) return cached;

  if (typeof window === "undefined") {
    return { tier: "none", prefersReducedMotion: false, saveData: false, lowPower: false, wasm: false };
  }

  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    deviceMemory?: number;
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = nav.connection?.saveData === true;
  const lowPower = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  const wasm = typeof WebAssembly === "object";

  let tier: RenderTier = "none";
  // Reduced motion / data saver: never spin up a GPU context for decoration.
  if (!prefersReducedMotion && !saveData) {
    if (await hasWebGPU()) tier = "webgpu";
    else if (hasWebGL()) tier = "webgl";
  }

  cached = { tier, prefersReducedMotion, saveData, lowPower, wasm };
  return cached;
}
