const WEBFLOW_API_BASE = "https://api.webflow.com/v2";
const WEBFLOW_AUTHORIZE_URL = "https://webflow.com/oauth/authorize";
const WEBFLOW_TOKEN_URL = "https://api.webflow.com/oauth/access_token";

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
