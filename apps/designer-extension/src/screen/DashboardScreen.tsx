import { useExtensionSize } from "../hooks/useExtensionSize";

// Bare placeholder - only exists to prove the post-sign-in redirect works
// against real credentials. Real dashboard content/design comes later.
export function DashboardScreen() {
  useExtensionSize("large");

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-white">
      <p className="text-text-sm-medium font-sans text-text-black">Dashboard</p>
    </div>
  );
}
