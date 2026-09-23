import { Icon, type IconName } from "./Icon";

export type DashboardTab = "editor" | "presets" | "account";

export interface NavTab<T extends string> {
  tab: T;
  icon: IconName;
  label: string;
}

// icon/label are per-tab since "editor"/"presets"/"account" aren't 1:1 with
// their Icon variant names by coincidence alone - keeping the mapping
// explicit here (rather than assuming DashboardTab === IconName) means the
// two can diverge later without a silent breakage. Exported so
// DashboardScreen can pass it as this component's own tab set explicitly,
// now that `tabs` isn't hardcoded inside this file anymore.
export const DASHBOARD_TABS: NavTab<DashboardTab>[] = [
  { tab: "editor", icon: "editor", label: "Editor" },
  { tab: "presets", icon: "presets", label: "Presets" },
  { tab: "account", icon: "account", label: "Account" },
];

interface DashboardNavProps<T extends string> {
  tabs: NavTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

// Persistent bottom bar, mobile-app style - stays mounted across tabs the
// same way DashboardHeader does. Icon color is driven here (not baked into
// the SVGs, see Icon.tsx) so the active tab can be highlighted dynamically
// instead of each icon owning a fixed color.
//
// Generic over its own tab id type (was hardcoded to DashboardTab) so
// WebflowSolutionsScreen can reuse this exact shell for its own three tabs
// (Multi-image/CMS images/Blog to staging) instead of a second, visually
// duplicated nav bar - per explicit direction to reuse this component
// rather than rebuild it.
export function DashboardNav<T extends string>({ tabs, activeTab, onTabChange }: DashboardNavProps<T>) {
  return (
    <nav id="dashboard-nav" className="flex w-full items-center bg-background-dark justify-between px-[20px] py-[12px]">
      {tabs.map(({ tab, icon, label }) => {
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
            <span className="text-mobile-text-sm-medium font-sans">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
