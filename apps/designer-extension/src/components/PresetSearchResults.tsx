import { useEffect, useRef, useState, type RefObject } from "react";
import type { GalleryPresetDisplay } from "../types/presetGallery";

// A plain border-color can't be a gradient - same two-layer trick
// PresetCard.tsx's own "Pro" pill border already uses (a solid fill painted
// into the padding-box, gradient-gradient painted into the border-box
// underneath/around it, revealed as a ring by `border: 1px solid
// transparent`). Split into the longhand properties (rather than one
// `background` shorthand string like the Pro pill's) specifically so
// `backgroundPosition` can be driven live by the cursor below - the
// shorthand can't express that on its own. The gradient layer's size is
// enlarged to 300% so there's real room for that position to pan across
// instead of just repeating the same static 0-100% stretch.
//
// A real self-looping CSS animation (`@keyframes` panning backgroundPosition
// on a timer) was tried first and dropped - two problems, not one: (1)
// gradient-gradient is a near-vertical gradient (3deg - its color transition
// runs top-to-bottom, barely at all left-to-right), so animating only the
// X-position barely moved anything visually; (2) per explicit direction,
// this needs to actually track the cursor (like the pasted BorderGlow
// reference), not run on a fixed timer regardless of the mouse - a
// self-looping keyframe can never do that by construction. Fixed by driving
// backgroundPosition directly from real pointer coordinates instead (see
// handlePointerMove below) - moves in whichever direction the cursor
// actually does, covers both axes, and only moves when the mouse does.
const GRADIENT_BORDER_STYLE = {
  backgroundImage: "linear-gradient(var(--background-background-white), var(--background-background-white)), var(--gradient-gradient)",
  backgroundOrigin: "padding-box, border-box",
  backgroundClip: "padding-box, border-box",
  backgroundSize: "100% 100%, 300% 300%",
} as const;

