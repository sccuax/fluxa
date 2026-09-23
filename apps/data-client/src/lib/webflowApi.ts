const WEBFLOW_API_BASE = "https://api.webflow.com/v2";
const WEBFLOW_AUTHORIZE_URL = "https://webflow.com/oauth/authorize";
const WEBFLOW_TOKEN_URL = "https://api.webflow.com/oauth/access_token";
// Beta path, not /v2 - see routes/auth.ts's own authorized_user:read comment.
const WEBFLOW_RESOLVE_ID_TOKEN_URL = "https://api.webflow.com/beta/token/resolve";

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}) {
  const url = new URL(WEBFLOW_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", params.scopes.join(" "));
  return url.toString();
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) {
  const response = await fetch(WEBFLOW_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      grant_type: "authorization_code",
      // Required per OAuth2 (RFC 6749 4.1.3) whenever redirect_uri was sent
      // in the authorize request, which buildAuthorizeUrl above always does
      // - Webflow rejects the exchange with a 400 if it's missing here.
      redirect_uri: params.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webflow token exchange failed: ${response.status}`);
  }

  return response.json() as Promise<{ access_token: string }>;
}

// Resolves which site(s) an installation's access token grants access to -
// GET /v2/sites, scope sites:read (already requested, see SCOPES in
// routes/auth.ts). Webflow's standard Site-level Marketplace App install
// flow (user installs from a specific site's Apps panel) scopes the
// resulting token to exactly that one site, so callers should normally
// expect a single-element array - verified against
// https://developers.webflow.com/data/reference/sites/list.
export async function listAuthorizedSites(params: { accessToken: string }) {
  const response = await fetch(`${WEBFLOW_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Webflow site list failed: ${response.status}`);
  }

  return response.json() as Promise<{ sites: Array<{ id: string; displayName?: string }> }>;
}

// --- CMS (Webflow Solutions: multi-image-in-Collection-List feature) ------
// Scope cms:read (added to SCOPES in routes/auth.ts). Shapes below are our
// best-known read of https://developers.webflow.com/data/reference/cms/* -
// verify against the real API response the first time this is exercised
// live, same caution createAssetUpload's own comment gives.

export interface WebflowCollectionSummary {
  id: string;
  displayName: string;
  slug: string;
}

export async function listSiteCollections(params: {
  accessToken: string;
  siteId: string;
}): Promise<{ collections: WebflowCollectionSummary[] }> {
  const response = await fetch(`${WEBFLOW_API_BASE}/sites/${params.siteId}/collections`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Webflow collection list failed: ${response.status}`);
  }

  return response.json() as Promise<{ collections: WebflowCollectionSummary[] }>;
}

export interface WebflowCollectionField {
  id: string;
  slug: string;
  displayName: string;
  type: string;
}

// Full collection details including its field schema - `type` is compared
// against the literal string "MultiImage" by routes/cmsGallery.ts to find
// the field(s) this whole feature can actually target (see that route for
// why: no other Webflow mechanism - Code Component prop types included -
// can bind a multi-image field to anything).
export async function getCollectionDetails(params: {
  accessToken: string;
  collectionId: string;
}): Promise<{ id: string; displayName: string; fields: WebflowCollectionField[] }> {
  const response = await fetch(`${WEBFLOW_API_BASE}/collections/${params.collectionId}`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Webflow collection details fetch failed: ${response.status}`);
  }

  return response.json() as Promise<{ id: string; displayName: string; fields: WebflowCollectionField[] }>;
}

export interface WebflowCollectionItem {
  id: string;
  fieldData: Record<string, unknown>;
}

// Resolves one *live* (published) item by its slug - the identifier
// routes/publicCmsGallery.ts's runtime script actually has available in the
// rendered DOM (see the designer-extension CLAUDE.md's "CMS gallery" section
// for the marker-attribute mechanism that puts it there). Live, not staged,
// data - a published site's own visitors should never see an unpublished
// draft's images. Filtering server-side by `slug` (not a full unfiltered
// list) since a collection can hold far more items than the one requested.
export async function getLiveCollectionItemBySlug(params: {
  accessToken: string;
  collectionId: string;
  slug: string;
}): Promise<WebflowCollectionItem | null> {
  const url = new URL(`${WEBFLOW_API_BASE}/collections/${params.collectionId}/items/live`);
  url.searchParams.set("slug", params.slug);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Webflow live item lookup failed: ${response.status}`);
  }

  const body = (await response.json()) as { items?: WebflowCollectionItem[] };
  return body.items?.[0] ?? null;
}

