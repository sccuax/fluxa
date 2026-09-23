import { apiFetch } from "./apiClient";

// "Webflow Solutions" feature #3: reuse a single CMS image (any `Image`-
// type field - the OTHER feature, the multi-image gallery, is `MultiImage`
// fields) on any real Webflow `Image` element anywhere in the project.
// Unlike that gallery, applying the image needs NO custom code, NO HTML
// Embed, and NO published-site runtime at all: `ImageElement.setAsset()`
// and the top-level `webflow.getAssetById()` are both real Designer API
// methods (confirmed against the installed
// @webflow/designer-extension-typings package, not assumed) that set a
// genuine native image binding directly - functionally identical to a
// person manually picking that same asset in the element's own Settings
// panel. This file only covers the panel side: collection discovery
// (reusing services/cmsGallery.ts's own Collection List detection for step
// 1), the per-item/per-field image picker (step 3, backend-backed since an
// arbitrary collection's own field schema needs Webflow's Data API - the
// Designer API's searchAvailableFields() only ever describes the
// currently-SELECTED list's own already-connected collection, not an
// arbitrary one picked afterward), and marking/applying the target Image
// element (step 4).

export type ImageTargetElement = Extract<AnyElement, { type: "Image" }>;

export function isImageElement(element: AnyElement | null): element is ImageTargetElement {
  return element !== null && "type" in element && element.type === "Image";
}

// Same "one attribute, whose VALUE is the config id" shape
// cmsGallery.ts's own GALLERY_TARGET_ATTRIBUTE/GALLERY_CONFIG_ATTRIBUTE
// pair uses (there, split into two attributes since the target needed a
// separate boolean marker; here there's only ever one reuse per marked
// element, so a single attribute suffices).
export const CMS_IMAGE_TARGET_ATTRIBUTE = "data-fluxa-cms-image-config";

export async function markImageTarget(element: ImageTargetElement, configId: string): Promise<void> {
  await element.setAttribute(CMS_IMAGE_TARGET_ATTRIBUTE, configId);
}

// Sets the real, native image binding - no custom code involved at all.
//
// Real, observed issue: a CMS Image field's own `fileId` (the identifier
// Webflow's Data API returns for it, developers.webflow.com/data/reference/
// field-types-item-values) doesn't reliably resolve via the Designer API's
// `getAssetById()` - confirmed against Webflow's own docs that this
// pairing is simply never documented as guaranteed, and confirmed in
// practice (a real report: a genuinely still-present CMS image's own
// `fileId` came back `null`, not a real "this was deleted" case). Both
// APIs manage the same site's asset library, but a CMS field's own file
// reference isn't proven to always be a Designer-visible Asset id - most
// likely for images set via the CMS API/CSV import/an external URL rather
// than through the Designer's own Assets panel or CMS editor.
//
// Rather than fail outright on that gap, this falls back to re-uploading
// the image from its own public CDN `sourceUrl` as a brand-new site asset
// via `webflow.createAsset()` (also a real Designer API method) and using
// THAT instead. The one real cost on this fallback path is a duplicate
// entry in the site's Assets panel - accepted, since correctness (the
// image actually gets applied) matters more here than a perfectly tidy
// Assets list, and it only ever triggers when the direct id lookup fails,
// not on every apply.
export async function applyImageToElement(
  element: ImageTargetElement,
  assetId: string,
  sourceUrl: string,
): Promise<void> {
  let asset = await webflow.getAssetById(assetId);
  if (!asset) {
    let response: Response;
    try {
      response = await fetch(sourceUrl);
    } catch {
      throw new Error(
        "This image's original file couldn't be found in your Assets, and re-downloading it failed too.",
      );
    }
    if (!response.ok) {
      throw new Error(
        "This image's original file couldn't be found in your Assets, and re-downloading it failed too.",
      );
    }
    const blob = await response.blob();
    const filename = sourceUrl.split("/").pop()?.split("?")[0] || "reused-image";
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    asset = await webflow.createAsset(file);
  }
  await element.setAsset(asset);
}

// Mirrors applyGradient.ts's own findAppliedGradients() convention exactly:
// scans the CURRENT page (webflow.getAllElements(), the Designer API's own
// doc comment confirms this is page/component-scoped, not site-wide - same
// real, already-documented, accepted limitation that scan already has
// everywhere else in this app) for the one Image element carrying this
// specific reuse's own marker attribute. Used by "Manage" (re-picking a
// different image for an already-marked target) and by Delete (best-effort
// clearing the marker if the target happens to be on the current page).
export async function findImageReuseTarget(configId: string): Promise<ImageTargetElement | null> {
  const elements = await webflow.getAllElements();
  for (const element of elements) {
    if (!isImageElement(element)) continue;
    if ((await element.getAttributeValue(CMS_IMAGE_TARGET_ATTRIBUTE)) === configId) {
      return element;
    }
  }
  return null;
}

// Step 3's picker - one page of a collection's real live items, each with
// every one of its own Image-type fields' current value (a post can have
// more than one single-image field - a thumbnail AND a cover photo, say).
export interface CmsImageFieldValue {
  fieldSlug: string;
  fileId: string | null;
  url: string;
  alt: string | null;
}

export interface CmsImageItem {
  id: string;
  slug: string;
  name: string;
  images: CmsImageFieldValue[];
}

export interface CmsImageItemsPage {
  items: CmsImageItem[];
  pagination: { limit: number; offset: number; total: number };
}

export function fetchCollectionImageItems(
  siteId: string,
  collectionId: string,
  params: { limit: number; offset: number },
): Promise<CmsImageItemsPage> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return apiFetch<CmsImageItemsPage>(
    `/api/cms-images/${siteId}/collections/${collectionId}/image-items?${query.toString()}`,
  );
}

// The "Reused images" list (CmsImagesScreen.tsx's own top-level view) -
// pure bookkeeping, see data-client's db/app-schema.ts's cmsImageReuses
// comment for why there's nothing else this needs to power (no
// published-site runtime reads this at all).
export interface CmsImageReuseConfig {
  id: string;
  siteId: string;
  collectionId: string;
  itemSlug: string;
  itemName: string;
  fieldSlug: string;
  assetId: string;
  createdByUserId: string | null;
  createdAt: string;
  isOwner: boolean;
}

export function fetchImageReuses(siteId: string): Promise<CmsImageReuseConfig[]> {
  return apiFetch<CmsImageReuseConfig[]>(`/api/cms-images/${siteId}/image-reuses`);
}

export interface ImageReuseBody {
  itemSlug: string;
  itemName: string;
  fieldSlug: string;
  assetId: string;
}

// Called client-side ONLY after applyImageToElement() has already
// succeeded - see routes/cmsImages.ts's own comment.
export function createImageReuse(
  siteId: string,
  body: ImageReuseBody & { collectionId: string },
): Promise<CmsImageReuseConfig> {
  return apiFetch<CmsImageReuseConfig>(`/api/cms-images/${siteId}/image-reuses`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateImageReuse(
  siteId: string,
  id: string,
  body: ImageReuseBody,
): Promise<CmsImageReuseConfig> {
  return apiFetch<CmsImageReuseConfig>(`/api/cms-images/${siteId}/image-reuses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteImageReuse(siteId: string, id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/cms-images/${siteId}/image-reuses/${id}`, { method: "DELETE" });
}
