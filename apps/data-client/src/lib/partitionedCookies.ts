// The Designer Extension iframe and this Worker are different sites (see
// auth.ts's advanced.defaultCookieAttributes comment), so every better-auth
// cookie here is already SameSite=None; Secure just to survive a cross-site
// fetch at all. Confirmed by real testing (Chrome DevTools > Application >
// Cookies) that this is necessary but not sufficient: the cookie is issued
// with a real ~7-day expiry but disappears the moment the extension iframe
// reloads, forcing a fresh sign-in - Chrome treats an un-partitioned
// third-party cookie as ephemeral rather than actually persisting it.
//
// CHIPS ("Cookies Having Independent Partitioned State") is Chrome's own
// sanctioned fix: a `Partitioned` attribute tells the browser to persist the
// cookie, scoped per top-level site (here, always the one Webflow Designer
// document embedding this extension), instead of wiping/blocking it. The
// installed better-auth version has no built-in option to add this
// attribute, so it's added here by rewriting the handler's own response
// headers rather than forking/patching that dependency. Requires `Secure`
// (already set) - Chrome refuses a `Partitioned` cookie without it.
export function addPartitionedAttribute(response: Response): Response {
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length === 0) return response;

  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of setCookies) {
    const isCrossSite = /;\s*samesite=none/i.test(cookie);
    const alreadyPartitioned = /;\s*partitioned/i.test(cookie);
    headers.append("set-cookie", isCrossSite && !alreadyPartitioned ? `${cookie}; Partitioned` : cookie);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Matches better-auth's own session cookie regardless of the `__Secure-`
// prefix (present whenever baseURL is HTTPS, i.e. the deployed Worker;
// absent under a plain-HTTP local `wrangler dev`) - the cookie *name* is
// whatever precedes the first `=`.
const SESSION_TOKEN_COOKIE_NAME_PATTERN = /^[^=]*\.session_token(?==)/i;

// Real bug, fixed 2026-09-16: `/api/auth/callback/google`'s response used to
// be returned to the popup completely unmodified (see index.ts's own
// comment on why - the OLD, pre-2026-09-12 flow needed the popup to be able
// to read this cookie back itself). That reasoning is stale now: the
// current oauth-popup-exchange flow never reads this cookie at all - it
// pulls the session token straight out of the completion page's own
// embedded JSON (lib/oauthPopupHandoff.ts) and mints an entirely separate,
// correctly `Partitioned` cookie once the extension iframe polls
// routes/oauthPopupExchange.ts. But better-auth's own sign-in logic still
// sets a REAL session cookie on this response regardless of whether the app
// uses it - and because this response is the popup's own top-level
// navigation landing on this Worker's domain, that cookie gets stored as a
// genuine, UNPARTITIONED, first-party cookie for this domain. Unlike every
// other cookie this app sets, the extension iframe can never again reach or
// overwrite it (a cross-site fetch's own Partitioned cookie is a
// permanently separate entry from an unpartitioned one with the identical
// name/domain/path - confirmed via real DevTools inspection: two rows with
// the same name coexist, one is a leftover Google session forever, one
// tracks whatever's actually signed in). Sign-out can't clear it either
// (its own clearing Set-Cookie goes through addPartitionedAttribute above,
// so it only ever clears the Partitioned one). Net effect: once a visitor
// signs in with Google once, `/api/me` keeps resolving to THAT session
// forever, regardless of any later sign-out + different-account sign-in,
// because most cookie parsers (browsers send same-named cookies oldest-set
// first per RFC 6265) return the first/oldest match - the stale Google one.
//
// Fix: strip the real session cookie from this response before it ever
// reaches the popup (nothing needs it there - see above), and explicitly
// expire that same unpartitioned cookie name too, so this same endpoint
// self-heals anyone who already has the stale cookie from before this fix,
// the very next time they go through Google sign-in again.
export function stripPopupSessionCookie(response: Response): Response {
  const setCookies = response.headers.getSetCookie();
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of setCookies) {
    if (SESSION_TOKEN_COOKIE_NAME_PATTERN.test(cookie)) continue;
    headers.append("set-cookie", cookie);
  }
  // Always expire both possible cookie names (the deployed Worker's real
  // `__Secure-` prefixed one, plus the unprefixed name a local plain-HTTP
  // `wrangler dev` would have used) regardless of whether THIS particular
  // callback set one itself - an error callback (e.g. signup_disabled) still
  // needs to clean up a stale cookie left behind by an earlier SUCCESSFUL
  // one, and there's no reliable way to know which prefix an old stale
  // cookie used without seeing it.
  headers.append("set-cookie", "__Secure-better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None");
  headers.append("set-cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=None");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
