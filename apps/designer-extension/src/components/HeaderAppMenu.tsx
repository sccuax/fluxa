import { useEffect, useState, type RefObject } from "react";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { Dropdown } from "./Dropdown";

// About/Preferences/Cookies rows for DashboardHeader's "..." menu, rendered
// inside the generic Dropdown shell (Dropdown.tsx). None of the three
// destination screens exist yet (see CLAUDE.md's Dashboard section - this
// menu's content was explicitly called out as not built), so each row is
// wired up structurally (button, icon, label) but has no real onClick yet -
// same "no-op stub, ready to wire" state DashboardScreen's own onOpenMenu
// prop was in before this component existed.
const MENU_ITEMS: Array<{ label: string; icon: IconName }> = [
  { label: "About", icon: "about" },
  { label: "Preferences", icon: "preferences" },
  { label: "Cookies", icon: "cookies" },
];

export function HeaderAppMenu({ open, onCloseRequest, triggerRef }: {
  open: boolean;
  onCloseRequest: () => void;
  triggerRef: RefObject<HTMLElement>;
}) {
  // Which row was last clicked, kept highlighted (text-color-accent, same
  // active/inactive convention AppliedGradientsMenu's own activeKey already
  // uses) until a different row is clicked or the dropdown closes - per
  // explicit spec, nothing should read as highlighted just from opening the
  // menu. Reset on every open so a stale highlight from a previous open
  // never reappears.
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    if (open) setActiveLabel(null);
  }, [open]);

  return (
    // offsetPx=20 (not the chevron menu's 60) - per explicit design spec,
    // this dropdown's right edge sits flush with the header's own
    // px-[20px] padding, unlike the chevron menu which has to clear the
    // "..." button sitting beside it.
    <Dropdown open={open} onCloseRequest={onCloseRequest} triggerRef={triggerRef} offsetPx={20}>
      {MENU_ITEMS.map(({ label, icon }) => {
        const isActive = label === activeLabel;
        return (
          <button
            key={label}
            type="button"
            onClick={() => setActiveLabel(label)}
            className={`flex items-center gap-2 whitespace-nowrap text-left font-sans text-mobile-text-md-regular ${
              isActive ? "text-text-color-accent" : "text-text-secondary"
            }`}
          >
            <Icon name={icon} />
            {label}
          </button>
        );
      })}
      {/* Plain text, not a button - the version line isn't an action, per
          explicit spec ("por ultimo un texto que diga Version Bet[a]").
          "Version Beta" - the user's own message cut off mid-word; adjust
          the literal copy here if that guess is wrong. */}
      <p className="whitespace-nowrap font-sans text-mobile-text-md-regular text-text-secondary">
        Version Beta
      </p>
    </Dropdown>
  );
}
