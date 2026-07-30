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
}) {
  const response = await fetch(WEBFLOW_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Webflow token exchange failed: ${response.status}`);
  }

  return response.json() as Promise<{ access_token: string }>;
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
