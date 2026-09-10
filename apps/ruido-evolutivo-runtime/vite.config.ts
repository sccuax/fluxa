import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Mirrors apps/glass-liquid-runtime/vite.config.ts exactly - see that file's
// own comment for the full rationale (iife format assigning onto a window
// global with zero runtime external imports, version-pinned fileName rather
// than a content hash so an already-published <script src> never breaks).
// Bumped v1 -> v2 for mount()'s handle gaining pause()/resume()
// (packages/ruido-evolutivo-renderer/src/mount.ts); v2 -> v3 for per-front
// opacity (shader's uColorAlpha, from config.colorsOpacity) - each previous
// version had already been uploaded to R2 with an immutable Cache-Control,
// so overwriting those same bytes in place would violate that contract for
// anything that already cached them.
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/main.ts", import.meta.url)),
      name: "FluxaRuidoEvolutivo",
      formats: ["iife"],
      fileName: () => "ruido-evolutivo-runtime.v3.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
  },
});
