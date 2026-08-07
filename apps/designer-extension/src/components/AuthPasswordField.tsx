import { useState, type ChangeEvent } from "react";
import { EyeIcon } from "./EyeIcon";
import { EyeOffIcon } from "./EyeOffIcon";

interface AuthPasswordFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string | null;
  autoComplete?: string;
}

// Show/hide toggle state is owned internally (not lifted) so that two of
// these on the same screen (password + confirm password on sign-up) can be
// revealed independently. Error is rendered in normal flow, not absolute -
// unlike AuthTextField's email error, password errors vary in length
// ("Invalid email or password" vs "Something went wrong...") so an absolute
// message would risk overlapping the submit button below it.
export function AuthPasswordField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = "******",
  error,
  autoComplete,
}: AuthPasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col min-h-[66px] w-full items-start gap-2">
      <label className="text-mobile-text-md-medium font-sans" htmlFor={id}>
        {label}
      </label>
      <div className="relative flex min-h-[36px] w-full items-center rounded-4 border border-border-border pl-4 pr-3">
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full flex-1 text-text-sm-regular placeholder:text-text-secondary placeholder:[-webkit-text-fill-color:var(--text-secondary)] focus:outline-none ${
            showPassword
              ? ""
              : "text-transparent [-webkit-text-fill-color:transparent] caret-neutral-900 selection:text-transparent selection:[-webkit-text-fill-color:transparent]"
          }`}
        />
        {!showPassword && value.length > 0 && (
          <span className="pointer-events-none absolute left-4 text-text-sm-regular text-text-secondary">
            {"*".repeat(value.length)}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="shrink-0 text-text-secondary"
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <span className="text-[10px] text-error-800">{error}</span>}
    </div>
  );
}
