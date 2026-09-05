import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { createGalleryPresetSchema, updateGalleryPresetSchema } from "@fluxa/gradient-core";
import type { AppEnv } from "../types";
import { createDb } from "../db/client";
import { galleryPresets } from "../db/schema";
import { requireAdminToken } from "../middleware/requireAdminToken";

// Fluxa's own curated preset gallery - see db/app-schema.ts's galleryPresets
// table comment for how this differs from routes/presets.ts (a customer's
// own per-site saved presets). Every route on *this* router is admin-only
// (requireAdminToken) - the only consumer is apps/preset-admin, which also
// needs to see unpublished drafts, so this can't be the same route the
// Designer Extension reads from. See publicGalleryPresetRoutes below for
// that one.
export const galleryPresetRoutes = new Hono<AppEnv>();

galleryPresetRoutes.use(requireAdminToken);

galleryPresetRoutes.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const results = await db
    .select()
    .from(galleryPresets)
    .orderBy(desc(galleryPresets.createdAt));

  return c.json(results);
});

galleryPresetRoutes.post("/", async (c) => {
  const body = createGalleryPresetSchema.parse(await c.req.json());
  const db = createDb(c.env.DATABASE_URL);

  const [row] = await db.insert(galleryPresets).values(body).returning();

  return c.json(row, 201);
});

galleryPresetRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  // updateGalleryPresetSchema, not createGalleryPresetSchema.partial() - a
  // plain z.discriminatedUnion has no .partial() of its own (only a flat
  // z.object does), so `kind` stays required on every PATCH even though
  // every other field is optional - see that schema's own comment in
  // gradient-core for why. A caller only toggling isPublished still needs
  // to send `kind` alongside it.
  const body = updateGalleryPresetSchema.parse(await c.req.json());
  const db = createDb(c.env.DATABASE_URL);

  const [row] = await db
    .update(galleryPresets)
    .set(body)
    .where(eq(galleryPresets.id, id))
    .returning();

  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
});

// Admin-captured thumbnail upload - a separate route from the general
// PATCH above, same reason routes/profile.ts's avatar upload is its own
// route rather than a field on a general "update user" body: this is a
// binary file upload (multipart/form-data), not a JSON patch. apps/
// preset-admin's "Capture thumbnail" button draws the live GradientCanvas's
// actual WebGL canvas onto an offscreen 2D canvas (center-cropped to this
// route's own expected aspect ratio) and encodes it as WebP client-side
// before POSTing here - this route trusts that encoding already happened
// and only re-validates size/MIME, it doesn't do any image processing of
// its own (Workers has no built-in raster image codec to lean on for that).
const MAX_THUMBNAIL_BYTES = 500 * 1024;

