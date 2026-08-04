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
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [
      // Webflow Designer Extension iframe origin (apps/data-client/wrangler.toml
      // has the matching value - keep both in sync). Add the Fluxa dashboard's
      // origin here once that app exists.
      env.DESIGNER_EXTENSION_ORIGIN,
      "http://localhost:1337",
    ],
  });
}
