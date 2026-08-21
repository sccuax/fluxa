// EyeDropper API (WHATWG/Chromium) - confirmed absent from this repo's
// installed TypeScript version's own lib.dom.d.ts (checked node_modules
// directly, not assumed). Minimal ambient surface, just what
// ControlPanel.tsx's EyeDropperButton actually calls - not a full spec
// mirror.
interface EyeDropperOpenOptions {
  signal?: AbortSignal;
}

interface EyeDropperOpenResult {
  sRGBHex: string;
}

interface EyeDropper {
  open(options?: EyeDropperOpenOptions): Promise<EyeDropperOpenResult>;
}

interface EyeDropperConstructor {
  new (): EyeDropper;
}

interface Window {
  EyeDropper?: EyeDropperConstructor;
}