// Paginated live-items list, for the image picker (routes/cmsGalleryItems.ts)
// rather than a single-slug lookup - passes `limit`/`offset` straight
// through to Webflow's own List Live Items endpoint (max 100 per Webflow's
// own documented cap) instead of aggregating every page server-side, so a
// large collection paginates the same way in our own picker UI ("Load
// more") rather than one slow/huge request. Live, same reasoning
// getLiveCollectionItemBySlug's own comment gives - the picker should show
// exactly what a real visitor would see, not an unpublished draft.
export interface WebflowItemsPage {
  items: WebflowCollectionItem[];
  pagination: { limit: number; offset: number; total: number };
}

export async function listLiveCollectionItems(params: {
  accessToken: string;
  collectionId: string;
  limit: number;
  offset: number;
}): Promise<WebflowItemsPage> {
  const url = new URL(`${WEBFLOW_API_BASE}/collections/${params.collectionId}/items/live`);
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Webflow live items list failed: ${response.status}`);
  }

  return response.json() as Promise<WebflowItemsPage>;
}

// Verifies a webflow.getIdToken() value server-side against Webflow itself -
// used by POST /api/link-installation to trust a *verified* siteId, never a
// client-submitted one (see that route's own comment). `accessToken` here
// just needs authorized_user:read from THIS app (any installation's token
// works, not necessarily the one for the site the idToken names) - see
// routes/auth.ts's SCOPES comment.
export interface ResolvedIdToken {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  siteId: string;
}

export async function resolveIdToken(params: {
  accessToken: string;
  idToken: string;
}): Promise<ResolvedIdToken> {
  const response = await fetch(WEBFLOW_RESOLVE_ID_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken: params.idToken }),
  });

  if (!response.ok) {
    throw new Error(`Webflow id token resolve failed: ${response.status}`);
  }

  return response.json() as Promise<ResolvedIdToken>;
}

// Webflow's Assets API uses a two-step, presigned-upload flow: create asset
// metadata, then PUT the file bytes to the returned upload URL. The request
// and response field names below are our best-known shape - verify against
// https://developers.webflow.com/data/reference/assets before shipping,
// since Data API details can change between versions.
export async function createAssetUpload(params: {
  accessToken: string;
  siteId: string;
  fileName: string;
  fileHash: string;
}) {
  const response = await fetch(
    `${WEBFLOW_API_BASE}/sites/${params.siteId}/assets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: params.fileName,
        fileHash: params.fileHash,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Webflow asset creation failed: ${response.status}`);
  }

  return response.json() as Promise<{
    id: string;
    uploadUrl: string;
    uploadDetails: Record<string, string>;
  }>;
}

// "Blog to staging" (routes/blogStaging.ts) - the STAGED items list (all
// items, drafts included), deliberately NOT listLiveCollectionItems above
// (that one only ever returns items already live - a genuine, never-
// published draft wouldn't appear there at all, and this feature's whole
// point is surfacing drafts so "Publish your draft post" has something to
// act on). `isDraft`/`lastPublished` are real, documented fields at the
// item level (developers.webflow.com/data/reference/cms/collection-items/
// staged-items/list-items, confirmed directly, not assumed).
export interface WebflowStagedItem extends WebflowCollectionItem {
  isDraft?: boolean;
  isArchived?: boolean;
  lastPublished?: string | null;
}

export async function listCollectionItems(params: {
  accessToken: string;
  collectionId: string;
  limit: number;
  offset: number;
}): Promise<{ items: WebflowStagedItem[]; pagination: { limit: number; offset: number; total: number } }> {
  const url = new URL(`${WEBFLOW_API_BASE}/collections/${params.collectionId}/items`);
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Webflow items list failed: ${response.status}`);
  }

  return response.json() as Promise<{
    items: WebflowStagedItem[];
    pagination: { limit: number; offset: number; total: number };
  }>;
}

