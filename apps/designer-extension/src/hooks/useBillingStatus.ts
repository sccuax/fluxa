import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBillingStatus, createCheckoutSession, type BillingStatus } from "../services/billing";
import { planCache } from "../services/planCache";

// Promoted straight to hooks/ (not colocated in a component) - unlike
// PlanCard.tsx's own usePresetUsage, which only promotes itself "if a second
// consumer ever needs it", this one has two real consumers from day one
// (PlanCard.tsx and PlanBillingModal.tsx) - one shared implementation avoids
// the two drifting apart, same reasoning ColorSwatchPicker.tsx's own
// extraction history already used in this app.
//
// No nonce/handoff mechanism here, unlike googleSignIn.ts's popup flow -
// Lemon Squeezy's webhook (data-client's routes/billing.ts) is an
// independent, reliable channel that updates the real subscription row
// regardless of whether this tab/JS is even still running, so there's
// nothing to correlate. This hook just opens the checkout in a new tab and
// polls the plain status endpoint until it reflects Pro (or gives up).
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export function useBillingStatus() {
  // Starts from the session cache (services/planCache.ts), then revalidates.
  const [status, setStatus] = useState<BillingStatus | null>(planCache.billing);
  const [loading, setLoading] = useState(planCache.billing === null);
  const [upgrading, setUpgrading] = useState(false);
  // Latest-value refs so the interval/timeout closures below always see
  // current state without needing to be recreated every render (same
  // "latest ref" pattern this app already uses for drag-handler closures).
  const upgradingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchBillingStatus();
      planCache.billing = next;
      setStatus(next);
      return next;
    } catch {
      // No real session / not connected (sandbox, plain-browser dev) - same
      // "fail into a harmless default" precedent as PlanCard's own
      // usePresetUsage, nothing further to surface differently here.
      planCache.billing = null;
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-checks once whenever the extension iframe regains focus - covers "I
  // closed the checkout tab and came back" with zero ongoing polling cost,
  // independent of whether startUpgrade() is currently bounded-polling.
  useEffect(() => {
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const startUpgrade = useCallback(async () => {
    let url: string;
    try {
      ({ url } = await createCheckoutSession());
    } catch {
      return;
    }

    // A plain, normally-sized new tab - not a fixed-size named popup like
    // googleSignIn.ts's Google window, since Lemon Squeezy's hosted checkout
    // is a full page meant to be viewed at normal size, not a compact
    // consent screen.
    window.open(url, "_blank");

    setUpgrading(true);
    upgradingRef.current = true;
    const startedAt = Date.now();

    const poll = async () => {
      if (!upgradingRef.current) return;
      const next = await refresh();
      if (next?.plan === "pro" || Date.now() - startedAt > POLL_TIMEOUT_MS) {
        upgradingRef.current = false;
        setUpgrading(false);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    setTimeout(poll, POLL_INTERVAL_MS);
  }, [refresh]);

  return { status, loading, upgrading, refresh, startUpgrade };
}
