import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// A real, git-tracked internal tool (unlike sandbox/, which is gitignored
// and disposable) for admins to build Fluxa's curated preset gallery
// visually - reuses apps/designer-extension's ControlPanel/GradientCanvas
// components directly via relative import (the same cross-app-import
// technique sandbox/vite.config.ts already proved works, see that file's
// own comment) rather than duplicating them, since both files were already
// confirmed to have zero Webflow-Designer-specific coupling (no `webflow`
// global calls, no hardcoded backend URL) before this app was built.
// publicDir reuses designer-extension's own public/ dir for the same
// font-file assets those components' Tailwind classes need.
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, "../designer-extension/public"),
  server: {
    port: 5175,
  },
});
