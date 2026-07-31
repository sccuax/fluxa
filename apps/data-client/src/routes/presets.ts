import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Bindings } from "../types/env";
import { createDb } from "../db/client";
import { presets } from "../db/schema";
import { createPresetSchema } from "../schema";

export const presetRoutes = new Hono<{ Bindings: Bindings }>();

presetRoutes.get("/:siteId", async (c) => {
  const siteId = c.req.param("siteId");
  const db = createDb(c.env.DATABASE_URL);

  const results = await db
    .select()
    .from(presets)
    .where(eq(presets.siteId, siteId));

  return c.json(results);
});

presetRoutes.post("/:siteId", async (c) => {
  const siteId = c.req.param("siteId");
  const { name, config } = createPresetSchema.parse(await c.req.json());
  const db = createDb(c.env.DATABASE_URL);

  const [row] = await db
    .insert(presets)
    .values({ siteId, name, config })
    .returning({ id: presets.id });

  return c.json(row, 201);
});
