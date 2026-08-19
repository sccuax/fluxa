import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { getPasswordErrorMessage } from "../helpers/formRegex";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { Modal } from "../components/Modal";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { DATA_CLIENT_URL } from "../services/apiClient";

interface ResetPasswordScreenProps {
  email: string;
  // The code ResetCodeScreen already validated via check-verification-otp -
  // needed again here because better-auth's /email-otp/reset-password is
  // the step that actually consumes the OTP (check-verification-otp only
  // validates it without consuming it), so the same code has to be resent.
  otp: string;
  onBackToSignIn: () => void;
}

// The lockup's natural SVG height is 32px (see FluxaLogoLockup); the
// entrance animation below shrinks it to this height once it settles
// flush-left with the field labels - same animation as every other Auth*
// screen (SignUpScreen, ForgotPasswordScreen, ResetCodeScreen).
const LOGO_SHRUNK_HEIGHT = 16;
const LOGO_NATURAL_HEIGHT = 32;

// Final step of the password-reset flow (see ForgotPasswordScreen and
// ResetCodeScreen).
export function ResetPasswordScreen({ email, otp, onBackToSignIn }: ResetPasswordScreenProps) {
  // Functional estimate (no Figma spec yet): ForgotPasswordScreen's 420
  // (one field, no Google/divider block) plus one more password-field row.
  useExtensionSize({ width: 320, height: 500 });

  const logoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const logoEl = logoRef.current;
    const container = logoEl?.parentElement;
    if (!logoEl || !container) return;

    const { paddingLeft, paddingRight } = getComputedStyle(container);
    const contentWidth = container.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
    const centeredOffset = (contentWidth - logoEl.offsetWidth) / 2;

    const tween = gsap.to(logoEl, {
      x: -centeredOffset,
      scale: LOGO_SHRUNK_HEIGHT / LOGO_NATURAL_HEIGHT,
      transformOrigin: "left center",
      duration: 0.8,
      delay: 0.2,
      ease: "power2.inOut",
    });

    return () => {
      tween.kill();
    };
  }, []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let hasError = false;
    const passwordErrorMessage = getPasswordErrorMessage(password);
    if (passwordErrorMessage) {
      setPasswordError(passwordErrorMessage);
      hasError = true;
    } else {
      setPasswordError(null);
    }
    if (confirmPassword !== password) {
      setConfirmPasswordError("Passwords don't match");
      hasError = true;
    } else {
      setConfirmPasswordError(null);
    }
    if (hasError) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${DATA_CLIENT_URL}/api/auth/email-otp/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      if (!res.ok) {
        // Most likely cause here is the OTP expiring in the gap between
        // ResetCodeScreen's check and this submit (5 minute window - see
        // auth.ts's emailOTP plugin config) - there's no separate field to
        // attach a more specific message to at this step, so it goes on the
        // password field like every other fallback error in this flow.
        setPasswordError("Something went wrong. Please try again.");
        return;
      }
      setShowSuccessModal(true);
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-y-auto overflow-x-hidden bg-white">
      <AuthHeaderBanner />

      <div className="absolute left-0 top-[90px] flex min-h-[380px] w-full flex-col items-center gap-8">
        <div className="flex min-h-[318px] w-full flex-col items-center gap-[32px] px-[24px]">
          <FluxaLogoLockup ref={logoRef} />

          <div className="flex min-h-[254px] w-full flex-col items-center justify-center gap-[12px]">
            <form className="flex w-full flex-col items-center gap-3" onSubmit={handleSubmit} noValidate>
              <AuthPasswordField
                id="password"
                name="password"
                label="New password*"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                error={passwordError}
                autoComplete="new-password"
              />

              <AuthPasswordField
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm new password*"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError(null);
                }}
                error={confirmPasswordError}
                autoComplete="new-password"
              />

              <div className="flex min-h-[66px] w-full flex-col items-center gap-3">
                <ButtonPrimary
                  type="submit"
                  disabled={isSubmitting}
                  className=""
                >
                  {isSubmitting ? "Changing password..." : "Reset password"}
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

      {/* Success feedback - green rather than the red used for field
          errors elsewhere, per the design token's `success` color scale
          (packages/design-tokens - the same source as `error`/`warning`). */}
      <Modal open={showSuccessModal} onClose={onBackToSignIn}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full">
          <svg width="38" height="32" viewBox="0 0 38 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="25.9287" cy="12" r="5" fill="#E23F8C" />
          <circle cx="32.9287" cy="5" r="5" fill="#E23F8C" />
          <path
            d="M15.5358 15.5357C17.4884 13.5831 20.6544 13.5831 22.607 15.5357C24.5595 17.4883 24.5596 20.6544 22.607 22.607L16.0641 29.149C15.9254 29.3327 15.7735 29.5099 15.6061 29.6773C14.6258 30.6576 13.3401 31.1452 12.0553 31.1412C10.7573 31.1555 9.45488 30.6686 8.46446 29.6783C8.29341 29.5072 8.13777 29.3263 7.99669 29.1382L1.46446 22.607C-0.488156 20.6544 -0.488154 17.4883 1.46446 15.5357C3.41709 13.5831 6.58313 13.5831 8.53575 15.5357L12.0348 19.0357L15.5358 15.5357Z"
            fill="url(#paint0_linear_381_2635)"
          />
          <defs>
            <linearGradient id="paint0_linear_381_2635" x1="7.89148" y1="31.1413" x2="12.2915" y2="13.1218" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6FF5F1" />
              <stop offset="0.2548" stopColor="#3B9CD6" />
              <stop offset="0.5" stopColor="#0955E5" />
              <stop offset="0.75" stopColor="#8E54C5" />
              <stop offset="1" stopColor="#E23F8C" />
            </linearGradient>
          </defs>
        </svg>
        </div>
        <p className="text-mobile-header-h1 mt-3 font-display text-text-black">
          Password changed successfully
        </p>
        <p className="text-mobile-text-md-regular  font-sans text-text-secondary">
          You can now sign in with your new password.
        </p>
      </Modal>
    </div>
  );
}
