import { getEffectiveGradientColors, type GradientConfig } from "@fluxa/gradient-core";

// Pinned to the exact versions installed locally (package.json / GradientCanvas.tsx's
// working preview) so the published embed renders identically to what the panel already
// showed - not the latest esm.sh-resolved versions, which could drift.
const REACT_VERSION = "18.3.1";
const SHADERGRADIENT_VERSION = "2.4.20";
// @shadergradient/react depends on @react-three/fiber and three internally. Without
// pinning these too, esm.sh resolves whatever's latest for those transitive deps -
// confirmed for real on the published page to resolve @react-three/fiber@9.x, which
// requires React 19 (v9 reads renamed React-19-only ReactSharedInternals fields, e.g.
// `.S` for the current dispatcher) and throws `Cannot read properties of undefined
// (reading 'S')` against our pinned React 18. Must match apps/designer-extension's own
// installed versions (package.json: @react-three/fiber ^8.18.0, three ^0.166.0), the
// same ones GradientCanvas.tsx's working panel preview already renders with.
const REACT_THREE_FIBER_VERSION = "8.18.0";
const THREE_VERSION = "0.166.1";

// A leading HTML comment marker so applyGradient.ts can recognize an embed it created
// earlier (re-applying should update that embed's code in place, not stack a second one).
export const GRADIENT_EMBED_MARKER = "<!-- fluxa-gradient -->";

// Builds the self-contained <script type="module"> + mount-point payload written into
// an HtmlEmbedElement's `code` setting (see CLAUDE.md "Applying the gradient to the
// published site"). Loads the *real* @shadergradient/react from esm.sh at runtime rather
// than porting its shader by hand - deliberate, see CLAUDE.md for why.
//
// `?deps=react@..,react-dom@..,@react-three/fiber@..,three@..` pins @shadergradient/react's
// own internal react/react-dom/@react-three-fiber/three imports to the exact same
// esm.sh-served module URLs as this file's own pinned versions, so the browser's module
// cache resolves all of them to one shared instance each - without it, esm.sh could
// independently resolve different copies that still satisfy the same peer ranges, which
// breaks React's hook dispatcher (a documented esm.sh multi-copy gotcha). Confirmed for
// real on the published page: with only react/react-dom pinned, esm.sh resolved
// @react-three/fiber@9.x (needs React 19) against our React 18, throwing `Cannot read
// properties of undefined (reading 'S')` - see the comment on REACT_THREE_FIBER_VERSION
// above.
export function buildGradientEmbedCode(config: GradientConfig, rootId: string): string {
  // colorCount is app-level only (see gradient-core's schema.ts) - resolved
  // to a plain color3 value here so the injected script itself stays a dumb
  // ShaderGradient prop dump, with no knowledge of the app's own "2 colors"
  // toggle needed at runtime on the published site.
  const configJson = JSON.stringify({ ...config, ...getEffectiveGradientColors(config) });

  return `${GRADIENT_EMBED_MARKER}
<div id="${rootId}" style="position:absolute;inset:0;width:100%;height:100%;"></div>
<script type="module">
import React from "https://esm.sh/react@${REACT_VERSION}";
import { createRoot } from "https://esm.sh/react-dom@${REACT_VERSION}/client";
import { ShaderGradientCanvas, ShaderGradient } from "https://esm.sh/@shadergradient/react@${SHADERGRADIENT_VERSION}?deps=react@${REACT_VERSION},react-dom@${REACT_VERSION},@react-three/fiber@${REACT_THREE_FIBER_VERSION},three@${THREE_VERSION}";

const config = ${configJson};
const mount = document.getElementById("${rootId}");
if (mount) {
  // ShaderGradientCanvas's own pixelDensity prop is passed straight through as a
  // fixed dpr to @react-three/fiber's <Canvas> - it never reads the visitor's real
  // devicePixelRatio, so the same preset renders (css width x css height x
  // pixelDensity^2) physical pixels regardless of screen density. On a real,
  // unscaled 4K display that's up to 4x the pixels of the same layout at 1080p for
  // the exact same shader - confirmed to visibly stutter for real on one visitor's
  // PC, fluid again once they dropped to 1080p. This mirrors
  // gradient-core/adaptivePixelDensity.ts's canonical formula (kept in sync by hand -
  // this embed can't import that module, it runs standalone from esm.sh) to shrink
  // pixelDensity for a large rendered box instead of always using the preset's raw
  // configured value.
  var MAX_RENDER_PIXELS = 1920 * 1080;
  var MIN_ADAPTIVE_PIXEL_DENSITY = 0.35;
  function computeAdaptivePixelDensity(configuredPixelDensity, cssWidth, cssHeight) {
    var area = cssWidth * cssHeight;
    if (!(area > 0)) return configuredPixelDensity;
    var maxDensityForBudget = Math.sqrt(MAX_RENDER_PIXELS / area);
    return Math.max(MIN_ADAPTIVE_PIXEL_DENSITY, Math.min(configuredPixelDensity, maxDensityForBudget));
  }

  var root = createRoot(mount);
  var pendingFrame = null;
  function render() {
    pendingFrame = null;
    var rect = mount.getBoundingClientRect();
    var pixelDensity = computeAdaptivePixelDensity(config.pixelDensity, rect.width, rect.height);
    root.render(
      React.createElement(
        ShaderGradientCanvas,
        // lazyLoad left at its own default (true) here - unlike GradientCanvas.tsx
        // (the Designer Extension's own live-editing preview, forced to false
        // because the Designer's nested iframe never reports "in view" to an
        // IntersectionObserver), this runs in a real top-level browser tab on the
        // published site, where IntersectionObserver works correctly. Confirmed by
        // reading the installed package's own compiled source
        // (chunk-6MX7M6OR.mjs): it's a real, continuous isIntersecting toggle, not
        // a one-time lazy load - the whole <Canvas> (WebGL context included)
        // actually unmounts every time this shader scrolls out of view and
        // remounts when it scrolls back in. With several shaders on one real page,
        // this means only the ones currently on-screen are actually costing any
        // GPU/compositor time at once, instead of all of them rendering
        // continuously forever regardless of visibility.
        { style: { width: "100%", height: "100%" }, pointerEvents: "none", pixelDensity: pixelDensity, fov: config.fov, powerPreference: "high-performance" },
        React.createElement(ShaderGradient, config)
      )
    );
  }
  render();
  // Re-adapts on real layout changes (viewport resize, responsive breakpoints) -
  // rAF-coalesced so a continuous window-drag resize doesn't force a React render
  // on every single ResizeObserver tick.
  new ResizeObserver(function () {
    if (pendingFrame === null) pendingFrame = requestAnimationFrame(render);
  }).observe(mount);
}
</script>`;
}
