import { useEffect, useRef, useState, type RefObject } from "react";
import { findAppliedGradients, type AppliedGradient } from "../services/applyGradient";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { Icon } from "./Icon";
import { truncateLabel } from "./DashboardHeader";

type MenuState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; gradients: AppliedGradient[] };

function gradientKey(gradient: AppliedGradient): string {
  return `${gradient.element.id.component}-${gradient.element.id.element}`;
}

// Must stay in sync with the dropdown-fade-out animation duration in
// tailwind.config.js - there's no single source of truth linking a Tailwind
// animation's CSS duration to a JS timer (same situation as ControlPanel.tsx's
// FullViewModal/MODAL_ANIMATION_MS), so both were set to 200ms deliberately
// and must be changed together.
const DROPDOWN_ANIMATION_MS = 200;

// Anchored dropdown opened by DashboardHeader's chevron - lists every
// element on the current page with a live Fluxa gradient applied (see
// findAppliedGradients' own comment in applyGradient.ts for how "applied"
// is actually detected - there's no dedicated storage for this, it scans
// the page for the same marker the apply flow itself uses). Scans fresh
// every time it opens rather than caching, since gradients can be applied/
// removed at any time from EditorTab elsewhere in the app while this stays
// closed.
//
// DashboardHeader renders this unconditionally once `open` has ever been
// true (not `{open && <AppliedGradientsMenu .../>}`) - this component owns
// its own mount lifecycle instead, staying mounted for DROPDOWN_ANIMATION_MS
// after `open` flips false so the exit (dropdown-fade-out) actually gets to
// play, the same "stay mounted through the close animation" shape
// FullViewModal already uses for the color modal. Closing via the chevron
// toggle and via an outside click both just flip the same `open` prop, so
// there's one single exit-animation code path regardless of which caused it.
export function AppliedGradientsMenu({ open, onCloseRequest, triggerRef }: {
  open: boolean;
  onCloseRequest: () => void;
  // The chevron button that opens this menu - excluded from the "click
  // outside" check below alongside this menu's own containerRef. Without
  // it, the *second* click (meant to close the menu) raced its own two
  // native events: pointerdown bubbled to document first and closed the
  // menu via the outside-click handler (the button isn't inside
  // containerRef, so it looked like an outside click), then click fired on
  // the button itself right after and toggled gradientsMenuOpen back to
  // true - net effect, the menu (and the chevron's rotation) never actually
  // closed on a second click, only ever seemed to re-open.
  triggerRef: RefObject<HTMLElement>;
}) {
  // Stays true through the exit animation even after `open` goes false -
  // see the effect below.
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<MenuState>({ status: "loading" });
  // Which row was last clicked, kept highlighted (text-color-accent, same
  // active/inactive convention as DashboardNav's own tabs) until either a
  // different row is clicked or the whole dropdown closes - per explicit
  // spec, not tied to the Designer's own real selection (which can change
  // independently, e.g. via useSelectedElement's poll, without this menu
  // knowing or caring).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keeps this component mounted (returns null below once mounted is
  // false) for DROPDOWN_ANIMATION_MS after `open` goes false, so
  // dropdown-fade-out actually gets to play instead of the dropdown just
  // vanishing the instant it's told to close.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timeout = setTimeout(() => setMounted(false), DROPDOWN_ANIMATION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  // Re-scans the page fresh on every open (not once on mount - this
  // component itself stays mounted indefinitely now, see the comment above
  // the export) and resets any row left highlighted from a previous open,
  // per this menu's own "active resets on close" spec.
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

  // Closes on any click outside this dropdown - no existing click-outside
  // pattern elsewhere in this codebase to reuse (Tooltip is hover-only), so
  // this is a plain document-level pointerdown listener. Only active while
  // genuinely open - no need to react to outside clicks while already
  // closing/closed.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const insideMenu = containerRef.current?.contains(target);
      const insideTrigger = triggerRef.current?.contains(target);
      if (!insideMenu && !insideTrigger) {
        onCloseRequest();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onCloseRequest, triggerRef]);

  async function handleSelect(gradient: AppliedGradient) {
    setActiveKey(gradientKey(gradient));
    await getWebflowDesigner().setSelectedElement(gradient.element);
    // Deliberately no onClose() here - the dropdown stays open so the
    // active-row highlight (the whole point of tracking activeKey) is
    // actually visible, per explicit spec ("solo se quitará el estado
    // active si se da click en otro row o si cerramos el dropdown").
  }

  if (!mounted) return null;

  return (
    // right-[60px]/top-full, not left-0 - resolves against DashboardHeader's
    // own relative positioning (see that component's comment on why
    // `relative` moved there), per explicit design spec. No fixed width -
    // an absolutely positioned box with only `right` set (no `left`)
    // already shrink-wraps to its own content by default, which is exactly
    // the "width auto" the spec asked for. Animation class follows `open`
    // (not `mounted`) - the instant `open` flips false, this switches to
    // dropdown-fade-out while `mounted` is still true for one more
    // DROPDOWN_ANIMATION_MS, so the exit actually plays.
    <div
      ref={containerRef}
      className={`absolute right-[60px] top-full z-30 flex max-h-[240px] flex-col gap-2 overflow-y-auto rounded-b-4 bg-background-dark p-3 ${
        open ? "animate-dropdown-fade-in" : "animate-dropdown-fade-out"
      }`}
    >
      {state.status === "loading" && (
        <p className="font-sans text-mobile-text-md-regular text-text-secondary">Scanning page…</p>
      )}
      {state.status === "error" && (
        <p className="font-sans text-mobile-text-md-regular text-error-500">{state.message}</p>
      )}
      {state.status === "ready" && state.gradients.length === 0 && (
        <p className="font-sans text-mobile-text-md-regular text-text-secondary">
          No gradients applied on this page yet.
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
    </div>
  );
}
