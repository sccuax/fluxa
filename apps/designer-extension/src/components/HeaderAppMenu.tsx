import { useEffect, useState, type RefObject } from "react";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { Dropdown } from "./Dropdown";
import { AboutModal } from "./AboutModal";
import { CookiesModal } from "./CookiesModal";

// About/Preferences/Cookies rows for DashboardHeader's "..." menu, rendered
// inside the generic Dropdown shell (Dropdown.tsx). Preferences still has no
// destination screen (see CLAUDE.md's Dashboard section) and stays a no-op
// stub; About opens AboutModal.tsx, Cookies opens CookiesModal.tsx. The Tooltip
// "Locked. Will be available soon." hint this menu's rows used to carry was
// removed per explicit direction - scrollable={false} on the Dropdown below
// is kept regardless (this menu is always exactly 3 rows + the version
// line, never enough to need Dropdown's own default scroll).
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [cookiesOpen, setCookiesOpen] = useState(false);

  useEffect(() => {
    if (open) setActiveLabel(null);
  }, [open]);

  function handleRowClick(label: string) {
    setActiveLabel(label);
    if (label === "About") setAboutOpen(true);
    if (label === "Cookies") setCookiesOpen(true);
  }

  return (
    <>
      {/* offsetPx=20 (not the chevron menu's 60) - per explicit design spec,
          this dropdown's right edge sits flush with the header's own
          px-[20px] padding, unlike the chevron menu which has to clear the
          "..." button sitting beside it. */}
      <Dropdown open={open} onCloseRequest={onCloseRequest} triggerRef={triggerRef} offsetPx={20} scrollable={false}>
        {MENU_ITEMS.map(({ label, icon }) => {
          const isActive = label === activeLabel;
          return (
            <button
              key={label}
              type="button"
              onClick={() => handleRowClick(label)}
              className={`flex items-center gap-2 whitespace-nowrap text-left font-sans text-mobile-text-md-regular ${
                isActive ? "text-text-color-accent" : "text-text-secondary"
              }`}
            >
              <Icon name={icon} />
              {label}
            </button>
          );
        })}
        <p className="whitespace-nowrap font-sans text-mobile-text-md-regular text-text-secondary">
          Version 1.0
        </p>
      </Dropdown>
      {aboutOpen && (
        <AboutModal
          onClose={() => {
            setAboutOpen(false);
            onCloseRequest();
          }}
        />
      )}
      {cookiesOpen && (
        <CookiesModal
          onClose={() => {
            setCookiesOpen(false);
            onCloseRequest();
          }}
        />
      )}
    </>
  );
}
