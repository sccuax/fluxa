import { Icon, type IconName } from "./Icon";

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

export function LinksCard() {
  return (
    <div className="flex flex-col justify-start gap-3 rounded-4 border border-border-border p-3">
      {LINK_ITEMS.map(({ label, icon }, index) => (
        <div
          key={label}
          className={`flex items-center justify-between ${
            index < LINK_ITEMS.length - 1 ? "border-b border-border-border pb-3" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name={icon} className="text-background-dark" />
            <span className="font-sans text-mobile-text-md-medium text-text-black">{label}</span>
          </div>
          <Icon name="chevronDown" className="-rotate-90 cursor-pointer" />
        </div>
      ))}
    </div>
  );
}
