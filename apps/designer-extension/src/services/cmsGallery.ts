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

// CmsImagesScreen.tsx's own step 1 - unlike the multi-image wizard above
// (which needs a real placed Collection List to discover a collection+its
// fields via the Designer API with zero backend round trip), "CMS images"
// has to work with NO Collection List anywhere involved at all ("cualquier
// parte del proyecto sin necesidad de instalar una collection list", per
// explicit direction) - there's nothing to select, so this goes through
// the real Webflow Data API instead (routes/cmsGallery.ts's own
// `GET /:siteId/collections`, built earlier but originally unused - this
// is what it was for). Real backend round trip, not instant like the
// Designer-API calls above.
export interface CmsSiteCollection {
  id: string;
  displayName: string;
  slug: string;
}

export async function fetchSiteCollections(siteId: string): Promise<CmsSiteCollection[]> {
  const { collections } = await apiFetch<{ collections: CmsSiteCollection[] }>(
    `/api/cms-gallery/${siteId}/collections`,
  );
  return collections;
}

// An element is either the Slug source or a gallery target, never both - a
// real case: the wizard's old step-5 slip marked the Slug text as the target
// too, which would make the published script mount the carousel into (and
// wipe) the very text it reads the slug from. Any target mark is cleared.
export async function markGallerySlugElement(element: AttributeCapableElement): Promise<void> {
  if ((await element.getAttributeValue(GALLERY_TARGET_ATTRIBUTE)) !== null) {
    await element.removeAttribute(GALLERY_TARGET_ATTRIBUTE);
  }
  if ((await element.getAttributeValue(GALLERY_CONFIG_ATTRIBUTE)) !== null) {
    await element.removeAttribute(GALLERY_CONFIG_ATTRIBUTE);
  }
  await element.setAttribute(GALLERY_SLUG_ATTRIBUTE, MARKER_VALUE);
}

// Checks, before marking, that the element the customer picked for the Slug
// step really shows the item's Slug field - a real, reported support case
// (2026-09-23): an element bound to the Name field got marked instead, and
// the published gallery rendered nothing at all with no hint why (the
// runtime script sends the element's text as the slug, and a title never
// matches one). getSettings() returns CMS bindings with their real
// `fieldType` (@webflow/designer-extension-typings' BindingValue - 'slug' is
// its own CmsFieldType). "unknown" covers every case where the binding
// can't be read at all (no elementSettings capability, an inline
// "containsBindings" value, a thrown call). Per explicit direction the
// wizard blocks on EVERY non-"ok" result (step 4 must be genuinely complete
// before step 5) - so if a correctly bound element is ever rejected, the
// console.warn below logs the raw getSettings() payload to see what the
// Designer API actually reported for it.
export type SlugBindingCheck =
  | { status: "ok" }
  | { status: "wrongField"; fieldName: string }
  | { status: "wrongCollection"; collectionName: string }
  | { status: "unbound" }
  | { status: "unknown" };

interface CmsBinding {
  sourceType: "cms";
  collectionId: string;
  collectionName: string;
  fieldName: string;
  fieldType: string;
}

function isCmsBinding(value: unknown): value is CmsBinding {
  return typeof value === "object" && value !== null && (value as { sourceType?: unknown }).sourceType === "cms";
}

function isUnsupportedSetting(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && (value as { sourceType?: unknown }).sourceType === "unsupported"
  );
}

// The display name of `collectionId`'s Slug field (the field whose reserved
// slug is "slug"), via any Collection List on the current page bound to that
// collection - no backend round trip. null when no such list is on the page
// or the lookup fails; the caller then falls back to Webflow's default name.
async function findSlugFieldName(collectionId: string): Promise<string | null> {
  try {
    const elements = await webflow.getAllElements();
    for (const element of elements.filter(isCollectionList)) {
      if ((await getCollectionId(element)) !== collectionId) continue;
      const fields = await element.searchAvailableFields();
      return fields.find((field) => field.slug === "slug")?.displayName ?? null;
    }
  } catch (error) {
    console.warn("Fluxa: couldn't read the collection's Slug field name", error);
  }
  return null;
}

export async function checkSlugBinding(
  element: AnyElement,
  collectionId: string | null,
): Promise<SlugBindingCheck> {
  if (!("elementSettings" in element) || element.elementSettings !== true) {
    console.warn("Fluxa: slug binding check - element has no elementSettings", element.type);
    return { status: "unknown" };
  }

  try {
    const settings = await element.getSettings();
    const values: unknown[] = Object.values(settings);
    const bindings = values.filter(isCmsBinding);

    if (bindings.length === 0) {
      console.warn("Fluxa: slug binding check found no CMS binding", element.type, JSON.stringify(settings));
      return values.some(isUnsupportedSetting) ? { status: "unknown" } : { status: "unbound" };
    }

    // Confirmed in the real Designer (2026-09-23): a text element bound to
    // the Slug field reports `fieldType: "plainText"`, `fieldName: "Slug"` -
    // NOT the 'slug' CmsFieldType, so fieldType alone rejects a correct
    // setup. The Slug field is identified by name instead, read from the
    // collection's own schema (its field with the reserved slug "slug") so
    // a renamed Slug field still matches; 'slug' fieldType is kept too in
    // case Webflow ever reports it that way.
    const slugFieldName = collectionId ? await findSlugFieldName(collectionId) : null;
    const slugBinding = bindings.find(
      (binding) => binding.fieldType === "slug" || binding.fieldName === (slugFieldName ?? "Slug"),
    );
    if (slugBinding) {
      return collectionId && slugBinding.collectionId !== collectionId
        ? { status: "wrongCollection", collectionName: slugBinding.collectionName }
        : { status: "ok" };
    }
    return { status: "wrongField", fieldName: bindings[0].fieldName };
  } catch (error) {
    console.warn("Fluxa: slug binding check threw", error);
    return { status: "unknown" };
  }
}

