import { z } from "zod";

export const uploadRequestSchema = z.object({
  siteId: z.string().min(1).max(255),
  accessToken: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileHash: z.string().min(1),
});
