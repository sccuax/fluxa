// Entry point for the self-hosted "ruidoEvolutivo" published-site runtime.
// Vite's library mode (iife format, see vite.config.ts) bundles this
// module's exports directly onto `window.FluxaRuidoEvolutivo` - no external
// imports at runtime (three is bundled straight into the output), so a
// published Webflow site loading this via a plain <script src> tag never
// depends on esm.sh or any other third party at request time. See
// apps/designer-extension/src/services/ruidoEvolutivoEmbedScript.ts for the
// actual <script> tag this file is loaded by. Mirrors
// apps/glass-liquid-runtime/src/main.ts exactly.
export { mountRuidoEvolutivo as mount } from "@fluxa/ruido-evolutivo-renderer";
