import type { RuidoEvolutivoConfig } from "@fluxa/gradient-core";

// Self-hosted from day one, same reasoning as glassLiquidEmbedScript.ts -
// packages/ruido-evolutivo-renderer is a hand-authored Three.js shader with
// no React dependency, bundled directly into apps/ruido-evolutivo-runtime's
// own build. RUNTIME_URL points at that compiled, version-pinned bundle,
// served by apps/data-client's routes/runtimeAssets.ts (the same generic
// R2-backed route glassLiquid already uses - no Worker code needed per
// runtime, just a new object uploaded to the fluxa-runtime-assets bucket).
// v2: mount()'s handle gained pause()/resume() (see
// @fluxa/ruido-evolutivo-renderer's mount.ts) so this embed can stop the
// render loop via IntersectionObserver below.
const RUNTIME_URL = "https://fluxa-data-client.jojanmartinez533.workers.dev/api/public/runtime/ruido-evolutivo-runtime.v2.js";

// A leading HTML comment marker so applyRuidoEvolutivo.ts can recognize an
// embed it created earlier (re-applying should update that embed's code in
// place, not stack a second one) - deliberately a DIFFERENT literal string
// from GRADIENT_EMBED_MARKER/GLASS_LIQUID_EMBED_MARKER so a ruidoEvolutivo
// embed is never mistaken for either other kind's.
export const RUIDO_EVOLUTIVO_EMBED_MARKER = "<!-- fluxa-ruido-evolutivo -->";

// Builds the self-contained <canvas> + <script> payload written into an
// HtmlEmbedElement's `code` setting. Mirrors buildGlassLiquidEmbedCode
// exactly - a classic (non-module) script loading the self-hosted runtime
// via a plain <script src> tag, then calling its exposed
// window.FluxaRuidoEvolutivo.mount(canvas, config) directly - no esm.sh, no
// ES module imports, no CDN dependency of any kind at runtime.
export function buildRuidoEvolutivoEmbedCode(config: RuidoEvolutivoConfig, rootId: string): string {
  const configJson = JSON.stringify(config);

  return `${RUIDO_EVOLUTIVO_EMBED_MARKER}
<canvas id="${rootId}" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
<script>
(function () {
  var s = document.createElement("script");
  s.src = "${RUNTIME_URL}";
  s.onload = function () {
    var canvas = document.getElementById("${rootId}");
    if (canvas && window.FluxaRuidoEvolutivo) {
      var handle = window.FluxaRuidoEvolutivo.mount(canvas, ${configJson});
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
