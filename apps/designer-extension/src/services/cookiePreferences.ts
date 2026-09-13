// Real, persisted cookie-category consent - not decorative. Fluxa's own
// cookies today (better-auth's session cookie, the OAuth state/marker
// cookies) are all strictly-necessary/essential, which don't legally
// require opt-in consent (GDPR's own "strictly necessary" exemption) - so
// nothing reads `analytics`/`marketing` yet. This exists so that whenever
// an actual analytics tool is wired in later (Google Analytics or a free
// alternative - discussed, not started), that init code has a real
// consent flag to check first instead of loading unconditionally:
//
//   import { getCookiePreferences } from "./cookiePreferences";
//   if (getCookiePreferences().analytics) { /* load GA */ }
//
// Stored in localStorage (not a cookie) - this is the visitor's own
// recorded preference about OTHER cookies/tracking, not something that
// itself needs to be sent to a server on every request.
export interface CookiePreferences {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const STORAGE_KEY = "fluxa-cookie-preferences";

// Matches the reference design's own defaults (Analytics/Preference on,
// Marketing off) - worth revisiting once analytics actually ships: a
// strict GDPR reading wants non-essential categories opt-IN (default off),
// not opt-out.
const DEFAULT_PREFERENCES: CookiePreferences = {
  analytics: true,
  marketing: false,
  preferences: true,
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
