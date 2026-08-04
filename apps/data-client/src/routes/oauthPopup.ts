import { Hono } from "hono";
import type { AppEnv } from "../types";

export const oauthPopupRoutes = new Hono<AppEnv>();

// Landing page for the Google sign-in popup window opened from
// SignInScreen.tsx's Google button. better-auth's /api/auth/callback/google
// redirects the popup here (as callbackURL on success, errorCallbackURL on
// failure - see auth.ts's disableImplicitSignUp) once it's already done all
// the real work (exchanging the code, setting the session cookie or not).
// This page's only job is to relay that outcome back to the extension iframe
// that opened it via postMessage, then close itself.
oauthPopupRoutes.get("/", (c) => {
  const error = c.req.query("error") ?? null;
  const targetOrigin = c.env.DESIGNER_EXTENSION_ORIGIN;

  return c.html(`<!doctype html>
<html>
<body>
<script>
  (function () {
    var message = { source: "fluxa-google-auth", error: ${JSON.stringify(error)} };
    if (window.opener) {
      window.opener.postMessage(message, ${JSON.stringify(targetOrigin)});
    }
    window.close();
  })();
</script>
</body>
</html>`);
});
