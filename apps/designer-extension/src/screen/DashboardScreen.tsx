import { useState } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { DashboardHeader } from "../components/DashboardHeader";
import { DashboardNav, type DashboardTab } from "../components/DashboardNav";
import { EditorTab } from "../components/EditorTab";

// Height is a functional estimate (no full Figma spec yet, same approach as
// ForgotPasswordScreen/ResetCodeScreen) - width is the fixed 320px every
// other screen in this app uses. Revisit once the rest of the Editor tab
// (live gradient preview when something IS selected) is built and the real
// total height is known.
const DASHBOARD_SIZE = { width: 320, height: 540 };

// DashboardHeader and DashboardNav are being built element-by-element
// against Figma - EditorTab covers the Editor tab (no-selection state,
// supported-elements guide, Apply button); the Presets/Account tabs' content
// is next. Real dashboard content otherwise still TODO.
export function DashboardScreen() {
  useExtensionSize(DASHBOARD_SIZE);

  // Owned here (not by DashboardNav) since header and center content will
  // both eventually need to react to the active tab too.
  const [activeTab, setActiveTab] = useState<DashboardTab>("editor");

  return (
    <div className="flex h-screen w-full flex-col bg-white">
      <DashboardHeader />
      {/* flex-1 (not h-full - see CLAUDE.md's SignIn/SignUp layout gotchas
          for the same class of bug) so this takes exactly the remaining
          space between header and nav. overflow-hidden (not overflow-y-auto
          - moved down into EditorTab's own ControlPanel fields container, so
          only that scrolls and the preview/tab bar/Apply button stay fixed
          in view) + min-h-0 so this flex child is actually allowed to be
          constrained to the available height instead of growing to fit
          EditorTab's content (the default flex min-height:auto would
          otherwise let it overflow the fixed-height panel). */}
      <div className="flex-1 min-h-0 overflow-hidden bg-background-white">
        {activeTab === "editor" && <EditorTab />}
      </div>
      <DashboardNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
