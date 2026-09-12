import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonSecondaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Optional leading icon, same left-of-label placement as ButtonPrimary's
  // own icon prop.
  icon?: ReactNode;
  // Every existing call site (AccountTab's "Log out", ManageProfileScreen's
  // "Change photo") stretches to its container's full width - false for the
  // first call site that doesn't (ManageProfileScreen's "Change password",
  // a compact pill embedded inside the password field itself). A prop
  // rather than a `w-full`/`w-auto` override via `className` since Tailwind
  // utility precedence between two classes targeting the same property
  // isn't determined by their order in the class string, so a later
  // `className` can't reliably win over this component's own default.
  fullWidth?: boolean;
  // Same reasoning as fullWidth, for padding - "Change password" needs a
  // smaller py-1.5/px-3 pill instead of this component's own default py-2
  // (and no default horizontal padding at all, which every full-width call
  // site has relied on its own container to provide).
  paddingClassName?: string;
  // Same reasoning again, for the label's own type size - "Change password"
  // uses mobile-text-sm-medium (11px) instead of this component's own
  // default mobile-text-md-medium (12px).
  textClassName?: string;
}

// Plain bordered/outlined button - the "secondary" counterpart to
// ButtonPrimary's gradient-filled button. Deliberately has none of
// ButtonPrimary's own WebGL hover-ripple treatment (see that file's own
// comment for why that effect exists at all) - this is a flat border +
// accent-colored label/icon, per explicit Figma spec (AccountTab's "Log
// out" button, the first call site).
//
// shrink-0: same fix, same reasoning as ButtonPrimary.tsx's own shrink-0 -
// this button has no min-height floor of its own, so a flex-column
// container with more content than available space (ManageProfileScreen's
// "Delete account" button sits in exactly that situation, alongside
// ButtonPrimary's "Save") would otherwise crush it toward its own
// min-content height via the default flex-shrink: 1, before overflow-y-auto
// ever gets a chance to scroll instead.
export function ButtonSecondary({
  type = "button",
  className = "",
  children,
  icon,
  disabled,
  fullWidth = true,
  paddingClassName = "py-2",
  textClassName = "text-mobile-text-md-medium",
  ...rest
}: ButtonSecondaryProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`h-auto flex items-center justify-center shrink-0 rounded-4 border border-border-border font-sans text-text-color-accent shadow-[-1px_4px_3px_0_rgba(133,129,121,0.05),-1px_2px_2px_0_rgba(133,129,121,0.09),0_0_1px_0_rgba(133,129,121,0.10)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-text-secondary ${fullWidth ? "w-full" : "w-auto"} ${paddingClassName} ${textClassName} ${className}`}
      {...rest}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
}
