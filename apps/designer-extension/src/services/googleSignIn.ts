import { DATA_CLIENT_URL } from "./apiClient";

const POPUP_CALLBACK_URL = `${DATA_CLIENT_URL}/oauth-popup-callback`;
// Not a real auth failure (a session is still set - the user does have a
// legitimate account) - just a signal for the popup callback page to show
// "you already have an account" instead of the normal success page. See the
// requestSignUp branch below and oauthPopup.ts.
const ALREADY_REGISTERED_CALLBACK_URL = `${POPUP_CALLBACK_URL}?error=already_registered`;
const SESSION_POLL_INTERVAL_MS = 1000;

interface GoogleAuthMessage {
  source: "fluxa-google-auth";
  error: string | null;
}

function isGoogleAuthMessage(data: unknown): data is GoogleAuthMessage {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === "fluxa-google-auth";
}

// Returns the active session's id, or null if there's no session. Used
// instead of a plain boolean so the caller can tell "a session happens to
// already exist" apart from "this flow just created a brand-new one" - see
// the baseline comment below for why that distinction matters.
async function getActiveSessionId(): Promise<string | null> {
  const res = await fetch(`${DATA_CLIENT_URL}/api/me`, { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: unknown; sessionId: string | null };
  return data.user != null ? data.sessionId : null;
}

// Opens a popup that runs the whole Google OAuth round trip against the
// deployed Data Client. Success/failure is detected two ways, since neither
// is reliable alone:
//  - postMessage from the popup (see the Worker's /oauth-popup-callback
//    route) - works when the browsing context stays connected to this
//    opener.
//  - polling /api/me for a session cookie - works even when it doesn't,
//    because cookies aren't affected by window-reference isolation.
// The second path exists because accounts.google.com sets
// Cross-Origin-Opener-Policy: same-origin on its own pages. The moment the
// popup navigates there mid-flow, the browser permanently severs
// window.opener for the rest of that popup's lifetime (confirmed via manual
// testing - Chrome logs "Cross-Origin-Opener-Policy policy would block the
// window.closed call"), so postMessage back to this window silently never
// arrives - not something fixable via this app's own COOP settings, since
// it's Google's header, not ours.
// `error` is null on success, or a code like "signup_disabled" (see
// data-client's auth.ts - disableImplicitSignUp) on failure.
// Rejects if the popup is blocked, or if it closes with neither a session
// nor a message (user cancelled, or closed an error page themselves - see
// oauthPopup.ts, which renders its own feedback for that case since it
// usually can't relay one back here).
// `requestSignUp` is better-auth's sanctioned way to let this same Google
// provider config serve both a disableImplicitSignUp-guarded sign-in button
// and a sign-up button that actually creates the account - see CLAUDE.md's
// "Google sign-in popup flow" section.
export function openGoogleSignInPopup(options?: { requestSignUp?: boolean }): Promise<{ error: string | null }> {
  return new Promise((resolve, reject) => {
    const popup = window.open("", "fluxa-google-signin", "width=480,height=640");
    if (!popup) {
      reject(new Error("popup_blocked"));
      return;
    }

    let settled = false;
    let closeCheckInFlight = false;
    // Snapshot which session (if any) is already active the instant this
    // flow starts, by id rather than a plain boolean. A boolean alone can't
    // prove *this* Google flow is what produced a later "active" reading -
    // a session left over from before (e.g. LogoutButton's sign-out request
    // failing silently, which it's deliberately built to tolerate) would
    // already read as active the moment the first poll tick fires, well
    // before the popup has even navigated to Google, and get misreported as
    // a fresh, successful Google sign-in for whatever account that stale
    // session actually belonged to - a real bug reported against this exact
    // flow (signing out, then clicking "Sign in with Google" again, silently
    // resumed the previous account with no account-picker ever shown).
    // Comparing session ids (not just "is something active") also correctly
    // handles a second real case a boolean can't: signing in with Google
    // immediately after signing up with Google. Sign-up already leaves a
    // valid session active (see SignUpScreen.tsx's handleGoogleSignUp
    // comment) - a boolean baseline would permanently read "already active"
    // for that session and never report the *next* sign-in as successful,
    // even though completing sign-in always issues a brand-new session id
    // (better-auth mints a fresh session on every completed sign-in, even
    // for an already-signed-in account) - so comparing ids still recognizes
    // that as success, while a leftover, never-replaced id still correctly
    // does not.
    let baselineSessionId: string | null = null;
    const sessionBaseline = getActiveSessionId().then((id) => {
      baselineSessionId = id;
    });
    // A poll only counts as success once it sees a session id that (a)
    // exists and (b) differs from whatever was active at baseline - either
    // there was none before and now there is one, or there was one before
    // and a completed sign-in replaced it with a freshly minted one.
    const isFreshSession = (id: string | null) => id !== null && id !== baselineSessionId;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(pollClosed);
      window.clearInterval(pollSession);
    };

    const settle = (result: { error: string | null } | null, err?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        // best-effort - may already be closed, or its browsing context is
        // isolated from us by now (see comment above)
      }
      if (result) resolve(result);
      else reject(err ?? new Error("popup_closed"));
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== new URL(DATA_CLIENT_URL).origin) return;
      if (!isGoogleAuthMessage(event.data)) return;
      settle({ error: event.data.error });
    };
    window.addEventListener("message", onMessage);

    const pollSession = window.setInterval(() => {
      sessionBaseline
        .then(() => getActiveSessionId())
        .then((id) => {
          if (isFreshSession(id)) settle({ error: null });
        });
    }, SESSION_POLL_INTERVAL_MS);

    const pollClosed = window.setInterval(() => {
      if (popup.closed && !closeCheckInFlight) {
        closeCheckInFlight = true;
        // One last session check before giving up - the popup closing and
        // the session cookie landing can race right at the end of a
        // successful flow. Still gated on isFreshSession, same reason as
        // pollSession above.
        sessionBaseline
          .then(() => getActiveSessionId())
          .then((id) => settle(isFreshSession(id) ? { error: null } : null));
      }
    }, 300);

    fetch(`${DATA_CLIENT_URL}/api/auth/sign-in/social`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        // For a plain sign-in, an already-linked account is the whole
        // point, so `callbackURL` (better-auth's default redirect target)
        // is just the normal success page. For sign-up, that same "account
        // already existed" outcome should instead read as "you already
        // have an account" - better-auth only distinguishes the two via
        // `newUserCallbackURL`, which it uses in place of `callbackURL`
        // specifically when a *new* user was just registered (see
        // callback.mjs's `result.isRegister` check) - so for requestSignUp
        // we swap which URL means what.
        callbackURL: options?.requestSignUp ? ALREADY_REGISTERED_CALLBACK_URL : POPUP_CALLBACK_URL,
        ...(options?.requestSignUp ? { newUserCallbackURL: POPUP_CALLBACK_URL } : {}),
        errorCallbackURL: POPUP_CALLBACK_URL,
        ...(options?.requestSignUp ? { requestSignUp: true } : {}),
      }),
    })
      .then((res) => res.json())
      .then((data: { url?: string }) => {
        if (!data.url) throw new Error("no_redirect_url");
        popup.location.href = data.url;
      })
      .catch((err) => settle(null, err));
  });
}
