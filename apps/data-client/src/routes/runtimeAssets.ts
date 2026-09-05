import { Hono } from "hono";
import type { AppEnv } from "../types";

// Serves self-hosted, version-pinned JS runtime bundles (currently
// glass-liquid-runtime.v1.js, apps/glass-liquid-runtime) to published
// Webflow sites via a plain <script src> tag - see
// apps/designer-extension/src/services/glassLiquidEmbedScript.ts for the
// actual embed that loads this. Public, no auth (same as the thumbnail/
// avatar routes below) - a published site's own visitors need to load this
// with no session/token of any kind.
//
// Mirrors galleryPresets.ts's `/thumbnail/:key` route and profile.ts's
// `/avatar/:key` route exactly - the only two existing precedents in this
// Worker for serving a raw R2 object, since there's no general static-asset
// mechanism (no Workers Sites, no ASSETS binding) configured here.
// Cache-Control is immutable: filenames are version-pinned by convention
// (a breaking change ships as a NEW filename, e.g. glass-liquid-runtime.v2.js,
// never overwriting v1), so a given URL's bytes never change once uploaded.
export const publicRuntimeAssetRoutes = new Hono<AppEnv>();

publicRuntimeAssetRoutes.get("/:filename", async (c) => {
  const filename = c.req.param("filename");
  const object = await c.env.RUNTIME_ASSETS.get(filename);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
