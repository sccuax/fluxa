import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";

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
        // Wraps the whole row (icon + label + chevron), not just the icon -
        // hover anywhere on the row shows the hint, not just its 16px icon.
        // side="top" (not "left"/"right") since this row spans nearly the
        // full card width - a bubble opening off either horizontal edge
        // would get silently clipped by AccountTab's own scrolling
        // `overflow-y-auto` ancestor (see Tooltip.tsx's own comment on why
        // that clips X too, not just Y). fullWidth so this wrapper doesn't
        // shrink the row back down to content width and break its own
        // justify-between layout.
        <Tooltip key={label} text="Locked. Will be available soon." side="top" fullWidth>
          <div
            className={`flex w-full items-center justify-between ${
              index < LINK_ITEMS.length - 1 ? "border-b border-border-border pb-3" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon name={icon} className="text-background-dark" />
              <span className="font-sans text-mobile-text-md-medium text-text-black">{label}</span>
            </div>
            <Icon name="chevronDown" className="-rotate-90 cursor-pointer" />
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
