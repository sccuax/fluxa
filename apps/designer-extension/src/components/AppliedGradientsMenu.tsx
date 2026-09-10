import { useEffect, useState, type RefObject } from "react";
import { findAppliedGradients, type AppliedGradient } from "../services/applyGradient";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { Icon } from "./Icon";
import { Dropdown } from "./Dropdown";
import { truncateLabel } from "./DashboardHeader";

type MenuState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; gradients: AppliedGradient[] };

function gradientKey(gradient: AppliedGradient): string {
  return `${gradient.element.id.component}-${gradient.element.id.element}`;
}

// Content for DashboardHeader's chevron dropdown, rendered inside the
// generic Dropdown shell (Dropdown.tsx - pulled out of this component once a
// second dropdown, HeaderAppMenu.tsx, needed the exact same open/close
// behavior). Lists every element on the current page with a live Fluxa
// gradient applied (see findAppliedGradients' own comment in
// applyGradient.ts for how "applied" is actually detected - there's no
// dedicated storage for this, it scans the page for the same marker the
// apply flow itself uses). Scans fresh every time it opens rather than
// caching, since gradients can be applied/removed at any time from
// EditorTab elsewhere in the app while this stays closed.
export function AppliedGradientsMenu({ open, onCloseRequest, triggerRef }: {
  open: boolean;
  onCloseRequest: () => void;
  triggerRef: RefObject<HTMLElement>;
}) {
  const [state, setState] = useState<MenuState>({ status: "loading" });
  // Which row was last clicked, kept highlighted (text-color-accent, same
  // active/inactive convention as DashboardNav's own tabs) until either a
  // different row is clicked or the whole dropdown closes - per explicit
  // spec, not tied to the Designer's own real selection (which can change
  // independently, e.g. via useSelectedElement's poll, without this menu
  // knowing or caring).
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Re-scans the page fresh on every open and resets any row left
  // highlighted from a previous open, per this menu's own "active resets on
  // close" spec.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setActiveKey(null);
    setState({ status: "loading" });
    findAppliedGradients()
      .then((gradients) => {
        if (!cancelled) setState({ status: "ready", gradients });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Failed to scan the page.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSelect(gradient: AppliedGradient) {
    setActiveKey(gradientKey(gradient));
    await getWebflowDesigner().setSelectedElement(gradient.element);
    // Deliberately no onClose() here - the dropdown stays open so the
    // active-row highlight (the whole point of tracking activeKey) is
    // actually visible, per explicit spec ("solo se quitará el estado
    // active si se da click en otro row o si cerramos el dropdown").
  }

  return (
    <Dropdown open={open} onCloseRequest={onCloseRequest} triggerRef={triggerRef} offsetPx={60}>
      {state.status === "loading" && (
        <p className="font-sans text-mobile-text-md-regular text-text-secondary">Scanning page…</p>
      )}
      {state.status === "error" && (
        <p className="font-sans text-mobile-text-md-regular text-error-500">{state.message}</p>
      )}
      {state.status === "ready" && state.gradients.length === 0 && (
        <p className="font-sans text-mobile-text-md-regular text-text-secondary">
          No shaders applied on this page yet.
        </p>
      )}
      {state.status === "ready" &&
        state.gradients.map((gradient) => {
          const key = gradientKey(gradient);
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(gradient)}
              className={`flex items-center gap-2 whitespace-nowrap text-left font-sans text-mobile-text-md-regular ${
                isActive ? "text-text-color-accent" : "text-text-secondary"
              }`}
            >
              <Icon name="cube" />
              {truncateLabel(gradient.label)}
            </button>
          );
        })}
    </Dropdown>
  );
}
