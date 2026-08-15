import { Icon, type IconName } from "./Icon";

export type DashboardTab = "editor" | "presets" | "account";

interface DashboardNavProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

// icon/label are per-tab since "editor"/"presets"/"account" aren't 1:1 with
// their Icon variant names by coincidence alone - keeping the mapping
// explicit here (rather than assuming DashboardTab === IconName) means the
// two can diverge later without a silent breakage.
const TABS: Array<{ tab: DashboardTab; icon: IconName; label: string }> = [
  { tab: "editor", icon: "editor", label: "Editor" },
  { tab: "presets", icon: "presets", label: "Presets" },
  { tab: "account", icon: "account", label: "Account" },
];

// Persistent bottom bar for DashboardScreen, mobile-app style - stays
// mounted across tabs the same way DashboardHeader does. Icon color is
// driven here (not baked into the SVGs, see Icon.tsx) so the active tab can
// be highlighted dynamically instead of each icon owning a fixed color.
export function DashboardNav({ activeTab, onTabChange }: DashboardNavProps) {
  return (
    <nav className="flex w-full items-center bg-background-dark justify-between px-[20px] py-[12px]">
      {TABS.map(({ tab, icon, label }) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`flex min-w-[60px] flex-col items-center gap-[2px] ${
              isActive ? "text-text-color-accent" : "text-text-secondary"
            }`}
          >
            <Icon name={icon} />
            <span className="mobile-text-md-regular font-sans">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
