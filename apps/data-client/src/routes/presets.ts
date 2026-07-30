import { Hono } from "hono";
import { z } from "zod";
import { gradientConfigSchema } from "@fluxa/gradient-core";
import type { Bindings } from "../types/env";

const createPresetSchema = z.object({
  name: z.string().min(1).max(80),
  config: gradientConfigSchema,
});

export const presetRoutes = new Hono<{ Bindings: Bindings }>();

presetRoutes.get("/:siteId", async (c) => {
  const siteId = c.req.param("siteId");
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, config, created_at FROM presets WHERE site_id = ?",
  )
    .bind(siteId)
    .all();

  return c.json(results);
});

presetRoutes.post("/:siteId", async (c) => {
  const siteId = c.req.param("siteId");
  const { name, config } = createPresetSchema.parse(await c.req.json());

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO presets (id, site_id, name, config, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, siteId, name, JSON.stringify(config), new Date().toISOString())
    .run();

  return c.json({ id }, 201);
});
