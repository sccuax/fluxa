import { apiFetch } from "./apiClient";

// "Webflow Solutions" feature #1: multi-image CMS fields inside a Collection
// List. Webflow has no native way to bind a multi-image field to anything
// (confirmed: no Code Component prop type for it, and setCustomAttribute's
// CMS-binding UI has no Designer API equivalent) - the real fix is Fluxa
// marking two elements inside the Collection List's own item template with
// plain HTML attributes (setAttribute, NOT Webflow's "Custom Attributes"
// panel feature - see applyGradient.ts's own marker for the same
// distinction), then a published-site runtime script reads those markers
// per rendered item and fetches the real image list from
// apps/data-client's routes/publicCmsGallery.ts. This file only covers the
// panel side: discovering the collection + its multi-image fields via the
// real Designer API, creating the backend config row, and marking elements.

// Exported - cmsGalleryEmbedScript.ts's runtime script (baked into the
// published/preview page) has to look for the exact same attribute names
// this panel writes, so both sides read from one literal definition instead
// of two copies that could drift.
export const GALLERY_SLUG_ATTRIBUTE = "data-fluxa-gallery-slug";
export const GALLERY_TARGET_ATTRIBUTE = "data-fluxa-gallery-target";
export const GALLERY_CONFIG_ATTRIBUTE = "data-fluxa-gallery-config";
const MARKER_VALUE = "true";

// DynamoWrapperElement is the Collection List wrapper itself (Webflow's own
// Designer typings, elements-generated.d.ts) - its getSettings()/
// searchAvailableFields() are what let this whole feature discover a
// collection and its fields with zero backend round trip, unlike the
// research trail's earlier (wrong) assumption that this needed the Data API.
export type CollectionListElement = Extract<AnyElement, { type: "DynamoWrapper" }>;

export function isCollectionList(element: AnyElement | null): element is CollectionListElement {
  return element !== null && "type" in element && element.type === "DynamoWrapper";
}

// The generic HTML-attribute capability (Attributes mixin) - most concrete
// element types have it, but AnyElement includes members that don't (e.g.
// UnknownElement), so this has to be checked for real, same pattern
// applyGradient.ts's own canApplyPreset guard uses for `children`/`styles`.
export type AttributeCapableElement = Extract<AnyElement, { attributes: true }>;

export function canMarkElement(element: AnyElement | null): element is AttributeCapableElement {
  return element !== null && "attributes" in element && element.attributes === true;
}

export interface MultiImageField {
  slug: string;
  displayName: string;
}

export async function getCollectionId(collectionList: CollectionListElement): Promise<string | null> {
  const settings = await collectionList.getSettings();
  return settings.source?.collectionId ?? null;
}

export async function getMultiImageFields(
  collectionList: CollectionListElement,
): Promise<MultiImageField[]> {
  const fields = await collectionList.searchAvailableFields();
  return fields
    .filter((field) => field.fieldType === "multiImage")
    .map((field) => ({ slug: field.slug, displayName: field.displayName }));
}

export async function markGallerySlugElement(element: AttributeCapableElement): Promise<void> {
  await element.setAttribute(GALLERY_SLUG_ATTRIBUTE, MARKER_VALUE);
}

export async function isGallerySlugElement(element: AttributeCapableElement): Promise<boolean> {
  return (await element.getAttributeValue(GALLERY_SLUG_ATTRIBUTE)) === MARKER_VALUE;
}

// The target also carries which gallery config it renders (GALLERY_CONFIG_ATTRIBUTE)
// so a page with more than one CMS gallery set up still resolves each target
// to the right collection/field independently - the runtime script never
// has to guess or assume "one gallery per page".
export async function markGalleryTargetElement(
  element: AttributeCapableElement,
  configId: string,
): Promise<void> {
  await element.setAttribute(GALLERY_TARGET_ATTRIBUTE, MARKER_VALUE);
  await element.setAttribute(GALLERY_CONFIG_ATTRIBUTE, configId);
}

export async function getGalleryTargetConfigId(element: AttributeCapableElement): Promise<string | null> {
  const marked = (await element.getAttributeValue(GALLERY_TARGET_ATTRIBUTE)) === MARKER_VALUE;
  if (!marked) return null;
  const configId = await element.getAttributeValue(GALLERY_CONFIG_ATTRIBUTE);
  return typeof configId === "string" ? configId : null;
}

