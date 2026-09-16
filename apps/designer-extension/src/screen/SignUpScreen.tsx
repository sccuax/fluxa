import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { getEmailErrorMessage, getPasswordErrorMessage } from "../helpers/formRegex";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { Modal } from "../components/Modal";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { AuthTextField } from "../components/AuthTextField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { LegalFooterLinks } from "../components/LegalFooterLinks";
import { openGoogleSignInPopup } from "../services/googleSignIn";
import { DATA_CLIENT_URL } from "../services/apiClient";
import { trackEvent } from "../services/analytics";

interface SignUpScreenProps {
  onBackToSignIn: () => void;
}

// better-auth's generic sign-up error code for a duplicate email (see
// error.mjs - body.code is derived from the message
// "User already exists. Use another email." by upper-casing and stripping
// punctuation/spaces).
const USER_ALREADY_EXISTS_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

// The lockup's natural SVG height is 32px (see FluxaLogoLockup); the
// entrance animation below shrinks it to this height once it settles
// flush-left with the field labels.
const LOGO_SHRUNK_HEIGHT = 16;
const LOGO_NATURAL_HEIGHT = 32;

export function SignUpScreen({ onBackToSignIn }: SignUpScreenProps) {
  // Taller than SignInScreen's 552 to fit the two extra fields (full name,
  // confirm password) - no Figma spec exists yet for this screen, so this
  // is a functional estimate built from the same field-row heights used
  // there, not a pixel-exact value.
  useExtensionSize({ width: 320, height: 684 });

  const logoRef = useRef<HTMLDivElement>(null);

  // Entrance animation: the logo renders full-size and centered (its normal
  // CSS layout, same as SignInScreen), then slides left until flush with the
  // field labels below it while shrinking to LOGO_SHRUNK_HEIGHT. Only the
  // ending x position is computed from measurements (how far left it has to
  // travel to go from centered to flush-left) - the scale target is a fixed
  // ratio, so this doesn't depend on any hardcoded container width.
  // transform-origin "left center" keeps the (moving) left edge as the scale
  // pivot so the slide and the shrink read as one continuous motion instead
  // of fighting each other.
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

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAlreadyRegisteredModal, setShowAlreadyRegisteredModal] = useState(false);
  const [showAccountCreatedModal, setShowAccountCreatedModal] = useState(false);

  // A session cookie is already set at this point (both the email+password
  // and Google paths log the new user in as part of creating the account),
  // but per product direction sign-up always lands back on sign-in rather
  // than straight into the dashboard - the success modal's acknowledgement
  // is what sends them there.
  const handleAccountCreatedAcknowledge = () => {
    setShowAccountCreatedModal(false);
    onBackToSignIn();
  };

  const handleGoogleSignUp = async () => {
    try {
      const { error } = await openGoogleSignInPopup({ requestSignUp: true });
      if (error === "already_registered") {
        // Best-effort only - the popup itself already shows this message
        // directly and is the one channel guaranteed to reach the user (see
        // oauthPopup.ts). This only fires if postMessage happens to make it
        // back before the popup closes.
        setShowAlreadyRegisteredModal(true);
      } else if (error) {
        // TODO: surface other OAuth error codes once we've seen what they
        // look like testing against the real deployed Worker.
        console.error("Google sign-up error:", error);
      } else {
        trackEvent("sign_up_completed", "google");
        setShowAccountCreatedModal(true);
      }
    } catch {
      // Popup blocked, or closed with no session and no message - a genuine
      // user cancel, or an error page they closed themselves (see
      // oauthPopup.ts / googleSignIn.ts).
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedName = fullName.trim();
    let hasError = false;
    if (!trimmedName) {
      setNameError("Enter your name");
      hasError = true;
    } else {
      setNameError(null);
    }
    const emailErrorMessage = getEmailErrorMessage(email);
    if (emailErrorMessage) {
      setEmailError(emailErrorMessage);
      hasError = true;
    } else {
      setEmailError(null);
    }
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
      const res = await fetch(`${DATA_CLIENT_URL}/api/auth/sign-up/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: trimmedName }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null;
        setEmailError(
          body?.code === USER_ALREADY_EXISTS_CODE
            ? "An account with this email already exists"
            : null,
        );
        if (body?.code !== USER_ALREADY_EXISTS_CODE) {
          setPasswordError("Something went wrong. Please try again.");
        }
        return;
      }
      trackEvent("sign_up_completed", "email");
      setShowAccountCreatedModal(true);
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-y-auto overflow-x-hidden bg-white">
      <AuthHeaderBanner />

      <div className="absolute left-0 top-[90px] flex min-h-[562px] w-full flex-col items-center gap-[24px]">
        <div className="flex min-h-[500px] w-full flex-col items-center gap-6 px-[24px]">
          <FluxaLogoLockup ref={logoRef} />

          <div className="flex min-h-[436px] w-full flex-col items-center justify-center gap-[12px]">
            <form className="flex w-full flex-col items-center gap-3" onSubmit={handleSubmit} noValidate>
              <AuthTextField
                id="fullName"
                name="fullName"
                label="Full name*"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setNameError(null);
                }}
                placeholder="Jane Doe"
                error={nameError}
                autoComplete="name"
              />

              <AuthTextField
                id="email"
                name="email"
                label="Your email*"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="name@mail.com"
                error={emailError}
                autoComplete="email"
              />

              <AuthPasswordField
                id="password"
                name="password"
                label="Password*"
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
                label="Confirm password*"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError(null);
                }}
                error={confirmPasswordError}
                autoComplete="new-password"
              />

              {/* Submit */}
              <div className="flex min-h-[66px] w-full flex-col items-center gap-3">
                <ButtonPrimary
                  type="submit"
                  disabled={isSubmitting}
                  className=""
                >
                  {isSubmitting ? "Creating account..." : "Continue"}
                </ButtonPrimary>
                <div className="flex flex-row gap-3 w-full items-center justify-center">
                  <div className="h-[1px] w-full bg-border-border"></div>
                  <span className="text-mobile-text-md-medium text-text-secondary">or</span>
                  <div className="h-[1px] w-full bg-border-border"></div>
                </div>
              </div>
            </form>

            {/* Google sign-up + back to sign in */}
            <div className="flex min-h-[70px] w-full flex-col items-center gap-[12px]">
              <GoogleAuthButton label="Sign up with Google" onClick={handleGoogleSignUp} />
              <p className="text-center text-mobile-text-md-regular text-text-secondary">
                Already have an account?{" "}
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
        </div>

        <LegalFooterLinks className="pb-8" />
      </div>

      <Modal open={showAlreadyRegisteredModal} onClose={() => setShowAlreadyRegisteredModal(false)}>
        <p className="text-text-sm-medium font-sans text-text-black">
          You already have a Fluxa account with this Google account. Please sign in instead.
        </p>
        <ButtonPrimary onClick={() => setShowAlreadyRegisteredModal(false)}>Got it</ButtonPrimary>
      </Modal>

      <Modal open={showAccountCreatedModal} onClose={handleAccountCreatedAcknowledge}>
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
        <p className="text-mobile-header-h1 mt-3 font-display text-text-black">
          Your account was created <br />
          successfully
        </p>
        <p className="text-mobile-text-md-regular mb-[22px] font-sans text-text-secondary">
          If an account exists for that email,
        </p>
        <ButtonPrimary onClick={handleAccountCreatedAcknowledge}>Sign in</ButtonPrimary>
      </Modal>
    </div>
  );
}
