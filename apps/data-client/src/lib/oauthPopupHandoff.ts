import { lt } from "drizzle-orm";
import { createDb } from "../db/client";
import { oauthPopupHandoffs } from "../db/app-schema";
import type { Bindings } from "../types/env";

// better-auth's own OAUTH_POPUP_DATA_ELEMENT_ID constant (plugins/oauth-popup/
// constants.ts, verified against the installed package's source) - the id of
// the inert <script type="application/json"> block its completion page
// embeds the outcome in.
const COMPLETION_DATA_ELEMENT_ID = "better-auth-oauth-popup";
const COMPLETION_SCRIPT_REGEX = new RegExp(
  `<script type="application/json" id="${COMPLETION_DATA_ELEMENT_ID}">([\\s\\S]*?)<\\/script>`,
);

// Rows older than this are treated as abandoned (a popup the user closed
// without completing, or a genuinely stuck attempt) and purged - see the
// call site below. Generous on purpose; this table sees very low volume.
const HANDOFF_TTL_MS = 10 * 60 * 1000;

interface CompletionPayload {
  nonce?: string;
  token?: string;
  error?: { code: string; description?: string };
  redirectTo?: string;
}

// Captures better-auth's own oauth-popup plugin's completion-page payload
// server-side, keyed by the `nonce` the extension iframe already generated
// before ever opening the popup - see routes/oauthPopupExchange.ts's own
// comment for why this exists at all: that plugin's normal delivery
// mechanism (the completion page's window.opener.postMessage) never
// reaches the iframe for real, because accounts.google.com's own
// Cross-Origin-Opener-Policy: same-origin permanently severs window.opener
// the moment the popup navigates there mid-flow (confirmed via real
// testing - the popup closes itself right on schedule, but the opener
// never receives anything).
//
// Takes a CLONE of the response - the real caller (index.ts) still returns
// the ORIGINAL, unread response to the popup itself, so its own script
// still runs normally (its own postMessage attempt is harmless to still
// make, on the off chance it ever works on some other browser/provider
// combination).
export async function captureOAuthPopupHandoff(env: Bindings, response: Response): Promise<void> {
  const html = await response.text().catch(() => "");
  const match = html.match(COMPLETION_SCRIPT_REGEX);
  if (!match) return;

  let payload: CompletionPayload;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    return;
  }
  if (!payload.nonce) return;

  const db = createDb(env.DATABASE_URL);
  await db.delete(oauthPopupHandoffs).where(lt(oauthPopupHandoffs.createdAt, new Date(Date.now() - HANDOFF_TTL_MS)));
  await db.insert(oauthPopupHandoffs).values({
    nonce: payload.nonce,
    token: payload.token ?? null,
    errorCode: payload.error?.code ?? null,
    redirectTo: payload.redirectTo ?? null,
  });
}
