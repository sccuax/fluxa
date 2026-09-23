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
export function Dropdown({ open, onCloseRequest, triggerRef, offsetPx, align = "right", scrollable = true, variant = "dark", rounded = "bottom", fullWidth = false, children }: {
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
  // Both existing dropdowns anchor from the header's RIGHT edge - "right"
  // stays the default so neither call site needs to change. "left" is for
  // a trigger that instead sits at the header's own left edge (the new
  // service-switcher dropdown, which replaces the logo there) - same
  // `offsetPx` meaning, just measured from the left instead.
  align?: "left" | "right";
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
  // "dark" variant only, "bottom" (default) keeps the original
  // flush-against-its-header look (DashboardHeader's two menus, anchored
  // right below the dark header bar - square top corners read as
  // continuous with it). "all" rounds every corner, for a "dark" dropdown
  // that ISN'T flush against anything above it (WebflowSolutionsScreen's
  // per-row "..." actions menu, floating below a small button mid-card) -
  // per explicit direction. The "light" variant is unaffected, already
  // always fully rounded.
  rounded?: "bottom" | "all";
  // When true, spans the full width of the nearest positioned ancestor
  // (`left: 0; right: 0`) instead of shrink-wrapping to its own content -
  // per explicit direction for WebflowSolutionsScreen's field picker
  // ("debe medir 100% del div como su padre"), which needs to match its
  // trigger button's own full width, not just its content's. `align`/
  // `offsetPx` are ignored when this is true - both only make sense for a
  // shrink-wrapped box anchored from one edge.
  fullWidth?: boolean;
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

  // The exact multi-layer shadow given (real CSS custom properties with
  // fallbacks, e.g. `var(--_shadow-menu-inner-1-y, 0.5px)`) - applied via
  // inline `style`, not a Tailwind `shadow-[...]` arbitrary value: that
  // syntax requires escaping every space as `_` and this string is both too
  // long and has commas nested inside each `var(...)` fallback, which
  // Tailwind's bracket-content parsing isn't built to round-trip safely.
  // Undefined custom properties simply fall back to the literal numbers
  // given, so this renders correctly whether or not those tokens exist
  // elsewhere in this app.
  const LIGHT_MENU_SHADOW =
    "0 var(--_shadow-menu-inner-1-y, 0.5px) var(--_shadow-menu-inner-1-blur, 0.5px) 0 var(--_shadow-menu-inner-1-color, rgba(255, 255, 255, 0.12)) inset, 0 var(--_shadow-menu-inner-2-y, -0.5px) var(--_shadow-menu-inner-2-blur, 0.5px) 0 var(--_shadow-menu-inner-2-color, rgba(0, 0, 0, 0.12)) inset, 0 0 var(--_shadow-menu-drop-1-blur, 0) 0 rgba(255, 255, 255, 0.00), 0 var(--_shadow-menu-drop-2-y, 2px) var(--_shadow-menu-drop-2-blur, 6px) 0 var(--_shadow-menu-drop-2-color, rgba(0, 0, 0, 0.08)), 0 var(--_shadow-menu-drop-3-y, 4px) var(--_shadow-menu-drop-3-blur, 8px) var(--_shadow-menu-drop-3-spread, 2px) var(--_shadow-menu-drop-3-color, rgba(0, 0, 0, 0.08)), 0 var(--_shadow-menu-drop-4-y, 8px) var(--_shadow-menu-drop-4-blur, 16px) var(--_shadow-menu-drop-4-spread, 4px) var(--_shadow-menu-drop-4-color, rgba(0, 0, 0, 0.08)), 0 var(--_shadow-menu-drop-5-y, 12px) var(--_shadow-menu-drop-5-blur, 24px) var(--_shadow-menu-drop-5-spread, 8px) var(--_shadow-menu-drop-5-color, rgba(0, 0, 0, 0.08))";

  return (
    // No fixed width by default - an absolutely positioned box with only
    // `right` set (no `left`) shrink-wraps to its own content, which is
    // exactly the "width auto" every other dropdown wants. `fullWidth`
    // instead pins both `left`/`right` to 0, spanning this box's positioned
    // ancestor (the caller's own `relative` wrapper around its trigger)
    // exactly - offsetPx/align are meaningless together with that, so
    // they're skipped entirely in that branch. Animation class follows
    // `open` (not `mounted`) - the instant `open` flips false, this
    // switches to dropdown-fade-out while `mounted` is still true for one
    // more DROPDOWN_ANIMATION_MS, so the exit actually plays.
    <div
      ref={containerRef}
      style={{
        ...(fullWidth ? { left: 0, right: 0 } : align === "left" ? { left: offsetPx } : { right: offsetPx }),
        ...(variant === "light" ? { boxShadow: LIGHT_MENU_SHADOW } : null),
      }}
      className={`absolute top-full z-30 flex flex-col gap-1 ${
        // No padding here (per explicit direction: the container's own
        // p-1.5 + bg-background-white used to show as a plain white gap
        // around the rows) - bg/border are now the same lavender wash the
        // rows themselves already use (FIELD_PICKER_COLORS), so removing
        // the padding lets the rows sit flush against the container's own
        // edges instead of floating inset on a mismatched white backing.
        // Row hover states are untouched - they live in FIELD_PICKER_COLORS
        // on each row button, not here.
        variant === "light"
          ? "mt-1 rounded-4 border border-[#654CBD]/20 bg-[#CABEF4]/50"
          : `${rounded === "all" ? "rounded-4" : "rounded-b-4"} bg-background-dark p-3`
      } ${scrollable ? "max-h-[240px] overflow-y-auto" : ""} ${
        open ? "animate-dropdown-fade-in" : "animate-dropdown-fade-out"
      }`}
    >
      {children}
    </div>
  );
}
