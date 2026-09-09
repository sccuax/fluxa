import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// The first Vite "library mode" build in this monorepo - every other
// vite.config.ts here (designer-extension/preset-admin/sandbox) produces a
// conventional multi-chunk app bundle (index.html + hashed assets) meant to
// be loaded inside an iframe/dev server, not a single dependency-free file
// meant to be <script src>'d directly by an arbitrary published site. iife
// format wraps the entry's exports into a single self-executing function
// assigning them onto `window.FluxaGlassLiquid` - no import/export
// statements survive into the output, and three (this entry's only real
// dependency, via @fluxa/glass-liquid-renderer) is bundled straight in
// rather than left as an external import, so the built file has ZERO
// runtime dependency on esm.sh or any other CDN.
//
// fileName is a literal, version-pinned string (not Vite's usual content
// hash) - a future change to this shader ships under a NEW filename, so a
// site that already embedded a <script src="...vN.js"> tag keeps working
// forever, same versioning rationale as the root CLAUDE.md's still-deferred
// ShaderGradient self-hosting plan. Bumped v1 -> v2 for v1's real
// mousemove-tracking bug fix; v2 -> v3 for mount()'s handle gaining
// pause()/resume(); v3 -> v4 for a first halftone grain pass (a CMY-ink
// approximation); v4 -> v5 for redoing that halftone to actually match
// @shadergradient/react's real THREE.HalftonePass mechanics (RGB additive
// dot grids, not CMY ink - confirmed by reading that package's own compiled
// source) after v4's approximation was reported to look visibly different;
// v5 -> v6 for excluding the edge/seam lines from the grain entirely
// (applied only to the glass surface + refracted trail, composited before
// the edge line is added, per explicit direction that lines should render
// crisp regardless of grainStrength). Each previous version had already
// been served once with an immutable Cache-Control, so overwriting those
// same bytes in place would violate that contract for whatever already
// cached them (this Worker's edge cache, a visitor's browser); every real
// behavior change ships as a new filename instead.
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/main.ts", import.meta.url)),
      name: "FluxaGlassLiquid",
      formats: ["iife"],
      fileName: () => "glass-liquid-runtime.v6.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
  },
});
