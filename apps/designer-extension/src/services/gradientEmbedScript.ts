import type { GradientConfig } from "@fluxa/gradient-core";

// Pinned to the exact versions installed locally (package.json / GradientCanvas.tsx's
// working preview) so the published embed renders identically to what the panel already
// showed - not the latest esm.sh-resolved versions, which could drift.
const REACT_VERSION = "18.3.1";
const SHADERGRADIENT_VERSION = "2.4.20";
// @shadergradient/react depends on @react-three/fiber and three internally. Without
// pinning these too, esm.sh resolves whatever's latest for those transitive deps -
// confirmed for real on the published page to resolve @react-three/fiber@9.x, which
// requires React 19 (v9 reads renamed React-19-only ReactSharedInternals fields, e.g.
// `.S` for the current dispatcher) and throws `Cannot read properties of undefined
// (reading 'S')` against our pinned React 18. Must match apps/designer-extension's own
// installed versions (package.json: @react-three/fiber ^8.18.0, three ^0.166.0), the
// same ones GradientCanvas.tsx's working panel preview already renders with.
const REACT_THREE_FIBER_VERSION = "8.18.0";
const THREE_VERSION = "0.166.1";

// A leading HTML comment marker so applyGradient.ts can recognize an embed it created
// earlier (re-applying should update that embed's code in place, not stack a second one).
export const GRADIENT_EMBED_MARKER = "<!-- fluxa-gradient -->";

// Builds the self-contained <script type="module"> + mount-point payload written into
// an HtmlEmbedElement's `code` setting (see CLAUDE.md "Applying the gradient to the
// published site"). Loads the *real* @shadergradient/react from esm.sh at runtime rather
// than porting its shader by hand - deliberate, see CLAUDE.md for why.
//
// `?deps=react@..,react-dom@..,@react-three/fiber@..,three@..` pins @shadergradient/react's
// own internal react/react-dom/@react-three-fiber/three imports to the exact same
// esm.sh-served module URLs as this file's own pinned versions, so the browser's module
// cache resolves all of them to one shared instance each - without it, esm.sh could
// independently resolve different copies that still satisfy the same peer ranges, which
// breaks React's hook dispatcher (a documented esm.sh multi-copy gotcha). Confirmed for
// real on the published page: with only react/react-dom pinned, esm.sh resolved
// @react-three/fiber@9.x (needs React 19) against our React 18, throwing `Cannot read
// properties of undefined (reading 'S')` - see the comment on REACT_THREE_FIBER_VERSION
// above.
export function buildGradientEmbedCode(config: GradientConfig, rootId: string): string {
  const configJson = JSON.stringify(config);

  return `${GRADIENT_EMBED_MARKER}
<div id="${rootId}" style="position:absolute;inset:0;width:100%;height:100%;"></div>
<script type="module">
import React from "https://esm.sh/react@${REACT_VERSION}";
import { createRoot } from "https://esm.sh/react-dom@${REACT_VERSION}/client";
import { ShaderGradientCanvas, ShaderGradient } from "https://esm.sh/@shadergradient/react@${SHADERGRADIENT_VERSION}?deps=react@${REACT_VERSION},react-dom@${REACT_VERSION},@react-three/fiber@${REACT_THREE_FIBER_VERSION},three@${THREE_VERSION}";

const config = ${configJson};
const mount = document.getElementById("${rootId}");
if (mount) {
  createRoot(mount).render(
    React.createElement(
      ShaderGradientCanvas,
      { style: { width: "100%", height: "100%" }, pointerEvents: "none", lazyLoad: false, pixelDensity: config.pixelDensity },
      React.createElement(ShaderGradient, config)
    )
  );
}
</script>`;
}
