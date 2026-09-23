import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../db/client";
import { blogStagingItems } from "../db/schema";
import { onValidationError } from "../lib/validation";

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
