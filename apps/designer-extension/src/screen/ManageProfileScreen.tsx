import { useState } from "react";
import { Icon } from "../components/Icon";
import { PanelHeader } from "../components/PanelHeader";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { AuthTextField } from "../components/AuthTextField";
import { SuccessModal } from "../components/SuccessModal";
import { ConfirmDeleteAccountModal } from "../components/ConfirmDeleteAccountModal";
import { useAvatarUpload } from "../hooks/useAvatarUpload";
import { apiFetch } from "../services/apiClient";
import { getPasswordErrorMessage, getEmailErrorMessage } from "../helpers/formRegex";
import type { AccountUser } from "../hooks/useAccountUser";

// Shared by every field label in this screen (Name/Email/Password) - per
// explicit spec, distinct from AuthTextField's own default label style
// (text-mobile-text-md-medium/font-sans).
const FIELD_LABEL_CLASSNAME = "font-display text-mobile-header-h2 text-text-black";

// DashboardScreen sizes the panel to 320x540 (DASHBOARD_SIZE, shared by
// Editor/Presets/Account) once on its own mount - it never re-fires when
// AccountTab swaps to this sub-view, and this content genuinely doesn't fit
// in 540px (avatar row + 3 fields + Save + Delete + gaps + the header/nav
// chrome DashboardScreen itself already occupies - confirmed by testing:
// without a taller size, the bottom of this screen - the Save/Delete
// buttons - was clipped by the panel's real fixed height in the actual
// Designer, since a too-short outer iframe just cuts off overflowing
// content rather than somehow letting inner overflow-y-auto scroll further
// than the space it was actually given). Exported rather than called via
// its own useExtensionSize here, since AccountTab (this screen's only
// caller) already owns the showManageProfile state this needs to key off
// of - see that file's own comment for why the size-switching itself lives
// there instead of racing two separate setExtensionSize calls against each
// other on the same transition.
export const MANAGE_PROFILE_SIZE = { width: 320, height: 640 };

