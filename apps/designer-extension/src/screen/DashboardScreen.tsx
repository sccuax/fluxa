import { useState } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { DashboardHeader } from "../components/DashboardHeader";
import { DashboardNav, DASHBOARD_TABS, type DashboardTab } from "../components/DashboardNav";
import { EditorTab } from "../components/EditorTab";
import { PresetsTab } from "../components/PresetsTab";
import { AccountTab } from "./AccountTab";
import { trackEvent } from "../services/analytics";

// Height is a functional estimate (no full Figma spec yet, same approach as
// ForgotPasswordScreen/ResetCodeScreen) - width is the fixed 320px every
// other screen in this app uses. Revisit once the rest of the Editor tab
// (live gradient preview when something IS selected) is built and the real
// total height is known.
const DASHBOARD_SIZE = { width: 320, height: 540 };

// DashboardHeader and DashboardNav are being built element-by-element
// against Figma - EditorTab covers the Editor tab (no-selection state,
// supported-elements guide, Apply button); AccountTab now covers the first
// two rows of the Account tab (profile card, plan/usage card - more rows to
// come, see that file's own comment). The Presets tab is just a "Locked"
// coming-soon placeholder (PresetsTab.tsx) - not real content yet.
export function DashboardScreen({
  onSignOut,
  onSwitchToWebflowSolutions,
}: {
  onSignOut: () => void;
  onSwitchToWebflowSolutions: () => void;
}) {
  useExtensionSize(DASHBOARD_SIZE);

  // Owned here (not by DashboardNav) since header and center content will
  // both eventually need to react to the active tab too.
  const [activeTab, setActiveTab] = useState<DashboardTab>("editor");

  // Editor tab's intro gate: EditorTab shows EditorEmptyState +
  // SupportedElementsGuide + an "Accept" button until this flips true, then
  // it shows the real GradientCanvas + ControlPanel. Owned here (not in
  // EditorTab) so switching to Presets/Account and back doesn't re-show the
  // intro - it only resets on a fresh mount of DashboardScreen (sign-in).
  const [editorAccepted, setEditorAccepted] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col bg-white">
      <DashboardHeader
        activeService="shaders"
        onSelectShaders={() => {}}
        onSelectWebflowSolutions={onSwitchToWebflowSolutions}
      />
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
        {activeTab === "editor" && (
          <EditorTab accepted={editorAccepted} onAccept={() => setEditorAccepted(true)} />
        )}
        {activeTab === "presets" && <PresetsTab />}
        {activeTab === "account" && <AccountTab onSignOut={onSignOut} />}
      </div>
      <DashboardNav
        tabs={DASHBOARD_TABS}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          trackEvent("switch_tab", tab);
        }}
      />
    </div>
  );
}