// Kept in sync by hand with apps/data-client's schema/cmsGallery.ts
// (cmsGallerySettingsSchema) and cmsGalleryEmbedScript.ts's own
// DEFAULT_SETTINGS - three copies of the same shape/defaults across two
// apps, same situation gradientEmbedScript.ts's adaptivePixelDensity
// formula is already in, for the same reason (the published-site runtime
// script can't import a workspace package).
export interface CmsGallerySettings {
  showArrows: boolean;
  showDots: boolean;
  autoplay: boolean;
  autoplayIntervalMs: number;
  objectFit: "cover" | "contain";
}

export const DEFAULT_GALLERY_SETTINGS: CmsGallerySettings = {
  showArrows: true,
  showDots: true,
  autoplay: true,
  autoplayIntervalMs: 5000,
  objectFit: "cover",
};

export interface CmsGalleryConfig extends CmsGallerySettings {
  id: string;
  siteId: string;
  collectionId: string;
  fieldSlug: string;
  createdAt: string;
  // Computed server-side (routes/cmsGallery.ts's own isConfigOwner) - true
  // when the current signed-in Fluxa account created this gallery, or when
  // it has no recorded creator at all (a row from before this existed).
  // Every site collaborator sees every config; this is what drives
  // WebflowSolutionsScreen.tsx's disabled state for one that isn't theirs.
  isOwner: boolean;
}

// Proves this session's own Designer really is looking at `siteId` right
// now (a fresh webflow.getIdToken(), resolved server-side against Webflow
// itself) and has the backend remember that for ~15 minutes
// (data-client's routes/cmsGallery.ts, SITE_VERIFICATION_TTL_MS) - every
// other cms-gallery call below 403s with "not_verified" until this has run
// at least once. Called once per WebflowSolutionsScreen mount, not per
// request - see that screen's own mount effect for why (the Webflow round
// trip this makes is real, ~400-700ms observed, not worth repeating per
// click).
export function verifySiteAccess(siteId: string, idToken: string): Promise<{ verified: true; expiresAt: string }> {
  return apiFetch(`/api/cms-gallery/${siteId}/verify`, {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export function fetchGalleryConfigs(siteId: string): Promise<CmsGalleryConfig[]> {
  return apiFetch<CmsGalleryConfig[]>(`/api/cms-gallery/${siteId}/gallery-configs`);
}

export function createGalleryConfig(
  siteId: string,
  body: { collectionId: string; fieldSlug: string },
): Promise<CmsGalleryConfig> {
  return apiFetch<CmsGalleryConfig>(`/api/cms-gallery/${siteId}/gallery-configs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Read live by routes/publicCmsGallery.ts on every published-site request -
// no need to re-run "Install gallery script" after changing these (see that
// route's own comment).
export function updateGalleryConfigSettings(
  siteId: string,
  id: string,
  settings: Partial<CmsGallerySettings>,
): Promise<CmsGalleryConfig> {
  return apiFetch<CmsGalleryConfig>(`/api/cms-gallery/${siteId}/gallery-configs/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ settings }),
  });
}

export function deleteGalleryConfig(siteId: string, id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/cms-gallery/${siteId}/gallery-configs/${id}`, {
    method: "DELETE",
  });
}

// Powers the "Manage images" picker - one page of the config's real
// Collection items, each with its multi-image field's images and any
// existing hide-state already merged in server-side (routes/cmsGallery.ts).
export interface GalleryPickerImage {
  fileId: string | null;
  url: string;
  alt: string | null;
}

export interface GalleryPickerItem {
  id: string;
  slug: string;
  name: string;
  images: GalleryPickerImage[];
  hidden: boolean;
  hiddenImageIds: string[];
}

export interface GalleryPickerPage {
  items: GalleryPickerItem[];
  pagination: { limit: number; offset: number; total: number };
}

export function fetchGalleryItems(
  siteId: string,
  configId: string,
  params: { limit: number; offset: number },
): Promise<GalleryPickerPage> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return apiFetch<GalleryPickerPage>(
    `/api/cms-gallery/${siteId}/gallery-configs/${configId}/items?${query.toString()}`,
  );
}

// Always sends the item's full current selection state, not an incremental
// toggle - see setCmsGalleryItemOverrideSchema's own comment (data-client's
// schema/cmsGallery.ts) for why.
export function saveGalleryItemOverride(
  siteId: string,
  configId: string,
  itemSlug: string,
  override: { hidden: boolean; hiddenImageIds: string[] },
): Promise<{ hidden: boolean; hiddenImageIds: string[] }> {
  return apiFetch(
    `/api/cms-gallery/${siteId}/gallery-configs/${configId}/items/${encodeURIComponent(itemSlug)}/override`,
    { method: "PUT", body: JSON.stringify(override) },
  );
}
