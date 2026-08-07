import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../db/client";
import type { Bindings } from "../types/env";

// Built per-request from Worker bindings (Cloudflare env isn't available at
// module scope), so this is a factory rather than a module-level singleton.
export function createAuth(env: Bindings) {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Reject sign-in for a Google account with no existing Fluxa user
        // instead of silently creating one - the Designer Extension's Google
        // button is sign-in only; account creation is a separate sign-up flow.
        // better-auth's oauth2/link-account.mjs returns `error: "signup disabled"`
        // in this case, which the callback route turns into a redirect to
        // `?error=signup_disabled` on the popup callback page below.
        disableImplicitSignUp: true,
      },
    },
    account: {
      // The Google sign-in flow spans two separate top-level browsing
      // contexts: the extension iframe's fetch() to /api/auth/sign-in/social
      // (which sets better-auth's extra CSRF "state" cookie) and the
      // *separate* popup window that later lands on
      // /api/auth/callback/google (which needs that same cookie). Even
      // though both hit the same data-client domain, a cookie set from
      // inside a cross-origin iframe doesn't reliably reach a genuinely
      // separate top-level popup window - observed in practice as a
      // `state_mismatch` error on every attempt, regardless of whether the
      // Google account was registered. The primary CSRF guarantee (a random
      // state nonce checked against a single-use row in the `verification`
      // table, since storeStateStrategy defaults to "database" whenever a
      // database is configured, which it is here) doesn't depend on this
      // cookie - it's a secondary defense-in-depth check that assumes a
      // single-window flow, so it's safe to skip for this app's popup-based
      // architecture.
      skipStateCookieCheck: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      // The Designer Extension iframe and this Worker are different sites,
      // so every authenticated call from the extension (the /api/me poll in
      // googleSignIn.ts, presetRoutes, etc.) is a cross-site fetch. better-
      // auth's default session cookie is SameSite=Lax, which browsers only
      // send on top-level navigations, never on cross-site fetch/XHR - so
      // the extension could never actually read back its own session cookie
      // with the default. baseURL is HTTPS here, so `secure` already
      // defaults true; SameSite=None is the piece that needs to be explicit.
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    trustedOrigins: [
      // Webflow Designer Extension iframe origin (apps/data-client/wrangler.toml
      // has the matching value - keep both in sync). Add the Fluxa dashboard's
      // origin here once that app exists.
      env.DESIGNER_EXTENSION_ORIGIN,
      "http://localhost:1337",
      // TEMPORARY - see matching note in index.ts's CORS config. Remove once
      // the live demo over the Cloudflare quick tunnel is done.
      "https://platinum-double-nuke-reward.trycloudflare.com",
    ],
  });
}
