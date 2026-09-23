import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import type { Database } from "../db/client";
import { createDb } from "../db/client";
import {
  installations,
  siteVerifications,
  cmsGalleryConfigs,
  cmsGalleryItemOverrides,
  cmsItemVisibility,
  cmsSiteVisibilitySettings,
} from "../db/schema";
import {
  createCmsGalleryConfigSchema,
  updateCmsGalleryConfigSettingsSchema,
  cmsGallerySettingsSchema,
  setCmsGalleryItemOverrideSchema,
  setCmsItemVisibilitySchema,
  setCmsSiteVisibilitySettingsSchema,
  verifySiteSchema,
} from "../schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";
import {
  listSiteCollections,
  getCollectionDetails,
  listLiveCollectionItems,
  resolveIdToken,
} from "../lib/webflowApi";

// Backend for "Webflow Solutions" feature #1: letting a customer pick a
// Collection List's Collection and one of its multi-image fields from
// Fluxa's own panel, instead of Webflow's native binding UI - which cannot
// bind a multi-image field to anything at all (not a Text/Image Code
// Component prop, not a custom attribute - both confirmed dead ends, see
// the designer-extension CLAUDE.md's "CMS gallery" section for the full
// research trail). This router only ever reads/writes Fluxa's own
// `cmsGalleryConfigs` table and Webflow's CMS API on the customer's behalf -
// the actual per-item image fetch used by a *published* site is
// routes/publicCmsGallery.ts, a deliberately separate, unauthenticated
// router (same "public" vs "admin"/"customer" split as galleryPresets.ts).
export const cmsGalleryRoutes = new Hono<AppEnv>();

cmsGalleryRoutes.use(requireAuth);

export const siteIdParamSchema = z.object({
  siteId: z.string().min(1).max(255),
});

export const collectionIdParamSchema = siteIdParamSchema.extend({
  collectionId: z.string().min(1).max(255),
});

// Simplified 2026-09-15, then re-tightened 2026-09-16 - see this file's own
// POST /:siteId/verify below for the full current reasoning. Short version:
// any authenticated Fluxa account CAN share a site's installation token, but
// only once THEY (not just anyone who knows the siteId, which isn't secret)
// have proven real Designer access to that exact site via a fresh
// webflow.getIdToken() - checked here against `site_verifications`, a
// short-lived (15 min) row written by that verify endpoint, not re-checked
// against Webflow itself on every call (that round trip - observed
// ~400-700ms - is only worth paying once per Designer session, not once per
// click).
export type VerifiedInstallation =
  | { status: "ok"; accessToken: string }
  // Genuinely never installed at all - distinct from "not_verified" so the
  // Designer Extension can tell "there's nothing here" apart from "you just
  // need to (re-)verify", which POST /:siteId/verify recovers from on its
  // own.
  | { status: "not_installed" }
  | { status: "not_verified" };

