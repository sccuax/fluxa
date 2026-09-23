import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../db/client";
import { cmsImageReuses } from "../db/schema";
import { createCmsImageReuseSchema, updateCmsImageReuseSchema } from "../schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";
import { getCollectionDetails, listLiveCollectionItems } from "../lib/webflowApi";
import {
  siteIdParamSchema,
  collectionIdParamSchema,
  getVerifiedInstallation,
  verifiedInstallationError,
  isConfigOwner,
} from "./cmsGallery";

// "Webflow Solutions" feature #3: reuse a single CMS image (any `Image`-
// type field, not a `MultiImage` one - that's the OTHER feature, the
// multi-image gallery) on any real Webflow `Image` element anywhere in the
// project. Unlike that gallery, this has NO published-site runtime at all -
// `ImageElement.setAsset()` + `webflow.getAssetById()` (both confirmed
// real against the installed @webflow/designer-extension-typings package)
// set a genuine native image binding directly from the Designer Extension,
// so there's no HTML Embed, no self-hosted script, no public/unauthenticated
// router the way routes/publicCmsGallery.ts is for the gallery feature.
// This whole router is authenticated, customer-facing bookkeeping only -
// see db/app-schema.ts's cmsImageReuses comment for the full reasoning.
export const cmsImagesRoutes = new Hono<AppEnv>();

cmsImagesRoutes.use(requireAuth);

const imageItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

// A single Image-type field's value shape - unlike cmsGallery.ts's own
// AdminGalleryImage (built from a MultiImage field's own ARRAY), a plain
// Image field stores exactly one object directly, so there's no array to
// map over per field - one of these per (item, Image-type field slug) pair
// that's actually set.
interface ImageFieldValue {
  fieldSlug: string;
  fileId: string | null;
  url: string;
  alt: string | null;
}

function toImageFieldValue(fieldSlug: string, raw: unknown): ImageFieldValue | null {
  if (typeof raw !== "object" || raw === null) return null;
  const url = (raw as { url?: unknown }).url;
  if (typeof url !== "string") return null;
  const alt = (raw as { alt?: unknown }).alt;
  const fileId = (raw as { fileId?: unknown }).fileId;
  return {
    fieldSlug,
    url,
    alt: typeof alt === "string" ? alt : null,
    fileId: typeof fileId === "string" ? fileId : null,
  };
}

// Step 3 of the wizard (CmsImagesScreen.tsx) - one page of a collection's
// real live items, each with every one of its own Image-type fields'
// current value (a post can have more than one single-image field - a
// thumbnail AND a cover photo, say - each shown as its own thumbnail to
// pick from). One real Webflow round trip for the collection's own field
// schema (to know which slugs are actually type "Image"), then the
// standard paginated live-items call, same limit/offset "Load more" shape
// as cmsGallery.ts's own item pickers.
cmsImagesRoutes.get(
  "/:siteId/collections/:collectionId/image-items",
  zValidator("param", collectionIdParamSchema, onValidationError),
  zValidator("query", imageItemsQuerySchema, onValidationError),
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
      const { fields } = await getCollectionDetails({ accessToken: access.accessToken, collectionId });
      const imageFieldSlugs = fields.filter((field) => field.type === "Image").map((field) => field.slug);
      if (imageFieldSlugs.length === 0) {
        return c.json({ items: [], pagination: { limit, offset, total: 0 } });
      }

      const { items, pagination } = await listLiveCollectionItems({
        accessToken: access.accessToken,
        collectionId,
        limit,
        offset,
      });

      const pageItems = items.map((item) => {
        const slug = typeof item.fieldData.slug === "string" ? item.fieldData.slug : "";
        const name = typeof item.fieldData.name === "string" ? item.fieldData.name : slug;
        const images = imageFieldSlugs
          .map((fieldSlug) => toImageFieldValue(fieldSlug, item.fieldData[fieldSlug]))
          .filter((image): image is ImageFieldValue => image !== null);
        return { id: item.id, slug, name, images };
      });

      return c.json({ items: pageItems, pagination });
    } catch (err) {
      console.error("GET /:siteId/collections/:collectionId/image-items failed", err);
      return c.json({ error: "webflow_api_error" }, 502);
    }
  },
);

