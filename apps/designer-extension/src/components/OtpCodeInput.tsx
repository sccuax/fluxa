import { useRef, type KeyboardEvent } from "react";

interface OtpCodeInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
}

// A single string stays the source of truth (index i = box i), padded with
// spaces for not-yet-filled boxes - editing any one box via slice/splice
// against that padded string preserves every other box's position, unlike
// filtering/joining only the filled digits (which would collapse a gap,
// e.g. typing into box 3 while 1-2 are empty landing at the wrong index).
// Final validation (getOtpCodeErrorMessage's /^\d{6}$/) already rejects any
// string still containing a space, so an incomplete code just fails
// validation naturally without extra trimming here.
export function OtpCodeInput({ length, value, onChange, error, disabled }: OtpCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const padded = value.padEnd(length, " ");

  const setDigitsFrom = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      onChange(padded.slice(0, index) + " " + padded.slice(index + 1));
      return;
    }
    // Also handles pasting the full code into a single box - each digit
    // fills the next box in sequence from here.
    let next = padded;
    let lastIndex = index;
    for (const digit of digits) {
      if (lastIndex >= length) break;
      next = next.slice(0, lastIndex) + digit + next.slice(lastIndex + 1);
      lastIndex++;
    }
    onChange(next);
    inputRefs.current[Math.min(lastIndex, length - 1)]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !padded[index]?.trim() && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            value={padded[index]?.trim() ?? ""}
            onChange={(e) => setDigitsFrom(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={disabled}
            className={`h-11 w-9 rounded-4 border text-center text-text-sm-regular focus:outline-none disabled:opacity-50 ${
              error ? "border-error-800" : "border-border-border focus:border-[#858179]"
            }`}
          />
        ))}
      </div>
      {error && <span className="text-[10px] text-error-800">{error}</span>}
    </div>
  );
}
