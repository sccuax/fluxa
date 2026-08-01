import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../types";
import { buildAuthorizeUrl, exchangeCodeForToken } from "../lib/webflowApi";
import { createDb } from "../db/client";
import { installations } from "../db/schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";

const SCOPES = ["sites:read", "sites:write", "assets:read", "assets:write"];

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
    });

    // TODO: call GET /v2/token/authorized_by (or /v2/sites) to resolve which
    // site(s) this token grants access to, then persist { siteId, accessToken }
    // instead of the token alone.
    const db = createDb(c.env.DATABASE_URL);
    await db.insert(installations).values({ accessToken, userId });

    return c.text("Fluxa is installed. You can close this tab.");
  },
);
