// Entry point for the self-hosted "glassLiquid" published-site runtime.
// Vite's library mode (iife format, see vite.config.ts) bundles this
// module's exports directly onto `window.FluxaGlassLiquid` - no external
// imports at runtime (three is bundled straight into the output), so a
// published Webflow site loading this via a plain <script src> tag never
// depends on esm.sh or any other third party at request time. See
// apps/designer-extension/src/services/glassLiquidEmbedScript.ts for the
// actual <script> tag this file is loaded by.
export { mountGlassLiquid as mount } from "@fluxa/glass-liquid-renderer";
