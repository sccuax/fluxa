import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP, oauthPopup } from "better-auth/plugins";
import { createDb } from "../db/client";
import { ensureDestinationVerified } from "./emailRoutingGuard";
import type { Bindings } from "../types/env";

// Sender for the emailOTP plugin below - fluxa.agency is onboarded onto
// Cloudflare Email Service (see wrangler.toml's send_email binding). Not a
// real inbox, purely an outbound address.
const RESET_CODE_FROM_ADDRESS = { email: "noreply@fluxa.agency", name: "Fluxa" };

// Built per-request from Worker bindings (Cloudflare env isn't available at
// module scope), so this is a factory rather than a module-level singleton.
export function createAuth(env: Bindings) {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
    },
    // Explicit 48h, shorter than better-auth's own 7-day default - per
    // explicit direction, not a fix for the "logs out on reload" bug (that
    // was a third-party-cookie persistence issue, see
    // lib/partitionedCookies.ts; the cookie's Max-Age was never the cause,
    // 7 days already exceeded 48h). Session cookie's own `maxAge` mirrors
    // this directly (better-auth/dist/cookies: `sessionToken` cookie ->
    // `options.session?.expiresIn`).
    session: {
      expiresIn: 60 * 60 * 48,
    },
    // ManageProfileScreen's "Save" button (Designer Extension) hits this via
    // POST /api/auth/change-email. updateEmailWithoutVerification is what
    // makes it take effect immediately with no confirmation email - this app
    // has no emailVerification.sendVerificationEmail configured at all (no
    // template built, same gap the password-reset OTP flow would otherwise
    // fill for *this* purpose), and better-auth's own endpoint would
    // otherwise throw "Verification email isn't enabled" for any account
    // whose email isn't already verified. In practice this only actually
    // lets the change through for an account whose current email is
    // unverified (better-auth's own condition, not something this config
    // adds) - which is every email+password account in this app, since
    // nothing here ever sets emailVerified true. A Google-linked account
    // (emailVerified true, set by Google at sign-in) still fails closed with
    // that same error - there's no unverified-email path for it to use, and
    // this app has nothing to send a real confirmation through, so this
    // deliberately does not silently let a verified email change unconfirmed.
    user: {
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: true,
      },
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
        // Forwarded verbatim as `?prompt=select_account` on Google's own
        // authorize URL (confirmed in the installed @better-auth/core
        // source: google.mjs reads `options.prompt` and
        // create-authorization-url.mjs sets it on the query string
        // unconditionally when present). Without this, Google silently
        // reuses whichever Google account already has an active browser
        // session and skips its own account-chooser screen entirely - a
        // real, reported bug: signing out of Fluxa and clicking "Sign in
        // with Google" again never showed a picker at all.
        prompt: "select_account",
      },
    },
    account: {
      // A brand-new Google identity is never silently linked into an
      // *existing* Fluxa user just because the emails happen to match -
      // linking only ever happens for an `account` row that was already
      // created by a prior successful Google sign-in/sign-up. Without this,
      // better-auth's default implicit-linking behavior (oauth2/link-
      // account.mjs) would sign a visitor straight into someone else's
      // pre-existing email+password account the first time a Google
      // identity with the same email completes the OAuth round trip - the
      // exact "this Google account isn't registered but it logged me in
      // anyway" bug reported against this flow. disableImplicitSignUp above
      // only blocks creating a *new* user; this closes the separate
      // link-to-an-existing-user path disableImplicitSignUp doesn't cover.
      accountLinking: {
        disableImplicitLinking: true,
      },
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
    // Powers the "forgot password" flow's OTP step (ForgotPasswordScreen ->
    // ResetCodeScreen -> ResetPasswordScreen in the Designer Extension) via
    // the plugin's /email-otp/request-password-reset, /email-otp/check-
    // verification-otp, and /email-otp/reset-password endpoints. Only the
    // "forget-password" OTP type is actually used by this app right now -
    // sign-in-otp, email-verification, and change-email aren't wired up on
    // the frontend, so sendVerificationOTP below only handles that one case.
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        // Applies to every email-otp/* and sign-in/email-otp endpoint this
        // plugin registers (each tracked as its own bucket, keyed by
        // client IP + path - see rate-limiter/index.mjs's
        // createRateLimitKey - so this doesn't share a budget across
        // different endpoints). The frontend's own 90s resend cooldown
        // (ResetCodeScreen) is a separate, shorter UX throttle layered on
        // top of this - this is the real ceiling: at most 5 requests to
        // request-password-reset per IP per 24h, enforced server-side
        // regardless of what the client does.
        rateLimit: { window: 60 * 60 * 24, max: 5 },
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "forget-password") {
            console.error(`emailOTP: no email template wired up for OTP type "${type}"`);
            return;
          }
          // TEMPORARY (see lib/emailRoutingGuard.ts) - Workers Free's Email
          // Sending sandbox only delivers to Cloudflare-verified addresses.
          // If this one isn't verified yet, this kicks off Cloudflare's own
          // verification email instead and skips the doomed send below - the
          // user needs to click that link, then request the code again.
          // Remove this check once the account is on Workers Paid.
          if (!(await ensureDestinationVerified(env, email))) {
            return;
          }
          await env.EMAIL.send({
            to: email,
            from: RESET_CODE_FROM_ADDRESS,
            subject: "Your Fluxa password reset code",
            text: `Your password reset code is ${otp}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
            html: `<p>Your password reset code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
          });
        },
      }),
      // Real fix for Google sign-in's own popup-vs-embedded-iframe problem
      // (see googleSignIn.ts's own comment): the Designer Extension iframe
      // is a different origin from this Worker, so the session cookie the
      // OAuth callback sets during the POPUP's own top-level navigation is
      // never reliably readable back from inside the iframe - confirmed
      // for real (Google sign-in stopped completing at all once third-party
      // cookie blocking actually kicked in for this pairing). better-auth's
      // own first-party `oauthPopup` plugin exists specifically for this:
      // `/api/auth/oauth-popup/start` runs the whole provider round trip in
      // the popup's own first-party context (validating `popupOrigin`
      // against `trustedOrigins` below, with a signed marker cookie tying
      // the callback back to it - not something hand-rolled here), then
      // swaps the normal callback redirect for a small completion page
      // carrying the session token.
      //
      // That page's OWN documented delivery mechanism - posting the token
      // back to `window.opener` via `postMessage` - does NOT reach the
      // extension iframe in practice: confirmed via real testing that
      // accounts.google.com's own Cross-Origin-Opener-Policy: same-origin
      // permanently severs `window.opener` the instant the popup navigates
      // there mid-flow (the popup closes itself right on schedule per its
      // own script, the opener just never hears about it). Real fallback:
      // `lib/oauthPopupHandoff.ts` captures that same completion page's
      // payload SERVER-SIDE (parsed out of a cloned response, keyed by the
      // `nonce` the iframe already generated before ever opening the
      // popup), and `routes/oauthPopupExchange.ts` is a plain poll endpoint
      // the iframe hits with that nonce until the row lands - no
      // window-reference or partitioned-storage channel involved at all.
      // `bearer` is what lets that endpoint redeem the captured raw token
      // for a real session server-side - required pairing per better-auth's
      // own oauth-popup plugin doc comment.
      //
      // Deliberately NOT adopting better-auth's own suggested "keep the
      // token in localStorage forever" pattern for the embedded case (its
      // client plugin does this) - that would reopen the exact
      // XSS-token-exposure trade-off already weighed and rejected for this
      // app (see partitionedCookies.ts) for every Google session, not just
      // the login instant. Instead the exchange endpoint mints a real,
      // correctly `Partitioned` httpOnly cookie the moment the poll
      // succeeds, and the raw token is never persisted anywhere longer than
      // this table's own short TTL.
      oauthPopup(),
      bearer(),
    ],
    // better-auth's rate limiter defaults to an in-memory store and only
    // enables itself when it detects a "production" environment - neither
    // assumption holds reliably on Workers (isolates are short-lived and
    // don't share memory across requests/edge locations, so a Map-backed
    // counter doesn't actually limit anything across the fleet), so both
    // are set explicitly here rather than trusting the defaults. "database"
    // persists counts to the `rateLimit` table (Neon) via the drizzle
    // adapter above, which is what makes the emailOTP plugin's rateLimit
    // option above actually enforceable network-wide instead of best-effort
    // per-isolate.
    rateLimit: {
      enabled: true,
      storage: "database",
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
      // better-auth's IP resolution only checks x-forwarded-for by default,
      // which isn't the header Cloudflare's edge sets for the real client
      // IP - without this, the rate limiter above would key off a missing/
      // wrong IP and fall back to one shared bucket for every caller.
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
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
      "https://bon-recommends-todd-robbie.trycloudflare.com",
    ],
  });
}
