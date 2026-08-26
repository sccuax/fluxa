import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import type { AppEnv } from "../types";
import { createDb } from "../db/client";
import { account, user } from "../db/schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";

export const profileRoutes = new Hono<AppEnv>();

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Deliberately a small allowlist, not "anything image/*" - avoids storing
// (and later having to safely re-serve) formats like image/svg+xml, which
// can carry embedded script content.
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Uploads the file to R2 (see wrangler.toml's AVATARS binding) and writes
// the resulting served URL straight into better-auth's own user.image
// column - not a second "avatarUrl" field on user_profiles. That column
// already exists (populated automatically for Google-sign-in accounts) and
// GET /api/me already returns it, so reusing it avoids two competing
// "which one is the real avatar" fields for the same concept.
profileRoutes.post("/avatar", requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    return c.json({ error: "unsupported_file_type" }, 400);
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return c.json({ error: "file_too_large" }, 400);
  }

  const userId = c.get("user")!.id;
  // No path separators in the key (flat, not `avatars/<userId>/<uuid>`) -
  // keeps the GET route below a plain single :key param instead of needing
  // a wildcard route + URL-encoding concerns.
  const key = `${userId}-${crypto.randomUUID()}.${extension}`;
  const origin = new URL(c.req.url).origin;
  const avatarUrlPrefix = `${origin}/api/profile/avatar/`;

  const db = createDb(c.env.DATABASE_URL);

  // Read the *old* image value before overwriting it - a `.returning()` on
  // the UPDATE below gives the row's value *after* the update is applied,
  // not before, so reading it that way was actually reading back the
  // brand-new URL we were about to set and then immediately deleting the
  // object we'd just uploaded (a real bug found by testing: every fresh
  // upload 404'd right after being saved). This SELECT-before-UPDATE is
  // what actually gets the previous value.
  const [existing] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId)).limit(1);
  const previousImage = existing?.image ?? null;

  await c.env.AVATARS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const imageUrl = `${avatarUrlPrefix}${key}`;
  await db.update(user).set({ image: imageUrl }).where(eq(user.id, userId));

  // Delete the old R2 object this user's avatar used to point to, if any -
  // otherwise every re-upload leaves the previous one orphaned in the
  // bucket forever, and a user who changes their photo often would slowly
  // fill the bucket with objects nothing references anymore. Only delete
  // when the old value is actually one of *our* avatar URLs (this prefix) -
  // Google-sign-in accounts have user.image pointing at a real Google CDN
  // URL instead, which obviously isn't an R2 key to delete. Best-effort:
  // failing to clean up the old object shouldn't fail a successful upload
  // that already updated the DB to point at the new one.
  if (previousImage?.startsWith(avatarUrlPrefix)) {
    const previousKey = previousImage.slice(avatarUrlPrefix.length);
    await c.env.AVATARS.delete(previousKey).catch((error) => {
      console.error("Failed to delete previous avatar from R2", error);
    });
  }

  return c.json({ image: imageUrl });
});

// Public, no requireAuth - this just re-serves an object from R2 (which has
// no public bucket URL of its own configured), the same way any other
// static image asset would be served. Nothing sensitive in an avatar image,
// and an <img src> can't attach the session cookie for this to gate on
// anyway without extra CORS/credential wiring this doesn't need. For this to
// actually render inside the Designer Extension (a different origin), see
// index.ts's secureHeaders() crossOriginResourcePolicy override - setting
// that header here directly would get silently overwritten.
profileRoutes.get("/avatar/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.AVATARS.get(key);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      // immutable - each upload gets a fresh crypto.randomUUID() key, so a
      // given URL's bytes never change; a new upload is a new URL, not an
      // overwrite of this one.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// 8/128 mirrors better-auth's own emailAndPassword.minPasswordLength/
// maxPasswordLength defaults (create-context.mjs) - this route bypasses
// better-auth's own real endpoint (see comment below), so its own bounds
// aren't enforced automatically here otherwise.
const changePasswordSchema = z.object({ password: z.string().min(8).max(128) });

// Deliberately NOT better-auth's own POST /auth/change-password - that
// endpoint requires the caller's *current* password in the body
// (sensitiveSessionMiddleware, see the installed package's own
// api/routes/update-user.mjs), which ManageProfileScreen's single-field
// "type a new password, click Change password" UI has no room for and was
// not asked to add. This route accepts only the new password, gated purely
// by requireAuth's session check - a real, deliberate tradeoff (a still-
// logged-in session on an unattended device could change the password
// without re-proving it) accepted per explicit direction rather than
// silently enforced. Hashes via better-auth's own exported hashPassword
// (better-auth/crypto - the same scrypt implementation its real sign-in
// flow verifies against) and writes straight to the `credential` provider's
// account row, mirroring what better-auth's real changePassword handler
// does internally minus the currentPassword check.
profileRoutes.post(
  "/password",
  requireAuth,
  zValidator("json", changePasswordSchema, onValidationError),
  async (c) => {
    const { password } = c.req.valid("json");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    const [credentialAccount] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);

    // A Google-only account (no email+password credential linked) has
    // nothing here to update - failing closed rather than silently
    // creating one, since that's a distinct "add a password" flow this
    // screen isn't building.
    if (!credentialAccount) {
      return c.json({ error: "no_credential_account" }, 400);
    }

    const passwordHash = await hashPassword(password);
    await db.update(account).set({ password: passwordHash }).where(eq(account.id, credentialAccount.id));

    return c.json({ success: true });
  },
);

// Deliberately NOT better-auth's own POST /auth/delete-user - that endpoint
// requires either the caller's password or a "fresh" session (created within
// the last 24h, sessionConfig.freshAge's default - create-context.mjs) or it
// throws SESSION_EXPIRED, which would silently break deletion for anyone
// who's just been logged in for a while. Same reasoning as the /password
// route above: a custom route gated purely by requireAuth's session check,
// per explicit direction to build this "real, with confirmation" - the
// confirmation step lives in the frontend modal, not a re-auth requirement
// here. Deleting the `user` row cascades to `session`/`account` (both
// onDelete: "cascade" in auth-schema.ts) and every app-schema table that
// references it the same way (user_profiles/user_preferences/subscriptions/
// payments) - `installations.userId` is "set null" instead (keeps the row,
// same as an install that was never linked to a user), and nothing else has
// a blocking/restrict FK on user.id, so this is safe as one direct delete.
profileRoutes.post("/delete-account", requireAuth, async (c) => {
  const userId = c.get("user")!.id;
  const db = createDb(c.env.DATABASE_URL);

  await db.delete(user).where(eq(user.id, userId));

  return c.json({ success: true });
});
