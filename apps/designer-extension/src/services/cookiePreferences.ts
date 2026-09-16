// Real, persisted cookie-category consent - not decorative, and every
// category below controls something real (2026-09-14 reorganization). The
// original 3-category shape (analytics/marketing/preferences) was rebuilt
// from scratch once analytics actually shipped, per explicit direction:
// "Marketing cookies" gated nothing at all (no marketing pixel/tool exists
// anywhere in this codebase - grepped for Google Analytics/Meta Pixel/
// Hotjar/Mixpanel/etc. before concluding this, not assumed), and
// "Preference cookies" gated nothing either (this file is the ONLY
// localStorage usage in the whole app - grepped to confirm). Showing a
// working-looking toggle for something that does nothing is itself a
// coherence problem, not just a missed feature - so both were replaced
// with the two categories that actually correspond to real, distinct
// tracking behavior in this app, rather than padded back out to 3-4 fake
// ones just to match the category count of a generic cookie-consent
// reference design.
//
//   import { getCookiePreferences } from "./cookiePreferences";
//   if (getCookiePreferences().productAnalytics) { /* ... */ }
//
// Stored in localStorage (not a cookie) - this is the visitor's own
// recorded preference about what Fluxa itself tracks, not something that
// itself needs to be sent to a server on every request.
export interface CookiePreferences {
  // Gates services/analytics.ts's trackEvent() - every Designer Extension
  // usage event (auth completed, editor/presets/account interactions,
  // service selection). Aggregate/anonymous only: no user id, email, or
  // any other personal identifier is ever attached to an event (see
  // apps/data-client's routes/analytics.ts - a real GDPR-erasure gap was
  // caught and fixed here before this ever shipped, since Analytics Engine
  // has no per-record delete API).
  productAnalytics: boolean;
  // Gates whether a NEWLY GENERATED gradient/preset embed
  // (services/applyGradient.ts, applyGlassLiquid.ts,
  // applyRuidoEvolutivo.ts, read at the moment "Apply" is clicked) includes
  // a one-time, anonymous view-count beacon on the PUBLISHED site the
  // embed ends up on. Deliberately a separate category from
  // productAnalytics above: this affects the extension user's OWN site
  // visitors, not the extension user's own in-app behavior - a genuinely
  // different consent scope, worth a genuinely different toggle rather
  // than folding it into the same one. Baked in at generation time (not
  // checked at runtime by the embed itself) because the embed runs
  // standalone on a real visitor's browser, on a completely different
  // origin from this extension - it has no way to read this app's own
  // localStorage at all. Re-applying an existing element after flipping
  // this toggle picks up the new setting (each apply regenerates the
  // embed's code from scratch).
  publishedSiteAnalytics: boolean;
}

const STORAGE_KEY = "fluxa-cookie-preferences";

// Both default ON (opt-out) - explicit product decision (2026-09-14),
// overriding the opt-in-by-default stance this file used right after the
// reorganization above. A strict GDPR reading still prefers opt-in for
// non-essential categories - flagged again here on purpose, since this is
// exactly the kind of default worth double-checking against actual legal
// requirements for whichever jurisdictions Fluxa's users are in, before
// this ships broadly.
const DEFAULT_PREFERENCES: CookiePreferences = {
  productAnalytics: true,
  publishedSiteAnalytics: true,
};

export function getCookiePreferences(): CookiePreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<CookiePreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setCookiePreferences(preferences: CookiePreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // best-effort - a private/locked-down browsing context can throw here
  }
}
