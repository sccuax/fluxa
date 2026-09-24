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
  getSitePublishInfo,
  listRegisteredScripts,
  type RegisteredScript,
  type WebflowStagedItem,
} from "../lib/webflowApi";
import {
  siteIdParamSchema,
  collectionIdParamSchema,
  getVerifiedInstallation,
  verifiedInstallationError,
} from "./cmsGallery";

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

// The site's registered Custom Code (FOOTER, every page) is only a tiny
// LOADER since 2.0.0 (2026-09-23): it injects lib/blogStagingRuntime.ts's
// real logic, served from this Worker. Webflow only ships registered Custom
// Code on a real whole-site publish (no partial publish exists), so v1's
// all-inline script meant any logic change needed the customer to publish
// again; with the loader, that publish is needed exactly once per site
// (when the loader itself is installed/updated) and every later runtime
// change is just a Worker deploy. The loader also skips *.webflow.io itself,
// so staging never even requests the runtime. 1.0.0 was the old all-inline
// script (detail page only) - ensureBlogStagingScriptInstalled upgrades it.
// Real, accepted limitation: the "Page not found" is visual only (a
// client-side script can't set a real HTTP 404 status).
const BLOG_STAGING_SCRIPT_VERSION = "2.0.0";
const BLOG_STAGING_SCRIPT_DISPLAY_NAME = "Fluxa Blog to Staging";

function buildBlogStagingLoaderSource(publicBaseUrl: string, siteId: string): string {
  const runtimeUrl = `${publicBaseUrl}/api/public/blog-staging/${siteId}/v2/runtime.js`;
  return `(function(){if(/\\.webflow\\.io$/.test(location.hostname))return;var s=document.createElement('script');s.src=${JSON.stringify(runtimeUrl)};s.async=true;document.head.appendChild(s);})();`;
}

// Idempotent - once this site's registered script is the CURRENT version
// it's a cheap DB read and returns false. Otherwise (never installed, or
// an older version such as the 1.0.0 all-inline script) it registers the
// current loader, swaps it into the site's Custom Code, and returns true -
// meaning the customer has to publish once for it to reach their domains.
async function ensureBlogStagingScriptInstalled(
  db: Database,
  accessToken: string,
  siteId: string,
  publicBaseUrl: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ scriptId: blogStagingSiteSettings.scriptId, scriptVersion: blogStagingSiteSettings.scriptVersion })
    .from(blogStagingSiteSettings)
    .where(eq(blogStagingSiteSettings.siteId, siteId))
    .limit(1);
  if (existing?.scriptId && existing.scriptVersion === BLOG_STAGING_SCRIPT_VERSION) return false;

  const sourceCode = buildBlogStagingLoaderSource(publicBaseUrl, siteId);
  let registered: RegisteredScript;
  try {
    registered = await registerInlineScript({
      accessToken,
      siteId,
      sourceCode,
      displayName: BLOG_STAGING_SCRIPT_DISPLAY_NAME,
      version: BLOG_STAGING_SCRIPT_VERSION,
    });
  } catch (err) {
    // Registered versions are immutable and can't be registered twice - if
    // an earlier attempt registered this version but failed before
    // applying it, reuse that one instead of failing on every retry.
    const found = (await listRegisteredScripts({ accessToken, siteId })).find(
      (script) =>
        script.displayName === BLOG_STAGING_SCRIPT_DISPLAY_NAME && script.version === BLOG_STAGING_SCRIPT_VERSION,
    );
    if (!found) throw err;
    registered = found;
  }

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
  return true;
}

// Drives the in-app "Remember to publish your domains to see the applied
// changes." message (BlogToStagingScreen.tsx) - shown only while the
// site's CURRENT script was installed/updated after the last publish that
// matters: the custom domains' (the script no-ops on *.webflow.io anyway),
// or the site's own publish when it has no custom domain. Also upgrades an
// outdated script (e.g. 1.0.0) for a site already using the feature, so an
// existing install moves to the loader just by opening the screen.
blogStagingRoutes.get(
  "/:siteId/script-status",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [stagingRow] = await db
      .select({ itemSlug: blogStagingItems.itemSlug })
      .from(blogStagingItems)
      .where(and(eq(blogStagingItems.siteId, siteId), eq(blogStagingItems.stagingOnly, true)))
      .limit(1);

    try {
      if (stagingRow) {
        await ensureBlogStagingScriptInstalled(db, access.accessToken, siteId, c.env.BETTER_AUTH_URL);
      }

      const [settings] = await db
        .select({ installedAt: blogStagingSiteSettings.installedAt })
        .from(blogStagingSiteSettings)
        .where(eq(blogStagingSiteSettings.siteId, siteId))
        .limit(1);
      if (!settings?.installedAt) return c.json({ installed: false, publishNeeded: false });

      const site = await getSitePublishInfo({ accessToken: access.accessToken, siteId });
      const publishTimes = site.customDomains.length
        ? site.customDomains.map((domain) => domain.lastPublished)
        : [site.lastPublished];
      const installedAt = settings.installedAt.getTime();
      const publishNeeded = publishTimes.some((time) => !time || new Date(time).getTime() < installedAt);

      return c.json({ installed: true, publishNeeded });
    } catch (err) {
      console.error("GET /:siteId/script-status (blog-staging) failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);

// A published post edited since its last publish: its live version is stale
// until it's published again ("Publish your draft post" only publishes at
// the moment it's switched on - it doesn't track later edits). Drives the
// "(unpublished changes)" label + "Publish changes" button in
// BlogToStagingScreen.tsx, which republishes just that item via the same
// publish-state route below. The tolerance absorbs a publish itself possibly
// bumping lastUpdated a moment after lastPublished - not yet observed either
// way (the one real collection checked, 2026-09-23, had every published
// item's lastUpdated well BEFORE lastPublished).
const PENDING_CHANGES_TOLERANCE_MS = 5000;

function hasUnpublishedChanges(item: WebflowStagedItem, isDraft: boolean): boolean {
  if (isDraft || !item.lastUpdated || !item.lastPublished) return false;
  return Date.parse(item.lastUpdated) - Date.parse(item.lastPublished) > PENDING_CHANGES_TOLERANCE_MS;
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
        const isDraft = item.isDraft ?? false;
        return { id: item.id, slug, name, isDraft, hasUnpublishedChanges: hasUnpublishedChanges(item, isDraft) };
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
