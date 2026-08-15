import { useState, type FormEvent } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { getEmailErrorMessage } from "../helpers/formRegex";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { Modal } from "../components/Modal";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { AuthTextField } from "../components/AuthTextField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { openGoogleSignInPopup } from "../services/googleSignIn";
import { DATA_CLIENT_URL } from "../services/apiClient";

interface SignInScreenProps {
  onCreateAccount: () => void;
  onSignInSuccess: () => void;
  onForgotPassword: () => void;
}

export function SignInScreen({ onCreateAccount, onSignInSuccess, onForgotPassword }: SignInScreenProps) {
  useExtensionSize({ width: 320, height: 552 });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await openGoogleSignInPopup();
      if (error === "signup_disabled") {
        setShowCreateAccountModal(true);
      } else if (error) {
        // TODO: surface other OAuth error codes once we've seen what they
        // look like testing against the real deployed Worker.
        console.error("Google sign-in error:", error);
      } else {
        onSignInSuccess();
      }
    } catch {
      // Popup blocked, or closed with no session and no message - a genuine
      // user cancel, or an error page they closed themselves (see
      // oauthPopup.ts, which shows its own feedback directly since it
      // usually can't relay one back here - see googleSignIn.ts).
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Email format is a client-side check; whether the email/password pair
    // actually matches a row in the database can only be answered by the
    // server, so that half is left to the API call below.
    const emailErrorMessage = getEmailErrorMessage(email);
    if (emailErrorMessage) {
      setEmailError(emailErrorMessage);
      return;
    }
    setEmailError(null);
    setPasswordError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`${DATA_CLIENT_URL}/api/auth/sign-in/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        // better-auth intentionally returns the same generic error whether
        // the email isn't registered or the password is wrong (it even hashes
        // a dummy password in the "no such user" case) - this prevents an
        // attacker from using the login form to enumerate registered emails,
        // so we surface that same generic message rather than a more
        // specific "this user doesn't exist".
        setPasswordError("Invalid email or password");
        return;
      }
      onSignInSuccess();
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-y-auto overflow-x-hidden bg-white">
      <AuthHeaderBanner />

      <div className="absolute left-0 top-[90px] flex min-h-[430px] w-full flex-col items-center gap-8">
        <div className="flex min-h-[368px] w-full flex-col items-center gap-[32px] px-[24px]">
          <FluxaLogoLockup />

          <div className="flex min-h-[304px] w-full flex-col items-center justify-center gap-[12px]">
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
              />

              {/* Submit + forgot password */}
              <div className="flex min-h-[66px] w-full flex-col items-center gap-3">
                <ButtonPrimary
                  type="submit"
                  disabled={isSubmitting}
                  className=""
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </ButtonPrimary>
                <div className="flex min-h-[16px] w-full justify-center">
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-mobile-text-md-medium text-text-black hover:underline"
                  >
                    Forgot Password
                  </button>
                </div>
                <div className="flex flex-row gap-3 w-full items-center justify-center">
                  <div className="h-[1px] w-full bg-border-border"></div>
                  <span className="text-mobile-text-md-medium text-text-secondary">or</span>
                  <div className="h-[1px] w-full bg-border-border"></div>
                </div>
              </div>
            </form>

            {/* Google sign-in + create account */}
            <div className="flex min-h-[70px] w-full flex-col items-center gap-[12px]">
              <GoogleAuthButton label="Sign in with Google" onClick={handleGoogleSignIn} />
              <p className="text-center text-mobile-text-md-regular text-text-secondary">
                Not registered?{" "}
                <button
                  type="button"
                  onClick={onCreateAccount}
                  className="text-text-black text-mobile-text-md-medium hover:underline"
                >
                  Create account
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

      <Modal open={showCreateAccountModal} onClose={() => setShowCreateAccountModal(false)}>
        <p className="text-text-sm-medium font-sans text-text-black">
          You need to create an account first.
        </p>
        <ButtonPrimary onClick={() => setShowCreateAccountModal(false)}>Got it</ButtonPrimary>
      </Modal>
    </div>
  );
}
