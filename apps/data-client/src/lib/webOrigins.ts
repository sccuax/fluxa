// Origins of the marketing website (apps/website), which hosts the web login page and calls this Worker with
// credentials from the browser. Single source for the CORS allowlist (index.ts), better-auth's trustedOrigins
// (lib/auth.ts) and the "is this a web request" check that decides whether session cookies are partitioned.
export const WEB_ORIGINS = [
  "https://fluxa.agency",
  "https://www.fluxa.agency",
  // Staging site on a fluxa.agency subdomain, so it is SAME-SITE with api.fluxa.agency (a *.pages.dev origin
  // would make the session cookie third-party and the login would not stick).
  "https://staging.fluxa.agency",
  // `pnpm dev:website`
  "http://localhost:5176",
] as const;

export function isWebOrigin(origin: string | null | undefined): boolean {
  return !!origin && (WEB_ORIGINS as readonly string[]).includes(origin);
}
