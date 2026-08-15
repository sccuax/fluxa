import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { getOtpCodeErrorMessage, OTP_CODE_LENGTH } from "../helpers/formRegex";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { OtpCodeInput } from "../components/OtpCodeInput";
import { DATA_CLIENT_URL } from "../services/apiClient";

// UI-side pacing so the resend link can't be mashed - independent of (and
// much shorter than) the server-side cap below, which is the real ceiling.
const RESEND_COOLDOWN_SECONDS = 90;

// Mirrors auth.ts's emailOTP plugin rateLimit config (5 requests / 24h to
// request-password-reset, enforced server-side via the database-backed rate
// limiter) - used here only to phrase the lockout message; the actual limit
// is detected from the real 429 response, not counted client-side, since a
// user could always reload the extension and reset a local counter.
const RATE_LIMIT_MESSAGE = "You've reached the resend limit. Please try again in 24 hours.";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface ResetCodeScreenProps {
  email: string;
  // Passes the verified code up rather than re-deriving it later - better-
  // auth's check-verification-otp step (below) validates the OTP without
  // consuming it, but the final /email-otp/reset-password step (see
  // ResetPasswordScreen) needs that same OTP again to actually consume it,
  // so App.tsx has to carry it forward.
  onCodeVerified: (code: string) => void;
  onBackToSignIn: () => void;
}

// The lockup's natural SVG height is 32px (see FluxaLogoLockup); the
// entrance animation below shrinks it to this height once it settles
// flush-left with the field label - same animation as every other Auth*
// screen (SignUpScreen, ForgotPasswordScreen).
const LOGO_SHRUNK_HEIGHT = 16;
const LOGO_NATURAL_HEIGHT = 32;

// Second step of the password-reset flow (see ForgotPasswordScreen). A code
// (OTP), not a magic link, since the extension only ever runs inside an
// iframe inside the Webflow Designer - a link opened from an email client
// lands in a completely different browsing context with no way to signal
// back into that iframe (no postMessage target, no redirect that lands
// back inside the extension). A short code the user copies back in here
// sidesteps that entirely; better-auth's `emailOTP` plugin is the intended
// backend for this once wired up (see TODO in handleSubmit).
export function ResetCodeScreen({ email, onCodeVerified, onBackToSignIn }: ResetCodeScreenProps) {
  // Same functional-estimate approach as ForgotPasswordScreen's 420 (no
  // Figma spec yet) - taller to fit the "we sent a code to..." caption and
  // the resend-countdown row above/below the field.
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

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ticks once a second for the life of the screen; resendSecondsLeft is
  // reset back to RESEND_COOLDOWN_SECONDS on a successful resend rather than
  // this effect being restarted, so one interval covers the whole flow.
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  // Set once a resend attempt gets a real 429 from the server - sticky for
  // the rest of this screen's lifetime (the actual reset only happens
  // server-side after 24h, so there's nothing a local timer could count
  // down to that would be honest).
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setResendSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResend = async () => {
    if (isResending || isRateLimited || resendSecondsLeft > 0) return;
    setIsResending(true);
    try {
      const res = await fetch(`${DATA_CLIENT_URL}/api/auth/email-otp/request-password-reset`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setIsRateLimited(true);
        return;
      }
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch {
      // Resend failing silently just leaves the link enabled again below to
      // retry - no dedicated error slot for this action.
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const codeErrorMessage = getOtpCodeErrorMessage(code);
    if (codeErrorMessage) {
      setCodeError(codeErrorMessage);
      return;
    }
    setCodeError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`${DATA_CLIENT_URL}/api/auth/email-otp/check-verification-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, type: "forget-password" }),
      });
      if (!res.ok) {
        // Collapsed to one generic message regardless of the underlying
        // reason (invalid code, expired, or - for an email that was never
        // registered in the first place - better-auth's own USER_NOT_FOUND):
        // surfacing that last case distinctly would leak account existence
        // through this screen, undoing the anti-enumeration behavior
        // ForgotPasswordScreen's request step already relies on.
        setCodeError("Invalid or expired code. Please try again.");
        return;
      }
      onCodeVerified(code);
    } catch {
      setCodeError("Something went wrong. Please try again.");
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
            <p className="text-center text-mobile-text-md-regular text-text-secondary">
              We sent a {OTP_CODE_LENGTH}-digit code to <span className="text-text-black">{email}</span>
            </p>

            <form className="flex w-full flex-col items-center gap-3" onSubmit={handleSubmit} noValidate>
              <div className="flex w-full flex-col items-center gap-2">
                <label className="text-mobile-text-md-medium font-sans">Verification code</label>
                <OtpCodeInput
                  length={OTP_CODE_LENGTH}
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setCodeError(null);
                  }}
                  error={codeError}
                  disabled={isSubmitting}
                />
              </div>

              {isRateLimited ? (
                <p className="text-center text-[10px] text-error-800">{RATE_LIMIT_MESSAGE}</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendSecondsLeft > 0 || isResending}
                  className="text-mobile-text-md-regular text-text-secondary enabled:text-text-black enabled:hover:underline disabled:cursor-default"
                >
                  {resendSecondsLeft > 0
                    ? `Didn't receive the code? Resend email in ${formatCountdown(resendSecondsLeft)}`
                    : isResending
                      ? "Resending..."
                      : "Didn't receive the code? Resend email"}
                </button>
              )}

              <div className="flex min-h-[66px] w-full flex-col items-center gap-3">
                <ButtonPrimary
                  type="submit"
                  disabled={isSubmitting}
                  className=""
                >
                  {isSubmitting ? "Verifying..." : "Verify code"}
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
