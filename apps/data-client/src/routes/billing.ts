import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { createDb, type Database } from "../db/client";
import { plans, subscriptions, payments, paymentEvents } from "../db/schema";
import { requireAuth } from "../middleware/requireAuth";
import {
  createProCheckout,
  verifyLemonSqueezySignature,
  mapSubscriptionStatus,
  mapInvoiceStatus,
} from "../lib/lemonSqueezy";

export const billingRoutes = new Hono<AppEnv>();

// The one plan this app currently sells - see scripts/seedProPlan.mjs, which
// seeds the matching `plans` row by this same code. Hardcoded rather than
// user-selectable since there's exactly one paid tier for now.
const PRO_PLAN_CODE = "pro";

// requireAuth is applied per-route below, never router-wide - /webhook is
// called by Lemon Squeezy itself, never a logged-in browser, and must stay
// public.

billingRoutes.post("/checkout", requireAuth, async (c) => {
  const user = c.get("user")!;
  const redirectUrl = `${new URL(c.req.url).origin}/billing-checkout-complete`;

  try {
    const { url } = await createProCheckout(c.env, {
      userId: user.id,
      userEmail: user.email,
      redirectUrl,
    });
    return c.json({ url });
  } catch (err) {
    console.error("Lemon Squeezy checkout creation failed", err);
    return c.json({ error: "checkout_failed" }, 502);
  }
});

billingRoutes.get("/status", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DATABASE_URL);

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const plan = subscription && (subscription.status === "trialing" || subscription.status === "active") ? "pro" : "free";

  return c.json({
    plan,
    status: subscription?.status ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    customerPortalUrl: subscription?.customerPortalUrl ?? null,
  });
});

// --- Webhook -------------------------------------------------------------
//
// No requireAuth - the caller is Lemon Squeezy's own servers, identified by
// the X-Signature HMAC below, not a Fluxa session.
//
// The very first thing this handler does is read the RAW body via
// c.req.text() - never c.req.json() anywhere in this route. The signature is
// computed by Lemon Squeezy over the exact raw bytes it sent; parsing with
// JSON.parse(rawBody) on that same already-read string, rather than calling
// a body-parsing helper that might re-derive/re-serialize it, is what keeps
// verification correct. No global middleware in this app reads the request
// body ahead of a route handler (sessionMiddleware only reads headers), so
// there's nothing upstream that could have already consumed this stream.
billingRoutes.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Signature") ?? null;

  const validSignature = await verifyLemonSqueezySignature(rawBody, signature, c.env.LEMONSQUEEZY_WEBHOOK_SECRET);
  if (!validSignature) {
    console.error("Lemon Squeezy webhook: invalid signature");
    // Deliberately never touches payment_events for a bad signature - an
    // unauthenticated request should never be logged as a real event.
    return c.json({ error: "invalid_signature" }, 401);
  }

  let payload: LemonSqueezyPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  const eventName = payload?.meta?.event_name;
  if (!eventName) {
    return c.json({ error: "invalid_payload" }, 400);
  }

  // Lemon Squeezy documents no per-delivery id separate from the resource's
  // own id, so a real retry (same payload, resent) is identified by hashing
  // the exact raw bytes - a byte-identical retry hashes identically (dedupes
  // correctly); a genuinely different event, even of the same type, carries
  // a different data.id/timestamp and therefore a different hash.
  const providerEventId = await sha256Hex(rawBody);
  const db = createDb(c.env.DATABASE_URL);

  const [existing] = await db
    .select({ processed: paymentEvents.processed })
    .from(paymentEvents)
    .where(eq(paymentEvents.providerEventId, providerEventId))
    .limit(1);

  if (existing?.processed) {
    return c.json({ ok: true, duplicate: true });
  }

  if (!existing) {
    await db
      .insert(paymentEvents)
      .values({
        provider: "lemonsqueezy",
        providerEventId,
        eventType: eventName,
        payload,
        processed: false,
      })
      .onConflictDoNothing({ target: paymentEvents.providerEventId });
  }

  try {
    await dispatchLemonSqueezyEvent(db, payload);
    await db
      .update(paymentEvents)
      .set({ processed: true, processedAt: new Date(), errorMessage: null })
      .where(eq(paymentEvents.providerEventId, providerEventId));
    return c.json({ ok: true });
  } catch (err) {
    console.error("Lemon Squeezy webhook processing failed", eventName, err);
    await db
      .update(paymentEvents)
      .set({ errorMessage: String(err) })
      .where(eq(paymentEvents.providerEventId, providerEventId));
    // Non-2xx so Lemon Squeezy retries - the idempotency check above means a
    // retry of a FAILED attempt correctly reuses the same payment_events row
    // instead of double-logging it.
    return c.json({ error: "processing_failed" }, 500);
  }
});

// --- Payload shapes (only the fields this route actually reads) ----------