// Shared by the replace-on-reupload cleanup below and the delete-on-preset-
// removal cleanup further down - both need to turn a stored thumbnailUrl
// back into the bare R2 key to delete it, and both need to do it the same
// way (only ever touch R2 for a URL that's actually one of *our* thumbnail
// URLs - a stray/foreign value in this column, however unlikely, should
// never be treated as an R2 key to delete).
function thumbnailKeyFromUrl(url: string, requestUrl: string): string | null {
  const prefix = `${new URL(requestUrl).origin}/api/public/gallery-presets/thumbnail/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

galleryPresetRoutes.post("/:id/thumbnail", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ error: "invalid_request" }, 400);
  }
  if (file.type !== "image/webp") {
    return c.json({ error: "unsupported_file_type" }, 400);
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    return c.json({ error: "file_too_large" }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);

  // Same "read the old value before the UPDATE overwrites it" ordering
  // routes/profile.ts's avatar upload already had to get right - a
  // .returning() on the UPDATE reflects the row *after* the update, not
  // before, so reading the previous key that way would read back the
  // brand-new URL instead of the one being replaced.
  const [existing] = await db
    .select({ thumbnailUrl: galleryPresets.thumbnailUrl })
    .from(galleryPresets)
    .where(eq(galleryPresets.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const key = `${id}-${crypto.randomUUID()}.webp`;
  await c.env.PRESET_THUMBNAILS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const thumbnailUrl = `${new URL(c.req.url).origin}/api/public/gallery-presets/thumbnail/${key}`;

  const [row] = await db
    .update(galleryPresets)
    .set({ thumbnailUrl })
    .where(eq(galleryPresets.id, id))
    .returning();

  // Best-effort cleanup of the object this preset's thumbnail used to point
  // at, if any - otherwise every re-capture (a normal, expected action while
  // an admin is iterating on a preset) leaves the previous one orphaned in
  // the bucket forever.
  const previousKey = existing.thumbnailUrl && thumbnailKeyFromUrl(existing.thumbnailUrl, c.req.url);
  if (previousKey) {
    await c.env.PRESET_THUMBNAILS.delete(previousKey).catch((error) => {
      console.error("Failed to delete previous preset thumbnail from R2", error);
    });
  }

  return c.json(row);
});

galleryPresetRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env.DATABASE_URL);

  // DELETE...RETURNING gives back the row as it was right before deletion -
  // requesting thumbnailUrl here (not just id) is what lets the R2 cleanup
  // below happen without a separate SELECT first.
  const [row] = await db
    .delete(galleryPresets)
    .where(eq(galleryPresets.id, id))
    .returning({ id: galleryPresets.id, thumbnailUrl: galleryPresets.thumbnailUrl });

  if (!row) return c.json({ error: "not_found" }, 404);

  // Best-effort - a preset's thumbnail (if it had one) has no other owner
  // once the row itself is gone, so leaving it behind would just orphan it
  // in the bucket forever. Same reasoning/pattern as the re-capture cleanup
  // above.
  const orphanedKey = row.thumbnailUrl && thumbnailKeyFromUrl(row.thumbnailUrl, c.req.url);
  if (orphanedKey) {
    await c.env.PRESET_THUMBNAILS.delete(orphanedKey).catch((error) => {
      console.error("Failed to delete preset's thumbnail from R2 on preset delete", error);
    });
  }
  return c.json({ ok: true });
});

// A genuinely separate Hono instance, mounted at a genuinely separate URL
// prefix in index.ts ("/api/public/gallery-presets", not
// "/api/gallery-presets") - NOT just a different sub-path under the same
// prefix as galleryPresetRoutes above. Confirmed by testing (not assumed):
// mounting two Hono sub-apps at the *same* prefix does not isolate their
// middleware from each other - `.use()` with no path filter, once mounted,
// matches every path under that prefix regardless of which sub-app's route
// table a given path actually came from, so a first attempt at
// "/api/gallery-presets/published" on a second router still hit
// requireAdminToken and 401'd. A distinct prefix is what actually avoids
// that middleware's wildcard match.
//
// The Designer Extension's PresetsTab.tsx reads from this - no session or
// token required, since a published gallery preset is meant to be visible
// to every Fluxa customer, not gated content. Only ever returns
// isPublished: true rows; a draft an admin is still iterating on in
// apps/preset-admin never reaches here.
export const publicGalleryPresetRoutes = new Hono<AppEnv>();

publicGalleryPresetRoutes.get("/published", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const results = await db
    .select()
    .from(galleryPresets)
    .where(eq(galleryPresets.isPublished, true))
    .orderBy(desc(galleryPresets.createdAt));

  return c.json(results);
});

// Public, no auth - re-serves an R2 object the same way routes/profile.ts's
// avatar GET does (see that route's own comment for the crossOriginResourcePolicy
// note - index.ts's global secureHeaders() override already covers this
// route too, nothing extra needed here). Cache-Control is immutable: every
// upload (including a re-capture replacing an old thumbnail) gets a fresh
// crypto.randomUUID() key, so a given URL's bytes never change.
publicGalleryPresetRoutes.get("/thumbnail/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.PRESET_THUMBNAILS.get(key);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
