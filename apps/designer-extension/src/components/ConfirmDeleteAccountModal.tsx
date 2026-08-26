import { Modal } from "./Modal";
import { ButtonSecondary } from "./ButtonSecondary";

// ManageProfileScreen's "Delete account" confirmation step - per explicit
// direction ("Real, con confirmación"), since account deletion is
// irreversible and the backend route it calls (POST /api/profile/delete-account)
// has no re-auth step of its own to catch an accidental click (see that
// route's own comment for why - it deliberately skips better-auth's own
// freshAge/password requirement). Reuses Modal.tsx like every other popup in
// this app; the "Delete" action is its own one-off red button rather than a
// ButtonSecondary variant, since overriding that component's hardcoded
// accent border/text color via a trailing className risks losing to its own
// defaults in the compiled stylesheet (same class-precedence reasoning
// documented on ButtonSecondary's fullWidth/paddingClassName/textClassName
// props) - not worth a fourth override prop for a single destructive-styled
// call site.
export function ConfirmDeleteAccountModal({
  open,
  onCancel,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <p className="font-display text-mobile-header-h1 text-text-black">Delete your account?</p>
      <p className="font-sans text-mobile-text-md-regular text-text-secondary">
        This can't be undone. Your profile, presets, and account data will be permanently deleted.
      </p>
      <div className="flex w-full gap-2">
        <ButtonSecondary onClick={onCancel} disabled={isDeleting}>
          Cancel
        </ButtonSecondary>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="h-auto w-full rounded-4 border border-error-800 py-2 font-sans text-mobile-text-md-medium text-error-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-text-secondary"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
