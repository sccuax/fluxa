import { useEffect, useState } from "react";
import { WelcomeScreen } from "./screen/WelcomeScreen";
import { SignInScreen } from "./screen/SignInScreen";
import { SignUpScreen } from "./screen/SignUpScreen";
import { ForgotPasswordScreen } from "./screen/ForgotPasswordScreen";
import { ResetCodeScreen } from "./screen/ResetCodeScreen";
import { ResetPasswordScreen } from "./screen/ResetPasswordScreen";
import { DashboardScreen } from "./screen/DashboardScreen";
import { apiFetch } from "./services/apiClient";

type Screen = "welcome" | "signin" | "signup" | "forgotpassword" | "resetcode" | "resetpassword" | "dashboard";

// Matches the welcome intro's 3s animation timeline (see WelcomeScreen.tsx)
// plus a short hold so the finished state is visible before moving on.
const WELCOME_SCREEN_DURATION_MS = 3600;

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  // Lifted here (not local to ForgotPasswordScreen/ResetCodeScreen) so later
  // steps can reuse them - the three screens are separate steps of one flow
  // but don't render at the same time, so this has to live above all of
  // them. resetOtp specifically: ResetCodeScreen's check-verification-otp
  // call validates the code without consuming it, but ResetPasswordScreen's
  // reset-password call needs that same code again to actually consume it.
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");

  // Restores an already-signed-in session on load - previously nothing here
  // ever checked for one, so every fresh mount (a plain reload while
  // iterating on changes included) fell through Welcome -> SignInScreen
  // unconditionally, regardless of whether the session cookie itself was
  // still valid. This is a real, separate bug from - and was masked by -
  // the session-cookie-persistence work in auth.ts/partitionedCookies.ts:
  // fixing the cookie alone was never going to change this on its own,
  // since nothing here ever looked at it to begin with. `welcomeElapsed`/
  // `hasSession` are waited on TOGETHER, not raced against each other - a
  // still-pending `/api/me` check when the welcome animation's own minimum
  // hold time elapses holds the screen a beat longer rather than
  // misrouting a real session to sign-in just because the check happened
  // to be slow.
  const [welcomeElapsed, setWelcomeElapsed] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setWelcomeElapsed(true), WELCOME_SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ user: unknown }>("/api/me")
      .then((data) => {
        if (!cancelled) setHasSession(!!data.user);
      })
      .catch(() => {
        if (!cancelled) setHasSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!welcomeElapsed || hasSession === null) return;
    setScreen(hasSession ? "dashboard" : "signin");
  }, [welcomeElapsed, hasSession]);

  if (screen === "signin") {
    return (
      <SignInScreen
        onCreateAccount={() => setScreen("signup")}
        onSignInSuccess={() => setScreen("dashboard")}
        onForgotPassword={() => setScreen("forgotpassword")}
      />
    );
  }
  if (screen === "signup") return <SignUpScreen onBackToSignIn={() => setScreen("signin")} />;
  if (screen === "forgotpassword") {
    return (
      <ForgotPasswordScreen
        onBackToSignIn={() => setScreen("signin")}
        onCodeRequested={(email) => {
          setResetEmail(email);
          setScreen("resetcode");
        }}
      />
    );
  }
  if (screen === "resetcode") {
    return (
      <ResetCodeScreen
        email={resetEmail}
        onCodeVerified={(code) => {
          setResetOtp(code);
          setScreen("resetpassword");
        }}
        onBackToSignIn={() => setScreen("signin")}
      />
    );
  }
  if (screen === "resetpassword") {
    return (
      <ResetPasswordScreen email={resetEmail} otp={resetOtp} onBackToSignIn={() => setScreen("signin")} />
    );
  }
  if (screen === "dashboard") return <DashboardScreen onSignOut={() => setScreen("signin")} />;
  return <WelcomeScreen />;
}
