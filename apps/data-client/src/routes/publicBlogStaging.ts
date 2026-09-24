import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../db/client";
import { blogStagingItems } from "../db/schema";
import { onValidationError } from "../lib/validation";
import { buildBlogStagingRuntime } from "../lib/blogStagingRuntime";

// Called from an arbitrary PUBLISHED customer site (any domain) by the
// site-wide enforcement script routes/blogStaging.ts registers - same
// "genuinely separate, permissively-CORS'd, unauthenticated" shape as
// routes/publicCmsGallery.ts, and for the identical reason: the global CORS
// allowlist in index.ts is a fixed list of Fluxa's own origins and can
// never include an arbitrary customer's own domain.
export const publicBlogStagingRoutes = new Hono<AppEnv>();

publicBlogStagingRoutes.use(cors({ origin: "*" }));

const paramsSchema = z.object({
  siteId: z.string().min(1),
  slug: z.string().min(1),
});

const siteParamSchema = z.object({ siteId: z.string().min(1) });

// v2 (loader + Worker-served runtime, see lib/blogStagingRuntime.ts). Both
// v2 paths have 3 segments, so they can never collide with the v1
// `/:siteId/:slug` route below, whatever a post's slug is. They're
// registered first regardless.
publicBlogStagingRoutes.get(
  "/:siteId/v2/runtime.js",
  zValidator("param", siteParamSchema, onValidationError),
  (c) => {
    const { siteId } = c.req.valid("param");
    return c.body(buildBlogStagingRuntime(c.env.BETTER_AUTH_URL, siteId), 200, {
      "Content-Type": "application/javascript; charset=utf-8",
      // Short, not immutable - this file is deliberately NOT versioned by
      // name (the whole point is updating it without a Webflow publish), so
      // a runtime fix should reach every live site within minutes.
      "Cache-Control": "public, max-age=300",
    });
  },
);

publicBlogStagingRoutes.get(
  "/:siteId/v2/slugs",
  zValidator("param", siteParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const db = createDb(c.env.DATABASE_URL);

    const rows = await db
      .select({ itemSlug: blogStagingItems.itemSlug })
      .from(blogStagingItems)
      .where(and(eq(blogStagingItems.siteId, siteId), eq(blogStagingItems.stagingOnly, true)));

    // no-store: a toggle in the extension must show up on the very next
    // page load of the live site.
    c.header("Cache-Control", "no-store");
    return c.json({ slugs: rows.map((row) => row.itemSlug) });
  },
);

// v1 - still called by the original inline script (1.0.0) on any site that
// hasn't been re-published since the v2 loader replaced it.
publicBlogStagingRoutes.get(
  "/:siteId/:slug",
  zValidator("param", paramsSchema, onValidationError),
  async (c) => {
    const { siteId, slug } = c.req.valid("param");
    const db = createDb(c.env.DATABASE_URL);

    const [row] = await db
      .select({ stagingOnly: blogStagingItems.stagingOnly })
      .from(blogStagingItems)
      .where(and(eq(blogStagingItems.siteId, siteId), eq(blogStagingItems.itemSlug, slug)))
      .limit(1);

    return c.json({ stagingOnly: row?.stagingOnly ?? false });
  },
);
