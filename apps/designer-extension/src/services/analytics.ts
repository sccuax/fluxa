import { getCookiePreferences } from "./cookiePreferences";
import { apiFetch } from "./apiClient";

// Designer Extension usage events -> POST /api/analytics/track ->
// Workers Analytics Engine (apps/data-client/src/routes/analytics.ts). The
// extension itself can't write to Analytics Engine directly - a binding
// only exists inside a Worker, never in browser JS - so every event goes
// through the already-deployed Data Client instead.
//
// Gated behind CookiesModal.tsx's own "Product analytics" toggle
// (cookiePreferences.ts's `productAnalytics`) - checked fresh on every call
// (not cached at module load) so toggling the preference takes effect
// immediately, without needing a reload.
//
// Fire-and-forget by design: callers never await this, a network failure
// is swallowed silently (`.catch(() => {})`), and it must never throw or
// block whatever real UI action it's attached to - losing an analytics
// event is always an acceptable failure mode here, breaking or delaying
// the user's actual click is not.
// `detail` is a free-form second dimension for whichever piece of context
// makes sense for that one event (a preset id for "apply_preset", a tab
// name for "switch_tab", nothing at all for "apply_gradient" since there's
// only one gradient config in play) - deliberately not called `siteId`,
// since most events here have no real "site" concept at all (the extension
// itself has no site-scoped identity beyond whatever element happens to be
// selected in the Designer at that moment).
export function trackEvent(event: string, detail?: string): void {
  if (!getCookiePreferences().productAnalytics) return;
  apiFetch("/api/analytics/track", {
    method: "POST",
    body: JSON.stringify({ event, detail }),
  }).catch(() => {});
}
