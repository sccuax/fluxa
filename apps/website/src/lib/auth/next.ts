// The login page sends the visitor to `?next=` after signing in. It must only ever be the API's own checkout
// starter (https://api.fluxa.agency/billing/start?interval=...): anything else would turn /login into an open
// redirect. Same rule the Worker applies when it builds that URL (data-client routes/billing.ts).
export function safeNext(raw: string | null, apiUrl: string): string | null {
  if (!raw) return null;
  try {
    const target = new URL(raw);
    const api = new URL(apiUrl);
    if (target.origin === api.origin && target.pathname === "/billing/start") return target.toString();
  } catch {
    // not a URL
  }
  return null;
}
