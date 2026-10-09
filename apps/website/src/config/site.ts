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
  // api.fluxa.agency is the SAME Worker as the workers.dev hostname the Designer Extension uses. The website must use
  // this one: it is same-site with fluxa.agency, which is what lets the login session cookie work from the browser.
  apiUrl: import.meta.env.PUBLIC_API_URL ?? "https://api.fluxa.agency",
  // The Pro card's "Upgrade to Pro" (append ?interval=monthly|yearly): the Worker sends logged-out visitors to /login,
  // then creates the Lemon Squeezy checkout for the signed-in account - see data-client routes/billing.ts.
  checkoutUrl: `${import.meta.env.PUBLIC_API_URL ?? "https://api.fluxa.agency"}/billing/start`,
  installUrl: import.meta.env.PUBLIC_INSTALL_URL ?? "#",
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
  { key: "shaders", href: "/#features" },
  { key: "solutions", href: "/webflow-solutions" },
  { key: "pricing", href: "/#pricing" },
  { key: "about", href: "/about" },
];
