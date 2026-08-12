import { useState, type FormEvent } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { getEmailErrorMessage } from "../helpers/formRegex";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { AuthTextField } from "../components/AuthTextField";

interface ForgotPasswordScreenProps {
  onBackToSignIn: () => void;
}

export function ForgotPasswordScreen({ onBackToSignIn }: ForgotPasswordScreenProps) {
  // Shorter than SignInScreen's 552 since this screen only has one field and
  // no Google/divider block - a functional estimate built from the same
  // field-row heights used there, not a pixel-exact value (no Figma spec yet).
  useExtensionSize({ width: 320, height: 420 });

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emailErrorMessage = getEmailErrorMessage(email);
    if (emailErrorMessage) {
      setEmailError(emailErrorMessage);
      return;
    }
    setEmailError(null);
    // TODO: wire to the real password-reset request once that endpoint
    // exists (better-auth's forgetPassword/resetPassword flow) - this is
    // UI-only for now.
  };

  return (
    <div className="relative w-full h-screen overflow-y-auto overflow-x-hidden bg-white">
      <AuthHeaderBanner />

      <div className="absolute left-0 top-[90px] flex min-h-[300px] w-full flex-col items-center gap-8">
        <div className="flex min-h-[238px] w-full flex-col items-center gap-[32px] px-[24px]">
          <FluxaLogoLockup />

          <div className="flex min-h-[174px] w-full flex-col items-center justify-center gap-[12px]">
            <form className="flex w-full flex-col items-center gap-3" onSubmit={handleSubmit} noValidate>
              <AuthTextField
                id="email"
                name="email"
                label="Your email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="name@mail.com"
                error={emailError}
              />

              <div className="flex min-h-[66px] w-full flex-col items-center gap-3">
                <ButtonPrimary
                  type="submit"
                  className="shadow-[3px_0_6px_0_rgba(0,0,0,0.25)_inset,-10px_47px_13px_0_rgba(33,33,33,0.00),-6px_30px_12px_0_rgba(33,33,33,0.01),-4px_17px_10px_0_rgba(33,33,33,0.05),-2px_7px_8px_0_rgba(33,33,33,0.09),0_2px_4px_0_rgba(33,33,33,0.10)]"
                >
                  Send an email
                </ButtonPrimary>
              </div>
            </form>

            <p className="text-center text-mobile-text-md-regular text-text-secondary">
              Remembered your password?{" "}
              <button
                type="button"
                onClick={onBackToSignIn}
                className="text-text-black text-mobile-text-md-medium hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex flex-row items-center gap-[12px]">
          <a href="#" className="text-mobile-text-md-regular text-text-secondary hover:underline">
            Privacy policy
          </a>
          <a href="#" className="text-mobile-text-md-regular text-text-secondary hover:underline">
            Terms of use
          </a>
        </div>
      </div>
    </div>
  );
}
