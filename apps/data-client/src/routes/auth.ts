import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../types";
import { buildAuthorizeUrl, exchangeCodeForToken, listAuthorizedSites } from "../lib/webflowApi";
import { createDb } from "../db/client";
import { installations } from "../db/schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";

// Must match exactly what's enabled for this app in Webflow's own App
// dashboard - Webflow rejects the authorize request with
// `error=invalid_scope` for any scope requested here that isn't enabled
// there (learned this the hard way: sites:read/sites:write were already
// listed here but never enabled in the dashboard, so /auth/install never
// actually worked until both sides were brought in sync). custom_code:read/
// custom_code:write are for the not-yet-built "Apply gradient" -> Custom
// Code injection flow (see CLAUDE.md's "Important product correction") -
// requested now so enabling scopes in the dashboard only has to happen once.
const SCOPES = [
  "sites:read",
  "sites:write",
  "assets:read",
  "assets:write",
  "custom_code:read",
  "custom_code:write",
];

const OAUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  maxAge: 300,
};

// `state` is optional: it's only present when the flow was started from our
// own /auth/install (which sets it). A Webflow-initiated install (Marketplace,
// a site's Apps panel, or the dashboard "Authorization URL" shared with beta
// testers) redirects straight here with just `code` - see the callback handler.
const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1).optional(),
});

// Standalone HTML shown to a human at the end of the Webflow install flow
// (this route is a top-level browser navigation, not an API call). Kept inline
// and dependency-free, matching routes/oauthPopup.ts.
function installResultPage(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0B0D12; color: #FBFBFA;">
<div style="max-width: 360px; padding: 32px; text-align: center;">
<h1 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">${title}</h1>
<p style="font-size: 14px; line-height: 1.5; color: #B7B4AD; margin: 0;">${body}</p>
</div>
</body>
</html>`;
}

const INSTALL_SUCCESS_HTML = installResultPage(
  "Fluxa is installed",
  "You can close this tab and open Fluxa from your site's Apps panel in the Webflow Designer.",
);

export const authRoutes = new Hono<AppEnv>();

// Requires a Fluxa session so the resulting `installations` row can be
// attributed to a user - see "Decide + wire authorization on presets" task.
authRoutes.get("/install", requireAuth, (c) => {
  const state = crypto.randomUUID();
  setCookie(c, "fluxa_oauth_state", state, OAUTH_COOKIE_OPTS);
  // c.get("user") is guaranteed non-null past requireAuth.
  setCookie(c, "fluxa_oauth_user", c.get("user")!.id, OAUTH_COOKIE_OPTS);

  const url = buildAuthorizeUrl({
    clientId: c.env.WEBFLOW_CLIENT_ID,
    redirectUri: c.env.WEBFLOW_REDIRECT_URI,
    state,
    scopes: SCOPES,
  });

  return c.redirect(url);
});

authRoutes.get(
  "/callback",
  zValidator("query", callbackQuerySchema, onValidationError),
  async (c) => {
    const { code, state } = c.req.valid("query");
    const expectedState = getCookie(c, "fluxa_oauth_state");
    const cookieUserId = getCookie(c, "fluxa_oauth_user");
    deleteCookie(c, "fluxa_oauth_state");
    deleteCookie(c, "fluxa_oauth_user");

    // Two ways an install reaches this callback:
    //  1. Started from Fluxa's own /auth/install (requires a Fluxa session):
    //     it sets fluxa_oauth_state + fluxa_oauth_user first, so here we can
    //     enforce the CSRF state match and attribute the row to that user.
    //  2. Started from Webflow's side (Marketplace, a site's Apps panel, or
    //     the dashboard "Authorization URL" we share with beta testers): the
    //     user's first contact with this Worker is this very request, so there
    //     is no cookie to check. This is the normal production path. Accept it
    //     and leave the row unlinked (userId null) - it gets linked later from
    //     inside the extension via an idToken-verified call (Fase 2). Safe to
    //     accept without a state check: the code->token exchange below is
    //     server-to-server with our client secret against our registered
    //     redirect_uri, so a forged/injected code can't yield a usable token,
    //     and an unlinked row grants nobody anything until it's claimed.
    const fluxaInitiated = expectedState !== undefined;
    if (fluxaInitiated && (!state || state !== expectedState || !cookieUserId)) {
      return c.html(
        installResultPage(
          "Installation didn't complete",
          "This install link has expired or is invalid. Please start again from Fluxa.",
        ),
        400,
      );
    }
    const userId = fluxaInitiated ? cookieUserId! : null;

    try {
      const { access_token: accessToken } = await exchangeCodeForToken({
        clientId: c.env.WEBFLOW_CLIENT_ID,
        clientSecret: c.env.WEBFLOW_CLIENT_SECRET,
        code,
        redirectUri: c.env.WEBFLOW_REDIRECT_URI,
      });

      // Resolve which site this token grants access to. Webflow's standard
      // Site-level Marketplace App install flow scopes the token to exactly
      // one site, so the expected case is sites.length === 1. Zero sites
      // (shouldn't happen for a completed install) or more than one (would
      // mean a Workspace-level grant - not a case the current one-row-per-
      // install `installations` schema is designed to disambiguate) both fall
      // back to leaving siteId null - this fails closed the same way the
      // ownership check in presetRoutes.ts already does for a null siteId,
      // rather than guessing which site to attribute the row to.
      let siteId: string | null = null;
      const { sites } = await listAuthorizedSites({ accessToken });
      if (sites.length === 1) {
        siteId = sites[0].id;
      } else {
        console.error(
          `/auth/callback: expected exactly 1 authorized site, got ${sites.length} - leaving installations.siteId null`,
        );
      }

      const db = createDb(c.env.DATABASE_URL);
      await db.insert(installations).values({ accessToken, userId, siteId });

      return c.html(INSTALL_SUCCESS_HTML);
    } catch (err) {
      console.error("/auth/callback: install failed", err);
      return c.html(
        installResultPage(
          "Installation didn't complete",
          "Something went wrong while finishing the installation. Please try installing Fluxa again.",
        ),
        500,
      );
    }
  },
);
