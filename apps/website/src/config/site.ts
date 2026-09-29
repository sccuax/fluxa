// Single place for site-wide constants. Pages/components import from here,
// never hardcode a URL or brand string inline.

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const SITE = {
  name: "Fluxa",
  url: import.meta.env.PUBLIC_SITE_URL ?? "https://fluxa.app",
  // Same Worker the Designer Extension talks to. Only the public, unauthenticated
  // routes (/api/public/*) may ever be called from the website.
  apiUrl:
    import.meta.env.PUBLIC_API_URL ?? "https://fluxa-data-client.jojanmartinez533.workers.dev",
  installUrl: import.meta.env.PUBLIC_INSTALL_URL ?? "#",
  // Where "Login" points. There is no web app yet (auth lives in the Designer
  // Extension), so this is a placeholder until that exists.
  loginUrl: import.meta.env.PUBLIC_LOGIN_URL ?? "#",
  supportEmail: "support@fluxa.app",
  repoUrl: "https://github.com/sccuax/fluxa",
} as const;

export interface NavItem {
  key: "shaders" | "solutions" | "pricing" | "about";
  href: string;
}

// Hrefs are locale-less paths; `localizedPath()` (i18n) prefixes them.
export const NAV: readonly NavItem[] = [
  { key: "shaders", href: "/shaders" },
  { key: "solutions", href: "/webflow-solutions" },
  { key: "pricing", href: "/pricing" },
  { key: "about", href: "/about" },
];
