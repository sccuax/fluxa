import type { GlassLiquidConfig } from "@fluxa/gradient-core";
import { buildAnalyticsBeaconSnippet } from "./embedAnalyticsBeacon";

// Self-hosted from day one - unlike gradientEmbedScript.ts (which loads
// React + @shadergradient/react from esm.sh at request time, a "real
// production dependency on a third party in the critical rendering path"
// the root CLAUDE.md flags as wanting to fix, deferred), this shader has no
// React dependency at all - just three, bundled directly into
// apps/glass-liquid-runtime's own build (see that app's own comment for
// why). RUNTIME_URL points at that compiled, version-pinned bundle, served
// by apps/data-client's routes/runtimeAssets.ts.
// v3: mount()'s handle gained pause()/resume() (see
// @fluxa/glass-liquid-renderer's mount.ts). v4: replaced the shader's own
// additive noise grain with a first halftone approximation (CMY ink). v5:
// redid that halftone to match @shadergradient/react's real
// THREE.HalftonePass mechanics (RGB additive dot grids). v6: excluded the
// edge/seam lines from the grain entirely, applying it only to the glass
// surface + refracted trail. v7: config.grainMode enum - "grain" (the v6
// halftone, unchanged) / "noise" (a second, closer-to-shaderGradient
// halftone variant - merging dots, scatter, CSS-px grid) / "off"; also
// config.flutesDepth / flutesDepthMask (analytic ridge relief). v8:
// config.ambientGradient (+ ambientColor1/2, ambientStrength) - a slow
// moving colour gradient refracted through the flutes, independent of the
// cursor trail, so the glass stays coloured on an un-hovered page. v9:
// per-colour opacity (config.*Opacity from the picker) now premultiplies
// each colour uniform, so opacity actually shows in the render. Each a real
// behavior change to the runtime, so it ships as a new filename rather than
// overwriting a previous version's immutably-cached bytes.
const RUNTIME_URL = "https://fluxa-data-client.jojanmartinez533.workers.dev/api/public/runtime/glass-liquid-runtime.v9.js";

// A leading HTML comment marker so applyGlassLiquid.ts can recognize an
// embed it created earlier (re-applying should update that embed's code in
// place, not stack a second one) - same pattern as gradientEmbedScript.ts's
// own GRADIENT_EMBED_MARKER, deliberately a DIFFERENT literal string so a
// glass-liquid embed is never mistaken for a gradient one by anything that
// scans for either marker.
export const GLASS_LIQUID_EMBED_MARKER = "<!-- fluxa-glass-liquid -->";

// Builds the self-contained <canvas> + <script> payload written into an
// HtmlEmbedElement's `code` setting. A classic (non-module) script that
// loads the self-hosted runtime via a plain <script src> tag, then calls
// its exposed window.FluxaGlassLiquid.mount(canvas, config) directly - no
// esm.sh, no ES module imports, no CDN dependency of any kind at runtime.
export function buildGlassLiquidEmbedCode(config: GlassLiquidConfig, rootId: string, includeAnalytics: boolean): string {
  const configJson = JSON.stringify(config);

  return `${GLASS_LIQUID_EMBED_MARKER}
<canvas id="${rootId}" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
<script>
(function () {
  var s = document.createElement("script");
  s.src = "${RUNTIME_URL}";
  s.onload = function () {
    var canvas = document.getElementById("${rootId}");
    if (canvas && window.FluxaGlassLiquid) {
${includeAnalytics ? buildAnalyticsBeaconSnippet("glassLiquid") : ""}      var handle = window.FluxaGlassLiquid.mount(canvas, ${configJson});
      // Pauses the render loop entirely (no GPU/compositor cost at all,
      // not just reduced quality) while this shader is scrolled out of
      // view - matters when several shaders share one real page, since
      // otherwise every one of them renders continuously forever
      // regardless of visibility.
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          handle.resume();
        } else {
          handle.pause();
        }
      }).observe(canvas);
    }
  };
  document.currentScript.parentNode.insertBefore(s, document.currentScript.nextSibling);
})();
</script>`;
}
