import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

// Must stay in sync with the dropdown-fade-out animation duration in
// tailwind.config.js - there's no single source of truth linking a Tailwind
// animation's CSS duration to a JS timer (same situation as
// ControlPanel.tsx's FullViewModal/MODAL_ANIMATION_MS), so both were set to
// 200ms deliberately and must be changed together.
const DROPDOWN_ANIMATION_MS = 200;

// Generic anchored dropdown shell, extracted from AppliedGradientsMenu.tsx
// (DashboardHeader's chevron menu) once a second dropdown (the "..." menu,
// HeaderAppMenu.tsx) needed the exact same open/close behavior - a global,
// reusable component rather than each menu re-implementing it. Owns:
// - the mount lifecycle (stays mounted DROPDOWN_ANIMATION_MS after `open`
//   goes false so dropdown-fade-out actually gets to play, instead of
//   vanishing the instant it's told to close - the same shape
//   ControlPanel.tsx's FullViewModal uses for the color modal)
// - the click-outside-to-close listener
// - the box's own position/animation classes
// Content is entirely up to the caller via `children` - this component has
// no opinion on what a dropdown's rows look like.
export function Dropdown({ open, onCloseRequest, triggerRef, offsetPx, scrollable = true, variant = "dark", children }: {
  open: boolean;
  onCloseRequest: () => void;
  // The button that opens this dropdown - excluded from the outside-click
  // check below alongside this dropdown's own containerRef. Without it, a
  // second click meant to close the dropdown races its own two native
  // events: pointerdown bubbles to document first and closes it via the
  // outside-click check (the trigger isn't inside containerRef, so it looks
  // like an outside click), then click fires on the trigger right after and
  // toggles it back open via the trigger's own handler - net effect, the
  // dropdown never actually closes on a second click, only seems to
  // re-open. Found and fixed once already on AppliedGradientsMenu.tsx before
  // this was pulled out - every Dropdown user gets the fix for free now.
  triggerRef: RefObject<HTMLElement>;
  // Both current dropdowns anchor their right edge some distance from the
  // header's own right edge (the chevron menu at 60px, clearing the "..."
  // button beside it; the "..." menu itself at 20px, flush with the
  // header's own px-[20px] padding) - a plain number, not a Tailwind
  // class, since an arbitrary-value class built from a JS variable
  // (`right-[${offsetPx}px]`) wouldn't be picked up by Tailwind's static
  // analysis. Applied via inline style instead, same pattern
  // ControlPanel.tsx's FullViewModal already uses for its own dynamic
  // top/bottom insets.
  offsetPx: number;
  // AppliedGradientsMenu (potentially many gradient-applied elements on a
  // page) keeps the default overflow-y-auto/max-h-[240px] scroll. false is
  // for a caller whose content can never realistically overflow that height
  // (HeaderAppMenu - a fixed 4 rows) - overflow-y-auto's own presence is
  // what was forcing overflow-x to also compute as non-visible per the CSS
  // overflow spec (not just a default; explicitly setting overflow-x:
  // visible while the other axis is non-visible still gets overridden the
  // same way), silently clipping any Tooltip.tsx hint that opened sideways
  // or - confirmed for real, not assumed - even the "top"/"bottom" variants
  // added specifically to dodge that, since this dropdown's own rendered
  // height is too tight for a 60px-tall bubble to fit above the first row or
  // below the others without still hitting the same clip. Dropping the
  // scroll entirely for a caller that will never need it removes the clip
  // at its actual source instead of fighting it with more positioning
  // variants.
  scrollable?: boolean;
  // "dark" (default) is DashboardHeader's own two menus, both anchored
  // below its dark header bar. "light" is for a caller anchored inside a
  // light-themed panel (e.g. a wizard step's own card) - WebflowSolutionsScreen's
  // field picker is the first one, styled to read as a native Webflow
  // dropdown (light surface, subtle border/shadow, hover tint) rather than
  // this shell's original dark-header look.
  variant?: "dark" | "light";
  children: ReactNode;
}) {
  // Stays true through the exit animation even after `open` goes false -
  // see the effect below.
  const [mounted, setMounted] = useState(open);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timeout = setTimeout(() => setMounted(false), DROPDOWN_ANIMATION_MS);
    return () => clearTimeout(timeout);
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

  if (!mounted) return null;

  return (
    // No fixed width - an absolutely positioned box with only `right` set
    // (no `left`) already shrink-wraps to its own content, which is exactly
    // the "width auto" both menus want. Animation class follows `open` (not
    // `mounted`) - the instant `open` flips false, this switches to
    // dropdown-fade-out while `mounted` is still true for one more
    // DROPDOWN_ANIMATION_MS, so the exit actually plays.
    <div
      ref={containerRef}
      style={{ right: offsetPx }}
      className={`absolute top-full z-30 flex flex-col gap-1 ${
        variant === "light"
          ? "mt-1 rounded-4 border border-border-border bg-background-white p-1.5 shadow-[0_4px_12px_0_rgba(0,0,0,0.08)]"
          : "rounded-b-4 bg-background-dark p-3"
      } ${scrollable ? "max-h-[240px] overflow-y-auto" : ""} ${
        open ? "animate-dropdown-fade-in" : "animate-dropdown-fade-out"
      }`}
    >
      {children}
    </div>
  );
}
