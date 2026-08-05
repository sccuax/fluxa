import { useExtensionSize } from "../hooks/useExtensionSize";

interface SignUpScreenProps {
  onBackToSignIn: () => void;
}

// Basic placeholder - fields, validation, and the real sign-up call aren't
// built yet. Will follow the same pattern as SignInScreen.tsx once designed.
export function SignUpScreen({ onBackToSignIn }: SignUpScreenProps) {
  useExtensionSize({ width: 320, height: 552 });

  return (
    <div className="relative flex h-screen w-[320px] flex-col items-center justify-center gap-4 bg-white">
      <p className="text-text-sm-medium font-sans text-text-black">Sign up</p>
      <button
        type="button"
        onClick={onBackToSignIn}
        className="text-mobile-text-md-medium text-text-black hover:underline"
      >
        Back to sign in
      </button>
    </div>
  );
}
