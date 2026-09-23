import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import type { Database } from "../db/client";
import { createDb } from "../db/client";
import { blogStagingItems, blogStagingSiteSettings } from "../db/schema";
import {
  setBlogStagingItemSchema,
  setAllBlogStagingItemsSchema,
  setBlogPublishStateSchema,
} from "../schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";
import {
  listCollectionItems,
  publishCollectionItems,
  unpublishCollectionItems,
  registerInlineScript,
  getSiteCustomCode,
  applySiteCustomCode,
} from "../lib/webflowApi";
import { collectionIdParamSchema, getVerifiedInstallation, verifiedInstallationError } from "./cmsGallery";

// "Webflow Solutions" feature #4: "Blog to staging" - see
// db/app-schema.ts's blogStagingItems comment for the full "why" (Webflow's
// own publish system has no per-item staging-vs-live distinction at all;
// this is a real, self-hosted enforcement mechanism, not a native Webflow
// capability). Two genuinely different actions live in this one router:
// - The "Preview in staging" toggle is OUR OWN bookkeeping (blogStagingItems)
//   plus a real site-wide script (ensureBlogStagingScriptInstalled below).
// - The "Publish your draft post" toggle is a REAL, direct Webflow CMS API
//   call (publishCollectionItems/unpublishCollectionItems) - no bookkeeping
//   of our own at all, the item's own isDraft state IS the source of truth.
export const blogStagingRoutes = new Hono<AppEnv>();

blogStagingRoutes.use(requireAuth);

const itemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

// The site-wide enforcement script's own source - kept deliberately tiny
// (Webflow's inline-script registration caps sourceCode at 2000 characters,
// confirmed against developers.webflow.com/data/reference/custom-code/
// custom-code/register-inline). Runs in the FOOTER (DOM-manipulating
// scripts belong there per Webflow's own guidance, not the head) on EVERY
// page of the site - so the cost of a brief "flash before hiding" is only
// ever paid on the rare page that's actually marked staging-only; every
// other page is completely unaffected. `siteId` is baked directly into the
// generated source per-site (this is a per-site registration call to begin
// with, so there's no shared/cross-site copy to keep generic) rather than
// read from any global - same "bake the real config into the generated
// code" precedent gradientEmbedScript.ts already sets for its own embed.
// Real, accepted limitation: this can only approximate a 404 visually (a
// plain client-side script can't set a real HTTP status code) - documented
// here rather than solved with more machinery.
const BLOG_STAGING_SCRIPT_VERSION = "1.0.0";
const BLOG_STAGING_SCRIPT_DISPLAY_NAME = "Fluxa Blog to Staging";

function buildBlogStagingScriptSource(publicBaseUrl: string, siteId: string): string {
  return `(function(){if(/\\.webflow\\.io$/.test(location.hostname))return;var p=location.pathname.split('/').filter(Boolean);var s=p[p.length-1];if(!s)return;fetch('${publicBaseUrl}/api/public/blog-staging/${siteId}/'+encodeURIComponent(s)).then(function(r){return r.ok?r.json():null}).then(function(d){if(d&&d.stagingOnly){document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:20px;color:#333">Page not found</div>';document.title='Page not found';}}).catch(function(){});})();`;
}

// Idempotent - a second call (from a second toggle, or a second post) is a
// cheap DB read that returns immediately once the first call has already
// registered+applied the script for this site. Called from every route
// below that actually needs staging-only enforcement to mean anything.
async function ensureBlogStagingScriptInstalled(
  db: Database,
  accessToken: string,
  siteId: string,
  publicBaseUrl: string,
): Promise<void> {
  const [existing] = await db
    .select({ scriptId: blogStagingSiteSettings.scriptId })
    .from(blogStagingSiteSettings)
    .where(eq(blogStagingSiteSettings.siteId, siteId))
    .limit(1);
  if (existing?.scriptId) return;

  const sourceCode = buildBlogStagingScriptSource(publicBaseUrl, siteId);
  const registered = await registerInlineScript({
    accessToken,
    siteId,
    sourceCode,
    displayName: BLOG_STAGING_SCRIPT_DISPLAY_NAME,
    version: BLOG_STAGING_SCRIPT_VERSION,
  });

  // Existing scripts must always be re-included in the PUT or Webflow
  // removes them (per that endpoint's own docs) - this app is very likely
  // not the only thing registering custom code on a given customer's site.
  const { scripts: existingScripts } = await getSiteCustomCode({ accessToken, siteId });
  await applySiteCustomCode({
    accessToken,
    siteId,
    scripts: [
      ...existingScripts.filter((script) => script.id !== registered.id),
      { id: registered.id, location: "footer", version: registered.version },
    ],
  });

  await db
    .insert(blogStagingSiteSettings)
    .values({ siteId, scriptId: registered.id, scriptVersion: registered.version, installedAt: new Date() })
    .onConflictDoUpdate({
      target: blogStagingSiteSettings.siteId,
      set: { scriptId: registered.id, scriptVersion: registered.version, installedAt: new Date() },
    });
}

