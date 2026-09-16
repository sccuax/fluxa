import { useState } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { PanelHeader } from "../components/PanelHeader";
import { ProfileCard } from "../components/ProfileCard";
import { PlanCard } from "../components/PlanCard";
import { LinksCard } from "../components/LinksCard";
import { LogoutButton } from "../components/LogoutButton";
import { LegalFooterLinks } from "../components/LegalFooterLinks";
import { useAccountUser } from "../hooks/useAccountUser";
import { ManageProfileScreen, MANAGE_PROFILE_SIZE } from "./ManageProfileScreen";
import { trackEvent } from "../services/analytics";

// Matches DashboardScreen's own DASHBOARD_SIZE value - redefined here
// (rather than imported from there) since this is the size *this tab*
// needs to restore when leaving ManageProfileScreen, not a reference to
// DashboardScreen's own constant; every other screen in this app similarly
// owns its own size value instead of cross-importing one.
const ACCOUNT_SIZE = { width: 320, height: 540 };

// Account tab content (DashboardScreen's third tab). Header matches the
// color-picker modal's own PanelHeader, but titled "Account" with the
// underlined-title variant (per explicit direction to reuse that header as
// a shared component). Main area: px-5, pt-3, pb-8, column, gap-4. Purely a
// composition of the individual account-section components (each owning its
// own data/styling) - see components/ProfileCard.tsx, PlanCard.tsx,
// LinksCard.tsx, LogoutButton.tsx.
export function AccountTab({ onSignOut }: { onSignOut: () => void }) {
  const [user, setUser] = useAccountUser();
  // Local, not lifted to DashboardScreen - ManageProfileScreen is a sub-view
  // of this tab only, reached via ProfileCard's own chevron (see that
  // file). Switching away to another DashboardNav tab and back remounts
  // AccountTab, which naturally resets this back to the account list - the
  // implicit "back" path until ManageProfileScreen's own back button (now
  // wired via PanelHeader's onBack) is used instead.
  const [showManageProfile, setShowManageProfile] = useState(false);

  // Owns the panel-size switch for both this tab and ManageProfileScreen
  // (rather than each screen calling its own useExtensionSize) because this
  // is the one place that knows about *both* sizes and the transition
  // between them - calling it unconditionally, keyed off showManageProfile,
  // is what correctly restores ACCOUNT_SIZE on the way back. Two separate
  // useExtensionSize calls (one here fixed to ACCOUNT_SIZE, one in
  // ManageProfileScreen fixed to its own size) would race on the render
  // where showManageProfile flips true: React runs a newly-mounted child's
  // effects before its parent's on the same commit, so ManageProfileScreen's
  // own call would apply first and this one would immediately overwrite it
  // back to 540 straight after - this single keyed call avoids that
  // entirely by only ever asserting one size per transition.
  useExtensionSize(showManageProfile ? MANAGE_PROFILE_SIZE : ACCOUNT_SIZE);

  // No-op if user is somehow still null - can't happen in practice
  // (requireAuth would reject the upload/rename before either callback
  // could ever fire without a session), so there's nothing meaningful to
  // update.
  const handleAvatarUploaded = (image: string) => user && setUser({ ...user, image });
  const handleNameUpdated = (name: string) => user && setUser({ ...user, name });
  const handleEmailUpdated = (email: string) => user && setUser({ ...user, email });

  if (showManageProfile) {
    return (
      <ManageProfileScreen
        user={user}
        onBack={() => setShowManageProfile(false)}
        onSignOut={onSignOut}
        onAvatarUploaded={handleAvatarUploaded}
        onNameUpdated={handleNameUpdated}
        onEmailUpdated={handleEmailUpdated}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PanelHeader title="Account" titleUnderline />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3">
        <ProfileCard
          user={user}
          onAvatarUploaded={handleAvatarUploaded}
          onManageProfile={() => {
            trackEvent("open_manage_profile");
            setShowManageProfile(true);
          }}
        />
        <PlanCard />
        <LinksCard />
        <LogoutButton onSignOut={onSignOut} />
        <LegalFooterLinks />
      </div>
    </div>
  );
}
