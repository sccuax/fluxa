import { useState, type FormEvent } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { useFormValidation } from "../hooks/useFormValidation";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { Modal } from "../components/Modal";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { AuthTextField } from "../components/AuthTextField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { openGoogleSignInPopup } from "../services/googleSignIn";
import { DATA_CLIENT_URL } from "../services/apiClient";

interface SignUpScreenProps {
  onBackToSignIn: () => void;
}

// better-auth's generic sign-up error code for a duplicate email (see
// error.mjs - body.code is derived from the message
// "User already exists. Use another email." by upper-casing and stripping
// punctuation/spaces).
const USER_ALREADY_EXISTS_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

export function SignUpScreen({ onBackToSignIn }: SignUpScreenProps) {
  // Taller than SignInScreen's 552 to fit the two extra fields (full name,
  // confirm password) - no Figma spec exists yet for this screen, so this
  // is a functional estimate built from the same field-row heights used
  // there, not a pixel-exact value.
  useExtensionSize({ width: 320, height: 684 });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formValidation = useFormValidation(email, password);
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
      setNameError("Full name is required");
      hasError = true;
    } else {
      setNameError(null);
    }
    if (!formValidation.isEmailValid) {
      setEmailError("Invalid email");
      hasError = true;
    } else {
      setEmailError(null);
    }
    if (!formValidation.password.isValid) {
      setPasswordError("Password must be at least 10 characters, with uppercase, lowercase, and a special character");
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
      setShowAccountCreatedModal(true);
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-white">
      <AuthHeaderBanner />

      <div className="absolute left-0 top-[90px] flex min-h-[562px] w-[320px] flex-col items-center gap-[48px]">
        <div className="flex min-h-[500px] w-full flex-col items-center gap-[32px] px-[24px]">
          <FluxaLogoLockup />

          <div className="flex min-h-[436px] w-full flex-col items-center justify-center gap-[12px]">
            <form className="flex w-full flex-col items-center gap-3" onSubmit={handleSubmit}>
              <AuthTextField
                id="fullName"
                name="fullName"
                label="Full name"
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
                label="Your email"
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
                label="Password"
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
                label="Confirm password"
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
                  className="shadow-[3px_0_6px_0_rgba(0,0,0,0.25)_inset,-10px_47px_13px_0_rgba(33,33,33,0.00),-6px_30px_12px_0_rgba(33,33,33,0.01),-4px_17px_10px_0_rgba(33,33,33,0.05),-2px_7px_8px_0_rgba(33,33,33,0.09),0_2px_4px_0_rgba(33,33,33,0.10)]"
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

      <Modal open={showAlreadyRegisteredModal} onClose={() => setShowAlreadyRegisteredModal(false)}>
        <p className="text-text-sm-medium font-sans text-text-black">
          You already have a Fluxa account with this Google account. Please sign in instead.
        </p>
        <ButtonPrimary onClick={() => setShowAlreadyRegisteredModal(false)}>Got it</ButtonPrimary>
      </Modal>

      <Modal open={showAccountCreatedModal} onClose={handleAccountCreatedAcknowledge}>
        <p className="text-text-sm-medium font-sans text-text-black">
          Your account was created successfully.
        </p>
        <ButtonPrimary onClick={handleAccountCreatedAcknowledge}>Sign in</ButtonPrimary>
      </Modal>
    </div>
  );
}
