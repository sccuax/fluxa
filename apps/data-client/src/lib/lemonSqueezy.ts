import type { Bindings } from "../types";
import type { PaymentStatus, SubscriptionStatus } from "../db/app-schema";

// Lemon Squeezy API helpers - no module-level state (env is only ever
// threaded in per call), same factory-per-request pattern as createDb/
// createAuth documented in this app's CLAUDE.md. Request/response shapes
// below were verified against docs.lemonsqueezy.com directly while planning
// this feature, not guessed from memory - re-verify against their live docs
// if either endpoint ever starts returning something unexpected.

const LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1";

interface CheckoutResponse {
  data: { attributes: { url: string } };
}

export type BillingIntervalChoice = "monthly" | "yearly";

// Creates a hosted Checkout for the monthly or yearly Pro variant, tagged with our own
// userId via checkout_data.custom so the eventual webhook can resolve
// ownership directly - no nonce/correlation table needed (see billing.ts's
// own top comment for why: Lemon Squeezy's webhook is an independent,
// reliable delivery channel, unlike the Google sign-in popup's own COOP-
// severed window.opener, which is what actually forced that mechanism
// there).
export async function createProCheckout(
  env: Bindings,
  args: { userId: string; userEmail: string; redirectUrl: string; interval: BillingIntervalChoice },
): Promise<{ url: string }> {
  const variantId = args.interval === "yearly" ? env.LEMONSQUEEZY_VARIANT_YEARLY : env.LEMONSQUEEZY_VARIANT_MONTHLY;
  const response = await fetch(`${LEMONSQUEEZY_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
      // Real JSON:API content types, not plain "application/json" - Lemon
      // Squeezy's API rejects requests missing either of these.
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: { redirect_url: args.redirectUrl },
          checkout_data: {
            email: args.userEmail,
            custom: { user_id: args.userId },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: env.LEMONSQUEEZY_STORE_ID } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Lemon Squeezy checkout creation failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as CheckoutResponse;
  return { url: json.data.attributes.url };
}

// Verifies X-Signature (hex HMAC-SHA256 of the RAW request body) using the
// webhook signing secret. crypto.subtle.verify does the actual byte
// comparison in constant time internally - deliberately not a hand-rolled
// string/byte compare, which is easy to get subtly timing-unsafe.
export async function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHex: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHex || !/^[0-9a-f]+$/i.test(signatureHex) || signatureHex.length % 2 !== 0) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signatureBytes = new Uint8Array(signatureHex.length / 2);
  for (let i = 0; i < signatureBytes.length; i++) {
    signatureBytes[i] = parseInt(signatureHex.slice(i * 2, i * 2 + 2), 16);
  }

  return crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(rawBody));
}

// Lemon Squeezy's subscription.status values -> our narrower enum
// (db/app-schema.ts's subscriptionStatusEnum).
//
// "cancelled" is NOT the end of access - confirmed against Lemon Squeezy's
// own docs: cancelling flips status to "cancelled" *immediately*, but the
// customer keeps access through a grace period until `ends_at` (the current
// paid period's end), at which point a SEPARATE later `subscription_expired`
// webhook fires and access actually ends. Mapping "cancelled" -> our
// "canceled" would flip a still-paying-through-the-period customer to Free
// the instant they cancel - wrong, and contradicts the license copy's own
// "stops at the end of the paid period" language. So "cancelled" maps to
// "active" here (still has access); routes/billing.ts's upsert separately
// sets `cancelAtPeriodEnd: true` for this exact case so the UI can still
// show "Cancels on {date}" without downgrading early. Only "expired" (the
// real end-of-access signal) maps to "canceled".
//
// "paused"/"unpaid" have no exact match - both bucket into "past_due"
// (closest available semantic: "not currently active, not permanently
// ended") as a deliberate, documented judgment call rather than a precise
// mapping.
export function mapSubscriptionStatus(lsStatus: string): SubscriptionStatus {
  switch (lsStatus) {
    case "on_trial":
      return "trialing";
    case "active":
    case "cancelled":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "expired":
      return "canceled";
    default:
      return "incomplete";
  }
}

// Lemon Squeezy's subscription-invoice.status values -> our narrower enum
// (db/app-schema.ts's paymentStatusEnum).
export function mapInvoiceStatus(lsStatus: string): PaymentStatus {
  switch (lsStatus) {
    case "paid":
      return "succeeded";
    case "pending":
      return "pending";
    case "void":
      return "canceled";
    case "refunded":
    case "partial_refund":
      return "refunded";
    default:
      return "failed";
  }
}
