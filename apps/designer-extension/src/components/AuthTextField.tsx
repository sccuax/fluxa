import type { ChangeEvent, FocusEvent, KeyboardEvent, ReactNode } from "react";

interface AuthTextFieldProps {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string | null;
  autoComplete?: string;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  // Overrides the label's own styling (e.g. ManageProfileScreen's "Name"/
  // "Password" fields use the mobile-header-h2 token, not this component's
  // own default) - defaults to the original style so every existing call
  // site (Sign In/Sign Up) renders unchanged.
  labelClassName?: string;
  // Content rendered inside the input's own bordered box, right-aligned
  // (e.g. ManageProfileScreen's inline "Change password" ButtonSecondary) -
  // reserves room via inputClassName's own padding-right so typed text
  // never runs underneath it. Absent for every existing call site.
  trailing?: ReactNode;
}

// Plain single-line field (email, full name, ...) - label + input + an
// error rendered in normal flow below the box, left-aligned, matching
// AuthPasswordField's error so both field types read consistently.
// AuthPasswordField (the show/hide-toggle password field used by Sign
// In/Sign Up) is still the right choice when a field needs that specific
// behavior - this component's own "password" type is for the different
// case of a field that's never revealed at all (ManageProfileScreen's
// "Password" field, always masked, no eye toggle).
export function AuthTextField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  onBlur,
  onKeyDown,
  labelClassName = "text-mobile-text-md-medium font-sans",
  trailing,
}: AuthTextFieldProps) {
  return (
    <div className="flex min-h-[66px] w-full items-start gap-3">
      <div className="flex min-h-[66px] w-full flex-1 flex-col items-start gap-2">
        <label className={labelClassName} htmlFor={id}>
          {label}
        </label>
        <div className="relative w-full h-[36px] flex justify-center border border-border-border focus-within:border-[#858179] pl-4 rounded-4 overflow-hidden">
          <input
            id={id}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            // 136px is a functional estimate of the "Change password" pill's
            // own rendered width (ManageProfileScreen's only trailing call
            // site so far) - reserved so typed dots never run underneath it;
            // revisit once seen rendered for real.
            className={`w-full flex-1 bg-transparent text-text-sm-regular focus:outline-none ${trailing ? "pr-[136px]" : ""}`}
          />
          {trailing && <div className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</div>}
        </div>
        {error && <span className="text-[10px] text-error-800">{error}</span>}
      </div>
    </div>
  );
}
