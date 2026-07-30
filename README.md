# Fluxa

A Webflow Designer Extension for building custom, animated 3D mesh gradients
(via [ShaderGradient](https://github.com/ruucm/shadergradient), MIT-licensed)
and applying them directly to elements in the Webflow Designer.

## Architecture

```
apps/
  designer-extension/   React 18 + TypeScript + Vite - runs in an iframe inside
                         the Webflow Designer. Renders a live gradient preview
                         (@shadergradient/react / three.js) driven by a Zustand
                         store, and writes styles back via the Webflow Designer
                         API.
  data-client/           Hono.js on Cloudflare Workers. Handles the Webflow
                         OAuth install flow and any call that needs a site
                         access token (e.g. uploading the rendered gradient
                         as a Webflow asset), backed by Cloudflare D1.
packages/
  gradient-core/         Zod schema + TS types for a gradient config, shared
                         between the frontend control panel and backend
                         preset validation.
  config/                Shared base tsconfig.
webflow.json              Designer Extension manifest (verify fields against
                           the current Webflow CLI docs before first publish).
```

**Flow:** user tweaks gradient params in the panel -> live WebGL preview ->
on "Apply", the canvas is rasterized client-side -> sent to the Data Client
-> Data Client uploads it as a Webflow asset using the stored site token ->
frontend sets that asset as the selected element's `background-image` via
the Designer API. Presets are saved per `site_id` in D1.

## Getting started

```bash
pnpm install
pnpm dev:extension   # Vite dev server for the Designer Extension (port 1337)
pnpm dev:api         # wrangler dev for the Data Client
```

Before the Data Client can do anything real:

1. Register the app in the [Webflow App dashboard](https://developer.webflow.com/)
   to get a client ID/secret and confirm the OAuth redirect URI.
2. Create the D1 database and run the schema:
   ```bash
   wrangler d1 create fluxa-db
   # copy the returned database_id into apps/data-client/wrangler.toml
   pnpm --filter @fluxa/data-client db:migrate
   ```
3. Set secrets: `wrangler secret put WEBFLOW_CLIENT_SECRET` (from
   `apps/data-client`).

## Things to verify before shipping

APIs that move independently of this scaffold - double-check against current
docs before relying on them:

- `webflow.json` manifest fields (`apps/data-client` root) - Webflow's App
  CLI schema.
- Webflow Designer API surface used in
  `apps/designer-extension/src/lib/webflowDesigner.ts` - replace with
  `@webflow/designer-extension-typings` once installed.
- Webflow Assets API request/response shape in
  `apps/data-client/src/lib/webflowApi.ts` - it's a presigned two-step
  upload; confirm field names against
  https://developers.webflow.com/data/reference/assets.
- Dependency versions in the `package.json` files are pinned to reasonably
  recent releases as of early 2026; `pnpm install` will resolve the latest
  matching semver range.

## License

MIT, see [LICENSE](./LICENSE). Third-party attribution in
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
