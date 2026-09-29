import type { GalleryPreset } from "@fluxa/gradient-core";
import { SITE } from "@/config/site";

// Build-time fetch of the public gallery. The Worker route is unauthenticated
// by design (/api/public/*); never call an authenticated route from here.
// The result is baked into the static HTML, so visitors never hit the API, and
// publishing a preset in Fluxa Studio triggers a rebuild (deploy hook).

export async function fetchPublishedPresets(): Promise<GalleryPreset[]> {
  const response = await fetch(`${SITE.apiUrl}/api/public/gallery-presets/published`);
  if (!response.ok) {
    throw new Error(`Failed to load presets (${response.status})`);
  }
  return (await response.json()) as GalleryPreset[];
}

/** Like fetchPublishedPresets, but a failing API must not break the site build. */
export async function fetchPublishedPresetsSafe(): Promise<GalleryPreset[]> {
  try {
    return await fetchPublishedPresets();
  } catch (error) {
    console.warn("[website] presets unavailable, rendering without them:", error);
    return [];
  }
}
