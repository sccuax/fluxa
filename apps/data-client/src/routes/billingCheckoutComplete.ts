import { Hono } from "hono";
import type { AppEnv } from "../types";
import { installResultPage } from "./auth";

export const billingCheckoutCompleteRoutes = new Hono<AppEnv>();

// Lemon Squeezy's hosted Checkout redirects here (product_options.redirect_url,
// see lib/lemonSqueezy.ts's createProCheckout) once payment finishes, inside
// the new tab startUpgrade() opened - a genuine top-level browser navigation
// in a tab this app's own JS doesn't control, so it needs somewhere real to
// land. No nonce, no postMessage attempt: unlike the Google sign-in popup,
// Lemon Squeezy's own webhook (routes/billing.ts's POST /webhook) is what
// actually updates this user's subscription state, independent of whether
// this tab or its JS ever runs at all - this page only has to tell the human
// they're done. Reuses routes/auth.ts's own "title + body, dark result page"
// template rather than a second copy of the same shape.
billingCheckoutCompleteRoutes.get("/", (c) => {
  return c.html(
    installResultPage(
      "Payment received",
      "You can close this tab and return to Fluxa in Webflow.",
    ),
  );
});
