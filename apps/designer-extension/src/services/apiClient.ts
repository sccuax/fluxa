import type { ApiError } from "../types/api";

// Hardcoded for now - swap for an import.meta.env.VITE_DATA_CLIENT_URL once
// the extension needs to point at a local `wrangler dev` backend too.
export const DATA_CLIENT_URL = "https://fluxa-data-client.jojanmartinez533.workers.dev";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    // The raw machine code (e.g. "not_verified", "not_owner") for callers
    // that need to branch on *which* failure this was, not just display
    // `.message` - e.g. WebflowSolutionsScreen.tsx re-verifying on
    // "not_verified" specifically rather than every failure.
    public code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // A FormData body (e.g. the avatar upload) needs the browser to set its
  // own multipart/form-data Content-Type with the boundary parameter -
  // forcing application/json here would silently break that upload.
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${DATA_CLIENT_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      body?.message ?? body?.error ?? `Request to ${path} failed with ${response.status}`,
      body?.error,
    );
  }

  return response.json() as Promise<T>;
}
