import { DATA_CLIENT_URL } from "./apiClient";

// A leading HTML comment marker so applyCmsGalleryEmbed.ts can recognize an
// embed it created earlier - same pattern as gradientEmbedScript.ts's own
// GRADIENT_EMBED_MARKER.
export const CMS_GALLERY_EMBED_MARKER = "<!-- fluxa-cms-gallery -->";

// Since 2026-09-23 the embed is only a LOADER: the gallery's real logic
// (find every target on the page, resolve its item's slug, fetch images,
// mount the carousel) lives in apps/data-client's lib/cmsGalleryRuntime.ts
// and is served by routes/publicCmsGallery.ts at /runtime.js. Before, the
// whole script was baked into this embed, so any fix only reached a site
// after the customer re-ran "Install gallery script" AND published (a real
// case: a staging-only bug that wiped a whole section needed exactly that).
// Now a Worker deploy is enough; the embed itself only changes if this
// loader line does. `defer` - the runtime runs once the page is parsed,
// whatever this embed's position in the DOM relative to the Collection List.
export function buildCmsGalleryEmbedCode(): string {
  return `${CMS_GALLERY_EMBED_MARKER}
<script src="${DATA_CLIENT_URL}/api/public/cms-gallery/runtime.js" defer></script>`;
}
