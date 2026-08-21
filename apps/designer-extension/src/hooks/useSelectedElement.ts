import { useEffect, useState } from "react";
import { getWebflowDesigner } from "../services/webflowDesigner";

interface SelectedElementState {
  element: AnyElement | null;
  // Best-effort human-readable label for the current selection, for UI like
  // DashboardHeader. AnyElement is a big discriminated union - most concrete
  // element types (see elements-generated.d.ts) mix in `Styles` and
  // `DisplayName` capabilities, exposed as boolean flags (`element.styles`,
  // `element.displayName`) rather than always being present, so those flags
  // are checked before calling the matching getter. Priority: the element's
  // first class name (what the user most wants - matches the Style panel),
  // then the Designer's own element name (Navigator panel label, e.g. "Div
  // Block", or a custom rename) as a fallback, then - for a Component
  // instance specifically (`type: 'ComponentInstance'`, has neither styles
  // nor getTag) - the underlying Component's own name, and finally the raw
  // HTML tag as a last resort. getName() (only on form-field elements -
  // returns the HTML `name` attribute, not a friendly label) is deliberately
  // not used here.
  label: string | null;
  loading: boolean;
  error: string | null;
}

// Exported for AppliedGradientsMenu.tsx (DashboardHeader's chevron dropdown),
// which needs the exact same label-resolution logic for elements it finds by
// scanning the page rather than by polling the current selection.
export async function resolveLabel(element: AnyElement): Promise<string | null> {
  if (element.styles) {
    const styles = await element.getStyles();
    const named = styles?.find((style) => style?.name);
    if (named?.name) return named.name;
  }
  if ("displayName" in element && element.displayName) {
    // Only set if the instance/element was manually renamed in the
    // Designer - null for an unrenamed Component instance, which is why
    // the getComponent() fallback below still needs to run.
    const displayName = await element.getDisplayName();
    if (displayName) return displayName;
  }
  if ("getComponent" in element && typeof element.getComponent === "function") {
    const component = await element.getComponent();
    const name = await component.getName();
    if (name) return name;
  }
  if ("getTag" in element && typeof element.getTag === "function") {
    return element.getTag();
  }
  return null;
}

// Polls the Designer's current selection. The Designer API has no
// selection-change event as of this writing, so a short interval is the
// pragmatic option - swap for a subscription if/when Webflow adds one.
export function useSelectedElement(pollIntervalMs = 500) {
  const [state, setState] = useState<SelectedElementState>({
    element: null,
    label: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const element = await getWebflowDesigner().getSelectedElement();
        const label = element ? await resolveLabel(element) : null;
        if (!cancelled) {
          setState({ element, label, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            element: null,
            label: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    poll();
    const interval = setInterval(poll, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return state;
}
