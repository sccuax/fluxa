import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

// Rejects requests with no active session. Must run after sessionMiddleware
// on the same route (relies on c.get("user") being populated already).
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});