blogStagingRoutes.get(
  "/:siteId/collections/:collectionId/items",
  zValidator("param", collectionIdParamSchema, onValidationError),
  zValidator("query", itemsQuerySchema, onValidationError),
  async (c) => {
    const { siteId, collectionId } = c.req.valid("param");
    const { limit, offset } = c.req.valid("query");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    try {
      const { items, pagination } = await listCollectionItems({
        accessToken: access.accessToken,
        collectionId,
        limit,
        offset,
      });

      const pageItems = items.map((item) => {
        const slug = typeof item.fieldData.slug === "string" ? item.fieldData.slug : "";
        const name = typeof item.fieldData.name === "string" ? item.fieldData.name : slug;
        return { id: item.id, slug, name, isDraft: item.isDraft ?? false };
      });

      const slugs = pageItems.map((item) => item.slug).filter((slug) => slug.length > 0);
      const overrides = slugs.length
        ? await db
            .select()
            .from(blogStagingItems)
            .where(and(eq(blogStagingItems.siteId, siteId), inArray(blogStagingItems.itemSlug, slugs)))
        : [];
      const stagingBySlug = new Map(overrides.map((row) => [row.itemSlug, row.stagingOnly]));

      const itemsWithStaging = pageItems.map((item) => ({
        ...item,
        stagingOnly: stagingBySlug.get(item.slug) ?? false,
      }));

      return c.json({ items: itemsWithStaging, pagination });
    } catch (err) {
      console.error("GET /:siteId/collections/:collectionId/items (blog-staging) failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);

blogStagingRoutes.put(
  "/:siteId/collections/:collectionId/items/:itemSlug/staging",
  zValidator(
    "param",
    collectionIdParamSchema.extend({ itemSlug: z.string().min(1) }),
    onValidationError,
  ),
  async (c) => {
    const { siteId, collectionId, itemSlug } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const { stagingOnly } = setBlogStagingItemSchema.parse(await c.req.json());

    if (stagingOnly) {
      try {
        await ensureBlogStagingScriptInstalled(db, access.accessToken, siteId, c.env.BETTER_AUTH_URL);
      } catch (err) {
        console.error("ensureBlogStagingScriptInstalled failed", err);
        return c.json(
          { error: "webflow_api_error", message: "Failed to install the staging-enforcement script." },
          502,
        );
      }
    }

    if (!stagingOnly) {
      await db
        .delete(blogStagingItems)
        .where(and(eq(blogStagingItems.siteId, siteId), eq(blogStagingItems.itemSlug, itemSlug)));
      return c.json({ itemSlug, stagingOnly: false });
    }

    await db
      .insert(blogStagingItems)
      .values({ siteId, collectionId, itemSlug, stagingOnly: true })
      .onConflictDoUpdate({
        target: [blogStagingItems.siteId, blogStagingItems.itemSlug],
        set: { collectionId, stagingOnly: true, updatedAt: new Date() },
      });

    return c.json({ itemSlug, stagingOnly: true });
  },
);

// "All posts to staging?" - a real bulk write across every slug the caller
// passes (its own currently-loaded page(s) of items), not a derived
// override - see db/app-schema.ts's own comment for why this table can't
// cleanly support a separate override layer the way cmsItemVisibility does.
blogStagingRoutes.put(
  "/:siteId/collections/:collectionId/items/staging-all",
  zValidator("param", collectionIdParamSchema, onValidationError),
  async (c) => {
    const { siteId, collectionId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const { stagingOnly, itemSlugs } = setAllBlogStagingItemsSchema.parse(await c.req.json());

    if (stagingOnly) {
      try {
        await ensureBlogStagingScriptInstalled(db, access.accessToken, siteId, c.env.BETTER_AUTH_URL);
      } catch (err) {
        console.error("ensureBlogStagingScriptInstalled failed", err);
        return c.json(
          { error: "webflow_api_error", message: "Failed to install the staging-enforcement script." },
          502,
        );
      }
    }

    if (!stagingOnly) {
      await db
        .delete(blogStagingItems)
        .where(and(eq(blogStagingItems.siteId, siteId), inArray(blogStagingItems.itemSlug, itemSlugs)));
      return c.json({ stagingOnly: false, count: itemSlugs.length });
    }

    // One batch of upserts rather than N sequential inserts - matches this
    // app's own "prefer a batch write over many small ones" convention.
    await db
      .insert(blogStagingItems)
      .values(itemSlugs.map((itemSlug) => ({ siteId, collectionId, itemSlug, stagingOnly: true })))
      .onConflictDoUpdate({
        target: [blogStagingItems.siteId, blogStagingItems.itemSlug],
        set: { collectionId, stagingOnly: true, updatedAt: new Date() },
      });

    return c.json({ stagingOnly: true, count: itemSlugs.length });
  },
);

// "Publish your draft post." - a REAL, direct Webflow CMS API action, not
// our own bookkeeping. `itemId` (Webflow's own CMS item id, not the slug)
// is required here since the underlying endpoints take item ids, not slugs
// - the frontend already has it from the same item-list response above.
blogStagingRoutes.put(
  "/:siteId/collections/:collectionId/items/:itemId/publish-state",
  zValidator(
    "param",
    collectionIdParamSchema.extend({ itemId: z.string().min(1) }),
    onValidationError,
  ),
  async (c) => {
    const { siteId, collectionId, itemId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const { publish } = setBlogPublishStateSchema.parse(await c.req.json());

    try {
      if (publish) {
        await publishCollectionItems({ accessToken: access.accessToken, collectionId, itemIds: [itemId] });
      } else {
        await unpublishCollectionItems({ accessToken: access.accessToken, collectionId, itemIds: [itemId] });
      }
      return c.json({ itemId, isDraft: !publish });
    } catch (err) {
      console.error("PUT .../publish-state failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);
