import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { AppEnv } from "./types";
import { createAuth } from "./lib/auth";
import { sessionMiddleware } from "./middleware";
import { authRoutes } from "./routes/auth";
import { assetRoutes } from "./routes/assets";
import { presetRoutes } from "./routes/presets";
import { profileRoutes } from "./routes/profile";
import { oauthPopupRoutes } from "./routes/oauthPopup";

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

app.get("/api/me", (c) => c.json({ user: c.get("user") }));

// better-auth's own routes: sign-up/sign-in (email+password), Google OAuth,
// session management. See src/lib/auth.ts for provider config.
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Webflow *app installation* OAuth (site access token), separate from the
// end-user auth above.
app.route("/auth", authRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/presets", presetRoutes);
app.route("/api/profile", profileRoutes);
app.route("/oauth-popup-callback", oauthPopupRoutes);

export default app;
