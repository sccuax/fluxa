// Same deployed Data Client every other app in this repo talks to
// (apps/designer-extension/src/services/apiClient.ts has the identical
// constant/comment) - hardcoded for now, swap for an env var if this ever
// needs to point at a local `wrangler dev` backend.
export const DATA_CLIENT_URL = "https://fluxa-data-client.jojanmartinez533.workers.dev";

// VITE_ADMIN_API_TOKEN comes from this app's own .env (gitignored via the
// repo root's blanket .env/.env.* pattern - see .env.example for what to
// put there). Not session/cookie auth like every other app in this repo -
// see apps/data-client's middleware/requireAdminToken.ts for why a single
// shared secret is enough for a local-only internal tool.
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_API_TOKEN as string | undefined;

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!ADMIN_TOKEN) {
    throw new Error("VITE_ADMIN_API_TOKEN is not set - copy .env.example to .env and fill it in.");
  }

  // A FormData body (the thumbnail upload) needs the browser to set its own
  // multipart/form-data Content-Type with the boundary parameter - forcing
  // application/json here would silently break that upload, same fix
  // apps/designer-extension's own apiClient.ts already has for its avatar
  // upload.
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${DATA_CLIENT_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      "x-admin-token": ADMIN_TOKEN,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(response.status, body?.error ?? `Request to ${path} failed with ${response.status}`);
  }

  // A DELETE with no body would otherwise throw trying to parse empty text
  // as JSON - every route in this app's own backend (routes/galleryPresets.ts)
  // always returns a JSON body (even DELETE's `{ ok: true }`), so this is
  // just defensive, not something expected to trigger in practice.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
