import { DATA_CLIENT_URL } from "./apiClient";

// better-auth's own first-party oauth-popup plugin (see data-client's
// auth.ts for the server side and its own detailed rationale) - NOT the
// old hand-rolled "POST /api/auth/sign-in/social, then set popup.location"
// dance. That old approach detected success by polling GET /api/me for a
// changed session id from the OPENER (this code) - which depended on the
// browser letting this cross-site iframe read data-client's session
// cookie at all. That stopped working the moment third-party cookie
// blocking actually applied to this pairing for real (confirmed - Google
// sign-in stopped completing entirely). This plugin instead runs the whole
// provider round trip inside the POPUP's own first-party context.
const OAUTH_POPUP_START_URL = `${DATA_CLIENT_URL}/api/auth/oauth-popup/start`;
// Never actually navigated to or rendered by this flow - the plugin's own
// completion page replaces the normal callbackURL/errorCallbackURL/
// newUserCallbackURL redirect entirely (see auth.ts). These two URLs are
// kept only as opaque, distinguishable markers so `redirectTo` (relayed
// through the poll below) can still tell "signed in" apart from "already
// had an account" for the requestSignUp case - the same trick the old
// implementation used with two real pages.
const POPUP_CALLBACK_URL = `${DATA_CLIENT_URL}/oauth-popup-callback`;
const ALREADY_REGISTERED_CALLBACK_URL = `${POPUP_CALLBACK_URL}?error=already_registered`;
// Polled with the same `nonce` generated below until the popup's own OAuth
// callback has landed server-side. NOT the plugin's own documented
// mechanism (postMessage from the completion page to window.opener) -
// confirmed via real testing that this never arrives, because Google's own
// Cross-Origin-Opener-Policy: same-origin permanently severs window.opener
// the moment the popup visits accounts.google.com mid-flow. See
// data-client's routes/oauthPopupExchange.ts and lib/oauthPopupHandoff.ts
// for the server side of this poll-based fallback - it's plain server-
// mediated correlation by a client-generated nonce, no window-reference or
// partitioned-storage channel involved at all. Also doubles as the actual
// session handoff: once it reports success, this iframe already has a
// real, correctly `Partitioned` session cookie (set by that same request,
// since it genuinely originates from inside this iframe's own top-level
// context) - no separate exchange call needed.
const POLL_URL = `${DATA_CLIENT_URL}/api/oauth-popup-exchange`;
const POLL_INTERVAL_MS = 1000;
// Matches better-auth's own client plugin's default popup timeout - the
// SOLE "give up" mechanism now (see the real bug below for why there's no
// earlier one).
const POPUP_TIMEOUT_MS = 300_000;

interface PollResponse {
  status: "pending" | "success" | "error";
  error?: string;
  redirectTo?: string;
}

// Opens a popup that runs the whole Google OAuth round trip against the
// deployed Data Client, then polls for its outcome (see POLL_URL above).
// `error` is null on success, or a code like "signup_disabled" (see
// data-client's auth.ts - disableImplicitSignUp) on failure.
// Rejects if the popup is blocked, or the poll never resolves within
// POPUP_TIMEOUT_MS (a genuine cancel - the user closing the real popup
// without finishing - looks identical to this from here; see the real bug
// below for why that can't be detected any faster).
//
// Real bug, found and fixed: an earlier version of this function also
// gave up as soon as `popup.closed` read true, on the theory that the
// popup's own completion page always closes itself once it's done -
// confirmed via real testing (wrangler tail on the deployed Worker,
// cross-referenced against this file's own console logging) that
// `popup.closed` reads `true` within a few hundred ms of the popup
// navigating to accounts.google.com - WAY before the user has even picked
// an account, let alone before the OAuth round trip actually completes
// server-side (which the Worker logs showed landing correctly, several
// real seconds later, every single time). This is the same COOP
// restriction documented elsewhere in this file's own history (Chrome
// logs "Cross-Origin-Opener-Policy policy would block the window.closed
// call") - reading `.closed` on a COOP-severed cross-origin popup
// reference doesn't throw, it just lies. The fix: don't use `popup.closed`
// to decide anything at all here - poll on a fixed interval until the
// server reports a real outcome, and only give up on the timeout above.
// `requestSignUp` is better-auth's sanctioned way to let this same Google
// provider config serve both a disableImplicitSignUp-guarded sign-in button
// and a sign-up button that actually creates the account - see CLAUDE.md's
// "Google sign-in popup flow" section.
export function openGoogleSignInPopup(options?: { requestSignUp?: boolean }): Promise<{ error: string | null }> {
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID();
    const startUrl = new URL(OAUTH_POPUP_START_URL);
    startUrl.searchParams.set("provider", "google");
    startUrl.searchParams.set("popupOrigin", window.location.origin);
    startUrl.searchParams.set("popupNonce", nonce);
    // For a plain sign-in, an already-linked account is the whole point, so
    // callbackURL is just the normal success marker. For sign-up, that same
    // "account already existed" outcome should instead read as "you already
    // have an account" - better-auth only distinguishes the two via
    // newUserCallbackURL, used in place of callbackURL specifically when a
    // *new* user was just registered - so for requestSignUp we swap which
    // marker means what.
    startUrl.searchParams.set("callbackURL", options?.requestSignUp ? ALREADY_REGISTERED_CALLBACK_URL : POPUP_CALLBACK_URL);
    startUrl.searchParams.set("errorCallbackURL", POPUP_CALLBACK_URL);
    if (options?.requestSignUp) {
      startUrl.searchParams.set("newUserCallbackURL", POPUP_CALLBACK_URL);
      startUrl.searchParams.set("requestSignUp", "true");
    }

    const popup = window.open(startUrl.toString(), "fluxa-google-signin", "width=480,height=640");
    if (!popup) {
      reject(new Error("popup_blocked"));
      return;
    }

    let settled = false;
    let checking = false;

    const cleanup = () => {
      window.clearInterval(pollHandoff);
      window.clearTimeout(timeout);
    };

    const settle = (result: { error: string | null } | null, err?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        // best-effort - may already be closed, or its browsing context is
        // isolated from us by now (COOP, see the class comment above)
      }
      if (result) resolve(result);
      else reject(err ?? new Error("popup_timeout"));
    };

    const checkHandoff = async () => {
      if (settled || checking) return;
      checking = true;
      try {
        const res = await fetch(POLL_URL, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nonce }),
        });
        if (res.status === 202) return; // not landed yet - keep polling
        const data = (await res.json()) as PollResponse;
        if (data.status === "success") {
          settle({ error: null });
          return;
        }
        if (data.status === "error") {
          // See the requestSignUp branch above - both outcomes mint a real
          // session, so `redirectTo` (which of the two marker URLs this
          // attempt actually resolved to) is what distinguishes "you
          // already have an account" from a genuine new sign-up, not
          // whichever error code came back.
          if (options?.requestSignUp && data.redirectTo?.startsWith(ALREADY_REGISTERED_CALLBACK_URL)) {
            settle({ error: "already_registered" });
          } else {
            settle({ error: data.error ?? "unknown_error" });
          }
        }
      } catch {
        // transient network error - next interval tick tries again
      } finally {
        checking = false;
      }
    };

    const pollHandoff = window.setInterval(() => void checkHandoff(), POLL_INTERVAL_MS);
    const timeout = window.setTimeout(() => settle(null), POPUP_TIMEOUT_MS);
  });
}
