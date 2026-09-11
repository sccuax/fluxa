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
// `className` appends to the wrapper's own classes - needed by callers like
// SegmentedRow/IconInputRow whose label carries its own positioning class
// (mr-auto, to push itself left in a flex row) that has to live on this
// wrapper now that it's what actually sits in that flex row, not the plain
// label element it used to be before it got wrapped in a Tooltip.
// `align` (top/bottom only): "center" (default) centers the bubble over the
// trigger, same as before this prop existed. "start" left-aligns the
// bubble's own left edge with the trigger's instead - needed for a trigger
// that itself sits right at a scrolling container's own left edge (e.g.
// ControlPanel's row labels, all pinned left via mr-auto): centering a
// 150-200px-wide bubble over a short/narrow trigger there pushes half the
// bubble further left than the trigger's own position, past the panel's
// edge and into the same horizontal clip "left"/"right" already have in a
// scrolling ancestor (see the note above) - confirmed for real on the
// Orbit row specifically, whose short label sits closest to that edge.
// "start" avoids it by only ever growing rightward, into the row's own
// (much roomier) space. The tail bump can't track the trigger's own exact
// center in this mode without measuring it at runtime, so it's pinned a
// fixed offset from the bubble's own left edge instead - a good enough
// visual approximation for how short these triggers are, not a precise anchor.
// The bubble itself is min-w-[150px] max-w-[200px] (was max-w-[140px] with
// no minimum) for EVERY tooltip in the app, no exceptions, per explicit
// direction - a max-width alone doesn't widen anything for short text (it
// just caps how far long text is ALLOWED to stretch before wrapping), which
// is why raising it alone previously produced no visible change on short
// hints like "Copy". A real minimum is what actually forces every bubble,
// short or long, to read as a wide landscape shape instead of a
// content-hugging square/column - important in an app this narrow
// (Webflow's own Designer panel).
export function Tooltip({
  text,
  side,
  align = "center",
  fullWidth = false,
  className = "",
  children,
}: {
  text: string;
  side: "left" | "right" | "top" | "bottom";
  align?: "center" | "start";
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const bubblePositionClassName =
    side === "left"
      ? "right-full mr-2 top-1/2 -translate-y-1/2"
      : side === "right"
        ? "left-full ml-2 top-1/2 -translate-y-1/2"
        : side === "top"
          ? align === "start"
            ? "bottom-full mb-2 left-0"
            : "bottom-full mb-2 left-1/2 -translate-x-1/2"
          : align === "start"
            ? "top-full mt-2 left-0"
            : "top-full mt-2 left-1/2 -translate-x-1/2";
  const tailPositionClassName =
    side === "left"
      ? "-right-1 top-1/2 -translate-y-1/2"
      : side === "right"
        ? "-left-1 top-1/2 -translate-y-1/2"
        : side === "top"
          ? align === "start"
            ? "-bottom-1 left-3"
            : "-bottom-1 left-1/2 -translate-x-1/2"
          : align === "start"
            ? "-top-1 left-3"
            : "-top-1 left-1/2 -translate-x-1/2";

  return (
    <div className={`group relative ${fullWidth ? "flex w-full" : "inline-flex"} ${className}`}>
      {children}
      <div
        className={`pointer-events-none invisible absolute z-20 flex min-w-[150px] max-w-[200px] items-center rounded-[4px] bg-background-dark/80 py-[6px] px-[10px] font-sans text-mobile-text-sm-regular text-text-white group-hover:visible ${bubblePositionClassName}`}
      >
        {text}
        <span className={`absolute h-2 w-2 rounded-full bg-background-dark/80 ${tailPositionClassName}`} />
      </div>
    </div>
  );
}
