/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Public origin of this site (sitemap, canonical URLs, OG). */
  readonly PUBLIC_SITE_URL?: string;
  /** Data Client Worker origin (public presets API). */
  readonly PUBLIC_API_URL?: string;
  /** Where "Try Fluxa free" points (Webflow Marketplace listing or app install). */
  readonly PUBLIC_INSTALL_URL?: string;
  /** Where "Login" points (no web app yet). */
  readonly PUBLIC_LOGIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
