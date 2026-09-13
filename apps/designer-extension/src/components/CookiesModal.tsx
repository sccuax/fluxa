import { useState } from "react";
import { FullViewModal } from "./FullViewModal";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { getCookiePreferences, setCookiePreferences, type CookiePreferences } from "../services/cookiePreferences";

// Small local toggle switch - no other screen in this app needs one yet,
// so it stays inline here rather than a shared component (same reasoning
// AboutModal.tsx's own local AboutLinkRow uses).
//
// Real bug, fixed: the thumb's "off" position relied on an absolutely
// positioned element's implicit static position (no explicit `left`) plus
// a small translate - that implicit position isn't reliably the track's
// own left edge, so the "on" state's translate distance (measured from
// x=0) overshot the track's real right edge and rendered past it. Fixed by
// giving the thumb an explicit `left-0.5` base position and only
// translating the OFF-TO-ON delta (track width 44px - thumb width 20px -
// 2*2px inset = 20px) from there, rather than an absolute pixel guess.
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-gradient-gradient" : "bg-border-border"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface CategoryRowProps {
  title: string;
  description: string;
}

// "Essential" never toggles (always-on, shown as text per the reference
// design) - modeled as its own row rather than a 4th key in
// CookiePreferences, since it has no real on/off state to persist at all.
// "Always on" doesn't activate the other toggles either - checked against
// real cookie-consent UIs (OneTrust, Cookiebot, Termly): their equivalent
// "Necessary - Always Active" label is purely informational everywhere,
// never a select-all control; a real "Accept all" would be its own
// separate button elsewhere, not this label. Wrapped in the same `Tooltip`
// component ColorRow's own non-removable colors already use for "why can't
// I interact with this".
//
// Real bug, fixed: side="bottom" (tried first) centers the bubble
// horizontally on its trigger - but this trigger sits flush against the
// row's own right edge (justify-between), so a 150-200px-wide bubble
// centered there extends well past the modal's right edge. Tailwind's
// `invisible` (not `display: none`) still occupies that overflowing space
// even while hidden, and this content sits inside FullViewModal's
// overflow-y-auto area - per the CSS overflow spec, setting only the Y
// axis to non-visible forces the X axis to compute as `auto` too, so that
// invisible overflow silently added a horizontal scrollbar to the whole
// modal. Fixed with side="left" instead - the bubble grows leftward, into
// the row's own roomy interior, never past either edge.
function EssentialRow({ title, description }: CategoryRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-border py-4">
      <div className="flex flex-col gap-1">
        <span className="font-display text-mobile-header-h2 text-text-black">{title}</span>
        <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{description}</span>
      </div>
      <Tooltip text="Essential cookies are required and cannot be disabled." side="left">
        <span className="shrink-0 font-sans text-mobile-text-sm-regular text-text-color-accent">Always on</span>
      </Tooltip>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  last = false,
}: CategoryRowProps & { checked: boolean; onChange: (checked: boolean) => void; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-4 ${last ? "" : "border-b border-border-border"}`}>
      <div className="flex flex-col gap-1">
        <span className="font-display text-mobile-header-h2 text-text-black">{title}</span>
        <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{description}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

export function CookiesModal({ onClose }: { onClose: () => void }) {
  const [preferences, setPreferences] = useState<CookiePreferences>(getCookiePreferences);

  function updatePreference(key: keyof CookiePreferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setCookiePreferences(next);
  }

  return (
    <FullViewModal title="Cookies" titleIcon={<Icon name="cookies" className="h-[18px] w-[18px]" />} onClose={onClose}>
      <div className="flex flex-col gap-6 px-[20px] pb-8 pt-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-mobile-display-d1 text-text-black">Cookies policy</h2>
          <p className="font-sans text-mobile-text-md-regular text-text-secondary">
            Fluxa uses cookies and similar technologies to improve your experience, analyze usage, and deliver
            personalized content. You can control your preferences at any time.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-display text-mobile-header-h1 text-text-black">How we use cookies</h3>
          <p className="font-sans text-mobile-text-md-regular text-text-secondary">
            We use cookies for the following purposes:
          </p>
        </div>

        <div className="rounded-8 border border-border-border px-4">
          <EssentialRow title="Essential cookies" description="Required for Fluxa to work properly." />
          <ToggleRow
            title="Analytics cookies"
            description="Help us understand how Fluxa is used so we can improve."
            checked={preferences.analytics}
            onChange={(value) => updatePreference("analytics", value)}
          />
          <ToggleRow
            title="Marketing cookies"
            description="Used to deliver relevant content and updates."
            checked={preferences.marketing}
            onChange={(value) => updatePreference("marketing", value)}
          />
          <ToggleRow
            title="Preference cookies"
            description="Remember your settings and preferences."
            checked={preferences.preferences}
            onChange={(value) => updatePreference("preferences", value)}
            last
          />
        </div>
      </div>
    </FullViewModal>
  );
}
