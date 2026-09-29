import { useEffect, useState } from "react";
import { ButtonPrimary } from "./ButtonPrimary";
import { Icon } from "./Icon";
import { ACTIVE_FILL_GRADIENT } from "./RangeSlider";
import { apiFetch } from "../services/apiClient";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { trackEvent } from "../services/analytics";
import { useBillingStatus } from "../hooks/useBillingStatus";

// Free plan's preset ceiling - not read from any backend "plans" row (that
// table exists but has no routes yet, see CLAUDE.md's Database section), so
// this is the one place that number lives for now.
const FREE_PLAN_PRESET_LIMIT = 3;

// Real usage, not a placeholder count: resolves the current site's id via
// the Designer API and counts that site's actual saved presets through the
// already-existing GET /api/presets/:siteId route. Falls back to 0 (not an
// error state) on any failure - no real Designer connection (sandbox/plain
// browser dev), no installation for this site yet, or a request failure all
// land here, and this card is shown disabled regardless during this beta
// pass, so there's nothing useful to surface differently for each case.
// Kept local to this file (not hooks/) since PlanCard is its only consumer -
// promote it to hooks/ if a second one ever needs it.
function usePresetUsage() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { siteId } = await getWebflowDesigner().getSiteInfo();
        const list = await apiFetch<unknown[]>(`/api/presets/${siteId}`);
        if (!cancelled) setCount(list.length);
      } catch {
        if (!cancelled) setCount(0);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}

// Plan/usage row - built with real data (usePresetUsage above). Used both
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
  const usedPresets = usePresetUsage();
  const percent = Math.min(100, (usedPresets / FREE_PLAN_PRESET_LIMIT) * 100);
  const { status, upgrading, startUpgrade } = useBillingStatus();
  const isPro = status?.plan === "pro";

  function handleUpgradeClick() {
    trackEvent("click_upgrade_to_pro");
    startUpgrade();
  }

  if (isPro) {
    return (
      <div className="flex border-border-border border rounded-8 flex-col gap-3 p-3">
        <span className="font-sans text-text-sm-medium text-text-black">Pro plan</span>
        <span className="font-sans text-mobile-text-md-regular text-text-secondary">Unlimited shaders and presets.</span>
      </div>
    );
  }

  return (
    <div className="flex border-border-border border rounded-8 flex-col gap-3 p-3">
      <span className="font-sans text-text-sm-medium text-text-black">Free plan</span>
      <span className="font-sans text-mobile-text-md-regular text-text-secondary">
        {usedPresets} of {FREE_PLAN_PRESET_LIMIT} presets used
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