interface LemonSqueezyPayload {
  meta: { event_name: string; custom_data?: Record<string, string> };
  data: {
    type: string;
    id: string;
    attributes: Record<string, unknown>;
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Dispatches purely on data.type (not on the event_name string) - every
// subscription lifecycle event (created/updated/cancelled/resumed/expired/
// paused/unpaused) shares the same "subscriptions" resource shape and the
// same correct handling: re-run the upsert, since attributes.status is
// authoritative each time. Every subscription_payment_* event shares the
// "subscription-invoices" shape instead. order_created/order_refunded
// ("orders") are intentionally left as a no-op beyond the payment_events log
// already written above - see this file's own top-of-plan reasoning for why
// payments rows come from the invoice events, not the order events, for
// subscriptions.
async function dispatchLemonSqueezyEvent(db: Database, payload: LemonSqueezyPayload): Promise<void> {
  if (payload.data.type === "subscriptions") {
    await upsertSubscriptionFromPayload(db, payload);
  } else if (payload.data.type === "subscription-invoices") {
    await upsertSubscriptionFromInvoicePayload(db, payload, payload.meta.event_name);
  }
}

async function resolveProPlanId(db: Database): Promise<string> {
  const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, PRO_PLAN_CODE)).limit(1);
  if (!plan) {
    throw new Error(`No "${PRO_PLAN_CODE}" plan row found - run scripts/seedProPlan.mjs first`);
  }
  return plan.id;
}

async function upsertSubscriptionFromPayload(db: Database, payload: LemonSqueezyPayload): Promise<void> {
  const attrs = payload.data.attributes as {
    status: string;
    renews_at: string | null;
    trial_ends_at: string | null;
    urls?: { customer_portal?: string | null };
  };
  const userId = payload.meta.custom_data?.user_id;
  if (!userId) {
    throw new Error("Lemon Squeezy subscription webhook missing meta.custom_data.user_id");
  }

  const planId = await resolveProPlanId(db);
  const providerSubscriptionId = payload.data.id;

  const values = {
    userId,
    planId,
    status: mapSubscriptionStatus(attrs.status),
    provider: "lemonsqueezy",
    providerSubscriptionId,
    currentPeriodEnd: attrs.renews_at ? new Date(attrs.renews_at) : null,
    // See lib/lemonSqueezy.ts's mapSubscriptionStatus comment: "cancelled"
    // still has access through the grace period, this flag is what lets the
    // UI show "Cancels on {date}" without downgrading early.
    cancelAtPeriodEnd: attrs.status === "cancelled",
    trialEnd: attrs.trial_ends_at ? new Date(attrs.trial_ends_at) : null,
    customerPortalUrl: attrs.urls?.customer_portal ?? null,
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.providerSubscriptionId,
      set: {
        status: values.status,
        currentPeriodEnd: values.currentPeriodEnd,
        cancelAtPeriodEnd: values.cancelAtPeriodEnd,
        trialEnd: values.trialEnd,
        customerPortalUrl: values.customerPortalUrl,
        updatedAt: new Date(),
      },
    });
}

async function upsertSubscriptionFromInvoicePayload(
  db: Database,
  payload: LemonSqueezyPayload,
  eventName: string,
): Promise<void> {
  const attrs = payload.data.attributes as {
    subscription_id: number | string;
    status: string;
    total: number;
    currency: string;
  };
  const providerSubscriptionId = String(attrs.subscription_id);
  const providerPaymentId = payload.data.id;
  // subscription_payment_failed's own event NAME is a more reliable failure
  // signal than the invoice's own `status` field, which may still read
  // "pending" while Lemon Squeezy's dunning retries are in flight - trust
  // the event name for this one case rather than mapInvoiceStatus's generic
  // mapping.
  const paymentStatus = eventName === "subscription_payment_failed" ? "failed" : mapInvoiceStatus(attrs.status);

  const [subscription] = await db
    .select({ id: subscriptions.id, userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
    .limit(1);

  // The invoice event can in principle arrive before the subscription's own
  // created/updated event finishes writing its row - payments.subscriptionId
  // is nullable for exactly this kind of ordering gap, and payments.userId
  // falls back to the invoice's own custom_data if the subscription row
  // isn't there yet (rare, but not fatal - the subscription's own event will
  // still upsert its row separately).
  const userId = subscription?.userId ?? payload.meta.custom_data?.user_id;
  if (!userId) {
    throw new Error("Lemon Squeezy invoice webhook: could not resolve a userId");
  }

  await db
    .insert(payments)
    .values({
      userId,
      subscriptionId: subscription?.id ?? null,
      provider: "lemonsqueezy",
      providerPaymentId,
      amountCents: attrs.total,
      currency: attrs.currency.toLowerCase(),
      status: paymentStatus,
      paidAt: paymentStatus === "succeeded" ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: payments.providerPaymentId,
      set: {
        status: paymentStatus,
        updatedAt: new Date(),
      },
    });
}
