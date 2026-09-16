import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { PlanBillingModal } from "./PlanBillingModal";
import { SupportModal } from "./SupportModal";
import { trackEvent } from "../services/analytics";

// Preferences/Plan & billing/Support, each a full-width row (logo + label on
// the left via its own gap-2 div, a right-pointing chevron on the right -
// reuses the same chevronDown -rotate-90 trick ProfileCard's own edit button
// already uses, at its native 12x12 size, no override needed) inside one
// bordered/rounded card. Each label's icon is its own real Figma asset
// (Icon.tsx's gear/billing/support entries) - "gear" is deliberately
// distinct from the existing "preferences" icon (HeaderAppMenu's 12x12
// gear), not a reuse at a different size.
const LINK_ITEMS: Array<{ label: string; icon: IconName }> = [
  { label: "Preferences", icon: "gear" },
  { label: "Plan & billing", icon: "billing" },
  { label: "Support", icon: "support" },
];

// The Tooltip "Locked. Will be available soon." hint every row used to
// carry was removed (2026-09-14, per explicit direction) - same stance
// HeaderAppMenu.tsx's own menu already took on this exact pattern. Plan &
// billing and Support now open real modals (mirrors HeaderAppMenu's own
// About/Cookies rows: local open-state booleans + rendering the modal
// alongside this card rather than inside it). Preferences still has no
// destination screen (same as HeaderAppMenu's own Preferences row) - stays
// a no-op click, per explicit direction not to fake a modal for it yet.
export function LinksCard() {
  const [planBillingOpen, setPlanBillingOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  function handleRowClick(label: string) {
    if (label === "Plan & billing") {
      trackEvent("open_plan_billing_modal");
      setPlanBillingOpen(true);
    }
    if (label === "Support") {
      trackEvent("open_support_modal");
      setSupportOpen(true);
    }
  }

  return (
    <>
      <div className="flex flex-col justify-start gap-3 rounded-4 border border-border-border p-3">
        {LINK_ITEMS.map(({ label, icon }, index) => (
          <button
            key={label}
            type="button"
            onClick={() => handleRowClick(label)}
            className={`flex w-full items-center justify-between ${
              index < LINK_ITEMS.length - 1 ? "border-b border-border-border pb-3" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon name={icon} className="text-background-dark" />
              <span className="font-sans text-mobile-text-md-medium text-text-black">{label}</span>
            </div>
            <Icon name="chevronDown" className="-rotate-90 cursor-pointer" />
          </button>
        ))}
      </div>
      {planBillingOpen && <PlanBillingModal onClose={() => setPlanBillingOpen(false)} />}
      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
    </>
  );
}
