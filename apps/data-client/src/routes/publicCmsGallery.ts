import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../db/client";
import {
  installations,
  cmsGalleryConfigs,
  cmsGalleryItemOverrides,
  cmsItemVisibility,
  cmsSiteVisibilitySettings,
} from "../db/schema";
import { onValidationError } from "../lib/validation";
import { getLiveCollectionItemBySlug } from "../lib/webflowApi";

// Called from an arbitrary PUBLISHED customer site (any domain) by the
// self-hosted runtime script this feature ships - not from the Designer
// Extension or Fluxa Studio, both already covered by index.ts's global CORS
// allowlist. That allowlist is a fixed list of Fluxa's own origins and
// deliberately does NOT (and can't) include every customer's own domain, so
// this router gets its own permissive CORS instead of relying on the global
// one - otherwise the fetch would succeed on the wire but the browser would
// block the published site's own script from reading the JSON body. Safe to
// be this open: every response here is public data already visible on the
// customer's own live site (the images a real visitor already sees in that
// CMS item), not anything gated.
export const publicCmsGalleryRoutes = new Hono<AppEnv>();

publicCmsGalleryRoutes.use(cors({ origin: "*" }));

const paramsSchema = z.object({
  configId: z.string().min(1),
  slug: z.string().min(1),
});

// A minimal, stable shape - deliberately not the raw Webflow fieldData
// image object passed straight through, so a future Webflow API field
// addition/rename can't silently change what a published site's runtime
// script depends on. `fileId` is kept internally (to apply hiddenImageIds
// below) but dropped again before the response is built - the published
// site's own script never needed it and still doesn't.
function toGalleryImage(raw: unknown): { fileId: string | null; url: string; alt: string | null } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const url = (raw as { url?: unknown }).url;
  if (typeof url !== "string") return null;
  const alt = (raw as { alt?: unknown }).alt;
  const fileId = (raw as { fileId?: unknown }).fileId;
  return { url, alt: typeof alt === "string" ? alt : null, fileId: typeof fileId === "string" ? fileId : null };
}

publicCmsGalleryRoutes.get(
  "/:configId/:slug",
  zValidator("param", paramsSchema, onValidationError),
  async (c) => {
    const { configId, slug } = c.req.valid("param");
    const db = createDb(c.env.DATABASE_URL);

    // configId, not a raw collectionId/fieldId - the published site never
    // sees or needs to know either of those, only the config it was set up
    // to point at (see db/app-schema.ts's cmsGalleryConfigs comment).
    const [config] = await db
      .select()
      .from(cmsGalleryConfigs)
      .where(eq(cmsGalleryConfigs.id, configId))
      .limit(1);
    if (!config) return c.json({ error: "not_found" }, 404);

    const [installation] = await db
      .select({ accessToken: installations.accessToken })
      .from(installations)
      .where(eq(installations.siteId, config.siteId))
      .limit(1);
    if (!installation) return c.json({ error: "not_configured" }, 503);

    try {
      const item = await getLiveCollectionItemBySlug({
        accessToken: installation.accessToken,
        collectionId: config.collectionId,
        slug,
      });
      if (!item) return c.json({ error: "item_not_found" }, 404);

      const [override] = await db
        .select()
        .from(cmsGalleryItemOverrides)
        .where(
          and(eq(cmsGalleryItemOverrides.configId, config.id), eq(cmsGalleryItemOverrides.itemSlug, slug)),
        )
        .limit(1);

      // "Handle CMS visibility" (WebflowSolutionsScreen.tsx's own
      // CmsVisibilityScreen) writes a SEPARATE, gallery-independent hidden
      // flag for the same (site, collection, item) - db/app-schema.ts's own
      // cmsItemVisibility comment explains why it isn't just a second write
      // into cmsGalleryItemOverrides. Checking it here too means hiding a
      // post from that screen also hides it from an already-configured
      // gallery for this same collection, rather than the two hide toggles
      // silently disagreeing with each other. Real, known limitation this
      // does NOT cover: a collection with no gallery/embed installed at all
      // has no published-site script reading this route in the first place,
      // so hiding a post there has no live effect yet - only visible in the
      // "Handle CMS visibility" panel itself until that collection gets a
      // real embed of its own.
      const [generalOverride] = await db
        .select({ hidden: cmsItemVisibility.hidden })
        .from(cmsItemVisibility)
        .where(
          and(
            eq(cmsItemVisibility.siteId, config.siteId),
            eq(cmsItemVisibility.collectionId, config.collectionId),
            eq(cmsItemVisibility.itemSlug, slug),
          ),
        )
        .limit(1);

      // The "Hide all posts?" master switch (CmsVisibilityScreen.tsx) -
      // db/app-schema.ts's cmsSiteVisibilitySettings comment has the full
      // override semantics. A third, independent OR term alongside the two
      // above - it deliberately doesn't change or clear either of them, it
      // just forces `hidden` true while it's on.
      const [siteSettings] = await db
        .select({ hideAllPosts: cmsSiteVisibilitySettings.hideAllPosts })
        .from(cmsSiteVisibilitySettings)
        .where(eq(cmsSiteVisibilitySettings.siteId, config.siteId))
        .limit(1);

      const hidden =
        (override?.hidden ?? false) || (generalOverride?.hidden ?? false) || (siteSettings?.hideAllPosts ?? false);
      const rawImages = hidden ? [] : item.fieldData[config.fieldSlug];
      const hiddenImageIds = new Set(override?.hiddenImageIds ?? []);
      const images = (Array.isArray(rawImages) ? rawImages.map(toGalleryImage) : [])
        .filter((img): img is NonNullable<typeof img> => img !== null)
        .filter((img) => img.fileId === null || !hiddenImageIds.has(img.fileId))
        .map(({ url, alt }) => ({ url, alt }));

      // Read live on every request rather than baked into the embed script
      // at install time - a customer changing these in the wizard takes
      // effect on the next page load, no "Install gallery script" re-run
      // needed. `hidden` is a real, separate signal (not just an empty
      // `images` array) - a "hide this post entirely" override needs to
      // remove the whole rendered Collection Item (title and all), not just
      // leave an empty gallery placeholder sitting next to a visible title,
      // which is indistinguishable from "this item genuinely has zero
      // images" without it.
      return c.json({
        images,
        hidden,
        settings: {
          showArrows: config.showArrows,
          showDots: config.showDots,
          autoplay: config.autoplay,
          autoplayIntervalMs: config.autoplayIntervalMs,
          objectFit: config.objectFit,
        },
      });
    } catch (err) {
      console.error("GET /api/public/cms-gallery/:configId/:slug failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);
