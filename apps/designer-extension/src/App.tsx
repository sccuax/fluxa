import { useEffect, useState } from "react";
import { WelcomeScreen } from "./screen/WelcomeScreen";
import { SignInScreen } from "./screen/SignInScreen";
import { SignUpScreen } from "./screen/SignUpScreen";
import { ForgotPasswordScreen } from "./screen/ForgotPasswordScreen";
import { DashboardScreen } from "./screen/DashboardScreen";

type Screen = "welcome" | "signin" | "signup" | "forgotpassword" | "dashboard";

// Matches the welcome intro's 3s animation timeline (see WelcomeScreen.tsx)
// plus a short hold so the finished state is visible before moving on.
const WELCOME_SCREEN_DURATION_MS = 3600;

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");

  useEffect(() => {
    const timer = setTimeout(() => setScreen("signin"), WELCOME_SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

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
  if (screen === "forgotpassword") return <ForgotPasswordScreen onBackToSignIn={() => setScreen("signin")} />;
  if (screen === "dashboard") return <DashboardScreen />;
  return <WelcomeScreen />;
}
