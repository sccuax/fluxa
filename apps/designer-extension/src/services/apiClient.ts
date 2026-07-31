import type { ApiError } from "../types/api";

// Hardcoded for now - swap for an import.meta.env.VITE_DATA_CLIENT_URL once
// the extension needs to point at a local `wrangler dev` backend too.
const DATA_CLIENT_URL = "https://fluxa-data-client.jojanmartinez533.workers.dev";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${DATA_CLIENT_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      body?.error ?? `Request to ${path} failed with ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}
