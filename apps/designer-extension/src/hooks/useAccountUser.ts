import { useEffect, useState } from "react";
import { apiFetch } from "../services/apiClient";

export interface AccountUser {
  name: string;
  email: string;
  image: string | null;
}

// GET /api/me returns better-auth's own session user (see auth-schema.ts) -
// no dedicated Account-tab endpoint needed for this. Returns the setter too
// (not just the value) so a successful avatar upload (ProfilePicture.tsx)
// can reflect the new image immediately instead of waiting for a remount to
// refetch it.
export function useAccountUser(): [AccountUser | null, (user: AccountUser) => void] {
  const [user, setUser] = useState<AccountUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ user: AccountUser | null }>("/api/me")
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return [user, setUser];
}
