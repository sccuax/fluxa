import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { AppEnv } from "./types";
import { createAuth } from "./lib/auth";
import { addPartitionedAttribute } from "./lib/partitionedCookies";
import { captureOAuthPopupHandoff } from "./lib/oauthPopupHandoff";
import { sessionMiddleware } from "./middleware";
import { authRoutes } from "./routes/auth";
import { assetRoutes } from "./routes/assets";
import { presetRoutes } from "./routes/presets";
import { galleryPresetRoutes, publicGalleryPresetRoutes } from "./routes/galleryPresets";
import { publicRuntimeAssetRoutes } from "./routes/runtimeAssets";
import { profileRoutes } from "./routes/profile";
import { oauthPopupRoutes } from "./routes/oauthPopup";
import { oauthPopupExchangeRoutes } from "./routes/oauthPopupExchange";

const app = new Hono<AppEnv>();

// crossOriginOpenerPolicy defaults to "same-origin", which severs the
// window.opener relationship as soon as the Google sign-in popup navigates
// cross-origin (to Google, then back to /oauth-popup-callback) - the opener
// sees popup.closed flip to true almost immediately, well before the OAuth
// round trip finishes. "same-origin-allow-popups" keeps the same isolation
// but preserves the opener link for windows this app itself opens.
//
// crossOriginResourcePolicy defaults to "same-origin", which silently
// blocks routes/profile.ts's avatar images from rendering at all inside the
// Designer Extension - a different origin (*.webflow-ext.com) - the browser
// just shows its native broken-image icon, no console error naming CORP as
// the cause. secureHeaders() applies this middleware's own header *after*
// next() runs (see its source), so a route handler setting this header
// itself gets silently overwritten - it has to be configured here instead.
// "cross-origin" is safe worker-wide: every response here is either a
// public JSON API already gated by this file's own CORS allowlist below, or
// (this route) a public, non-sensitive avatar image meant to be embedded
// cross-origin in the first place.
app.use(
  secureHeaders({
    crossOriginOpenerPolicy: "same-origin-allow-popups",
    crossOriginResourcePolicy: "cross-origin",
  }),
);

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = [
        c.env.DESIGNER_EXTENSION_ORIGIN,
        "http://localhost:1337",
        // sandbox/ - local component/screen test harness (pnpm dev:sandbox).
        // Needed for real fetches (e.g. PresetsTab.tsx's gallery-presets
        // call) to work when a screen/component is rendered there instead
        // of the real Designer Extension - missing this is exactly what
        // silently broke PresetsTab.tsx in the sandbox the first time this
        // was tested (browser-blocked CORS failure, not a data problem -
        // the preset itself was created and published correctly).
        "http://localhost:5174",
        // apps/preset-admin - local-only internal tool, see routes/
        // galleryPresets.ts and requireAdminToken.ts.
        "http://localhost:5175",
        // apps/preset-admin deployed to Cloudflare Pages (Fluxa Studio on
        // the web). The whole site sits behind Cloudflare Access (email-PIN
        // allowlist of two admins), so this is still effectively the same
        // "internal tool" trust level as the localhost entry above - the
        // shared x-admin-token in the client bundle is only reachable by
        // those two authenticated admins. Production alias only; per-deploy
        // preview URLs (<hash>.fluxa-studio-236.pages.dev) are not listed.
        "https://fluxa-studio-236.pages.dev",
        // TEMPORARY - Cloudflare quick tunnel for a live demo of the
        // extension running standalone (not through the Designer iframe).
        // Quick tunnel URLs are random per run and expire when the tunnel is
        // stopped - remove this line once the demo is done.
        "https://bon-recommends-todd-robbie.trycloudflare.com",
      ];
      return allowed.includes(origin) ? origin : undefined;
    },
    credentials: true,
  }),
);

// Catches anything a route handler throws (e.g. a raw `schema.parse()` call)
// so a validation failure or bug returns a clean JSON error instead of
// Hono's default response, which can include the raw error message/stack.
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof ZodError) {
    return c.json({ error: "invalid_request", issues: err.issues }, 400);
  }
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

// Populates c.get("user")/c.get("session") for every route below (doesn't
// gate access by itself - see middleware/requireAuth.ts for that).
app.use("*", sessionMiddleware);

app.get("/health", (c) => c.json({ ok: true }));

// sessionId lets the extension's Google sign-in popup flow (googleSignIn.ts)
// tell "a genuinely new session was just issued" apart from "a session
// happened to already exist" - a plain user-present boolean can't do that,
// since a stale/leftover session and a freshly completed sign-in both read
// as "active" (see googleSignIn.ts's hadSessionBeforeStart comment).
app.get("/api/me", (c) => c.json({ user: c.get("user"), sessionId: c.get("session")?.id ?? null }));

// better-auth's own routes: sign-up/sign-in (email+password), Google OAuth,
// session management. See src/lib/auth.ts for provider config.
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const auth = createAuth(c.env);
  const response = await auth.handler(c.req.raw);
  // The Google OAuth callback (`/api/auth/callback/google`) sets the real
  // session cookie during the POPUP's own top-level navigation to this
  // Worker's own domain (Google redirects the popup window itself here,
  // see the "Google sign-in popup flow" section in this app's own
  // CLAUDE.md) - CHIPS partitions a cookie by whichever top-level site is
  // active when it's SET, which in that moment is this Worker's own
  // domain, not the Webflow Designer page embedding the extension iframe
  // that later has to read it back via `/api/me`. Partitioning it would
  // permanently wall it off from that iframe's own partition - confirmed
  // for real: this broke Google sign-in's post-login redirect (selecting a
  // Google account never returned to the dashboard) the moment
  // addPartitionedAttribute shipped unconditionally. Every other
  // `/api/auth/*` endpoint is always called via a plain `fetch()` from
  // code already running inside the extension iframe, so its top-level
  // site is consistently the Webflow Designer page both when the cookie is
  // set and later read - partitioning stays correct (and needed) there.
  if (c.req.path.startsWith("/api/auth/callback/")) {
    // Also captures better-auth's oauth-popup plugin's own completion-page
    // payload server-side (see lib/oauthPopupHandoff.ts) - its own
    // window.opener.postMessage relay never reaches the extension iframe
    // for real (Google's own COOP severs window.opener mid-flow, confirmed
    // via real testing), so routes/oauthPopupExchange.ts's poll endpoint is
    // what actually delivers this. Reads a CLONE - the original response
    // below is still returned to the popup completely unmodified.
    await captureOAuthPopupHandoff(c.env, response.clone());
    return response;
  }
  return addPartitionedAttribute(response);
});

// Webflow *app installation* OAuth (site access token), separate from the
// end-user auth above.
app.route("/auth", authRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/presets", presetRoutes);
app.route("/api/gallery-presets", galleryPresetRoutes);
// A genuinely different prefix from "/api/gallery-presets" above, not just
// a different sub-path under it - see routes/galleryPresets.ts's own
// comment on publicGalleryPresetRoutes for why that distinction matters
// (mounting two sub-apps at the same prefix does not isolate their
// middleware from each other).
app.route("/api/public/gallery-presets", publicGalleryPresetRoutes);
app.route("/api/public/runtime", publicRuntimeAssetRoutes);
app.route("/api/profile", profileRoutes);
app.route("/oauth-popup-callback", oauthPopupRoutes);
app.route("/api/oauth-popup-exchange", oauthPopupExchangeRoutes);

export default app;
