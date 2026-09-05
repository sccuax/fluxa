import { useEffect, useState } from "react";
import { ButtonPrimary } from "./ButtonPrimary";
import { Icon } from "./Icon";
import { ACTIVE_FILL_GRADIENT } from "./RangeSlider";
import { apiFetch } from "../services/apiClient";
import { getWebflowDesigner } from "../services/webflowDesigner";

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

// Plan/usage row - built with real data (usePresetUsage above), but shown
// disabled (opacity + pointer-events-none, plus the button's own `disabled`)
// per explicit direction: upgrading isn't actually offered during this beta
// pass, so the section reads as informational-only rather than interactive.
export function PlanCard() {
  const usedPresets = usePresetUsage();
  const percent = Math.min(100, (usedPresets / FREE_PLAN_PRESET_LIMIT) * 100);

  return (
    <div className="flex border-border-border border rounded-8 flex-col gap-3 p-3 opacity-50" aria-disabled="true" style={{ pointerEvents: "none" }}>
      <span className="font-sans text-sm-medium text-text-black">Free plan</span>
      <span className="font-sans text-mobile-text-md-regular text-text-secondary">
        {usedPresets} of {FREE_PLAN_PRESET_LIMIT} presets used
      </span>
      <div className="h-1 w-full overflow-hidden rounded-[4px] bg-border-border">
        <div className="h-full rounded-[4px]" style={{ width: `${percent}%`, background: ACTIVE_FILL_GRADIENT }} />
      </div>
      <ButtonPrimary disabled icon={<Icon name="sparkle" />}>
        Upgrade to Pro
      </ButtonPrimary>
    </div>
  );
}
