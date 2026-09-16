import { z } from "zod";

// Native Webflow div styling on the marked target element (class + inline
// style) already carries over to the rendered carousel wrapper - see
// cmsGalleryEmbedScript.ts's own comment on `wrap.className = target.className`
// - so size/border/background are deliberately NOT settings here, only
// things the customer genuinely can't reach through the Designer's own
// Style panel: what the script renders *inside* that box.
export const cmsGallerySettingsSchema = z.object({
  showArrows: z.boolean().default(true),
  showDots: z.boolean().default(true),
  autoplay: z.boolean().default(true),
  autoplayIntervalMs: z.number().int().min(1000).max(20000).default(5000),
  objectFit: z.enum(["cover", "contain"]).default("cover"),
});

export type CmsGallerySettings = z.infer<typeof cmsGallerySettingsSchema>;

export const createCmsGalleryConfigSchema = z.object({
  collectionId: z.string().min(1),
  fieldSlug: z.string().min(1),
  settings: cmsGallerySettingsSchema.partial().optional(),
});

export const updateCmsGalleryConfigSettingsSchema = z.object({
  settings: cmsGallerySettingsSchema.partial(),
});

// The picker (routes/cmsGalleryItems.ts) always sends the item's FULL
// current selection state on save, not an incremental toggle - simpler than
// diffing against whatever's already stored, and matches how the UI itself
// works (a checkbox list, not a series of individual add/remove actions).
export const setCmsGalleryItemOverrideSchema = z.object({
  hidden: z.boolean().default(false),
  hiddenImageIds: z.array(z.string()).default([]),
});

// webflow.getIdToken() (Designer API) - never a client-submitted siteId, see
// routes/cmsGallery.ts's own POST /:siteId/verify comment for why that
// distinction is the whole point of this endpoint.
export const verifySiteSchema = z.object({
  idToken: z.string().min(1),
});
