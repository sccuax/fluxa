export type { GradientConfig, GradientPreset } from "@fluxa/gradient-core";

export interface ApiError {
  error: string;
  // Real bug, fixed 2026-09-16: apiClient.ts's own ApiRequestError used to
  // only ever surface `error` (a short machine code like "not_verified") as
  // its user-facing `.message` - several routes already sent a real,
  // human-readable `message` alongside it that was silently discarded, so a
  // user saw the literal code ("forbidden") instead of an explanation.
  message?: string;
}
