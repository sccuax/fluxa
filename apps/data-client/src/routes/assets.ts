import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../types/env";
import { createAssetUpload } from "../lib/webflowApi";

const uploadRequestSchema = z.object({
  siteId: z.string(),
  accessToken: z.string(),
  fileName: z.string(),
  fileHash: z.string(),
});

export const assetRoutes = new Hono<{ Bindings: Bindings }>();

assetRoutes.post("/upload", async (c) => {
  const body = uploadRequestSchema.parse(await c.req.json());
  const upload = await createAssetUpload(body);
  return c.json(upload);
});
