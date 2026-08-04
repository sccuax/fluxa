import { DATA_CLIENT_URL } from "./apiClient";

const POPUP_CALLBACK_URL = `${DATA_CLIENT_URL}/oauth-popup-callback`;

interface GoogleAuthMessage {
  source: "fluxa-google-auth";
  error: string | null;
}

function isGoogleAuthMessage(data: unknown): data is GoogleAuthMessage {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === "fluxa-google-auth";
}

// Opens a popup that runs the whole Google OAuth round trip against the
// deployed Data Client, then resolves once the popup (see the Worker's
// /oauth-popup-callback route) posts its result back and closes itself.
// `error` is null on success, or a code like "signup_disabled" (see
// data-client's auth.ts - disableImplicitSignUp) on failure.
// Rejects if the popup is blocked, or if the user closes it manually before
// the flow finishes.
export function openGoogleSignInPopup(): Promise<{ error: string | null }> {
  return new Promise((resolve, reject) => {
    const popup = window.open("", "fluxa-google-signin", "width=480,height=640");
    if (!popup) {
      reject(new Error("popup_blocked"));
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(pollClosed);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== new URL(DATA_CLIENT_URL).origin) return;
      if (!isGoogleAuthMessage(event.data)) return;
      settled = true;
      cleanup();
      resolve({ error: event.data.error });
    };
    window.addEventListener("message", onMessage);

    const pollClosed = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        if (!settled) reject(new Error("popup_closed"));
      }
    }, 300);

    fetch(`${DATA_CLIENT_URL}/api/auth/sign-in/social`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        callbackURL: POPUP_CALLBACK_URL,
        errorCallbackURL: POPUP_CALLBACK_URL,
      }),
    })
      .then((res) => res.json())
      .then((data: { url?: string }) => {
        if (!data.url) throw new Error("no_redirect_url");
        popup.location.href = data.url;
      })
      .catch((err) => {
        popup.close();
        cleanup();
        reject(err);
      });
  });
}
