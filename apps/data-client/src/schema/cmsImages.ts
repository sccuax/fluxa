import { z } from "zod";

// "CMS images" (routes/cmsImages.ts) - a real reuse row is only ever
// created client-side AFTER `ImageElement.setAsset()` has already
// succeeded (see the designer-extension's services/cmsImages.ts), so this
// is pure bookkeeping - every field here is just what the panel already
// knows at that point, nothing this schema itself needs to re-derive or
// validate against Webflow.
export const createCmsImageReuseSchema = z.object({
  collectionId: z.string().min(1),
  itemSlug: z.string().min(1),
  itemName: z.string().min(1),
  fieldSlug: z.string().min(1),
  assetId: z.string().min(1),
});

// "Manage" (re-picking a different image for an already-marked target) -
// collectionId is deliberately NOT here: CmsImagesScreen.tsx's own Manage
// flow reuses the reuse row's existing collectionId rather than letting it
// change, so this only ever updates which post/field/asset within that
// same collection is applied.
export const updateCmsImageReuseSchema = z.object({
  itemSlug: z.string().min(1),
  itemName: z.string().min(1),
  fieldSlug: z.string().min(1),
  assetId: z.string().min(1),
});
