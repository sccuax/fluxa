import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./types";
import { createAuth } from "./lib/auth";
import { sessionMiddleware } from "./middleware";
import { authRoutes } from "./routes/auth";
import { assetRoutes } from "./routes/assets";
import { presetRoutes } from "./routes/presets";

const app = new Hono<AppEnv>();

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

// Populates c.get("user")/c.get("session") for every route below (doesn't
// gate access by itself - see middleware/requireAuth.ts for that).
app.use("*", sessionMiddleware);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/me", (c) => c.json({ user: c.get("user") }));

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
