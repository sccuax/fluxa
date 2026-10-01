// The Designer Extension's editor tab bar (Shape / Colors / Motion / Camera): display-font labels over a bottom border,
// the active one underlined with the accent colour. Shared so the marketing site's product mock-ups show the exact
// same bar as the real panel.
interface PanelTabsProps<T extends string> {
  tabs: Array<{ tab: T; label: string }>;
  active: T;
  onChange?: (tab: T) => void;
  className?: string;
}

export function PanelTabs<T extends string>({ tabs, active, onChange, className = "" }: PanelTabsProps<T>) {
  return (
    <div className={`flex shrink-0 gap-4 border-b border-border-border bg-background-white-2 px-[20px] pt-[12px] ${className}`}>
      {tabs.map(({ tab, label }) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange?.(tab)}
          className={`border-b pb-[8px] pt-[4px] font-display text-mobile-header-h1 ${
            tab === active ? "border-b-accent-500 text-text-black" : "border-b-transparent text-text-secondary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
