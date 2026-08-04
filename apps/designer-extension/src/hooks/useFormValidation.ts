import { useMemo } from "react";
import {
  EMAIL_REGEX,
  LOWERCASE_REGEX,
  UPPERCASE_REGEX,
  SPECIAL_CHAR_REGEX,
  PASSWORD_MIN_LENGTH,
} from "../helpers/formRegex";

export interface PasswordValidation {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasSpecialChar: boolean;
  isValid: boolean;
}

export interface FormValidation {
  isEmailValid: boolean;
  password: PasswordValidation;
  isFormValid: boolean;
}

// Password rule: at least 10 chars, with at least one lowercase, one
// uppercase, and one special (non-alphanumeric) character.
export function useFormValidation(email: string, password: string): FormValidation {
  return useMemo(() => {
    const minLength = password.length >= PASSWORD_MIN_LENGTH;
    const hasLowercase = LOWERCASE_REGEX.test(password);
    const hasUppercase = UPPERCASE_REGEX.test(password);
    const hasSpecialChar = SPECIAL_CHAR_REGEX.test(password);

    const passwordValidation: PasswordValidation = {
      minLength,
      hasLowercase,
      hasUppercase,
      hasSpecialChar,
      isValid: minLength && hasLowercase && hasUppercase && hasSpecialChar,
    };

    const isEmailValid = EMAIL_REGEX.test(email);

    return {
      isEmailValid,
      password: passwordValidation,
      isFormValid: isEmailValid && passwordValidation.isValid,
    };
  }, [email, password]);
}
