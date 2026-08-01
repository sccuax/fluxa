import type { Context } from "hono";

// Shared @hono/zod-validator failure hook - keeps the error shape consistent
// with the rest of the API (`{ error: "invalid_request" }`) instead of
// leaking the raw ZodError each validator would otherwise return by default.
export function onValidationError(
  result: { success: boolean },
  c: Context,
) {
  if (!result.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
}
