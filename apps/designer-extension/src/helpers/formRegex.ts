// Regex patterns exclusively for form validation - see hooks/useFormValidation.ts.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LOWERCASE_REGEX = /[a-z]/;
export const UPPERCASE_REGEX = /[A-Z]/;
export const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;
export const DIGIT_REGEX = /[0-9]/;

export const PASSWORD_MIN_LENGTH = 10;

export const OTP_CODE_LENGTH = 6;
export const OTP_CODE_REGEX = /^\d{6}$/;

const PASSWORD_RULE_MESSAGE =
  "Password must be at least 10 characters, with uppercase, lowercase, and a special character.";

// Password rule (unchanged): 10+ chars, at least one lowercase, one
// uppercase, and one special (non-alphanumeric) character - a digit isn't
// required to pass, but its presence/absence is used below to point at
// exactly what's missing rather than repeating the same generic message
// for every failure. Composition (case/digit/symbol) is checked before
// length, since a short password is usually also missing a character
// class - naming that is more actionable than only saying "too short".
export function getPasswordErrorMessage(password: string): string | null {
  if (password.length === 0) return PASSWORD_RULE_MESSAGE;

  const hasLowercase = LOWERCASE_REGEX.test(password);
  const hasUppercase = UPPERCASE_REGEX.test(password);
  const hasSpecialChar = SPECIAL_CHAR_REGEX.test(password);
  const hasDigit = DIGIT_REGEX.test(password);

  if (!hasUppercase && !hasLowercase) {
    return "Add at least an uppercase and lowercase to your password.";
  }
  if (!hasDigit && !hasSpecialChar) {
    return "Add a number and a special character to your password.";
  }
  if (!hasSpecialChar) {
    return "Add at least a special character to your password.";
  }
  if (!hasUppercase) {
    return "Add at least an uppercase letter to your password.";
  }
  if (!hasLowercase) {
    return "Add at least a lowercase letter to your password.";
  }
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_MESSAGE;

  return null;
}

// The reset-code screen's OTP field: exactly 6 digits, nothing else -
// see helpers this pairs with in ResetCodeScreen.tsx.
export function getOtpCodeErrorMessage(code: string): string | null {
  if (code.length === 0) return "Enter the code we sent you";
  if (!OTP_CODE_REGEX.test(code)) return `Enter the ${OTP_CODE_LENGTH}-digit code`;
  return null;
}

// Stands in for the browser's native `type="email"` validation bubble
// (disabled via `noValidate` on the forms that use this - it doesn't fit
// the extension's 320px viewport). Points at what's actually wrong instead
// of a generic "invalid email": no "@" at all vs. an "@" with no domain
// extension (e.g. "name@mail" with no ".com").
export function getEmailErrorMessage(email: string): string | null {
  if (EMAIL_REGEX.test(email)) return null;
  if (!email.includes("@")) return "Enter a valid email address";

  const domain = email.slice(email.indexOf("@") + 1);
  const [, extension] = domain.split(".");
  if (!domain.includes(".") || !extension) return "You're missing the .com";

  return "Enter a valid email address";
}
