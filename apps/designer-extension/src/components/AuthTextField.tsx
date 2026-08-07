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
// error rendered absolutely below the box. Only safe for messages that are
// short and fixed-length (e.g. "Invalid email"), since absolute positioning
// doesn't reserve layout space - a longer/variable message would overlap
// whatever comes next. Password fields have their own component
// (AuthPasswordField) since their behavior (show/hide toggle, masking)
// isn't just a style variant of this one.
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
        <div className="relative w-full h-[36px] flex justify-center border border-border-border pl-4 rounded-4">
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
          {error && (
            <span className="absolute right-0 top-full mt-1 text-[10px] text-error-800">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
