import { useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { Dropdown } from "./Dropdown";

// Matches Webflow's own Settings-panel field list (light surface, an icon
// per row, hover/selected tint) rather than this app's own plain
// ButtonSecondary list, per explicit direction - checked against Webflow's
// Trademark Usage Policy and developer design guidelines first (see
// Icon.tsx's own "multiImage" comment): matching Webflow's native in-app
// look is explicitly sanctioned for a Designer Extension, not restricted -
// only their actual name/logo/wordmark is. Rest = bg #CABEF4, border
// #8967FF, text/svg #8967FF (same as border) - revised from an earlier pass
// that had rest text/bg too close in lightness to read (#EDDEFF on
// #DBD5EF). Hover inverts: bg becomes the former text/border color
// (#8967FF), text/svg becomes #EDDEFF - a real dark-on-light ->
// light-on-dark swap this time, not two similar pastels. `text-[...]`
// alone drives the icon's own color too via currentColor, same as every
// other icon call site in this app - no separate icon color class needed.
// Shared by both the trigger button and every dropdown row, per explicit
// direction that the trigger should carry these colors too, not just the
// opened list.
const PILL_COLORS = "border-[#8967FF] bg-[#CABEF4] text-[#8967FF] hover:bg-[#8967FF] hover:text-[#EDDEFF]";

export interface PillDropdownOption {
  key: string;
  displayName: string;
}

// Generic "pick one from a list" trigger+dropdown, extracted from
// WebflowSolutionsScreen.tsx's own FieldDropdown (originally hardcoded to
// multi-image fields) once CmsImagesScreen.tsx needed the identical control
// for picking a COLLECTION instead - the two lists are the same shape
// (`{key, displayName}`), so this is one component with a configurable
// `icon`/`placeholder` rather than a second near-copy. `options`/`onSelect`
// use a plain string `key` (a field slug for the multi-image wizard, a
// collectionId for CmsImagesScreen) rather than either caller's own
// domain-specific field name, so this file has no knowledge of either
// feature.
export function PillDropdown({
  options,
  onSelect,
  disabled,
  placeholder,
  icon = "multiImage",
}: {
  options: PillDropdownOption[];
  onSelect: (key: string) => void;
  disabled?: boolean;
  placeholder: string;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-4 border px-3 py-2 text-left font-sans text-mobile-text-sm-regular transition-colors disabled:opacity-50 ${PILL_COLORS}`}
      >
        <span className="flex items-center gap-2">
          <Icon name={icon} className="shrink-0" />
          {placeholder}
        </span>
        <Icon name="chevronDown" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Dropdown open={open} onCloseRequest={() => setOpen(false)} triggerRef={triggerRef} offsetPx={0} variant="light" fullWidth>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              setOpen(false);
              onSelect(option.key);
            }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-4 border px-2.5 py-1 text-left font-sans text-mobile-text-sm-regular transition-colors ${PILL_COLORS}`}
          >
            <Icon name={icon} className="shrink-0" />
            {option.displayName}
          </button>
        ))}
      </Dropdown>
    </div>
  );
}
