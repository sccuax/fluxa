import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../types";
import type { Database } from "../db/client";
import { createDb } from "../db/client";
import { installations, presets } from "../db/schema";
import { createPresetSchema } from "../schema";
import { requireAuth } from "../middleware/requireAuth";
import { onValidationError } from "../lib/validation";

export const presetRoutes = new Hono<AppEnv>();

const siteIdParamSchema = z.object({
  siteId: z.string().min(1).max(255),
});

presetRoutes.use(requireAuth);

// A site only "belongs" to the caller if they hold an installation for it -
// see the userId column added to `installations` for this. Until the
// siteId-resolution TODO in routes/auth.ts is done, installations.siteId is
// always null, so this fails closed (no access) rather than open.
async function ownsSite(db: Database, siteId: string, userId: string) {
  const [installation] = await db
    .select({ id: installations.id })
    .from(installations)
    .where(
      and(eq(installations.siteId, siteId), eq(installations.userId, userId)),
    )
    .limit(1);

  return installation !== undefined;
}

presetRoutes.get(
  "/:siteId",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    if (!(await ownsSite(db, siteId, userId))) {
      return c.json({ error: "forbidden" }, 403);
    }

    const results = await db
      .select()
      .from(presets)
      .where(eq(presets.siteId, siteId));

    return c.json(results);
  },
);

presetRoutes.post(
  "/:siteId",
  zValidator("param", siteIdParamSchema, onValidationError),
  async (c) => {
    const { siteId } = c.req.valid("param");
    const userId = c.get("user")!.id;
    const db = createDb(c.env.DATABASE_URL);

    if (!(await ownsSite(db, siteId, userId))) {
      return c.json({ error: "forbidden" }, 403);
    }

    const { name, config } = createPresetSchema.parse(await c.req.json());

    const [row] = await db
      .insert(presets)
      .values({ siteId, name, config })
      .returning({ id: presets.id });

    return c.json(row, 201);
  },
);
