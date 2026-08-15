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

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

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
    const userId = getCookie(c, "fluxa_oauth_user");
    deleteCookie(c, "fluxa_oauth_state");
    deleteCookie(c, "fluxa_oauth_user");

    if (!state || state !== expectedState || !userId) {
      return c.json({ error: "invalid_state" }, 400);
    }

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

    return c.text("Fluxa is installed. You can close this tab.");
  },
);