cmsImagesRoutes.get(
  "/:siteId/image-reuses",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const rows = await db.select().from(cmsImageReuses).where(eq(cmsImageReuses.siteId, siteId));
    // Every site collaborator sees every reuse (same "a real team needs to
    // know what's already there" reasoning cmsGalleryConfigs' own GET
    // uses) - `isOwner` is what CmsImagesScreen.tsx uses to show Manage/
    // Delete as disabled for a reuse someone else created.
    return c.json(rows.map((row) => ({ ...row, isOwner: isConfigOwner(row, userId) })));
  },
);

// Called client-side ONLY after ImageElement.setAsset() has already
// succeeded (this route never itself touches the Designer or Webflow's own
// CMS/Assets API) - purely records that it happened, for the "Reused
// images" list.
cmsImagesRoutes.post(
  "/:siteId/image-reuses",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const body = createCmsImageReuseSchema.parse(await c.req.json());

    const [row] = await db
      .insert(cmsImageReuses)
      .values({ siteId, createdByUserId: userId, ...body })
      .returning();

    return c.json({ ...row, isOwner: true }, 201);
  },
);

// "Manage" - CmsImagesScreen.tsx re-locates the already-marked target
// element on the current page (via its own marker attribute, the row's
// `id`) and re-runs ImageElement.setAsset() BEFORE calling this - same
// "only ever records what already happened" posture as the POST above.
// collectionId is deliberately not updatable here, see
// updateCmsImageReuseSchema's own comment.
cmsImagesRoutes.patch(
  "/:siteId/image-reuses/:id",
  zValidator("param", siteIdParamSchema.extend({ id: z.string().min(1) }), onValidationError),
  async (c) => {
    const { siteId, id } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [existing] = await db
      .select({ createdByUserId: cmsImageReuses.createdByUserId })
      .from(cmsImageReuses)
      .where(and(eq(cmsImageReuses.id, id), eq(cmsImageReuses.siteId, siteId)))
      .limit(1);
    if (!existing) return c.json({ error: "not_found" }, 404);
    if (!isConfigOwner(existing, userId)) {
      return c.json({ error: "not_owner", message: "Only this reuse's creator can manage it." }, 403);
    }

    const body = updateCmsImageReuseSchema.parse(await c.req.json());

    const [row] = await db
      .update(cmsImageReuses)
      .set(body)
      .where(and(eq(cmsImageReuses.id, id), eq(cmsImageReuses.siteId, siteId)))
      .returning();

    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json({ ...row, isOwner: true });
  },
);

// Removes Fluxa's own bookkeeping row only - deliberately does NOT touch
// the real applied image on the target element (there's nothing to "clean
// up" there; Webflow's own Image element keeps working fine on its own
// once set, exactly like manually picking an asset in its own settings
// panel would). CmsImagesScreen.tsx best-effort clears the marker
// attribute client-side if the target happens to be on the current page.
cmsImagesRoutes.delete(
  "/:siteId/image-reuses/:id",
  zValidator("param", siteIdParamSchema.extend({ id: z.string().min(1) }), onValidationError),
  async (c) => {
    const { siteId, id } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const access = await getVerifiedInstallation(db, siteId, userId);
    if (access.status !== "ok") {
      return c.json(verifiedInstallationError(access), 403);
    }

    const [existing] = await db
      .select({ createdByUserId: cmsImageReuses.createdByUserId })
      .from(cmsImageReuses)
      .where(and(eq(cmsImageReuses.id, id), eq(cmsImageReuses.siteId, siteId)))
      .limit(1);
    if (!existing) return c.json({ error: "not_found" }, 404);
    if (!isConfigOwner(existing, userId)) {
      return c.json({ error: "not_owner", message: "Only this reuse's creator can remove it." }, 403);
    }

    await db.delete(cmsImageReuses).where(and(eq(cmsImageReuses.id, id), eq(cmsImageReuses.siteId, siteId)));
    return c.json({ ok: true });
  },
);
