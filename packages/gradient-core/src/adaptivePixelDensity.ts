// ShaderGradientCanvas's own `pixelDensity` prop is passed straight through as a
// literal, fixed `dpr` value to @react-three/fiber's <Canvas> (confirmed by reading
// the installed package's compiled chunk-CPUZJ7YV.mjs - it never reads
// `window.devicePixelRatio` at all). That means the actual number of physical pixels
// the shader renders is simply (css width) x (css height) x pixelDensity^2 - so the
// SAME preset (same pixelDensity) can be 4x more expensive on a real, unscaled 4K
// display than on a 1080p one purely because the canvas's CSS box is that much
// bigger, nothing to do with GPU/DPI at all. Confirmed for real: a shader that was
// fluid at 1080p visibly stuttered on the same PC set to native 4K.
//
// MAX_RENDER_PIXELS is deliberately exactly 1920x1080 (~2.07M px) - the resolution
// confirmed fluid in that real report. computeAdaptivePixelDensity shrinks the
// configured pixelDensity (never raises it) so the canvas never renders more total
// physical pixels than that budget, regardless of how large its CSS box actually is.
export const MAX_RENDER_PIXELS = 1920 * 1080;

// A hard floor so an extreme (multi-monitor/ultra-wide) canvas doesn't get shrunk
// into a blurry mess chasing the pixel budget - below this, accept the higher pixel
// count instead of degrading quality further.
export const MIN_ADAPTIVE_PIXEL_DENSITY = 0.35;

// `gradientEmbedScript.ts`'s injected <script> can't import this module (it runs
// standalone in a visitor's browser, loaded from esm.sh) - its own copy of this
// exact formula/constants must be kept in sync by hand if this ever changes.
export function computeAdaptivePixelDensity(
  configuredPixelDensity: number,
  cssWidth: number,
  cssHeight: number,
): number {
  const area = cssWidth * cssHeight;
  if (!(area > 0)) return configuredPixelDensity;

  const maxDensityForBudget = Math.sqrt(MAX_RENDER_PIXELS / area);
  return Math.max(
    MIN_ADAPTIVE_PIXEL_DENSITY,
    Math.min(configuredPixelDensity, maxDensityForBudget),
  );
}
