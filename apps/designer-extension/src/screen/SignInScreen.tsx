import { useState, type FormEvent } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { useFormValidation } from "../hooks/useFormValidation";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { EyeIcon } from "../components/EyeIcon";
import { EyeOffIcon } from "../components/EyeOffIcon";
import { Modal } from "../components/Modal";
import { openGoogleSignInPopup } from "../services/googleSignIn";
import { DATA_CLIENT_URL } from "../services/apiClient";

interface SignInScreenProps {
  onCreateAccount: () => void;
}

// Structural skeleton only - layout/spacing (flex, gap, position) mirrors the
// Figma export 1:1, but colors/fonts/borders are intentionally left out so
// tokens from @fluxa/design-tokens can be applied on top via className.
// Banner + logo lockup are left as empty placeholders on purpose (pending design).
export function SignInScreen({ onCreateAccount }: SignInScreenProps) {
  useExtensionSize({ width: 320, height: 552 });
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formValidation = useFormValidation(email, password);
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
      }
      // else: success - a session cookie is set; navigating away from this
      // screen once that flow exists is out of scope for now.
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
    if (!formValidation.isEmailValid) {
      setEmailError("Invalid email");
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
      // else: success - a session cookie is set; navigating away from this
      // screen once that flow exists is out of scope for now.
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-white">
      {/* Decorative header banner - gradient blob artwork from Figma, clipped
          to this exact 320x86 box. The source SVG's own viewBox already
          matches these dimensions, so the browser's default SVG viewport
          clipping reproduces Figma's vector mask without needing a separate
          clip-path here. */}
      <div className="absolute left-0 top-0 h-[86px] w-[320px] overflow-hidden">
        <img src="/images/signin-header-bg.svg" alt="" className="h-full w-full" />
      </div>

      <div className="absolute left-0 top-[90px] flex min-h-[430px] w-[320px] flex-col items-center gap-[48px]">
        <div className="flex min-h-[368px] w-full flex-col items-center gap-[32px] px-[24px]">
          {/* Logo lockup (mark + wordmark) - empty on purpose, pending design */}
          <div className="flex items-center gap-[16px]">
            <svg width="137" height="32" viewBox="0 0 137 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32 24.0013C32 28.422 28.417 32 24.0013 32C19.5856 32 16.0025 28.417 16.0025 24.0013C16.0025 28.422 12.4195 32 8.00379 32C3.58808 32 0 28.417 0 24.0013C0 19.5856 3.58303 16.0025 7.99874 16.0025C3.58303 15.9975 0 12.4195 0 7.99874C0 5.78836 0.893234 3.78994 2.34159 2.34159C3.78994 0.893234 5.78836 0 7.99874 0H23.9962C28.4119 0 31.995 3.58303 31.995 7.99874C31.995 10.2091 31.1017 12.2075 29.6534 13.6559C28.205 15.1042 26.2066 15.9975 23.9962 15.9975C28.4119 15.9975 31.995 19.5805 31.995 23.9962L32 24.0013Z" fill="url(#paint0_linear_69_1249)" />
              <path d="M52.5872 8.62705V15.4298H64.0075V19.25H52.5872V28.6718H47.9999V4.66553H65.4609V8.62705H52.5872Z" fill="#0B0D12" />
              <path d="M68.8421 28.6719V2.84375H73.3537V28.6719H68.8421Z" fill="#0B0D12" />
              <path d="M84.6326 29.1463C82.4526 29.1463 80.8074 28.3994 79.7022 26.9107C78.597 25.4169 78.0469 23.1561 78.0469 20.1282V9.65161H82.6645V19.6185C82.6645 21.5362 82.9572 22.9643 83.5376 23.9131C84.1179 24.8568 85.0162 25.3312 86.2274 25.3312C86.9288 25.3312 87.5495 25.1545 88.0845 24.8013C88.6194 24.448 89.0786 23.9535 89.4672 23.3075C89.8558 22.6666 90.1636 21.9197 90.3958 21.0719C90.6279 20.2241 90.7642 19.2905 90.8146 18.2711V9.65161H95.3969V28.677H91.612L91.6826 22.6767H91.0266C90.7087 24.2058 90.2696 25.4422 89.6994 26.3859C89.1291 27.3296 88.4327 28.031 87.6101 28.4751C86.7875 28.9243 85.7934 29.1463 84.6276 29.1463H84.6326Z" fill="#0B0D12" />
              <path d="M98.45 28.672L104.814 19.1794L98.45 9.65161H103.759L107.544 16.9993H108.124L111.909 9.65161H117.218L110.854 19.1794L117.294 28.672H112.02L108.129 21.2889H107.549L103.804 28.672H98.4551H98.45Z" fill="#0B0D12" />
              <path d="M136.228 26.1082C136.168 25.225 136.117 24.3419 136.082 23.4537C136.047 22.5706 136.026 21.7126 136.026 20.8901V17.3272C136.026 15.4348 135.749 13.8905 135.189 12.6895C134.634 11.4884 133.781 10.6052 132.645 10.035C131.505 9.46473 130.051 9.18213 128.28 9.18213C127.114 9.18213 126.049 9.30325 125.081 9.54548C124.112 9.78771 123.249 10.1662 122.497 10.6709C121.745 11.1806 121.114 11.7912 120.604 12.5078C120.095 13.2244 119.706 14.0672 119.439 15.0361L123.546 16.3078C123.718 15.46 124.031 14.7737 124.495 14.2539C124.954 13.7341 125.51 13.3506 126.15 13.1083C126.791 12.8661 127.468 12.745 128.169 12.745C129.335 12.745 130.178 13.0175 130.697 13.5625C131.217 14.1075 131.48 14.7585 131.48 15.5105C131.48 16.0202 131.358 16.4037 131.116 16.656C130.874 16.9084 130.49 17.1001 129.971 17.2212C129.451 17.3424 128.775 17.4635 127.952 17.5846C126.448 17.8016 125.141 18.064 124.021 18.3668C122.906 18.6696 121.972 19.0481 121.22 19.4922C120.468 19.9413 119.903 20.5166 119.529 21.2231C119.151 21.9246 118.964 22.7724 118.964 23.7716C118.964 24.9576 119.201 25.9517 119.676 26.7541C120.15 27.5565 120.796 28.1571 121.624 28.5557C122.446 28.9544 123.38 29.1563 124.425 29.1563C125.61 29.1563 126.66 28.9292 127.574 28.4851C128.482 28.0359 129.254 27.4304 129.885 26.6683C130.516 25.9063 131 25.0635 131.338 24.14H131.924C131.969 24.9424 132.03 25.7297 132.105 26.5068C132.176 27.284 132.262 28.0107 132.363 28.6869H136.471C136.375 27.8644 136.294 27.0064 136.233 26.1233L136.228 26.1082ZM130.536 23.489C130.122 23.9836 129.673 24.4075 129.188 24.7456C128.704 25.0837 128.209 25.3411 127.715 25.5127C127.215 25.6843 126.726 25.7701 126.241 25.7701C125.414 25.7701 124.737 25.5379 124.202 25.0787C123.668 24.6194 123.4 23.9735 123.4 23.1509C123.4 22.4949 123.557 21.9801 123.874 21.6067C124.192 21.2332 124.616 20.9405 125.146 20.7336C125.681 20.5267 126.282 20.3602 126.948 20.2239C127.614 20.0927 128.28 19.9766 128.946 19.8808C129.612 19.7849 130.248 19.6385 130.854 19.4468C131.091 19.3711 131.318 19.2802 131.525 19.1843L131.58 21.7379C131.288 22.4192 130.94 23.0046 130.526 23.5042L130.536 23.489Z" fill="#0B0D12" />
              <defs>
                <linearGradient id="paint0_linear_69_1249" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6FF5F1" />
                  <stop offset="0.3" stop-color="#3B9DD6" />
                  <stop offset="0.504808" stop-color="#0644BB" />
                  <stop offset="0.701923" stop-color="#7442A4" />
                  <stop offset="1" stop-color="#E23F8C" />
                </linearGradient>
              </defs>
            </svg>

          </div>

          <div className="flex min-h-[304px] w-full flex-col items-center justify-center gap-[12px]">
            <form className="flex w-full flex-col items-center gap-3" onSubmit={handleSubmit}>
              {/* Email field */}
              <div className="flex min-h-[66px] w-full items-start gap-3">
                <div className="flex min-h-[66px] w-full flex-1 flex-col items-start gap-2">
                  <label className="text-mobile-text-md-medium font-sans" htmlFor="email">Your email</label>
                  <div className="relative w-full h-[42px] flex justify-center border border-border-border pl-4 rounded-4">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(null);
                      }}
                      placeholder="name@mail.com"
                      className="w-full flex-1 text-text-sm-regular focus:outline-none"
                    />
                    {emailError && (
                      <span className="absolute right-0 top-full mt-1 text-[10px] text-error-800">{emailError}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Password field */}
              <div className="flex flex-col min-h-[66px] w-full items-start gap-2">
                <label className="text-mobile-text-md-medium font-sans" htmlFor="password">Password</label>
                <div className="relative flex min-h-[42px] w-full items-center rounded-4 border border-border-border pl-4 pr-3">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    placeholder="******"
                    className={`w-full flex-1 text-text-sm-regular placeholder:text-text-secondary placeholder:[-webkit-text-fill-color:var(--text-secondary)] focus:outline-none ${
                      showPassword
                        ? ""
                        : "text-transparent [-webkit-text-fill-color:transparent] caret-neutral-900 selection:text-transparent selection:[-webkit-text-fill-color:transparent]"
                    }`}
                  />
                  {!showPassword && password.length > 0 && (
                    <span className="pointer-events-none absolute left-4 text-text-sm-regular text-text-secondary">
                      {"*".repeat(password.length)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="shrink-0 text-text-secondary"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {passwordError && (
                  <span className="text-[10px] text-error-800">{passwordError}</span>
                )}
              </div>

              {/* Submit + forgot password */}
              <div className="flex min-h-[66px] w-full flex-col items-center gap-[8px]">
                <ButtonPrimary
                  type="submit"
                  disabled={isSubmitting}
                  className="shadow-[3px_0_6px_0_rgba(0,0,0,0.25)_inset,-10px_47px_13px_0_rgba(33,33,33,0.00),-6px_30px_12px_0_rgba(33,33,33,0.01),-4px_17px_10px_0_rgba(33,33,33,0.05),-2px_7px_8px_0_rgba(33,33,33,0.09),0_2px_4px_0_rgba(33,33,33,0.10)]"
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </ButtonPrimary>
                <div className="flex min-h-[16px] w-full justify-end">
                  <button type="button" className="text-mobile-text-md-medium text-text-black hover:underline">Forgot Password</button>
                </div>
              </div>
            </form>

            {/* Google sign-in + create account */}
            <div className="flex min-h-[70px] w-full flex-col items-center gap-[12px]">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="flex min-h-[42px] w-full items-center justify-center gap-[8px] border border-border-border rounded-4 text-text-sm-medium text-[#212121]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clip-path="url(#clip0_150_923)">
                    <path d="M15.844 8.18429C15.844 7.64047 15.7999 7.09371 15.7058 6.55872H8.15997V9.63937H12.4811C12.3018 10.6329 11.7257 11.5119 10.882 12.0704V14.0693H13.46C14.9739 12.6759 15.844 10.6182 15.844 8.18429Z" fill="#4285F4" />
                    <path d="M8.15999 16.0006C10.3176 16.0006 12.1372 15.2922 13.4629 14.0693L10.885 12.0704C10.1677 12.5584 9.24174 12.8347 8.16293 12.8347C6.07584 12.8347 4.30623 11.4266 3.67128 9.53357H1.01099V11.5942C2.36906 14.2956 5.13518 16.0006 8.15999 16.0006V16.0006Z" fill="#34A853" />
                    <path d="M3.66833 9.53356C3.33322 8.53999 3.33322 7.46411 3.66833 6.47054V4.40991H1.01097C-0.123694 6.67043 -0.123694 9.33367 1.01097 11.5942L3.66833 9.53356V9.53356Z" fill="#FBBC04" />
                    <path d="M8.15999 3.16644C9.30053 3.1488 10.4029 3.57798 11.2289 4.36578L13.5129 2.08174C12.0667 0.72367 10.1471 -0.0229773 8.15999 0.000539111C5.13518 0.000539111 2.36906 1.70548 1.01099 4.40987L3.66834 6.4705C4.30035 4.57449 6.0729 3.16644 8.15999 3.16644V3.16644Z" fill="#EA4335" />
                  </g>
                  <defs>
                    <clipPath id="clip0_150_923">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>

                Sign in with Google
              </button>
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
