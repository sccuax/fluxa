import { z } from "zod";

export const setBlogStagingItemSchema = z.object({
  stagingOnly: z.boolean(),
});

// "All posts to staging?" master toggle - a real bulk write, not a
// separate override layer (see db/app-schema.ts's blogStagingItems comment
// for why). `itemSlugs` is always the caller's own currently-loaded page(s)
// of items, same "only affects what's actually loaded" limitation this
// app's other search/list screens already have.
export const setAllBlogStagingItemsSchema = z.object({
  stagingOnly: z.boolean(),
  itemSlugs: z.array(z.string().min(1)).min(1).max(500),
});

export const setBlogPublishStateSchema = z.object({
  publish: z.boolean(),
});
