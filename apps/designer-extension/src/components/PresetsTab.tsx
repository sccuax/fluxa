import { Icon } from "./Icon";

// Presets tab has no real content yet (see DashboardScreen.tsx's own
// comment) - this is a coming-soon placeholder, not the final design.
// role="img" + aria-label on the icon is the accessible-SVG equivalent of
// an <img>'s alt text, since an inline <svg> has no alt attribute of its
// own.
export function PresetsTab() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[12px] px-[20px] text-center">
      <Icon name="lock" role="img" aria-label="Locked. Will be available soon." className="text-text-secondary" width={24} height={24} />
      <h1 className="font-display text-mobile-display-d1 text-text-secondary">Locked</h1>
      <p className="max-w-[190px] font-sans text-mobile-text-md-regular text-text-secondary">
        Will be available soon.
      </p>
    </div>
  );
}
