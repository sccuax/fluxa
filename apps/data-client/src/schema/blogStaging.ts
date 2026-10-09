import { z } from "zod";

export const setBlogStagingItemSchema = z.object({
  stagingOnly: z.boolean(),
  // The item's display name, stored so the live-site runtime can still hide
  // an item whose rendered card shows neither its slug nor a detail link.
  itemName: z.string().min(1).max(500).optional(),
});

// "All posts to staging?" master toggle - a real bulk write, not a
// separate override layer (see db/app-schema.ts's blogStagingItems comment
// for why). `itemSlugs` is always the caller's own currently-loaded page(s)
// of items, same "only affects what's actually loaded" limitation this
// app's other search/list screens already have. `itemNames` maps slug ->
// display name (see setBlogStagingItemSchema).
export const setAllBlogStagingItemsSchema = z.object({
  stagingOnly: z.boolean(),
  itemSlugs: z.array(z.string().min(1)).min(1).max(500),
  itemNames: z.record(z.string(), z.string().max(500)).optional(),
});

export const setBlogPublishStateSchema = z.object({
  publish: z.boolean(),
});
