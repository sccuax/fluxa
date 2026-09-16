import { Hono } from "hono";
import type { AppEnv } from "../types";
import { embedViewSchema, trackEventSchema } from "../schema";

// Designer Extension usage events - NOT behind requireAuth: a visitor still
// on WelcomeScreen/SignInScreen can trigger a real event (e.g. would-be
// future auth-funnel tracking), and losing those for no real security
// reason would just undercount usage.
//
// Deliberately does NOT index (or otherwise store) c.get("user")'s real id,
// even though sessionMiddleware makes it available here for free - real
// bug caught before shipping: Analytics Engine has NO per-record delete API
// (you can't "delete all rows where index1 = X"), so a user id written here
// would outlive that same user's own "Delete account" flow
// (routes/profile.ts) for up to 90 days with no way to purge it - a real
// GDPR-erasure gap the CookiesModal's own "Analytics cookies" copy ("help
// us understand how Fluxa is used") never discloses. Kept purely
// aggregate/anonymous instead (no indexes at all, same as
// publicAnalyticsRoutes below) - still answers "how often is each feature
// used", just never "what did this specific person do."
export const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.post("/track", async (c) => {
  const body = trackEventSchema.parse(await c.req.json());
  // Fire-and-forget - writeDataPoint() returns void, not a Promise
  // (Analytics Engine's own API, confirmed against current Cloudflare
  // docs) - awaiting it would be a pointless no-op at best, and a write
  // failure here is silent by design (check `wrangler tail` if events ever
  // seem to be missing), never something worth failing this request over.
  c.env.ANALYTICS.writeDataPoint({
    blobs: ["extension", body.event, body.detail ?? "none"],
    doubles: [1],
  });
  return c.json({ ok: true });
});

// Published-site embed impressions (gradientEmbedScript.ts and its
// glassLiquid/ruidoEvolutivo siblings, apps/designer-extension/src/
// services/) - called from an anonymous visitor's browser on a real
// customer's live Webflow site, not from the extension. A genuinely
// different prefix from "/api/analytics" above (mounted at
// "/api/public/analytics" in index.ts), not just a different auth level on
// the same prefix - same reasoning routes/galleryPresets.ts's own
// publicGalleryPresetRoutes comment gives (mounting two routers at the same
// prefix does not isolate their middleware from each other).
//
// Deliberately NOT added to index.ts's CORS origin allowlist. That
// allowlist exists to stop an untrusted origin from reading a response it
// has no business reading (e.g. another site trying to read a signed-in
// user's own data back) - never a concern here, since every embed script
// calls this with `navigator.sendBeacon()` (falling back to a keepalive
// fetch), which never reads the response at all. sendBeacon's default
// text/plain body is a CORS-safelisted "simple request", so the browser
// sends it regardless of what this Worker's CORS headers say - the request
// still reaches and gets processed by the handler below either way. Using
// `application/json` instead here would trigger a real CORS preflight
// (OPTIONS) that this Worker's strict allowlist would silently swallow for
// every one of the arbitrary customer domains this route needs to accept
// from - checked before choosing sendBeacon, not guessed.
export const publicAnalyticsRoutes = new Hono<AppEnv>();

publicAnalyticsRoutes.post("/embed-view", async (c) => {
  // c.req.json() works fine here even though sendBeacon's own body arrives
  // with a text/plain Content-Type (see the comment above) - the underlying
  // Fetch API's Request.json() parses the body as JSON unconditionally, it
  // never actually inspects the Content-Type header.
  const body = embedViewSchema.parse(await c.req.json());
  c.env.ANALYTICS.writeDataPoint({
    blobs: ["embed-view", body.kind],
    doubles: [1],
  });
  return c.json({ ok: true });
});
