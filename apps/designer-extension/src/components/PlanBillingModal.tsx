import { ButtonPrimary } from "./ButtonPrimary";
import { FullViewModal } from "./FullViewModal";
import { Icon } from "./Icon";
import { PlanCard } from "./PlanCard";
import { trackEvent } from "../services/analytics";

interface PlanFeature {
  label: string;
  included: boolean;
  comingSoon?: boolean;
}

const FEATURES: PlanFeature[] = [
  { label: "3 presets", included: true },
  { label: "Unlimited static gradients", included: true },
  { label: "Unlimited presets", included: false },
  { label: "Unlimited animated gradients", included: false },
  { label: "Team library", included: false, comingSoon: true },
];

function PlanFeatureRow({ label, included, comingSoon, last = false }: PlanFeature & { last?: boolean }) {
  return (
    <div className={`flex items-center justify-between pb-3 ${last ? "" : "border-b border-border-border"}`}>
      <div className="flex items-center gap-2">
        <Icon name={included ? "check" : "lock"} className={included ? "text-text-color-accent" : "text-text-secondary"} />
        <span className={`font-sans text-mobile-text-md-regular ${included ? "text-text-black" : "text-text-secondary"}`}>
          {label}
        </span>
      </div>
      {comingSoon && (
        <span className="shrink-0 rounded-16 border border-accent-300 px-2 py-0.5 font-sans text-mobile-text-sm-medium bg-accent-50 text-text-color-accent">
          Coming soon
        </span>
      )}
    </div>
  );
}

// Matches the copy-paste reference screenshot (LinksCard's own "Plan &
// billing" row opens this). The top "Free plan" box IS PlanCard.tsx - the
// exact same component AccountTab already renders inline, not a
// re-implementation - so both places always show identical usage/progress
// data and stay in sync automatically (rendered here with its own
// "Upgrade to Pro" button hidden - see PlanCard.tsx's own
// `showUpgradeButton` comment for why). The checklist below is new,
// modal-only content: two included free-plan features (check, accent
// color) and three pro-only features (the real Figma lock asset in
// Icon.tsx, text-secondary), "Team library" alone carrying the reference
// screenshot's own pink "Coming soon" pill. "Upgrade to Pro" sits BELOW the
// checklist, as its own separate button - per the reference screenshot,
// NOT inside the Free plan box above.
export function PlanBillingModal({ onClose }: { onClose: () => void }) {
  return (
    <FullViewModal title="Plan & billing" titleIcon={<Icon name="billing" />} onClose={onClose}>
      <div className="flex flex-col gap-4 px-[20px] pb-8 pt-8">
        <PlanCard showUpgradeButton={false} />
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-mobile-text-md-medium text-text-black">What's included</h3>
      <div className="flex flex-col gap-3">
            {FEATURES.map((feature, index) => (
              <PlanFeatureRow key={feature.label} {...feature} last={index === FEATURES.length - 1} />
            ))}
          </div>
        </div>
        <ButtonPrimary icon={<Icon name="sparkle" />} onClick={() => trackEvent("click_upgrade_to_pro")}>
          Upgrade to Pro
        </ButtonPrimary>
      </div>
    </FullViewModal>
  );
}
