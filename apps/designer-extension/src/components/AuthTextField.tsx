import type { ChangeEvent } from "react";

interface AuthTextFieldProps {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email";
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string | null;
  autoComplete?: string;
}

// Plain single-line field (email, full name, ...) - label + input + an
// error rendered in normal flow below the box, left-aligned, matching
// AuthPasswordField's error so both field types read consistently.
// Password fields have their own component (AuthPasswordField) since their
// behavior (show/hide toggle, masking) isn't just a style variant of this one.
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
}: AuthTextFieldProps) {
  return (
    <div className="flex min-h-[66px] w-full items-start gap-3">
      <div className="flex min-h-[66px] w-full flex-1 flex-col items-start gap-2">
        <label className="text-mobile-text-md-medium font-sans" htmlFor={id}>
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
            className="w-full flex-1 text-text-sm-regular focus:outline-none"
          />
        </div>
        {error && <span className="text-[10px] text-error-800">{error}</span>}
      </div>
    </div>
  );
}
