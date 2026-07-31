import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { createAuth } from "../lib/auth";

// Populates c.get("user") / c.get("session") from the request's cookies.
// Always calls next() - it doesn't gate access on its own. Pair with
// requireAuth for routes that must reject unauthenticated requests.
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const auth = createAuth(c.env);
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  c.set("user", result?.user ?? null);
  c.set("session", result?.session ?? null);

  await next();
});
