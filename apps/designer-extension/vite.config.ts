import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    outDir: "dist",
    // Watch-mode rebuilds re-run the outDir empty step by default, which on
    // Windows can crash mid-rebuild with ENOTEMPTY when `webflow extension
    // serve` (or a still-open Designer connection) has a file handle open
    // inside dist/ at that exact moment. Skipping it means stale hashed
    // assets from old builds just pile up in dist/assets during a dev
    // session instead - harmless, since index.html always points at the
    // latest hash and this dir isn't shipped/committed.
    emptyOutDir: false,
    // Vite otherwise re-copies the entire public/ dir (fonts, images - none
    // of which change during a dev session) into outDir on every single
    // watch rebuild, which is both wasted work and another chance for the
    // same Windows file-lock crash (EBUSY this time, mid-copyfile) if
    // `webflow extension serve` has one of those files open at that instant.
    // `scripts/copy-public.mjs` copies it once instead - see package.json.
    copyPublicDir: false,
  },
  server: {
    port: 5173,
  },
});
