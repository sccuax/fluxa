import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, count } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb, type Database } from "../db/client";
import { shaderUsage, subscriptions } from "../db/schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";

export const shaderUsageRoutes = new Hono<AppEnv>();
shaderUsageRoutes.use(requireAuth);

// Free plan ceiling - the License Agreement's "up to 3 shaders". Editor
// shaders and free gallery presets share this one pool.
export const FREE_SHADER_LIMIT = 3;

async function isPro(db: Database, userId: string) {
  const [subscription] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return subscription?.status === "active" || subscription?.status === "trialing";
}

async function usedCount(db: Database, userId: string) {
  const [row] = await db.select({ n: count() }).from(shaderUsage).where(eq(shaderUsage.userId, userId));
  return row?.n ?? 0;
}

async function usageResponse(db: Database, userId: string) {
  const pro = await isPro(db, userId);
  return { plan: pro ? "pro" : "free", used: await usedCount(db, userId), limit: pro ? null : FREE_SHADER_LIMIT };
}

shaderUsageRoutes.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  return c.json(await usageResponse(db, c.get("user")!.id));
});

const idSchema = z.string().min(1).max(255);

// Called right BEFORE a shader is applied. Re-applying to an element that
// already holds a slot is always allowed; a new element on a Free account
// at the limit gets 402 and the extension shows the upgrade prompt instead
// of applying. Slots are never released (lifetime allowance).
shaderUsageRoutes.post(
  "/claim",
  zValidator(
    "json",
    z.object({ siteId: idSchema, elementId: idSchema, kind: z.string().min(1).max(40) }),
    onValidationError,
  ),
  async (c) => {
    const userId = c.get("user")!.id;
    const body = c.req.valid("json");
    const db = createDb(c.env.DATABASE_URL);

    const [existing] = await db
      .select({ id: shaderUsage.id })
      .from(shaderUsage)
      .where(
        and(eq(shaderUsage.userId, userId), eq(shaderUsage.siteId, body.siteId), eq(shaderUsage.elementId, body.elementId)),
      )
      .limit(1);

    if (!existing) {
      const pro = await isPro(db, userId);
      if (!pro && (await usedCount(db, userId)) >= FREE_SHADER_LIMIT) {
        return c.json({ error: "limit_reached", ...(await usageResponse(db, userId)) }, 402);
      }
      await db
        .insert(shaderUsage)
        .values({ userId, siteId: body.siteId, elementId: body.elementId, kind: body.kind })
        .onConflictDoNothing();
    } else {
      await db
        .update(shaderUsage)
        .set({ kind: body.kind })
        .where(eq(shaderUsage.id, existing.id));
    }

    return c.json(await usageResponse(db, userId));
  },
);
