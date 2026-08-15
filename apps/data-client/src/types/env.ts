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
}
