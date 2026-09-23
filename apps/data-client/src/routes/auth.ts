import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  listAuthorizedSites,
  resolveIdToken,
} from "../lib/webflowApi";
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
// cms:read is for the "Webflow Solutions" CMS-gallery feature
// (routes/cmsGallery.ts) - listing a site's collections/fields and reading
// live item data. An installation created before this scope was added still
// only has the older token; that install needs a fresh /auth/install run
// before routes/cmsGallery.ts's calls will succeed against it (Webflow 403s
// a request for a scope the token wasn't actually granted, it doesn't
// silently allow it).
//
// authorized_user:read is for POST /auth/link-installation below - calling
// Webflow's own "Resolve ID Token" endpoint (POST /beta/token/resolve)
// requires a bearer token from THIS registered app carrying this scope,
// regardless of which site that particular token was originally issued for
// (confirmed against https://developers.webflow.com/data/v2.0.0-beta/reference/token/resolve -
// it's described as an app-level capability, "a bearer token from a Data
// Client App", not tied to the specific site the id token names).
const SCOPES = [
  "sites:read",
  "sites:write",
  "assets:read",
  "assets:write",
  "custom_code:read",
  "custom_code:write",
  "cms:read",
  // Added for "Blog to staging" (routes/blogStaging.ts): cms:write for the
  // real publish/unpublish-item calls, pages:read/pages:write because
  // Webflow's own Custom Code API docs list them as required for the
  // site-wide script registration this feature also needs (confirmed
  // against developers.webflow.com, not assumed) even though this feature
  // never touches a Page resource directly. Per this file's own established
  // rule: the Webflow App dashboard's own scope list must be updated to
  // match BEFORE any install attempt works, and any installation
  // authorized before this change needs a fresh re-authorize to pick these
  // up - existing installations do NOT get these retroactively.
  "cms:write",
  "pages:read",
  "pages:write",
  "authorized_user:read",
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
      // Upsert on siteId (app-schema.ts's unique index), not a blind insert -
      // reinstalling an already-linked site (e.g. after SCOPES changes, like
      // adding cms:read) must replace that site's row so ownsSite() picks up
      // the fresh token, not add a second row for the same site. Real bug,
      // found and fixed 2026-09-14 - see that index's own comment for the
      // exact failure this caused. A null siteId (unresolved above) is never
      // deduplicated by this, since Postgres treats every NULL as distinct
      // under a unique index - each unresolved install still gets its own row.
      //
      // userId is COALESCEd, never blindly overwritten with this request's
      // own value: a Webflow-initiated reinstall of an ALREADY-linked site
      // (e.g. an existing customer re-authorizing from their site's Apps
      // panel, not via /auth/install) resolves userId to null here - a plain
      // overwrite would silently unlink that site from its owner's account.
      await db
        .insert(installations)
        .values({ accessToken, userId, siteId })
        .onConflictDoUpdate({
          target: installations.siteId,
          set: {
            accessToken,
            userId: sql`COALESCE(${sql.raw(`excluded.${installations.userId.name}`)}, ${installations.userId})`,
          },
        });

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

const linkInstallationSchema = z.object({
  // webflow.getIdToken() (Designer API) - never a client-submitted siteId,
  // see this route's own comment for why that distinction is the whole
  // point of this endpoint.
  idToken: z.string().min(1),
});

// Fase 2 of the "Beta-tester + production install flow" plan (data-client
// CLAUDE.md) - finally implemented. Fixes a real, general gap this session
// found the hard way: a site can end up genuinely installed (a real
// `installations` row with a real access token) with NO Fluxa userId at
// all, whenever the OAuth flow was started from Webflow's own side (the
// Apps panel, or an Authorization URL) rather than Fluxa's own
// /auth/install - Fase 1 already accepts that install rather than
// rejecting it, but nothing ever came back later to claim it. This is that
// "come back later and claim it" step, called by the Designer Extension
// once it has both a signed-in Fluxa session and a running Designer
// connection (see services/linkInstallation.ts).
//
// Security: the caller CANNOT claim an arbitrary siteId by just naming one
// in the request body - that would let any signed-in Fluxa user steal
// another customer's installation (and its sites:write/custom_code:write
// site token) by guessing/knowing a siteId, which isn't secret. Instead,
// the only siteId ever trusted here is whatever Webflow's OWN "Resolve ID
// token" endpoint returns for the caller's real, freshly-minted idToken -
// proof the caller is genuinely looking at that exact site's Designer right
// now, not a claim they typed in.
authRoutes.post(
  "/link-installation",
  requireAuth,
  zValidator("json", linkInstallationSchema, onValidationError),
  async (c) => {
    const { idToken } = c.req.valid("json");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    // Resolving an id token needs *a* bearer token from this app with
    // authorized_user:read (see SCOPES's own comment) - not necessarily one
    // for the site the id token names, so any installation on file works as
    // the calling credential, IN THEORY. Real bug, found 2026-09-15: picking
    // just the single most-recently-created one (the original approach
    // here) isn't safe - a stale install from before `authorized_user:read`
    // was added to SCOPES (or a Webflow-side install nobody ever finished
    // linking, `userId` still null) fails this call with a real Webflow 403
    // ("Webflow id token resolve failed: 403"), and there was no fallback,
    // so `link-installation` broke entirely as soon as any such row existed
    // and happened to be the newest. Now tries every installation as a
    // candidate credential, most-recently-linked-by-a-real-user first (far
    // more likely to have been through /auth/install with the CURRENT full
    // SCOPES list than an old unclaimed Webflow-side install), falling
    // through to the next on a 403/401 specifically - not on a different
    // failure (network error, 5xx), which still aborts immediately.
    const candidates = await db
      .select({ accessToken: installations.accessToken })
      .from(installations)
      .orderBy(sql`${installations.userId} IS NULL`, desc(installations.createdAt))
      .limit(10);
    if (candidates.length === 0) {
      return c.json(
        { error: "no_installation_available", message: "No Webflow installation exists yet to verify against." },
        503,
      );
    }

    let resolved: Awaited<ReturnType<typeof resolveIdToken>> | undefined;
    let lastErr: unknown;
    for (const candidate of candidates) {
      try {
        resolved = await resolveIdToken({ accessToken: candidate.accessToken, idToken });
        break;
      } catch (err) {
        lastErr = err;
        const message = err instanceof Error ? err.message : "";
        // Only a scope/auth rejection from Webflow itself is worth trying
        // the next candidate for - any other failure (network error, a
        // genuine 5xx) means retrying with a different token wouldn't help.
        if (!/resolve failed: 40[13]/.test(message)) break;
      }
    }
    if (!resolved) {
      console.error("POST /link-installation: resolveIdToken failed for every candidate", lastErr);
      return c.json({ error: "webflow_api_error" }, 502);
    }

    // Only ever claims a row that's currently unowned (userId IS NULL) -
    // mirrors the exact WHERE clause the original Fase 2 plan specified.
    // Never reassigns an already-linked site to a different Fluxa user here
    // (that would silently steal it from whoever installed it) - an
    // already-linked row just responds `linked: false, alreadyOwned`. Site
    // access itself no longer depends on this at all - any authenticated
    // Fluxa account with a site's siteId can already use its installation
    // (routes/cmsGallery.ts's own getSiteInstallation) - this endpoint's
    // only remaining job is the original Fase 2 one: claim a genuinely
    // unowned row (a Webflow-initiated install nobody ever linked) for
    // whoever's currently signed in.
    const [claimed] = await db
      .update(installations)
      .set({ userId })
      .where(and(eq(installations.siteId, resolved.siteId), isNull(installations.userId)))
      .returning({ id: installations.id });

    if (claimed) {
      return c.json({ linked: true, siteId: resolved.siteId });
    }

    const [existing] = await db
      .select({ id: installations.id, userId: installations.userId })
      .from(installations)
      .where(eq(installations.siteId, resolved.siteId))
      .limit(1);

    if (!existing) {
      return c.json(
        { error: "not_installed", message: "This site isn't installed yet - authorize Fluxa for it first." },
        404,
      );
    }

    return c.json({
      linked: false,
      alreadyOwned: existing.userId === userId,
      siteId: resolved.siteId,
    });
  },
);
