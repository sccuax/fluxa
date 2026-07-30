// Minimal typed surface of the `webflow` global injected by the Webflow
// Designer Extension runtime. This is intentionally small - extend it as
// Fluxa adopts more of the Designer API, and reconcile it against
// @webflow/designer-extension-typings once that package is installed.
// Reference: https://developers.webflow.com/designer/reference

export interface WebflowStyle {
  setProperty(name: string, value: string): Promise<void>;
}

export interface WebflowElement {
  id: { component: string; element: string };
  getStyles(): Promise<WebflowStyle[]>;
}

export interface WebflowDesignerAPI {
  getSelectedElement(): Promise<WebflowElement | null>;
  setExtensionSize(size: "default" | "comfortable" | "large"): Promise<void>;
}

declare global {
  const webflow: WebflowDesignerAPI;
}

export function getWebflowDesigner(): WebflowDesignerAPI {
  if (typeof webflow === "undefined") {
    throw new Error(
      "The `webflow` Designer API is only available when Fluxa runs inside the Webflow Designer.",
    );
  }
  return webflow;
}
