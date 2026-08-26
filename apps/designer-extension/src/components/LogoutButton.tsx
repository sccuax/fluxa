import { ButtonSecondary } from "./ButtonSecondary";
import { Icon } from "./Icon";
import { apiFetch } from "../services/apiClient";

// A real ButtonSecondary call site, not a stub: hits better-auth's own
// POST /api/auth/sign-out (the same raw-fetch-to-a-better-auth-endpoint
// pattern every other auth action in this app already uses, e.g.
// sign-in/email, sign-up/email - no dedicated better-auth React client
// wired up here) and calls onSignOut regardless of whether that request
// actually succeeded, same fail-open stance the Google sign-in popup relay
// already takes elsewhere - a session cookie the server thinks is still
// valid is far less harmful than trapping the user on a "Log out" button
// that silently does nothing because of a network blip.
export function LogoutButton({ onSignOut }: { onSignOut: () => void }) {
  async function handleLogout() {
    try {
      await apiFetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // best-effort - see comment above.
    }
    onSignOut();
  }

  return (
    <ButtonSecondary icon={<Icon name="logout" />} onClick={handleLogout}>
      Log out
    </ButtonSecondary>
  );
}
