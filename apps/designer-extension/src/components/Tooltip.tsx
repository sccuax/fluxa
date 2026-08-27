import type { ReactNode } from "react";

// A small pill+tail popover component, built to a real Figma Dev Mode
// reference (copy-paste'd SVG: a rounded rect + a half-circle "tail" bump on
// one edge, #0B0D12 @ 80% opacity, text in the mobile-text-sm-regular
// token). The tail is reproduced as a small circle overlapping the bubble's
// own edge (same fill, so the visible half reads as a bump) rather than
// hand-drawing the reference's half-circle path, since `text` needed to be
// real DOM text (so the component could hold more than the one string baked
// into that Figma export). `side` picks which edge the bubble opens toward -
// "left"/"right" pick whichever side has room in the trigger's own context,
// since a bubble opening toward a panel edge can overflow it (see
// ControlPanel.tsx's CLAUDE.md notes on the ~1000px invisible-overflow bug
// this caused there before `max-w-[140px]` was added below). "top"/"bottom"
// open centered above/below the trigger instead - needed for a trigger
// that's a full-width row (HeaderAppMenu/LinksCard's "Locked" hints):
// "left"/"right" push the bubble out past the row's own horizontal edges,
// which gets silently clipped whenever the trigger sits inside a scrolling
// `overflow-y-auto` ancestor - per the CSS overflow spec, setting only one
// axis to non-visible forces the *other* axis's computed value to `auto`
// too (never `visible`), so an `overflow-y-auto` list clips horizontal
// overflow just as much as vertical, even though only the Y axis was ever
// set explicitly. Centering horizontally over/under the trigger keeps the
// bubble within the trigger's own width, side-stepping that clip entirely -
// but "top"/"bottom" still each have their own vertical clip risk for a row
// sitting right at the scrolling ancestor's own top/bottom edge (confirmed
// for real, not assumed: HeaderAppMenu's first row clipped with "top" - its
// bubble rendered above the Dropdown's own top edge - fixed there by using
// "bottom" instead, which had enough clearance). Check both directions with
// a real getBoundingClientRect comparison against the scrolling ancestor
// before trusting either for a new call site near a list's edge.
// `fullWidth` makes the wrapper `flex w-full` instead of `inline-flex` - for
// a trigger that itself needs to be full-width (e.g. LinksCard's own
// `justify-between` row), the default `inline-flex` wrapper would shrink it
// back down to content width and break that layout.
export function Tooltip({
  text,
  side,
  fullWidth = false,
  children,
}: {
  text: string;
  side: "left" | "right" | "top" | "bottom";
  fullWidth?: boolean;
  children: ReactNode;
}) {
  const bubblePositionClassName =
    side === "left"
      ? "right-full mr-2 top-1/2 -translate-y-1/2"
      : side === "right"
        ? "left-full ml-2 top-1/2 -translate-y-1/2"
        : side === "top"
          ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
          : "top-full mt-2 left-1/2 -translate-x-1/2";
  const tailPositionClassName =
    side === "left"
      ? "-right-1 top-1/2 -translate-y-1/2"
      : side === "right"
        ? "-left-1 top-1/2 -translate-y-1/2"
        : side === "top"
          ? "-bottom-1 left-1/2 -translate-x-1/2"
          : "-top-1 left-1/2 -translate-x-1/2";

  return (
    <div className={`group relative ${fullWidth ? "flex w-full" : "inline-flex"}`}>
      {children}
      <div
        className={`pointer-events-none invisible absolute z-20 flex max-w-[140px] items-center rounded-[4px] bg-background-dark/80 py-[6px] px-[10px] font-sans text-mobile-text-sm-regular text-text-white group-hover:visible ${bubblePositionClassName}`}
      >
        {text}
        <span className={`absolute h-2 w-2 rounded-full bg-background-dark/80 ${tailPositionClassName}`} />
      </div>
    </div>
  );
}
