import type { GradientConfig } from "@fluxa/gradient-core";

// Pinned to the exact versions installed locally (package.json / GradientCanvas.tsx's
// working preview) so the published embed renders identically to what the panel already
// showed - not the latest esm.sh-resolved versions, which could drift.
const REACT_VERSION = "18.3.1";
const SHADERGRADIENT_VERSION = "2.4.20";

// A leading HTML comment marker so applyGradient.ts can recognize an embed it created
// earlier (re-applying should update that embed's code in place, not stack a second one).
export const GRADIENT_EMBED_MARKER = "<!-- fluxa-gradient -->";

// Builds the self-contained <script type="module"> + mount-point payload written into
// an HtmlEmbedElement's `code` setting (see CLAUDE.md "Applying the gradient to the
// published site"). Loads the *real* @shadergradient/react from esm.sh at runtime rather
// than porting its shader by hand - deliberate, see CLAUDE.md for why.
//
// `?deps=react@..,react-dom@..` pins @shadergradient/react's own internal react/react-dom
// imports to the exact same esm.sh-served module URL as the explicit top-level import
// below, so the browser's module cache resolves both to one shared React instance -
// without it, esm.sh could independently resolve a *different* React copy that still
// satisfies the same peer range, which breaks React's hook dispatcher (a documented
// esm.sh multi-copy gotcha). Not yet confirmed against the real published page - if
// "Invalid hook call" shows up in the embed's console, start here.
export function buildGradientEmbedCode(config: GradientConfig, rootId: string): string {
  const configJson = JSON.stringify(config);

  return `${GRADIENT_EMBED_MARKER}
<div id="${rootId}" style="position:absolute;inset:0;width:100%;height:100%;"></div>
<script type="module">
import React from "https://esm.sh/react@${REACT_VERSION}";
import { createRoot } from "https://esm.sh/react-dom@${REACT_VERSION}/client";
import { ShaderGradientCanvas, ShaderGradient } from "https://esm.sh/@shadergradient/react@${SHADERGRADIENT_VERSION}?deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}";

const config = ${configJson};
const mount = document.getElementById("${rootId}");
if (mount) {
  createRoot(mount).render(
    React.createElement(
      ShaderGradientCanvas,
      { style: { width: "100%", height: "100%" }, pointerEvents: "none", lazyLoad: false },
      React.createElement(ShaderGradient, config)
    )
  );
}
</script>`;
}
