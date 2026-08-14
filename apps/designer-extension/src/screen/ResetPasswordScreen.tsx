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
                  className="shadow-[3px_0_6px_0_rgba(0,0,0,0.25)_inset,-10px_47px_13px_0_rgba(33,33,33,0.00),-6px_30px_12px_0_rgba(33,33,33,0.01),-4px_17px_10px_0_rgba(33,33,33,0.05),-2px_7px_8px_0_rgba(33,33,33,0.09),0_2px_4px_0_rgba(33,33,33,0.10)]"
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-100">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 10.5L8 14.5L16 6"
              className="stroke-success-500"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-text-sm-medium font-sans text-success-500">Password changed successfully</p>
        <ButtonPrimary onClick={onBackToSignIn}>Continue to Sign In</ButtonPrimary>
      </Modal>
    </div>
  );
}
