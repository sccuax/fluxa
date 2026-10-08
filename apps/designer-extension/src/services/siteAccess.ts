import { apiFetch, ApiRequestError } from "./apiClient";
import { getWebflowDesigner } from "./webflowDesigner";

// Site verification, client side. The backend (data-client routes/cmsGallery.ts,
// getVerifiedInstallation) only serves site-scoped routes (cms-gallery,
// cms-images, blog-staging) while a SLIDING verification window is open: every
// use extends it by IDLE, capped at MAX after the last real proof. Re-proving
// costs a Webflow round trip (~400-700ms), so this module pays it as rarely as
// possible and never makes the user reopen the screen:
//   1. proactively - before a call, if our local clock says the window is about
//      to lapse (idle too long, or MAX nearly reached), verify first. No wasted
//      request that would 403.
//   2. reactively - if a call still comes back `not_verified` (clock skew,
//      another tab, server restart), verify once and retry that call once.
// Concurrent callers share ONE in-flight verification per site.
//
// IDLE / MAX mirror SITE_VERIFICATION_IDLE_MS / SITE_VERIFICATION_MAX_MS in
// routes/cmsGallery.ts - keep in sync by hand (different packages, no shared
// import). SAFETY_MS re-verifies a bit early so a call never races the expiry.
const IDLE_MS = 30 * 60 * 1000;
const MAX_MS = 8 * 60 * 60 * 1000;
const SAFETY_MS = 60 * 1000;

interface SiteState {
  provenAt: number;
  lastActivityAt: number;
}

const states = new Map<string, SiteState>();
const inflight = new Map<string, Promise<void>>();

function isLikelyValid(state: SiteState | undefined, now: number) {
  if (!state) return false;
  return now - state.lastActivityAt < IDLE_MS - SAFETY_MS && now - state.provenAt < MAX_MS - SAFETY_MS;
}

// Always does a real verification (fresh idToken -> POST /verify). Used on its
// own by WebflowSolutionsScreen's mount effect, and by the wrapper below.
export function verifySite(siteId: string): Promise<void> {
  const existing = inflight.get(siteId);
  if (existing) return existing;

  const promise = (async () => {
    const idToken = await getWebflowDesigner().getIdToken();
    await apiFetch(`/api/cms-gallery/${siteId}/verify`, {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    const now = Date.now();
    states.set(siteId, { provenAt: now, lastActivityAt: now });
  })().finally(() => {
    inflight.delete(siteId);
  });

  inflight.set(siteId, promise);
  return promise;
}

// `/api/<feature>/<siteId>/...` -> siteId. Every site-scoped route has this shape.
const SITE_PATH = /^\/api\/(?:cms-gallery|cms-images|blog-staging)\/([^/]+)\//;

// Drop-in for apiFetch on site-scoped routes (the siteId comes from the path).
export async function siteApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const siteId = SITE_PATH.exec(path)?.[1];
  if (!siteId) return apiFetch<T>(path, init);

  // Only auto-verify inside a real Designer. In the sandbox / plain-browser
  // dev modes there is no `webflow` global and getIdToken() can't work -
  // behave exactly like a plain apiFetch there (the backend then answers).
  const canVerify = typeof webflow !== "undefined";

  if (canVerify && !isLikelyValid(states.get(siteId), Date.now())) {
    // Best-effort: if this fails, still attempt the call and let the backend's
    // answer (with its real message) surface, same as before this module.
    await verifySite(siteId).catch((error) => console.warn("Fluxa: site verification failed", error));
  }

  try {
    const result = await apiFetch<T>(path, init);
    const state = states.get(siteId);
    if (state) state.lastActivityAt = Date.now();
    return result;
  } catch (error) {
    if (canVerify && error instanceof ApiRequestError && error.code === "not_verified") {
      // One retry only - if the fresh verification itself fails, its error
      // propagates (a real reason, e.g. getIdToken rejecting) instead of looping.
      await verifySite(siteId);
      const result = await apiFetch<T>(path, init);
      const state = states.get(siteId);
      if (state) state.lastActivityAt = Date.now();
      return result;
    }
    throw error;
  }
}
