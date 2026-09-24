import { apiFetch } from "./apiClient";

// "Blog to staging" (Webflow Solutions feature #4) - see data-client's
// db/app-schema.ts blogStagingItems comment for the full architecture (a
// real, self-hosted "hide on live, show on staging" mechanism, since
// Webflow's own publish system has no per-item equivalent) and
// routes/blogStaging.ts for why "Publish your draft post" needs none of
// that - it's a direct, real Webflow CMS API call.

export interface BlogStagingItem {
  id: string;
  slug: string;
  name: string;
  isDraft: boolean;
  // Published, but edited since - its live version is stale until it's
  // published again (see data-client routes/blogStaging.ts's own comment).
  hasUnpublishedChanges: boolean;
  stagingOnly: boolean;
}

export interface BlogStagingItemsPage {
  items: BlogStagingItem[];
  pagination: { limit: number; offset: number; total: number };
}

export function fetchBlogStagingItems(
  siteId: string,
  collectionId: string,
  params: { limit: number; offset: number },
): Promise<BlogStagingItemsPage> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return apiFetch<BlogStagingItemsPage>(
    `/api/blog-staging/${siteId}/collections/${collectionId}/items?${query.toString()}`,
  );
}

export function saveItemStaging(
  siteId: string,
  collectionId: string,
  itemSlug: string,
  stagingOnly: boolean,
): Promise<{ stagingOnly: boolean }> {
  return apiFetch(
    `/api/blog-staging/${siteId}/collections/${collectionId}/items/${encodeURIComponent(itemSlug)}/staging`,
    { method: "PUT", body: JSON.stringify({ stagingOnly }) },
  );
}

// The "All posts to staging?" master toggle - a real bulk write across
// every given slug (the caller's own currently-loaded items), not a
// derived override (see the backend's own comment for why).
export function saveAllItemsStaging(
  siteId: string,
  collectionId: string,
  stagingOnly: boolean,
  itemSlugs: string[],
): Promise<{ stagingOnly: boolean; count: number }> {
  return apiFetch(`/api/blog-staging/${siteId}/collections/${collectionId}/items/staging-all`, {
    method: "PUT",
    body: JSON.stringify({ stagingOnly, itemSlugs }),
  });
}

// Whether the site still has to be published for the staging-only script to
// reach its domains (data-client routes/blogStaging.ts, GET script-status) -
// drives BlogToStagingScreen.tsx's in-panel "Remember to publish" message.
// Also upgrades an outdated script server-side for a site already using the
// feature.
export function fetchBlogStagingScriptStatus(
  siteId: string,
): Promise<{ installed: boolean; publishNeeded: boolean }> {
  return apiFetch(`/api/blog-staging/${siteId}/script-status`);
}

// "Publish your draft post." - `itemId` is Webflow's own CMS item id (from
// the same fetchBlogStagingItems response), not the slug - the real
// publish/unpublish endpoints this calls take ids.
export function saveItemPublishState(
  siteId: string,
  collectionId: string,
  itemId: string,
  publish: boolean,
): Promise<{ isDraft: boolean }> {
  return apiFetch(`/api/blog-staging/${siteId}/collections/${collectionId}/items/${itemId}/publish-state`, {
    method: "PUT",
    body: JSON.stringify({ publish }),
  });
}
