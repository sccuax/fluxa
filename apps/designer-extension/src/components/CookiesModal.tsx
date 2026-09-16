import { useState } from "react";
import { FullViewModal } from "./FullViewModal";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { getCookiePreferences, setCookiePreferences, type CookiePreferences } from "../services/cookiePreferences";
import { ToggleSwitch } from "./ToggleSwitch";

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
    <div className="flex items-start justify-between gap-3 border-b border-border-border pt-3 pb-2">
      <div className="flex flex-col gap-1">
        <span className="font-display text-text-sm-medium text-text-black">{title}</span>
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
    <div className={`flex items-start justify-between gap-3 pt-3 pb-2 ${last ? "" : "border-b border-border-border"}`}>
      <div className="flex flex-col gap-1">
        <span className="font-display text-text-sm-medium text-text-black">{title}</span>
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
      <div className="flex flex-col gap-4 px-[20px] pb-8 pt-8">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-mobile-display-d1 text-text-black">Cookies policy</h2>
          <p className="font-sans text-mobile-text-md-regular text-text-secondary">
            Fluxa uses cookies and similar technologies to keep you signed in and, if you allow it, to understand
            how the product is used. You can control your preferences at any time.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-display text-text-sm-medium text-text-black">How we use cookies</h3>
          <p className="font-sans text-mobile-text-md-regular text-text-secondary">
            We use cookies for the following purposes:
          </p>
        </div>

        {/* 2026-09-14: rebuilt from the original 3-toggle shape (Analytics/
            Marketing/Preference) to these 2, once analytics actually
            shipped for real - see cookiePreferences.ts's own top comment
            for the full reasoning. Marketing/Preference each gated
            literally nothing (grepped to confirm, not assumed) - kept as
            named categories, they'd be exactly the kind of "toggle that
            does nothing" this reorganization exists to remove. Every row
            below now corresponds to one real, distinct thing this app
            actually does. */}
        <div className="rounded-4 border border-border-border px-3 pb-3">
          <EssentialRow title="Essential cookies" description="Required for Fluxa to work properly." />
          <ToggleRow
            title="Product analytics"
            description="Help us understand how you use the Fluxa extension so we can improve it. Only anonymous, aggregate usage counts - never tied to your account or identity."
            checked={preferences.productAnalytics}
            onChange={(value) => updatePreference("productAnalytics", value)}
          />
          <ToggleRow
            title="Published shader analytics"
            description="When you apply a gradient or preset, include an anonymous view counter on your published site so we can see how often it renders. No cookies or visitor data are collected - this only affects sites you apply a shader to after changing this."
            checked={preferences.publishedSiteAnalytics}
            onChange={(value) => updatePreference("publishedSiteAnalytics", value)}
            last
          />
        </div>
      </div>
    </FullViewModal>
  );
}
