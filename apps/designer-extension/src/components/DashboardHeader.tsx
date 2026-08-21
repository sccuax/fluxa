import { useRef, useState } from "react";
import { FluxaLogoLockup } from "./FluxaLogoLockup";
import { Icon } from "./Icon";
import { AppliedGradientsMenu } from "./AppliedGradientsMenu";
import { useSelectedElement } from "../hooks/useSelectedElement";

interface DashboardHeaderProps {
  onOpenMenu: () => void;
}

// Persistent top bar for DashboardScreen - stays mounted across the
// Editor/Presets/Account tabs (see DashboardNav), unlike the auth flow's
// full-screen transitions. onOpenMenu is owned by the parent rather than
// this component managing its own popover state, since the "About /
// Preferences / Cookies / version number" menu content isn't built yet.
// Class names (the most common source of `label`, see useSelectedElement's
// own priority order) can run arbitrarily long - truncated to 12 characters
// + an ellipsis so a long one never pushes the chevron/menu button out of
// the header's own max-h-[48px] row. A plain character-count slice rather
// than a CSS max-width/text-ellipsis, since the ask was specifically "after
// twelve letters" - a pixel-based CSS truncation would cut at a different
// character count per label depending on which letters it contains
// (proportional font), not a fixed count.
// Exported for AppliedGradientsMenu.tsx's own rows, which truncate their
// element labels the exact same way as this header does.
export const LABEL_MAX_CHARS = 12;

export function truncateLabel(label: string): string {
  return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS)}…` : label;
}

export function DashboardHeader({ onOpenMenu }: DashboardHeaderProps) {
  const { label } = useSelectedElement();
  const [gradientsMenuOpen, setGradientsMenuOpen] = useState(false);
  const chevronButtonRef = useRef<HTMLButtonElement>(null);

  return (
    // `relative` lives here, not on the small label+chevron wrapper below -
    // AppliedGradientsMenu is positioned via `right-[60px]`, which needs to
    // resolve against this header's own full-width box (per explicit
    // design spec), not the narrow inner wrapper around just the label.
    <header
      id="dashboard-header"
      className="relative flex max-h-[48px] w-full items-center justify-between bg-background-dark px-[20px] py-[12px]"
    >
      <FluxaLogoLockup variant="light" className="h-4 w-auto" />

      <div className="flex items-center gap-[16px]">
        <div className="flex items-center gap-[4px] text-text-white">
          <span className="text-md-regular text-text-secondary font-sans">
            {label ? truncateLabel(label) : "No selection"}
          </span>
          <button
            ref={chevronButtonRef}
            type="button"
            onClick={() => setGradientsMenuOpen((current) => !current)}
            aria-label="Show gradients applied on this page"
          >
            <Icon
              name="chevronDown"
              className={`cursor-pointer transition-transform duration-200 ease-out ${
                gradientsMenuOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="text-text-white"
        >
          <Icon name="threeDots" />
        </button>
      </div>

      {/* Rendered unconditionally (not `{gradientsMenuOpen && ...}`) - the
          menu now owns its own mount lifecycle so it can stay mounted
          briefly after `open` goes false to actually play its exit
          animation instead of vanishing instantly. See its own comment for
          the full reasoning. */}
      <AppliedGradientsMenu
        open={gradientsMenuOpen}
        onCloseRequest={() => setGradientsMenuOpen(false)}
        triggerRef={chevronButtonRef}
      />
    </header>
  );
}
