import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { getEmailErrorMessage } from "../helpers/formRegex";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { AuthTextField } from "../components/AuthTextField";
import { DATA_CLIENT_URL } from "../services/apiClient";

interface ForgotPasswordScreenProps {
  onBackToSignIn: () => void;
  onCodeRequested: (email: string) => void;
}

// Mirrors ResetCodeScreen's RATE_LIMIT_MESSAGE - same server-side ceiling (5
// request-password-reset calls / 24h / IP, see auth.ts's emailOTP rateLimit
// config), just phrased for the first request rather than a resend. Detected
// from the real 429 response, not counted client-side.
const RATE_LIMIT_MESSAGE = "You've reached the daily limit for reset emails. Please try again in 24 hours.";

// The lockup's natural SVG height is 32px (see FluxaLogoLockup); the
// entrance animation below shrinks it to this height once it settles
// flush-left with the field label (same as SignUpScreen).
const LOGO_SHRUNK_HEIGHT = 16;
const LOGO_NATURAL_HEIGHT = 32;

export function ForgotPasswordScreen({ onBackToSignIn, onCodeRequested }: ForgotPasswordScreenProps) {
  // Shorter than SignInScreen's 552 since this screen only has one field and
  // no Google/divider block - a functional estimate built from the same
  // field-row heights used there, not a pixel-exact value (no Figma spec yet).
  useExtensionSize({ width: 320, height: 420 });

  const logoRef = useRef<HTMLDivElement>(null);

  // Same entrance animation as SignUpScreen: the logo renders full-size and
  // centered, then slides left while shrinking to LOGO_SHRUNK_HEIGHT until
  // flush with the field label below it. See SignUpScreen for the full
  // rationale (transform-origin, why only the x offset is measured).
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

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emailErrorMessage = getEmailErrorMessage(email);
    if (emailErrorMessage) {
      setEmailError(emailErrorMessage);
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);
    try {
      // better-auth's /email-otp/request-password-reset always returns
      // { success: true } regardless of whether the email is registered (no
      // verification row gets created for an unknown email, so no OTP is
      // ever sent) - same anti-enumeration stance as sign-in (see CLAUDE.md's
      // "Email+password sign-in..." section), so this moves on to
      // ResetCodeScreen unconditionally rather than branching on a "found"
      // vs "not found" response that doesn't exist.
      const res = await fetch(`${DATA_CLIENT_URL}/api/auth/email-otp/request-password-reset`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Rate limit is the one case worth breaking the "always advance"
      // anti-enumeration stance above for: it doesn't depend on whether the
      // email is registered (it's keyed by IP), so surfacing it here doesn't
      // leak anything - and advancing to ResetCodeScreen anyway would just
      // strand the user waiting on a code the server never sent.
      if (res.status === 429) {
        setEmailError(RATE_LIMIT_MESSAGE);
        return;
      }
      onCodeRequested(email);
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-y-auto overflow-x-hidden bg-white">
      <AuthHeaderBanner />

      <div className="absolute left-0 top-[90px] flex min-h-[300px] w-full flex-col items-center gap-8">
        <div className="flex min-h-[238px] w-full flex-col items-center gap-[32px] px-[24px]">
          <FluxaLogoLockup ref={logoRef} />

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
                <ButtonPrimary type="submit" disabled={isSubmitting} className="">
                  {isSubmitting ? "Sending..." : "Send an email"}
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
