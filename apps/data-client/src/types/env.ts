export interface Bindings {
  DATABASE_URL: string;
  WEBFLOW_CLIENT_ID: string;
  WEBFLOW_CLIENT_SECRET: string;
  WEBFLOW_REDIRECT_URI: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  DESIGNER_EXTENSION_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Cloudflare Email Service binding (send_email in wrangler.toml) - used for
  // the password-reset OTP email, see lib/auth.ts's emailOTP plugin config.
  EMAIL: SendEmail;
  // TEMPORARY (see lib/emailRoutingGuard.ts) - Cloudflare API token scoped to
  // "Email Routing Addresses: Edit" only, used to auto-verify OTP recipients
  // while the account is on the Workers Free Email Sending sandbox. Remove
  // once upgraded to Workers Paid.
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  // R2 bucket for user-uploaded avatars (routes/profile.ts) - the uploaded
  // file itself lives here, only its served URL is written to user.image.
  AVATARS: R2Bucket;
  // R2 bucket for admin-captured preset gallery thumbnails
  // (routes/galleryPresets.ts) - see galleryPresets.thumbnailUrl.
  PRESET_THUMBNAILS: R2Bucket;
  // R2 bucket for self-hosted, versioned runtime bundles (routes/runtimeAssets.ts)
  // - e.g. glass-liquid-runtime.v1.js, loaded by a plain <script src> tag on a
  // published Webflow site instead of importing from esm.sh at request time.
  RUNTIME_ASSETS: R2Bucket;
  // Shared-secret gate for routes/galleryPresets.ts (middleware/
  // requireAdminToken.ts) - apps/preset-admin (a local-only internal tool,
  // not something exposed to customers) sends this back as `x-admin-token`.
  // A single static secret rather than a real user/role system, since this
  // is only ever meant to run on an admin's own machine for now - revisit if
  // this ever needs multiple distinct admin identities or audit trails.
  ADMIN_API_TOKEN: string;
  // Workers Analytics Engine dataset (routes/analytics.ts) - custom product
  // events this app defines itself (Designer Extension usage, published-
  // site embed impressions), distinct from the built-in per-request HTTP/
  // Workers analytics Cloudflare already collects for this zone
  // automatically. Free-plan-compatible (confirmed against current
  // Cloudflare docs, not assumed): 100k writes/day, 10k reads/day on
  // Workers Free, no Workers Paid requirement. Dataset is created
  // automatically on the first writeDataPoint() call - no separate
  // provisioning step, unlike the R2 buckets above.
  ANALYTICS: AnalyticsEngineDataset;
  // Cloudflare Account API token, scoped to "Account Analytics Read" only -
  // used exclusively by routes/adminAnalytics.ts to query the Analytics
  // Engine SQL API server-side for apps/preset-admin's own "Analytics" tab.
  // A real account-wide credential (not scoped to just this app's data like
  // ADMIN_API_TOKEN is), so it must only ever live as a Worker secret
  // (`wrangler secret put CLOUDFLARE_ANALYTICS_API_TOKEN`) - never in
  // wrangler.toml, never sent to the browser.
  CLOUDFLARE_ANALYTICS_API_TOKEN: string;
}
