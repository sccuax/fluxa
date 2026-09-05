import type { GlassLiquidConfig } from "@fluxa/gradient-core";

// Self-hosted from day one - unlike gradientEmbedScript.ts (which loads
// React + @shadergradient/react from esm.sh at request time, a "real
// production dependency on a third party in the critical rendering path"
// the root CLAUDE.md flags as wanting to fix, deferred), this shader has no
// React dependency at all - just three, bundled directly into
// apps/glass-liquid-runtime's own build (see that app's own comment for
// why). RUNTIME_URL points at that compiled, version-pinned bundle, served
// by apps/data-client's routes/runtimeAssets.ts.
const RUNTIME_URL = "https://fluxa-data-client.jojanmartinez533.workers.dev/api/public/runtime/glass-liquid-runtime.v2.js";

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
export function buildGlassLiquidEmbedCode(config: GlassLiquidConfig, rootId: string): string {
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
      window.FluxaGlassLiquid.mount(canvas, ${configJson});
    }
  };
  document.currentScript.parentNode.insertBefore(s, document.currentScript.nextSibling);
})();
</script>`;
}
