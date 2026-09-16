import { getWebflowDesigner } from "./webflowDesigner";
import { apiFetch, ApiRequestError } from "./apiClient";

interface LinkInstallationResult {
  linked: boolean;
  siteId?: string;
  alreadyOwned?: boolean;
}

// Fase 2 of the install-linking plan (data-client CLAUDE.md's "Beta-tester +
// production install flow"). A site can end up genuinely installed (a real
// `installations` row, a real Webflow access token) with no Fluxa userId at
// all - whenever the OAuth flow was started from Webflow's own side (the
// Apps panel, or an Authorization URL shared with a tester) rather than
// Fluxa's own /auth/install, which is the only entry point that already
// knows who's signed in. This claims that row for whichever Fluxa account
// is currently signed in, using webflow.getIdToken() - verified server-side
// against Webflow itself (routes/auth.ts's POST /auth/link-installation), so
// this can't be used to claim a site by guessing its id. Site access itself
// no longer depends on claiming anything, though (data-client CLAUDE.md's
// own "Multi-person site access" section) - any authenticated Fluxa
// account already shares a site's installation once it exists. This call's
// only remaining job is claiming a genuinely UNOWNED row (userId still
// null) for whoever's currently signed in, so that account shows up as the
// real owner for isConfigOwner's own per-gallery lock.
//
// Safe to call on every sign-in/session-restore: a no-op once this site is
// already linked to this same account, and the server never reassigns a
// site already linked to a DIFFERENT account. Silently does nothing when
// `webflow` isn't available (sandbox/plain-browser dev modes) or when
// there's nothing this call could act on yet - neither is a real error
// worth surfacing to someone just opening the app.
export async function linkCurrentInstallation(): Promise<LinkInstallationResult | null> {
  let idToken: string;
  try {
    idToken = await getWebflowDesigner().getIdToken();
  } catch {
    return null;
  }

  try {
    // Real bug, fixed 2026-09-15: this called "/api/link-installation" for
    // a long time, but authRoutes (routes/auth.ts) is mounted at "/auth",
    // not "/api/auth" - the real path was always "/auth/link-installation".
    // Every call silently 404'd at Hono's own routing layer (never reached
    // the handler at all) and got swallowed right below as an "expected,
    // not-yet-actionable" 404 - so this had never actually linked ANY
    // account to ANY site, ever, completely silently. Root cause of a real
    // report: a second teammate's brand-new account got a real, correctly-
    // enforced "forbidden" on every site-scoped request forever, because
    // installationCollaborators (data-client's app-schema.ts) never once
    // got populated for anyone.
    return await apiFetch<LinkInstallationResult>("/auth/link-installation", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 503 || error.status === 404)) {
      // Expected, not-yet-actionable states (no installation exists at all
      // yet, or this exact site was never authorized) - nothing to surface.
      return null;
    }
    console.error("linkCurrentInstallation failed", error);
    return null;
  }
}
