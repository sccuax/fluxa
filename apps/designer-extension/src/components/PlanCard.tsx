import { useEffect, useState } from "react";
import { ButtonPrimary } from "./ButtonPrimary";
import { Icon } from "./Icon";
import { ACTIVE_FILL_GRADIENT } from "./RangeSlider";
import { fetchShaderUsage, onShaderUsageChanged, type ShaderUsage } from "../services/shaderUsage";
import { trackEvent } from "../services/analytics";
import { useBillingStatus } from "../hooks/useBillingStatus";
import { planCache } from "../services/planCache";

// Real usage: how many of the Free plan's 3 lifetime shaders this account has
// spent (editor shaders and gallery presets share one pool; deleting a shader
// does not give it back), tracked server-side by the Data Client's
// routes/shaderUsage.ts. Falls back to an empty card on any failure.
export function useShaderUsage() {
  // Starts from the session cache (services/planCache.ts) so a remount doesn't
  // begin as "unknown". `loaded` flips true after the first response OR failure,
  // so a failed fetch settles on Free instead of showing the skeleton forever.
  const [usage, setUsage] = useState<ShaderUsage | null>(planCache.usage);
  const [loaded, setLoaded] = useState(planCache.usage !== null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchShaderUsage();
        planCache.usage = next;
        if (!cancelled) setUsage(next);
      } catch {
        // Keep whatever loaded; the card stays harmless without a session.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    const off = onShaderUsageChanged(() => {
      fetchShaderUsage()
        .then((next) => {
          planCache.usage = next;
          if (!cancelled) setUsage(next);
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return { usage, loaded };
}

// Plan/usage row - built with real data (useShaderUsage above). Used both
// inline in AccountTab and as PlanBillingModal.tsx's own top "Free plan"
// box - a single shared component so both places always show identical
// usage/progress data and stay in sync automatically, never two copies
// drifting apart.
//
// No longer shown disabled (2026-09-14, per explicit direction) - the
// opacity/pointer-events-none/aria-disabled wrapper and the button's own
// `disabled` are gone. "Upgrade to Pro" is wired to a real Lemon Squeezy
// checkout via useBillingStatus() (data-client's routes/billing.ts) - see
// that hook's own comment for the open-in-new-tab + poll mechanism.
//
// `showUpgradeButton` (default true, matches AccountTab's own inline use)
// defaults to hidden only for PlanBillingModal.tsx's own copy - per the
// reference screenshot, that modal's own "Upgrade to Pro" button sits
// BELOW the "What's included" checklist, not inside this box, so that
// caller renders its own button separately after the checklist rather than
// this one.
export function PlanCard({ showUpgradeButton = true }: { showUpgradeButton?: boolean }) {
  const { usage, loaded: usageLoaded } = useShaderUsage();
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 3;
  const percent = Math.min(100, (used / limit) * 100);
  const { status, loading: statusLoading, upgrading, startUpgrade } = useBillingStatus();
  const isPro = status?.plan === "pro" || usage?.plan === "pro";
  // Pro as soon as either source says so; Free only once BOTH have answered.
  // Until then the plan is unknown - render a neutral skeleton, never "Free".
  const planKnown = isPro || (usageLoaded && !statusLoading);

  function handleUpgradeClick() {
    trackEvent("click_upgrade_to_pro");
    startUpgrade();
  }

  if (!planKnown) {
    // Same box as the real card (3 rows: title, subtitle, bar) so nothing jumps.
    return (
      <div aria-busy="true" className="flex border-border-border border rounded-8 flex-col gap-3 p-3">
        <div className="h-5 w-20 animate-pulse rounded-4 bg-border-border" />
        <div className="h-5 w-32 animate-pulse rounded-4 bg-border-border" />
        <div className="h-1 w-full animate-pulse rounded-[4px] bg-border-border" />
      </div>
    );
  }

  if (isPro) {
    return (
      <div className="flex border-border-border border rounded-8 flex-col gap-3 p-3">
        <span className="font-sans text-text-sm-medium text-text-black">Pro plan</span>
        <span className="font-sans text-mobile-text-md-regular text-text-secondary">Unlimited shaders.</span>
      </div>
    );
  }

  return (
    <div className="flex border-border-border border rounded-8 flex-col gap-3 p-3">
      <span className="font-sans text-text-sm-medium text-text-black">Free plan</span>
      <span className="font-sans text-mobile-text-md-regular text-text-secondary">
        {used} of {limit} shaders used
      </span>
      <div className="h-1 w-full overflow-hidden rounded-[4px] bg-border-border">
        <div className="h-full rounded-[4px]" style={{ width: `${percent}%`, background: ACTIVE_FILL_GRADIENT }} />
      </div>
      {showUpgradeButton && (
        <ButtonPrimary icon={<Icon name="sparkle" />} onClick={handleUpgradeClick} disabled={upgrading}>
          {upgrading ? "Waiting for payment…" : "Upgrade to Pro"}
        </ButtonPrimary>
      )}
    </div>
  );
}
