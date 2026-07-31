import { z } from "zod";

export const uploadRequestSchema = z.object({
  siteId: z.string(),
  accessToken: z.string(),
  fileName: z.string(),
  fileHash: z.string(),
});
