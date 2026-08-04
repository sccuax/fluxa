import type { ButtonHTMLAttributes } from "react";

interface ButtonPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

// Defaults to type="button" (native <button> defaults to "submit" inside a
// form, which silently submits it if a caller forgets to set the type) -
// pass type="submit" explicitly where that's the intended behavior.
export function ButtonPrimary({ type = "button", className = "", children, ...rest }: ButtonPrimaryProps) {
  return (
    <button
      type={type}
      className={`w-full rounded-4 bg-gradient-gradient py-3 font-sans text-text-sm-medium text-text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-none disabled:bg-background-white-2 disabled:border disabled:border-border-border disabled:text-text-secondary ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
