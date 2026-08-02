import { useEffect } from "react";
import { getWebflowDesigner } from "../services/webflowDesigner";

type ExtensionSize = "default" | "comfortable" | "large" | { width: number; height: number };

// The webflow.json manifest only sets the extension's initial size - each
// screen calls this to switch the panel to the size its layout needs
// (e.g. 320x460 "comfortable" for Welcome, "large" for in-depth views).
export function useExtensionSize(size: ExtensionSize) {
  useEffect(() => {
    try {
      getWebflowDesigner()
        .setExtensionSize(size)
        .catch(() => {
          // No-op outside the real Designer (e.g. plain browser dev preview).
        });
    } catch {
      // getWebflowDesigner() throws synchronously when `webflow` isn't defined.
    }
  }, [size]);
}