// AccountTab's "Manage profile" sub-screen - reached via ProfileCard's
// chevron. Same PanelHeader as the Account screen itself (titleUnderline,
// same padding/border), just titled "Manage profile" and with onClose
// wired to onBack - per explicit direction to reuse the Color modal's own
// X affordance (ControlPanel.tsx's FullViewModal) for "return to Account"
// instead of a dedicated back-arrow button.
//
// Content, per explicit spec: a gap-3 row of [a 64x64 view-only avatar
// preview] + [a gap-3 column of the "Profile picture" label and a gap-2
// column of the "Change photo" button + its supported-formats caption] -
// the 64x64 preview is deliberately not itself a click target (unlike
// ProfileCard's small 40x40 ProfilePicture) - only the ButtonSecondary
// triggers the file picker here, per explicit direction that this avatar is
// "solo para visualizarla" - followed by Name/Email/Password fields, then a
// primary "Save" button and a secondary "Delete account" button.
export function ManageProfileScreen({
  user,
  onBack,
  onSignOut,
  onAvatarUploaded,
  onNameUpdated,
  onEmailUpdated,
}: {
  user: AccountUser | null;
  onBack: () => void;
  onSignOut: () => void;
  onAvatarUploaded: (url: string) => void;
  onNameUpdated: (name: string) => void;
  onEmailUpdated: (email: string) => void;
}) {
  const { preview, inputRef, openFilePicker, handleFileChange } = useAvatarUpload(onAvatarUploaded);
  const displaySrc = preview ?? user?.image ?? null;

  // Name/Email are both always-empty drafts - the current value is only
  // ever shown as the input's own placeholder (per explicit spec), not a
  // pre-filled value. Both used to commit individually (Name on blur/Enter,
  // matching ControlPanel.tsx's EditableNumberValue convention) until the
  // "Save" button below was added - per explicit direction, that instant
  // per-field commit was undone in favor of one combined save covering both.
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);

  async function handleSave() {
    const nextName = nameDraft.trim();
    const nextEmail = emailDraft.trim();
    const wantsNameChange = nextName.length > 0 && nextName !== user?.name;
    const wantsEmailChange = nextEmail.length > 0 && nextEmail !== user?.email;
    if (!wantsNameChange && !wantsEmailChange) return;

    if (wantsEmailChange) {
      const errorMessage = getEmailErrorMessage(nextEmail);
      if (errorMessage) {
        setEmailError(errorMessage);
        return;
      }
    }
    setEmailError(null);
    setIsSaving(true);
    try {
      if (wantsNameChange) {
        await apiFetch("/api/auth/update-user", {
          method: "POST",
          body: JSON.stringify({ name: nextName }),
        });
        onNameUpdated(nextName);
        setNameDraft("");
      }
      if (wantsEmailChange) {
        // better-auth's own anti-enumeration stance (see auth.ts's
        // changeEmail comment): a newEmail already registered by another
        // account still returns { status: true } without actually changing
        // anything - there's no way to tell that apart from a real success
        // from this response alone, so this optimistically reflects
        // nextEmail either way, same as every other place in this app that
        // accepts that tradeoff rather than leaking account existence.
        await apiFetch("/api/auth/change-email", {
          method: "POST",
          body: JSON.stringify({ newEmail: nextEmail }),
        });
        onEmailUpdated(nextEmail);
        setEmailDraft("");
      }
      setShowSavedModal(true);
    } catch (error) {
      console.error("Failed to save profile changes", error);
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Password field - always empty, masked placeholder (never shows the real
  // password, which isn't retrievable anyway). Deliberately calls a custom
  // backend route (POST /api/profile/password, see routes/profile.ts) that
  // skips better-auth's own currentPassword requirement, per explicit
  // direction that this is just one input + a "Change password" button -
  // see that route's own comment for the real security tradeoff this
  // accepts. Kept as its own instant action (not folded into "Save") since
  // that's the one field that was never asked to change.
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordChangedModal, setShowPasswordChangedModal] = useState(false);

  async function handleChangePassword() {
    const errorMessage = getPasswordErrorMessage(passwordDraft);
    if (errorMessage) {
      setPasswordError(errorMessage);
      return;
    }
    setPasswordError(null);
    setIsChangingPassword(true);
    try {
      await apiFetch("/api/profile/password", {
        method: "POST",
        body: JSON.stringify({ password: passwordDraft }),
      });
      setPasswordDraft("");
      setShowPasswordChangedModal(true);
    } catch (error) {
      console.error("Failed to change password", error);
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  // Delete account - real, gated behind a confirmation modal (see
  // ConfirmDeleteAccountModal's own comment for why the backend route it
  // calls has no re-auth step of its own to catch an accidental click). On
  // success, also signs out through the real /api/auth/sign-out endpoint
  // (same call LogoutButton makes) so the session cookie is cleared through
  // the sanctioned path rather than this route trying to replicate that
  // itself, then calls onSignOut() regardless of whether that best-effort
  // sign-out call succeeded - the account (and its session row) is already
  // gone from the database at that point either way.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await apiFetch("/api/profile/delete-account", { method: "POST" });
    } catch (error) {
      console.error("Failed to delete account", error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }
    try {
      await apiFetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // best-effort, see comment above.
    }
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    onSignOut();
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PanelHeader title="Manage profile" titleUnderline onClose={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-8">
        <div className="flex gap-3 items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background-white-2">
            {displaySrc ? (
              <img src={displaySrc} alt="" className="h-full w-full scale-[2] object-cover" />
            ) : (
              <Icon name="account" className="text-text-secondary" />
            )}
          </div>
          <div className="flex flex-col items-start gap-3">
            <span className="font-display text-sm-medium text-text-black">Profile picture</span>
            <div className="flex flex-col items-start gap-2">
              <ButtonSecondary className=" flex items-center text-mobile-text-md-medium px-4" icon={<Icon name="upload" />} onClick={openFilePicker}>
                Change photo
              </ButtonSecondary>
              <span className="font-sans text-mobile-text-sm-regular text-text-secondary">
                Supports png, jpg, webp under 5mb
              </span>
            </div>
          </div>
        </div>
        <AuthTextField
          id="manage-profile-name"
          name="name"
          label="Name"
          labelClassName={FIELD_LABEL_CLASSNAME}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder={user?.name ?? ""}
          autoComplete="off"
        />
        <AuthTextField
          id="manage-profile-email"
          name="email"
          type="email"
          label="Email"
          labelClassName={FIELD_LABEL_CLASSNAME}
          value={emailDraft}
          onChange={(e) => {
            setEmailDraft(e.target.value);
            setEmailError(null);
          }}
          placeholder={user?.email ?? ""}
          autoComplete="off"
          error={emailError}
        />
        <AuthTextField
          id="manage-profile-password"
          name="password"
          type="password"
          label="Password"
          labelClassName={FIELD_LABEL_CLASSNAME}
          value={passwordDraft}
          onChange={(e) => {
            setPasswordDraft(e.target.value);
            setPasswordError(null);
          }}
          placeholder="******"
          autoComplete="new-password"
          error={passwordError}
          trailing={
            <ButtonSecondary
              fullWidth={false}
              paddingClassName="py-1.5 px-3"
              textClassName="text-mobile-text-sm-medium"
              className="whitespace-nowrap"
              disabled={!passwordDraft || isChangingPassword}
              onClick={handleChangePassword}
            >
              Change password
            </ButtonSecondary>
          }
        />
        <ButtonSecondary icon={<Icon name="delete" />} onClick={() => setShowDeleteConfirm(true)}>
          Delete account
        </ButtonSecondary>
        <ButtonPrimary disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Saving..." : "Save"}
        </ButtonPrimary>

      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <SuccessModal
        open={showPasswordChangedModal}
        onClose={() => setShowPasswordChangedModal(false)}
        title="Password changed successfully"
        caption="Your password has been updated."
      />
      <SuccessModal
        open={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        title="Saved successfully"
        caption="Your profile has been updated."
      />
      <ConfirmDeleteAccountModal
        open={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
