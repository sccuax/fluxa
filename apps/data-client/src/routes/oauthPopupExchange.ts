import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { createAuth } from "../lib/auth";
import { createDb } from "../db/client";
import { oauthPopupHandoffs } from "../db/app-schema";

export const oauthPopupExchangeRoutes = new Hono<AppEnv>();

const pollBodySchema = z.object({ nonce: z.string().min(1) });

// googleSignIn.ts polls this every ~1s with the `nonce` it generated
// itself before ever opening the Google popup - no window-reference
// channel (window.opener, BroadcastChannel, localStorage) is trustworthy
// here, since Google's own popup is a genuinely separate top-level
// browsing context whose COOP header severs window.opener, and Chrome
// partitions the rest by top-level site anyway (see auth.ts's oauthPopup/
// bearer plugin comment and lib/oauthPopupHandoff.ts). This endpoint is
// plain server-mediated polling instead: index.ts's /api/auth/* handler
// writes a row here the moment the popup's own OAuth callback completes
// (whether success or failure), keyed by that same nonce - nothing about
// this lookup depends on any cookie at all.
//
// 202 means "not landed yet, keep polling." Once a row exists it's
// single-use - deleted immediately regardless of outcome, since it's only
// ever meant to be read once.
oauthPopupExchangeRoutes.post("/", async (c) => {
  const body = pollBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);
  const { nonce } = body.data;

  const db = createDb(c.env.DATABASE_URL);
  const [row] = await db.select().from(oauthPopupHandoffs).where(eq(oauthPopupHandoffs.nonce, nonce)).limit(1);
  if (!row) return c.json({ status: "pending" }, 202);

  await db.delete(oauthPopupHandoffs).where(eq(oauthPopupHandoffs.nonce, nonce));

  if (row.errorCode) return c.json({ status: "error", error: row.errorCode, redirectTo: row.redirectTo });
  if (!row.token) return c.json({ status: "error", error: "missing_token" });

  // Validate the token before trusting it enough to mint a cookie from it -
  // re-checks against better-auth's own session store via the bearer
  // plugin's translation (a real HTTP round trip through auth.handler, not
  // a direct/inferred call), so a malformed or stale value can't be used
  // to plant an arbitrary cookie.
  const auth = createAuth(c.env);
  const sessionCheck = await auth.handler(
    new Request(`${c.env.BETTER_AUTH_URL}/api/auth/get-session`, {
      headers: { authorization: `Bearer ${row.token}` },
    }),
  );
  const session = (await sessionCheck.json().catch(() => null)) as { session?: unknown } | null;
  if (!session?.session) return c.json({ status: "error", error: "invalid_token" });

  // Name/attributes mirror better-auth's own createCookie formula exactly
  // (verified against the installed package's cookies/index.mjs, see
  // partitionedCookies.ts's own comment): `__Secure-` prefix because
  // BETTER_AUTH_URL is HTTPS, `better-auth` is the unmodified default
  // cookiePrefix (auth.ts never overrides it), `.session_token` is the
  // fixed suffix for this specific cookie. This request genuinely
  // originates from inside the extension iframe (top-level site = the
  // Webflow Designer page), so - unlike the cookie the popup's own
  // callback set - the Partitioned attribute set here actually matches the
  // partition the iframe will read it back from later. Max-Age matches
  // auth.ts's own `session.expiresIn` (48h) - keep both in sync by hand if
  // either ever changes, same coupling that file's own comment flags.
  c.header(
    "Set-Cookie",
    `__Secure-better-auth.session_token=${row.token}; Path=/; Max-Age=${60 * 60 * 48}; HttpOnly; Secure; SameSite=None; Partitioned`,
  );
  return c.json({ status: "success" });
});
