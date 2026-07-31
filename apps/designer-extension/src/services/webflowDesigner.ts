// `webflow` and its types (WebflowApi, AnyElement, ...) are ambient globals
// provided by @webflow/designer-extension-typings (see tsconfig.json's
// typeRoots) - no import needed.
export function getWebflowDesigner(): WebflowApi {
  if (typeof webflow === "undefined") {
    throw new Error(
      "The `webflow` Designer API is only available when Fluxa runs inside the Webflow Designer.",
    );
  }
  return webflow;
}
