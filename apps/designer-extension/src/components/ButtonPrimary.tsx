import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LiquidGradientBackground } from "./LiquidGradientBackground";

interface ButtonPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Optional leading icon (e.g. AccountTab's "Upgrade to Pro" sparkle, or
  // EditorTab's "Apply gradient" stars) - rendered inside the same
  // always-on-top span as the label, left of it, with the label's own
  // gap-2 (8px) between them. Deliberately no color class of its own here:
  // an Icon.tsx entry passed in must use stroke="currentColor" (not a
  // hardcoded color) so it inherits this button's own text color -
  // text-text-white normally, disabled:text-text-secondary while disabled -
  // for free, the same way the label text does.
  icon?: ReactNode;
}

// Defaults to type="button" (native <button> defaults to "submit" inside a
// form, which silently submits it if a caller forgets to set the type) -
// pass type="submit" explicitly where that's the intended behavior.
//
// Height is h-auto (py-3 + the label's own line-height), not a fixed h-10 -
// h-10 (40px) is shorter than py-3's 24px of vertical padding plus
// text-sm-medium's own 18px line-height (42px needed), so the label
// overflowed the button's box by ~2px and this component's own
// overflow-hidden (needed below, for the WebGL ripple) silently clipped it.
// h-auto alone wasn't the full fix, though: `shrink-0` is also required.
// Real bug, found by testing ManageProfileScreen's own "Save" button
// specifically (and *only* there, never on Sign In's or EditorTab's own
// ButtonPrimary) - this button sits in a flex-column content area
// (ManageProfileScreen's own field list) whose total content is taller than
// the space available, unlike every other call site. AuthTextField's own
// wrapper has an explicit `min-h-[66px]` floor that keeps flex-shrink from
// touching it, but this component had no floor of its own at all - the
// default `flex-shrink: 1` let the flex layout algorithm squash *this*
// button down toward its own min-content height (measured at ~24px) to fit
// the available space, before overflow-y-auto ever got a chance to scroll
// instead. `shrink-0` is the same fix PanelHeader.tsx already uses for
// exactly this reason (see that file's own `shrink-0`) - it isn't just
// h-auto vs h-10, since a shrunk box just as happily crushes an auto height
// as a fixed one.
//
// The hover "liquid wave" effect is a WebGL canvas (LiquidGradientBackground)
// layered strictly *behind* the label, clipped to the button's rounded rect
// by `overflow-hidden` - never the button element itself. Two earlier
// attempts got this wrong: animating the CSS `background-position`/`-size`
// of the button's own gradient barely changed color (the token's gradient
// is nearly vertical, 3deg, so a horizontal-ish pan has almost nothing to
// shift), and applying an SVG `feDisplacementMap` `filter` to the whole
// button warped the button's shape *and* its text along with the
// background, which must never happen - text and the button's own edges
// have to stay crisp. Keeping the ripple confined to its own background
// layer, with the label in a separate always-on-top span, is what makes
// both of those constraints hold at once.
export function ButtonPrimary({
  type = "button",
  className = "",
  children,
  icon,
  disabled,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: ButtonPrimaryProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type={type}
      disabled={disabled}
      onPointerEnter={(e) => {
        setHovered(true);
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        setHovered(false);
        onPointerLeave?.(e);
      }}
      className={`relative isolate overflow-hidden w-full h-auto shrink-0 rounded-32 transition-shadow duration-300 ease-in-out bg-gradient-gradient py-2 font-sans text-text-sm-medium text-text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-none disabled:bg-background-white-2 disabled:border disabled:border-border-border hover:shadow-[3px_0_6px_0_rgba(0,0,0,0.25)_inset,-10px_47px_13px_0_rgba(33,33,33,0.00),-6px_30px_12px_0_rgba(33,33,33,0.01),-4px_17px_10px_0_rgba(33,33,33,0.05),-2px_7px_8px_0_rgba(33,33,33,0.09),0_2px_4px_0_rgba(33,33,33,0.10)] disabled:text-text-secondary ${className}`}
      {...rest}
    >
      {!disabled && <LiquidGradientBackground active={hovered} />}
      {/* inline-flex (not flex) - keeps this span an inline-level box so the
          button's native UA-stylesheet text-align:center still centers it as
          a unit (a block-level flex span would opt out of that and need its
          own centering), while still laying icon+label out in a row with a
          gap when icon is passed. Safe for every existing icon-less call
          site too - a single child in an inline-flex is positioned
          identically to plain inline content. */}
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
}