export async function isGallerySlugElement(element: AttributeCapableElement): Promise<boolean> {
  return (await element.getAttributeValue(GALLERY_SLUG_ATTRIBUTE)) === MARKER_VALUE;
}

// Clears a Slug mark an earlier (pre-validation) attempt left on an element
// that turns out not to be bound to the Slug field - otherwise the published
// script would still pick it up and send its text as the slug.
export async function unmarkGallerySlugElement(element: AttributeCapableElement): Promise<void> {
  if (await isGallerySlugElement(element)) await element.removeAttribute(GALLERY_SLUG_ATTRIBUTE);
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
  // Computed server-side (routes/cmsGallery.ts's own countGalleryImages) -
  // the real total image count across every live item's multi-image field,
  // summed via a paginated Webflow read. null only when that aggregation
  // itself failed (a real Webflow API error) - the list itself still
  // renders, WebflowSolutionsScreen.tsx just shows "-" for that one row's
  // count rather than blocking the whole list.
  imageCount: number | null;
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

// "Handle CMS visibility" (WebflowSolutionsScreen.tsx's "Handle CMS
// visibility" row -> CmsVisibilityScreen.tsx) - lets a customer hide/show a
// Collection Item on ANY collection placed on the current Designer page,
// whether or not a Fluxa gallery is even configured for it. Same
// zero-backend-round-trip discovery pattern as isCollectionList/
// getCollectionId above: `webflow.getAllElements()` is already page-scoped
// (same documented, accepted limitation AppliedGradientsMenu's own
// findAppliedGradients() has - a component only entered via
// webflow.enterComponent() wouldn't be reached either), and
// searchAvailableSources() (any DynamoWrapperElement, not just this one's
// own connected source) is what actually resolves a collectionId to a real,
// human display name with no backend call.
export interface CmsCollectionSummary {
  collectionId: string;
  displayName: string;
}

export async function discoverPageCollections(): Promise<CmsCollectionSummary[]> {
  const elements = await webflow.getAllElements();
  const collectionLists = elements.filter(isCollectionList);
  if (collectionLists.length === 0) return [];

  const ids = await Promise.all(collectionLists.map((el) => getCollectionId(el)));
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return [];

  // Any one Collection List's own searchAvailableSources() already lists
  // every collection in the site (not just the ones this element/page
  // happens to use) - only need to call it once, on whichever element was
  // found first.
  const sources = await collectionLists[0].searchAvailableSources();
  const nameById = new Map(sources.map((source) => [source.collectionId, source.displayName]));

  return uniqueIds.map((collectionId) => ({
    collectionId,
    // Falls back to the raw id rather than dropping the collection entirely
    // - searchAvailableSources() not listing a collectionId that a real,
    // connected Collection List on the page reports would be unexpected,
    // but showing *something* beats silently hiding a real collection.
    displayName: nameById.get(collectionId) ?? collectionId,
  }));
}

export interface CmsVisibilityItem {
  id: string;
  slug: string;
  name: string;
  hidden: boolean;
}

export interface CmsVisibilityPage {
  items: CmsVisibilityItem[];
  pagination: { limit: number; offset: number; total: number };
}

export function fetchCollectionVisibilityItems(
  siteId: string,
  collectionId: string,
  params: { limit: number; offset: number },
): Promise<CmsVisibilityPage> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return apiFetch<CmsVisibilityPage>(
    `/api/cms-gallery/${siteId}/collections/${collectionId}/items?${query.toString()}`,
  );
}

export function saveCollectionItemVisibility(
  siteId: string,
  collectionId: string,
  itemSlug: string,
  hidden: boolean,
): Promise<{ hidden: boolean }> {
  return apiFetch(
    `/api/cms-gallery/${siteId}/collections/${collectionId}/items/${encodeURIComponent(itemSlug)}/visibility`,
    { method: "PUT", body: JSON.stringify({ hidden }) },
  );
}

// The "Hide all posts?" master switch at the top of CmsVisibilityScreen.tsx -
// see data-client's db/app-schema.ts's cmsSiteVisibilitySettings comment for
// the override semantics (it forces every post hidden without touching any
// individual post's own stored state).
export function fetchCmsVisibilitySettings(siteId: string): Promise<{ hideAllPosts: boolean }> {
  return apiFetch(`/api/cms-gallery/${siteId}/visibility-settings`);
}

export function saveCmsVisibilitySettings(
  siteId: string,
  hideAllPosts: boolean,
): Promise<{ hideAllPosts: boolean }> {
  return apiFetch(`/api/cms-gallery/${siteId}/visibility-settings`, {
    method: "PUT",
    body: JSON.stringify({ hideAllPosts }),
  });
}
