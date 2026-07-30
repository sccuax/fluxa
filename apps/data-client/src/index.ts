import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./types/env";
import { createAuth } from "./lib/auth";
import { authRoutes } from "./routes/auth";
import { assetRoutes } from "./routes/assets";
import { presetRoutes } from "./routes/presets";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = [c.env.DESIGNER_EXTENSION_ORIGIN, "http://localhost:1337"];
      return allowed.includes(origin) ? origin : undefined;
    },
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

// better-auth's own routes: sign-up/sign-in (email+password), Google OAuth,
// session management. See src/lib/auth.ts for provider config.
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Webflow *app installation* OAuth (site access token), separate from the
// end-user auth above.
app.route("/auth", authRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/presets", presetRoutes);

export default app;
