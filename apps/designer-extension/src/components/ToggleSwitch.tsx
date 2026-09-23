// Extracted from CookiesModal.tsx once a second screen (WebflowSolutionsScreen's
// gallery settings panel) needed the same on/off switch - same reasoning
// Dropdown.tsx's own extraction comment gives for itself.
//
// Real bug, fixed (inherited from the original inline version): the thumb's
// "off" position relied on an absolutely positioned element's implicit
// static position (no explicit `left`) plus a small translate - that
// implicit position isn't reliably the track's own left edge, so the "on"
// state's translate distance (measured from x=0) overshot the track's real
// right edge and rendered past it. Fixed by giving the thumb an explicit
// `left-0` base position and only translating the OFF-TO-ON delta from
// there, rather than an absolute pixel guess. Track is h-4 w-8 (16x32px);
// thumb is a fixed 16x16px (h-4 w-4, same as the track's own height, so
// there's no top/bottom inset - `top-0`, not `top-0.5`) - keep the
// translate distance (track width 32px - thumb width 16px = 16px =
// translate-x-4) in sync if either size changes again.
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Added for CmsVisibilityScreen.tsx, whose toggle auto-saves on every
  // flip (no separate Save button like ManageGalleryImagesScreen.tsx's own
  // hidden toggle has) - disables the switch itself while that save is in
  // flight, so a rapid double-click can't fire two overlapping PUTs.
  // Optional and unused by every existing caller, so nothing else changes.
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-4 w-8 shrink-0 rounded-full transition-colors shadow-[inset_0_0.706px_4.706px_0_rgba(0,0,0,0.15)] disabled:opacity-50 ${
        checked ? "bg-gradient-gradient" : "bg-background-white-2"
      }`}
    >
      <span
        className={`absolute left-0 top-0 h-4 w-4 rounded-full bg-[linear-gradient(180deg,var(--Background-Background-White,#EFF1F4)_20.59%,var(--Background-Background-White-2,#D7DAE2)_85.35%)] border-border-border transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
