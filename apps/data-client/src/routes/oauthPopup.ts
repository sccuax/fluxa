import { Hono } from "hono";
import type { AppEnv } from "../types";

export const oauthPopupRoutes = new Hono<AppEnv>();

// Landing page for the Google sign-in popup window opened from
// SignInScreen.tsx's Google button. better-auth's /api/auth/callback/google
// redirects the popup here (as callbackURL on success, errorCallbackURL on
// failure - see auth.ts's disableImplicitSignUp) once it's already done all
// the real work (exchanging the code, setting the session cookie or not).
//
// This page tries to relay the outcome back to the extension iframe that
// opened it via postMessage, then close itself - but that relay is
// best-effort, not guaranteed: accounts.google.com sets
// Cross-Origin-Opener-Policy: same-origin on its own pages, and the popup
// passed through there earlier in the flow, so window.opener is usually
// already null by the time we get here (confirmed via manual testing). On
// error, render feedback directly in this page instead of auto-closing, since
// that's the one thing guaranteed to reach the user regardless of whether the
// relay above works - googleSignIn.ts also polls /api/me from the extension
// side as its own success-detection fallback, independent of this relay.
oauthPopupRoutes.get("/", (c) => {
  const error = c.req.query("error") ?? null;
  const targetOrigin = c.env.DESIGNER_EXTENSION_ORIGIN;

  // "already_registered" isn't a real auth failure (a session is set just
  // like a normal sign-in - see googleSignIn.ts's requestSignUp branch), but
  // it still needs to not auto-close and show something, since this inline
  // message is the one channel guaranteed to reach the user - postMessage
  // back to the extension is unreliable (see the class comment below) and
  // the extension's own session poll can't tell "existing account" apart
  // from "brand new account" (both just look like an active session).
  const feedback =
    error === "signup_disabled"
      ? "This Google account isn't linked to a Fluxa account yet. Close this window, then create an account first."
      : error === "already_registered"
        ? "You already have a Fluxa account with this Google account. Close this window and sign in instead."
        : error
          ? "Something went wrong signing in with Google. Close this window and try again."
          : null;

  return c.html(`<!doctype html>
<html>
<body style="font-family: sans-serif; padding: 24px; text-align: center;">
${feedback ? `<p>${feedback}</p><p id="raw-error" style="font-family: monospace; color: #888; font-size: 12px;"></p><button onclick="window.close()">Close</button>` : ""}
<script>
  (function () {
    var payload = { source: "fluxa-google-auth", error: ${JSON.stringify(error)} };
    // TEMPORARY: show the raw error code via textContent (safe from HTML
    // injection) to diagnose which error better-auth is actually sending -
    // remove once we've mapped the codes we can see in practice to friendly
    // messages above.
    var rawErrorEl = document.getElementById("raw-error");
    if (rawErrorEl && payload.error) rawErrorEl.textContent = "(" + payload.error + ")";
    if (window.opener) {
      window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
    }
    ${error ? "" : "window.close();"}
  })();
</script>
</body>
</html>`);
});
