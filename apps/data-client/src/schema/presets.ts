import { z } from "zod";
import { gradientConfigSchema } from "@fluxa/gradient-core";

export const createPresetSchema = z.object({
  name: z.string().min(1).max(80),
  config: gradientConfigSchema,
});
