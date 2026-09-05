import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

// Gates routes/galleryPresets.ts - a shared-secret check, not session auth
// (requireAuth.ts), since the caller here is apps/preset-admin, a small
// local-only internal tool with no end-user login of its own. Rejects with
// the same shape requireAuth.ts uses ({ error: "unauthorized" }, 401) so
// callers don't need a second error-handling branch.
export const requireAdminToken = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header("x-admin-token");
  if (!token || token !== c.env.ADMIN_API_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});