// One result row - a flatter, list-shaped sibling of PresetCard.tsx's own
// grid card (thumbnail + name + license, left-to-right instead of an
// image-with-overlays), per the reference mockup (copy-paste). Deliberately
// its own component rather than a variant of PresetCard - the two share no
// layout in common (grid card is a square image with absolutely-positioned
// text on top; this is a bordered horizontal row).
function PresetSearchResultRow({
  preset,
  clickable,
  onApply,
}: {
  preset: GalleryPresetDisplay;
  clickable: boolean;
  onApply: (preset: GalleryPresetDisplay) => void;
}) {
  const [color1, color2, color3] = preset.previewColors;
  // Plain useState (not CSS :hover) - an inline `style` background can't
  // carry a `:hover` pseudo-class on its own, and the gradient-border trick
  // needs `background` to actually change between states, not just a
  // border-color swap.
  const [hovered, setHovered] = useState(false);
  // Percent position within the row (0-100 both axes) - starts centered so
  // the very first hover frame (before any real mousemove has fired yet)
  // shows something reasonable rather than a value from a stale previous
  // hover.
  const [pointerPercent, setPointerPercent] = useState({ x: 50, y: 50 });
  const showGradientBorder = clickable && hovered;

  function handlePointerMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointerPercent({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onApply(preset) : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onApply(preset);
              }
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={clickable ? handlePointerMove : undefined}
      className={`flex items-center gap-3 rounded-4 border p-3 ${clickable ? "cursor-pointer" : ""} ${
        showGradientBorder ? "border-transparent" : "border-border-border"
      }`}
      style={
        showGradientBorder
          ? { ...GRADIENT_BORDER_STYLE, backgroundPosition: `0 0, ${pointerPercent.x}% ${pointerPercent.y}%` }
          : undefined
      }
    >
      {preset.thumbnailUrl ? (
        <img src={preset.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded-[4px] object-cover" />
      ) : (
        <div
          className="h-10 w-10 shrink-0 rounded-[4px]"
          style={{ backgroundImage: `linear-gradient(135deg, ${color1}, ${color2}, ${color3})` }}
        />
      )}
      {/* No gap between the two lines, per explicit direction - a plain
          flex-col with no gap class already stacks them flush. Every
          preset here comes from Fluxa Studio (there's no multi-author
          concept in this product), so "By Fluxa team" is a fixed label,
          not per-preset data - see PresetsTab.tsx's earlier decision not to
          add a real author field for this same reason. */}
      <div className="flex flex-1 flex-col truncate">
        <span className="truncate font-sans text-mobile-header-h2 text-text-black">{preset.name}</span>
        <span className="truncate font-sans text-mobile-text-sm-regular text-text-secondary">By Fluxa team</span>
      </div>
      {/* Same gradient-text treatment as PresetCard.tsx's own "Pro" badge -
          kept consistent app-wide rather than introducing a third look for
          the same label (the reference mockup's flat blue "Pro" wasn't
          matched literally here for that reason). */}
      {preset.license === "pro" ? (
        <span className="shrink-0 bg-gradient-gradient bg-clip-text font-sans text-mobile-text-sm-regular text-transparent">
          Pro
        </span>
      ) : (
        <span className="shrink-0 font-sans text-mobile-text-sm-regular text-text-secondary">Free</span>
      )}
    </div>
  );
}

// Floating results panel, anchored under the search bar - opens the instant
// there's a real query, closes on an outside click (own listener; not built
// on the shared Dropdown.tsx shell, since that one's hardcoded dark/
// right-anchored/content-width chrome is shaped for the header's own small
// menus, not a full-width light list under a search input) or when the
// query itself is cleared (PresetsTab.tsx unmounts this entirely once
// `query` is empty, so there's no separate "closed but query still set"
// state to manage here beyond the outside-click dismiss).
export function PresetSearchResults({
  query,
  results,
  clickable,
  onApply,
  onDismiss,
  anchorRef,
}: {
  query: string;
  results: GalleryPresetDisplay[];
  clickable: boolean;
  onApply: (preset: GalleryPresetDisplay) => void;
  onDismiss: () => void;
  // The search/filter row this panel opens under (PresetsTab.tsx) - measured
  // for its own real bottom edge below, so `top` is exact regardless of that
  // row's actual rendered height, no hardcoded px guess.
  anchorRef: RefObject<HTMLDivElement>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Computed fresh on every render (not state set from a useEffect) so the
  // very first paint already has the right numbers - a useEffect-driven
  // version starts at some placeholder value for one frame, then jumps to
  // the real one once the effect runs, which is exactly the ugly "jumps up
  // then settles down" flash this was rewritten to fix. Both anchorRef's
  // row and #dashboard-nav are already-mounted, long-lived elements by the
  // time this component ever renders (it only shows up after the user has
  // typed something, long after DashboardScreen's own chrome exists), so a
  // synchronous read here is always accurate - no effect/timing needed.
  const top = anchorRef.current?.getBoundingClientRect().bottom ?? 0;
  // Same real-DOM-measurement idea as FullViewModal's own useChromeInsets
  // (not reused directly - that hook's own useState+useEffect shape has the
  // identical one-frame-stale problem described above), inlined here so
  // `bottom` is correct from this component's very first render too.
  const bottom = document.getElementById("dashboard-nav")?.getBoundingClientRect().height ?? 0;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  return (
    <div
      ref={containerRef}
      // fixed (not absolute) - same reasoning as FullViewModal's own choice:
      // this whole app IS the viewport (a small fixed-size panel/iframe), so
      // `fixed` correctly spans real screen pixels here. top/bottom are both
      // real measured pixel values (not Tailwind classes) for the same
      // reason FullViewModal's own top/bottom insets are inline style, not
      // arbitrary-value classes.
      style={{ top, bottom }}
      className="fixed left-5 right-5 z-30 flex flex-col overflow-hidden bg-background-white"
    >
      <div className="flex shrink-0 items-center justify-between pt-3 pb-4">
        <p className="font-sans text-text-sm-medium text-text-black">Result for &ldquo;{query}&rdquo;</p>
        <p className="font-sans text-mobile-text-sm-regular text-text-secondary">{results.length} results</p>
      </div>
      {/* [scrollbar-width:none]/[&::-webkit-scrollbar]:hidden - per explicit
          direction, this list scrolls without the app's usual visible
          custom scrollbar (index.css's global *::-webkit-scrollbar rule
          would otherwise apply here like everywhere else). Scrolling itself
          stays fully functional (overflow-y-auto, wheel/touch/keyboard all
          still work) - only the visible track/thumb is hidden. */}
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {results.length > 0 ? (
          <div className="flex flex-col gap-2">
            {results.map((preset) => (
              <PresetSearchResultRow key={preset.id} preset={preset} clickable={clickable} onApply={onApply} />
            ))}
          </div>
        ) : (
          <p className="pt-4 text-center font-sans text-mobile-text-md-regular text-text-secondary">
            No presets found.
          </p>
        )}
        {/* "More to scroll" fade cue - sticky (not absolute), placed as the
            actual last flow child after the rows, per explicit direction:
            no JS scroll tracking needed for "disappears once there's
            nothing left to scroll" - a sticky element can't stick past its
            own natural flow position, so once that position is reached
            (the true end of the list) it just settles there instead of
            floating over the last row. from-background-white/to-transparent
            is the exact token match for the requested
            #EFF1F4->rgba(...,0) - once this has nothing left beneath it to
            overlay, it's the same solid color as the panel's own
            background, so it reads as "gone" rather than a visible patch.
            pointer-events-none so it never blocks clicking the row(s)
            beneath it while it IS overlaying something. */}
        {results.length > 0 && (
          <div aria-hidden className="sticky bottom-0 h-[57px] w-full bg-gradient-to-t from-background-white to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}
