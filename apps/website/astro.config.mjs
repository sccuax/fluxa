import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// Static output on purpose: the site is deployed to Cloudflare Pages as plain
// files behind the CDN. Anything dynamic (presets, billing, auth) lives in the
// Data Client Worker and is either fetched at build time (lib/api) or by an
// island in the visitor's browser.
const SITE = process.env.PUBLIC_SITE_URL ?? "https://fluxa.app";

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "never",
  build: { inlineStylesheets: "auto" },
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  // Experiments are unlisted (noindex + not in the sitemap).
  integrations: [react(), sitemap({ filter: (page) => !page.includes("/experiments") })],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es"],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    build: { target: "es2022" },
    // Workspace packages ship TS source (no build step), so Vite must
    // transpile them instead of treating them as prebuilt dependencies.
    ssr: { noExternal: [/^@fluxa\//] },
    optimizeDeps: { exclude: ["@fluxa/glass-liquid-renderer", "@fluxa/ruido-evolutivo-renderer"] },
  },
});
