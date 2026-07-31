import type { WebflowDesignerAPI } from "../types/webflow";

export function getWebflowDesigner(): WebflowDesignerAPI {
  if (typeof webflow === "undefined") {
    throw new Error(
      "The `webflow` Designer API is only available when Fluxa runs inside the Webflow Designer.",
    );
  }
  return webflow;
}
