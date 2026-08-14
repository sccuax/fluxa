import { useState, type ButtonHTMLAttributes } from "react";
import { LiquidGradientBackground } from "./LiquidGradientBackground";

interface ButtonPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

// Defaults to type="button" (native <button> defaults to "submit" inside a
// form, which silently submits it if a caller forgets to set the type) -
// pass type="submit" explicitly where that's the intended behavior.
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
      className={`relative isolate overflow-hidden w-full h-10 rounded-4 bg-gradient-gradient py-3 font-sans text-text-sm-medium text-text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-none disabled:bg-background-white-2 disabled:border disabled:border-border-border hover:shadow-[3px_0_6px_0_rgba(0,0,0,0.25)_inset,-10px_47px_13px_0_rgba(33,33,33,0.00),-6px_30px_12px_0_rgba(33,33,33,0.01),-4px_17px_10px_0_rgba(33,33,33,0.05),-2px_7px_8px_0_rgba(33,33,33,0.09),0_2px_4px_0_rgba(33,33,33,0.10)] disabled:text-text-secondary ${className}`}
      {...rest}
    >
      {!disabled && <LiquidGradientBackground active={hovered} />}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
