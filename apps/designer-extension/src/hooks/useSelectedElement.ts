import { useEffect, useState } from "react";
import { getWebflowDesigner } from "../services/webflowDesigner";

interface SelectedElementState {
  element: AnyElement | null;
  loading: boolean;
  error: string | null;
}

// Polls the Designer's current selection. The Designer API has no
// selection-change event as of this writing, so a short interval is the
// pragmatic option - swap for a subscription if/when Webflow adds one.
export function useSelectedElement(pollIntervalMs = 500) {
  const [state, setState] = useState<SelectedElementState>({
    element: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const element = await getWebflowDesigner().getSelectedElement();
        if (!cancelled) {
          setState({ element, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            element: null,
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