// Real, direct Webflow CMS API - "Publish your draft post." toggle
// (BlogToStagingScreen.tsx). Publishing a draft item automatically sets its
// own `isDraft` to false (confirmed in the endpoint's own docs) - no
// separate draft-flag update needed first. Requires `cms:write`.
export async function publishCollectionItems(params: {
  accessToken: string;
  collectionId: string;
  itemIds: string[];
}): Promise<{ publishedItemIds: string[]; errors?: string[] }> {
  const response = await fetch(`${WEBFLOW_API_BASE}/collections/${params.collectionId}/items/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ itemIds: params.itemIds }),
  });

  if (!response.ok) {
    throw new Error(`Webflow publish items failed: ${response.status}`);
  }

  return response.json() as Promise<{ publishedItemIds: string[]; errors?: string[] }>;
}

// The reverse of publishCollectionItems - removes item(s) from the live
// site and sets isDraft back to true (per the endpoint's own docs). 204 No
// Content on success, so there's no body to parse.
export async function unpublishCollectionItems(params: {
  accessToken: string;
  collectionId: string;
  itemIds: string[];
}): Promise<void> {
  const response = await fetch(`${WEBFLOW_API_BASE}/collections/${params.collectionId}/items/live`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items: params.itemIds.map((id) => ({ id })) }),
  });

  if (!response.ok) {
    throw new Error(`Webflow unpublish items failed: ${response.status}`);
  }
}

// "Blog to staging"'s own site-wide runtime script (routes/blogStaging.ts's
// ensureBlogStagingScriptInstalled) - the three real Custom Code API calls,
// each confirmed directly against developers.webflow.com/data/reference/
// custom-code before writing (not assumed): register once (scripts are
// IMMUTABLE per version - a real code change means a NEW version, never
// overwriting an existing one, same versioned-filename discipline this
// project already uses for its self-hosted glassLiquid/ruidoEvolutivo
// runtime bundles), read the site's current script list, then upsert the
// FULL list back (omitting an existing script from this call REMOVES it
// from the site, per the endpoint's own docs - callers must always include
// every script they want kept, not just the one being added).
export interface RegisteredScript {
  id: string;
  displayName: string;
  version: string;
}

export async function registerInlineScript(params: {
  accessToken: string;
  siteId: string;
  sourceCode: string;
  displayName: string;
  version: string;
}): Promise<RegisteredScript> {
  const response = await fetch(`${WEBFLOW_API_BASE}/sites/${params.siteId}/registered_scripts/inline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceCode: params.sourceCode,
      version: params.version,
      displayName: params.displayName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webflow register script failed: ${response.status}`);
  }

  return response.json() as Promise<RegisteredScript>;
}

export interface SiteCustomCodeScript {
  id: string;
  location: "header" | "footer";
  version: string;
}

export async function getSiteCustomCode(params: {
  accessToken: string;
  siteId: string;
}): Promise<{ scripts: SiteCustomCodeScript[] }> {
  const response = await fetch(`${WEBFLOW_API_BASE}/sites/${params.siteId}/custom_code`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  // A site with no custom code registered yet 404s here rather than
  // returning an empty list (confirmed empirically against a real fresh
  // site) - treated the same as "no scripts" rather than a real failure.
  if (response.status === 404) return { scripts: [] };
  if (!response.ok) {
    throw new Error(`Webflow get site custom code failed: ${response.status}`);
  }

  return response.json() as Promise<{ scripts: SiteCustomCodeScript[] }>;
}

export async function applySiteCustomCode(params: {
  accessToken: string;
  siteId: string;
  scripts: SiteCustomCodeScript[];
}): Promise<void> {
  const response = await fetch(`${WEBFLOW_API_BASE}/sites/${params.siteId}/custom_code`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scripts: params.scripts }),
  });

  if (!response.ok) {
    throw new Error(`Webflow apply site custom code failed: ${response.status}`);
  }
}
