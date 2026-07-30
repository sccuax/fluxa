import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Bindings } from "../types/env";
import { buildAuthorizeUrl, exchangeCodeForToken } from "../lib/webflowApi";

const SCOPES = ["sites:read", "sites:write", "assets:read", "assets:write"];

export const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.get("/install", (c) => {
  const state = crypto.randomUUID();
  setCookie(c, "fluxa_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 300,
  });

  const url = buildAuthorizeUrl({
    clientId: c.env.WEBFLOW_CLIENT_ID,
    redirectUri: c.env.WEBFLOW_REDIRECT_URI,
    state,
    scopes: SCOPES,
  });

  return c.redirect(url);
});

authRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, "fluxa_oauth_state");

  if (!code || !state || state !== expectedState) {
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
  await c.env.DB.prepare(
    "INSERT INTO installations (access_token, created_at) VALUES (?, ?)",
  )
    .bind(accessToken, new Date().toISOString())
    .run();

  return c.text("Fluxa is installed. You can close this tab.");
});
