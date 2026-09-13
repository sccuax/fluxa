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
