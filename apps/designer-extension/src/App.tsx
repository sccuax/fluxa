import { useEffect, useState } from "react";
import { WelcomeScreen } from "./screen/WelcomeScreen";
import { SignInScreen } from "./screen/SignInScreen";
import { SignUpScreen } from "./screen/SignUpScreen";

type Screen = "welcome" | "signin" | "signup";

// Matches the welcome intro's 3s animation timeline (see WelcomeScreen.tsx)
// plus a short hold so the finished state is visible before moving on.
const WELCOME_SCREEN_DURATION_MS = 3600;

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");

  useEffect(() => {
    const timer = setTimeout(() => setScreen("signin"), WELCOME_SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (screen === "signin") return <SignInScreen onCreateAccount={() => setScreen("signup")} />;
  if (screen === "signup") return <SignUpScreen onBackToSignIn={() => setScreen("signin")} />;
  return <WelcomeScreen />;
}
