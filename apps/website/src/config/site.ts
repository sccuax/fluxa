// Single place for site-wide constants. Pages/components import from here,
// never hardcode a URL or brand string inline.

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const SITE = {
  name: "Fluxa",
  url: import.meta.env.PUBLIC_SITE_URL ?? "https://fluxa.agency",
  // Same Worker the Designer Extension talks to. Only the public, unauthenticated
  // routes (/api/public/*) may ever be called from the website.
  apiUrl:
    import.meta.env.PUBLIC_API_URL ?? "https://fluxa-data-client.jojanmartinez533.workers.dev",
  installUrl: import.meta.env.PUBLIC_INSTALL_URL ?? "#",
  // Where "Login" points. There is no web app yet (auth lives in the Designer
  // Extension), so this is a placeholder until that exists.
  loginUrl: import.meta.env.PUBLIC_LOGIN_URL ?? "#",
  // Footer social links: placeholders until the real profiles exist.
  socialX: import.meta.env.PUBLIC_SOCIAL_X ?? "#",
  socialLinkedin: import.meta.env.PUBLIC_SOCIAL_LINKEDIN ?? "#",
  // Legal pages: the same Notion pages the Designer Extension's About modal links to (apps/designer-extension AboutModal.tsx).
  termsUrl: "https://app.notion.com/p/Fluxa-Terms-of-Use-3c8f1890e7c08196bc60d874c78da9a8",
  privacyUrl: "https://app.notion.com/p/Fluxa-Privacy-Policy-3c8f1890e7c0819ebbb5e5edcc52dbf4",
  licensesUrl: "https://sweltering-list-18f.notion.site/License-Agreement-3dbf1890e7c0815bb588e295a495bd4a",
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