export async function getVerifiedInstallation(
  db: Database,
  siteId: string,
  userId: string,
): Promise<VerifiedInstallation> {
  const [installation] = await db
    .select({ accessToken: installations.accessToken })
    .from(installations)
    .where(eq(installations.siteId, siteId))
    .limit(1);
  if (!installation) return { status: "not_installed" };

  const [verification] = await db
    .select({ id: siteVerifications.id })
    .from(siteVerifications)
    .where(
      and(
        eq(siteVerifications.siteId, siteId),
        eq(siteVerifications.userId, userId),
        gt(siteVerifications.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!verification) return { status: "not_verified" };

  return { status: "ok", accessToken: installation.accessToken };
}

// Small shared responder for the 8 call sites below - every one of them
// needs the exact same "translate a non-ok VerifiedInstallation into the
// right error response" branch, only the success path differs per route.
export function verifiedInstallationError(access: Exclude<VerifiedInstallation, { status: "ok" }>) {
  if (access.status === "not_installed") {
    return {
      error: "forbidden" as const,
      message: "Fluxa isn't installed on this site yet.",
    };
  }
  return {
    error: "not_verified" as const,
    message: "This site needs to be re-verified - reopen Webflow Solutions in the Designer.",
  };
}

// Sums the multi-image field's real image count across every LIVE item in
// the config's own collection - powers the "Your galleries" list's own
// per-gallery image total (WebflowSolutionsScreen.tsx). Paginates
// listLiveCollectionItems at Webflow's own 100-per-page cap rather than one
// unbounded request; MAX_PAGES bounds worst-case latency/rate-limit
// exposure for a pathologically large collection (2000 items is far beyond
// any real "blog"-shaped use case for this feature) rather than looping
// until Webflow's own `pagination.total` is exhausted no matter how large.
const IMAGE_COUNT_PAGE_SIZE = 100;
const IMAGE_COUNT_MAX_PAGES = 20;

async function countGalleryImages(
  accessToken: string,
  collectionId: string,
  fieldSlug: string,
): Promise<number | null> {
  try {
    let total = 0;
    for (let page = 0; page < IMAGE_COUNT_MAX_PAGES; page++) {
      const { items, pagination } = await listLiveCollectionItems({
        accessToken,
        collectionId,
        limit: IMAGE_COUNT_PAGE_SIZE,
        offset: page * IMAGE_COUNT_PAGE_SIZE,
      });
      for (const item of items) {
        const rawImages = item.fieldData[fieldSlug];
        if (Array.isArray(rawImages)) total += rawImages.length;
      }
      const fetched = (page + 1) * IMAGE_COUNT_PAGE_SIZE;
      if (fetched >= pagination.total || items.length === 0) break;
    }
    return total;
  } catch (err) {
    // Never fail the whole gallery list over one config's count - null
    // renders as "-" client-side rather than blocking the list.
    console.error("countGalleryImages failed", err);
    return null;
  }
}

// A gallery config's own creator (createdByUserId) is the only one who can
// edit/delete it - every OTHER site collaborator can still see it (a real
// team needs to know what's already configured) but the Designer
// Extension shows it disabled for them (WebflowSolutionsScreen.tsx's own
// `isOwner` check). Null creator (a row from before this column existed)
// is treated as editable by anyone, same "don't lock out whoever's already
// managing it" reasoning cmsGalleryConfigs.createdByUserId's own comment
// gives.
export function isConfigOwner(config: { createdByUserId: string | null }, userId: string): boolean {
  return config.createdByUserId === null || config.createdByUserId === userId;
}

// 15 minutes - long enough that a normal Webflow Solutions session (open
// the panel, run the wizard, tweak settings) never re-verifies mid-task,
// short enough that a siteId leaking outside the Designer entirely stays
// useless to an unrelated account within a bounded window rather than
// forever. Purely a DB-row TTL, nothing to rotate/revoke elsewhere.
const SITE_VERIFICATION_TTL_MS = 15 * 60 * 1000;

// Called once per Designer session (WebflowSolutionsScreen.tsx's own mount
// effect, right where linkCurrentInstallation() already runs) - proves,
// via a FRESH webflow.getIdToken() resolved server-side against Webflow
// itself, that the caller's own Designer session is genuinely looking at
// this exact siteId right now, then remembers that for
// SITE_VERIFICATION_TTL_MS so every other route in this router
// (getVerifiedInstallation) can check a cheap DB row instead of repeating
// this real network round-trip (~400-700ms observed) on every click. This
// closes the actual gap the simplified 2026-09-15 model left open: siteId
// isn't secret, so without this, any signed-in Fluxa account that merely
// *learned* a siteId (outside the Designer entirely - pasted somewhere,
// screenshotted) could read/create on that site forever. Deliberately
// looks up the installation by THIS SAME siteId (not "any installation on
// file" the way /auth/link-installation's own resolveIdToken caller-
// credential picking has to, since it doesn't know a siteId yet) - so this
// can't repeat that endpoint's own real scope-mismatch bug (data-client
// CLAUDE.md's own "POST /auth/link-installation real bugs" section).
cmsGalleryRoutes.post(
  "/:siteId/verify",
  zValidator("param", siteIdParamSchema, onValidationError),
  zValidator("json", verifySiteSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const { idToken } = c.req.valid("json");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const [installation] = await db
      .select({ accessToken: installations.accessToken })
      .from(installations)
      .where(eq(installations.siteId, siteId))
      .limit(1);
    if (!installation) {
      return c.json({ error: "forbidden" }, 403);
    }

    let resolved;
    try {
      resolved = await resolveIdToken({ accessToken: installation.accessToken, idToken });
    } catch (err) {
      console.error("POST /:siteId/verify: resolveIdToken failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }

    // The idToken has to resolve to THIS EXACT siteId - a valid, freshly-
    // minted idToken for some OTHER site the caller also has open wouldn't
    // prove anything about this one.
    if (resolved.siteId !== siteId) {
      return c.json({ error: "site_mismatch" }, 403);
    }

    const expiresAt = new Date(Date.now() + SITE_VERIFICATION_TTL_MS);
    await db
      .insert(siteVerifications)
      .values({ siteId, userId, expiresAt })
      .onConflictDoUpdate({
        target: [siteVerifications.siteId, siteVerifications.userId],
        set: { expiresAt },
      });

    return c.json({ verified: true, expiresAt });
  },
);

// The "Hide all posts?" master switch (CmsVisibilityScreen.tsx, above its
// own search bar) - see db/app-schema.ts's cmsSiteVisibilitySettings
// comment for the override semantics. No row yet means "off" (the default,
// same "no row = default" convention this whole feature already uses).
cmsGalleryRoutes.get(
  "/:siteId/visibility-settings",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [row] = await db
      .select({ hideAllPosts: cmsSiteVisibilitySettings.hideAllPosts })
      .from(cmsSiteVisibilitySettings)
      .where(eq(cmsSiteVisibilitySettings.siteId, siteId))
      .limit(1);

    return c.json({ hideAllPosts: row?.hideAllPosts ?? false });
  },
);

cmsGalleryRoutes.put(
  "/:siteId/visibility-settings",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const { hideAllPosts } = setCmsSiteVisibilitySettingsSchema.parse(await c.req.json());

    await db
      .insert(cmsSiteVisibilitySettings)
      .values({ siteId, hideAllPosts })
      .onConflictDoUpdate({
        target: cmsSiteVisibilitySettings.siteId,
        set: { hideAllPosts, updatedAt: new Date() },
      });

    return c.json({ hideAllPosts });
  },
);

// Lets the Designer Extension's panel show the customer a dropdown of their
// site's actual Collections (by name) instead of requiring them to know a
// raw collectionId, or Fluxa trying to infer "which collection is this
// Collection List bound to" from the Designer API - which, per the same
// research trail above, has no documented way to do that today.
cmsGalleryRoutes.get(
  "/:siteId/collections",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    try {
      const { collections } = await listSiteCollections({
        accessToken: access.accessToken,
        siteId,
      });
      return c.json({ collections });
    } catch (err) {
      console.error("GET /:siteId/collections failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);

// Only ever returns fields the rest of this feature can actually use -
// filtering to type === "MultiImage" here (rather than returning every
// field and filtering client-side) keeps that rule in one place instead of
// duplicated in the Designer Extension's own panel code.
cmsGalleryRoutes.get(
  "/:siteId/collections/:collectionId/fields",
  zValidator("param", collectionIdParamSchema, onValidationError),
  async (c) => {
    const { siteId, collectionId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    try {
      const { fields } = await getCollectionDetails({
        accessToken: access.accessToken,
        collectionId,
      });
      const multiImageFields = fields.filter((field) => field.type === "MultiImage");
      return c.json({ fields: multiImageFields });
    } catch (err) {
      console.error("GET /:siteId/collections/:collectionId/fields failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);

// Shared by this route and /:siteId/gallery-configs/:id/items below - both
// are a "Load more" picker over Webflow's own live-item pagination, not a
// single giant request.
const listItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

// Backs "Handle CMS visibility" (WebflowSolutionsScreen.tsx's own
// CmsVisibilityScreen) - a plain per-collection item list (name + hidden
// flag only, no images) for a collection the Designer discovered on the
// current page, whether or not a gallery is configured for it at all. Same
// live-item + limit/offset-pagination shape as
// /:siteId/gallery-configs/:id/items below (`listLiveCollectionItems`), just
// keyed directly by `collectionId` rather than needing a config row to
// resolve one from.
cmsGalleryRoutes.get(
  "/:siteId/collections/:collectionId/items",
  zValidator("param", collectionIdParamSchema, onValidationError),
  zValidator("query", listItemsQuerySchema, onValidationError),
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
      const { items, pagination } = await listLiveCollectionItems({
        accessToken: access.accessToken,
        collectionId,
        limit,
        offset,
      });

      const pageItems = items.map((item) => {
        const slug = typeof item.fieldData.slug === "string" ? item.fieldData.slug : "";
        const name = typeof item.fieldData.name === "string" ? item.fieldData.name : slug;
        return { id: item.id, slug, name };
      });

      const slugs = pageItems.map((item) => item.slug).filter((slug) => slug.length > 0);
      const overrides = slugs.length
        ? await db
            .select()
            .from(cmsItemVisibility)
            .where(
              and(
                eq(cmsItemVisibility.siteId, siteId),
                eq(cmsItemVisibility.collectionId, collectionId),
                inArray(cmsItemVisibility.itemSlug, slugs),
              ),
            )
        : [];
      const hiddenBySlug = new Map(overrides.map((row) => [row.itemSlug, row.hidden]));

      const itemsWithVisibility = pageItems.map((item) => ({
        ...item,
        hidden: hiddenBySlug.get(item.slug) ?? false,
      }));

      return c.json({ items: itemsWithVisibility, pagination });
    } catch (err) {
      console.error("GET /:siteId/collections/:collectionId/items failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);

// Deletes the row instead of writing a no-op "visible" one when unhiding -
// same "no row = default" convention cmsGalleryItemOverrides' own PUT uses,
// so the lookup above (and publicCmsGallery.ts's own) stays a plain
// optional-row check with nothing stale left behind.
cmsGalleryRoutes.put(
  "/:siteId/collections/:collectionId/items/:itemSlug/visibility",
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

    const { hidden } = setCmsItemVisibilitySchema.parse(await c.req.json());

    if (!hidden) {
      await db
        .delete(cmsItemVisibility)
        .where(
          and(
            eq(cmsItemVisibility.siteId, siteId),
            eq(cmsItemVisibility.collectionId, collectionId),
            eq(cmsItemVisibility.itemSlug, itemSlug),
          ),
        );
      return c.json({ siteId, collectionId, itemSlug, hidden: false });
    }

    await db
      .insert(cmsItemVisibility)
      .values({ siteId, collectionId, itemSlug, hidden: true })
      .onConflictDoUpdate({
        target: [cmsItemVisibility.siteId, cmsItemVisibility.collectionId, cmsItemVisibility.itemSlug],
        set: { hidden: true, updatedAt: new Date() },
      });

    return c.json({ siteId, collectionId, itemSlug, hidden: true });
  },
);

cmsGalleryRoutes.get(
  "/:siteId/gallery-configs",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const results = await db
      .select()
      .from(cmsGalleryConfigs)
      .where(eq(cmsGalleryConfigs.siteId, siteId));

    // One real Webflow round trip (paginated) per config, in parallel -
    // acceptable for the small number of galleries a single site actually
    // has (see countGalleryImages's own comment for the pagination bound).
    const imageCounts = await Promise.all(
      results.map((row) => countGalleryImages(access.accessToken, row.collectionId, row.fieldSlug)),
    );

    // Every site collaborator sees every config (a real team needs to know
    // what's already there) - `isOwner` is what the Designer Extension uses
    // to show Customize/Images/Remove as disabled for a config this caller
    // didn't create (see isConfigOwner's own comment).
    return c.json(
      results.map((row, i) => ({ ...row, isOwner: isConfigOwner(row, userId), imageCount: imageCounts[i] })),
    );
  },
);

cmsGalleryRoutes.post(
  "/:siteId/gallery-configs",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const { collectionId, fieldSlug, settings } = createCmsGalleryConfigSchema.parse(
      await c.req.json(),
    );
    // Fills in every settings field's own default for a brand-new row -
    // partial() on the request schema only means the caller doesn't have to
    // send all of them, not that the DB row should have nulls.
    const resolvedSettings = cmsGallerySettingsSchema.parse(settings ?? {});

    // ON CONFLICT DO NOTHING against the (siteId, collectionId, fieldSlug)
    // unique index (app-schema.ts) - re-submitting the same collection+field
    // is a no-op, not a duplicate row ("evitar duplicados", per explicit
    // direction), and re-selects the existing row below rather than
    // returning nothing so the caller always gets a real config id back.
    // Settings on a re-submit are deliberately ignored here too (same
    // no-op rule) - use PATCH to change an existing config's settings.
    // `createdByUserId` likewise only ever gets set on the real insert -
    // any collaborator can re-submit the same collection+field without
    // stealing authorship of an existing config.
    await db
      .insert(cmsGalleryConfigs)
      .values({ siteId, collectionId, fieldSlug, createdByUserId: userId, ...resolvedSettings })
      .onConflictDoNothing({
        target: [cmsGalleryConfigs.siteId, cmsGalleryConfigs.collectionId, cmsGalleryConfigs.fieldSlug],
      });

    const [row] = await db
      .select()
      .from(cmsGalleryConfigs)
      .where(
        and(
          eq(cmsGalleryConfigs.siteId, siteId),
          eq(cmsGalleryConfigs.collectionId, collectionId),
          eq(cmsGalleryConfigs.fieldSlug, fieldSlug),
        ),
      )
      .limit(1);

    return c.json({ ...row, isOwner: isConfigOwner(row, userId) }, 201);
  },
);

cmsGalleryRoutes.patch(
  "/:siteId/gallery-configs/:id",
  zValidator("param", siteIdParamSchema.extend({ id: z.string().min(1) }), onValidationError),
  async (c) => {
    const { siteId, id } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [existingConfig] = await db
      .select({ createdByUserId: cmsGalleryConfigs.createdByUserId })
      .from(cmsGalleryConfigs)
      .where(and(eq(cmsGalleryConfigs.id, id), eq(cmsGalleryConfigs.siteId, siteId)))
      .limit(1);
    if (!existingConfig) return c.json({ error: "not_found" }, 404);
    if (!isConfigOwner(existingConfig, userId)) {
      return c.json({ error: "not_owner", message: "Only this gallery's creator can edit it." }, 403);
    }

    const { settings } = updateCmsGalleryConfigSettingsSchema.parse(await c.req.json());

    const [row] = await db
      .update(cmsGalleryConfigs)
      .set(settings)
      .where(and(eq(cmsGalleryConfigs.id, id), eq(cmsGalleryConfigs.siteId, siteId)))
      .returning();

    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json({ ...row, isOwner: true });
  },
);

// Admin-facing image shape - unlike publicCmsGallery.ts's toGalleryImage,
// this one keeps `fileId` (the stable Webflow Asset id) since the picker
// needs a real identifier to save into hiddenImageIds; a URL isn't used for
// that (theoretically re-processable, unlike an asset's own id) even though
// it's still returned for the picker's own thumbnail rendering.
interface AdminGalleryImage {
  fileId: string | null;
  url: string;
  alt: string | null;
}

function toAdminGalleryImage(raw: unknown): AdminGalleryImage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const url = (raw as { url?: unknown }).url;
  if (typeof url !== "string") return null;
  const alt = (raw as { alt?: unknown }).alt;
  const fileId = (raw as { fileId?: unknown }).fileId;
  return {
    url,
    alt: typeof alt === "string" ? alt : null,
    fileId: typeof fileId === "string" ? fileId : null,
  };
}

// Powers the "Manage images" picker - one page of the config's real
// Collection items (live, same data source publicCmsGallery.ts itself
// reads), each with its multi-image field's images and any existing
// override merged in, straight through to Webflow's own limit/offset
// pagination rather than aggregating a whole collection server-side (see
// the designer-extension CLAUDE.md's own note on why - a "Load more" UI on
// the frontend, not a single giant request).
cmsGalleryRoutes.get(
  "/:siteId/gallery-configs/:id/items",
  zValidator("param", siteIdParamSchema.extend({ id: z.string().min(1) }), onValidationError),
  zValidator("query", listItemsQuerySchema, onValidationError),
  async (c) => {
    const { siteId, id } = c.req.valid("param");
    const { limit, offset } = c.req.valid("query");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [config] = await db
      .select()
      .from(cmsGalleryConfigs)
      .where(and(eq(cmsGalleryConfigs.id, id), eq(cmsGalleryConfigs.siteId, siteId)))
      .limit(1);
    if (!config) return c.json({ error: "not_found" }, 404);

    try {
      const { items, pagination } = await listLiveCollectionItems({
        accessToken: access.accessToken,
        collectionId: config.collectionId,
        limit,
        offset,
      });

      const pageItems = items.map((item) => {
        const slug = typeof item.fieldData.slug === "string" ? item.fieldData.slug : "";
        const name = typeof item.fieldData.name === "string" ? item.fieldData.name : slug;
        const rawImages = item.fieldData[config.fieldSlug];
        const images = Array.isArray(rawImages)
          ? rawImages.map(toAdminGalleryImage).filter((img): img is AdminGalleryImage => img !== null)
          : [];
        return { id: item.id, slug, name, images };
      });

      const slugs = pageItems.map((item) => item.slug).filter((slug) => slug.length > 0);
      const overrides = slugs.length
        ? await db
            .select()
            .from(cmsGalleryItemOverrides)
            .where(
              and(eq(cmsGalleryItemOverrides.configId, id), inArray(cmsGalleryItemOverrides.itemSlug, slugs)),
            )
        : [];
      const overrideBySlug = new Map(overrides.map((row) => [row.itemSlug, row]));

      const itemsWithOverrides = pageItems.map((item) => ({
        ...item,
        hidden: overrideBySlug.get(item.slug)?.hidden ?? false,
        hiddenImageIds: overrideBySlug.get(item.slug)?.hiddenImageIds ?? [],
      }));

      return c.json({ items: itemsWithOverrides, pagination });
    } catch (err) {
      console.error("GET /:siteId/gallery-configs/:id/items failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);

// Saves one item's full override state at once (a checkbox-list picker, not
// an incremental toggle - see setCmsGalleryItemOverrideSchema's own
// comment). Deletes the row instead of writing a no-op "fully visible" one
// so publicCmsGallery.ts's own lookup stays a plain "no row = show
// everything" check with nothing stale left behind.
cmsGalleryRoutes.put(
  "/:siteId/gallery-configs/:id/items/:itemSlug/override",
  zValidator(
    "param",
    siteIdParamSchema.extend({ id: z.string().min(1), itemSlug: z.string().min(1) }),
    onValidationError,
  ),
  async (c) => {
    const { siteId, id, itemSlug } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [config] = await db
      .select({ id: cmsGalleryConfigs.id, createdByUserId: cmsGalleryConfigs.createdByUserId })
      .from(cmsGalleryConfigs)
      .where(and(eq(cmsGalleryConfigs.id, id), eq(cmsGalleryConfigs.siteId, siteId)))
      .limit(1);
    if (!config) return c.json({ error: "not_found" }, 404);
    if (!isConfigOwner(config, userId)) {
      return c.json({ error: "not_owner", message: "Only this gallery's creator can edit it." }, 403);
    }

    const { hidden, hiddenImageIds } = setCmsGalleryItemOverrideSchema.parse(await c.req.json());

    if (!hidden && hiddenImageIds.length === 0) {
      await db
        .delete(cmsGalleryItemOverrides)
        .where(and(eq(cmsGalleryItemOverrides.configId, id), eq(cmsGalleryItemOverrides.itemSlug, itemSlug)));
      return c.json({ configId: id, itemSlug, hidden: false, hiddenImageIds: [] });
    }

    const [row] = await db
      .insert(cmsGalleryItemOverrides)
      .values({ configId: id, itemSlug, hidden, hiddenImageIds })
      .onConflictDoUpdate({
        target: [cmsGalleryItemOverrides.configId, cmsGalleryItemOverrides.itemSlug],
        set: { hidden, hiddenImageIds, updatedAt: new Date() },
      })
      .returning();

    return c.json(row);
  },
);

cmsGalleryRoutes.delete(
  "/:siteId/gallery-configs/:id",
  zValidator("param", siteIdParamSchema.extend({ id: z.string().min(1) }), onValidationError),
  async (c) => {
    const { siteId, id } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [existingConfig] = await db
      .select({ createdByUserId: cmsGalleryConfigs.createdByUserId })
      .from(cmsGalleryConfigs)
      .where(and(eq(cmsGalleryConfigs.id, id), eq(cmsGalleryConfigs.siteId, siteId)))
      .limit(1);
    if (!existingConfig) return c.json({ error: "not_found" }, 404);
    if (!isConfigOwner(existingConfig, userId)) {
      return c.json({ error: "not_owner", message: "Only this gallery's creator can remove it." }, 403);
    }

    const [row] = await db
      .delete(cmsGalleryConfigs)
      .where(and(eq(cmsGalleryConfigs.id, id), eq(cmsGalleryConfigs.siteId, siteId)))
      .returning({ id: cmsGalleryConfigs.id });

    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  },
);
