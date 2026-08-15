import { FluxaLogoLockup } from "./FluxaLogoLockup";
import { Icon } from "./Icon";
import { useSelectedElement } from "../hooks/useSelectedElement";

interface DashboardHeaderProps {
  onOpenMenu: () => void;
}

// Persistent top bar for DashboardScreen - stays mounted across the
// Editor/Presets/Account tabs (see DashboardNav), unlike the auth flow's
// full-screen transitions. onOpenMenu is owned by the parent rather than
// this component managing its own popover state, since the "About /
// Preferences / Cookies / version number" menu content isn't built yet.
export function DashboardHeader({ onOpenMenu }: DashboardHeaderProps) {
  const { label } = useSelectedElement();

  return (
    <header className="flex max-h-[48px] w-full items-center justify-between bg-background-dark px-[20px] py-[12px]">
      <FluxaLogoLockup variant="light" className="h-4 w-auto" />

      <div className="flex items-center gap-[16px]">
        <div className="flex items-center gap-[4px] text-text-white">
          <span className="text-md-regular text-text-secondary font-sans">{label ?? "No selection"}</span>
          <Icon name="chevronDown" className="cursor-pointer" />
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
    </header>
  );
}
