import { Hono } from "hono";
import type { Bindings } from "../types/env";
import { createAssetUpload } from "../lib/webflowApi";
import { uploadRequestSchema } from "../schema";

export const assetRoutes = new Hono<{ Bindings: Bindings }>();

assetRoutes.post("/upload", async (c) => {
  const body = uploadRequestSchema.parse(await c.req.json());
  const upload = await createAssetUpload(body);
  return c.json(upload);
});
