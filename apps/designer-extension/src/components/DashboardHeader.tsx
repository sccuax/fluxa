import { useRef, useState } from "react";
import { Dropdown } from "./Dropdown";
import { Icon } from "./Icon";
import { AppliedGradientsMenu } from "./AppliedGradientsMenu";
import { HeaderAppMenu } from "./HeaderAppMenu";
import { useSelectedElement } from "../hooks/useSelectedElement";

export type ActiveService = "shaders" | "webflowSolutions";

// Same two icons ServicesScreen.tsx's own `services` array swatches use
// (the brand-gradient square, the Webflow "W" monogram) - duplicated
// rather than imported, since those are defined inline as local JSX in
// that file's own data array, not exported components.
//
// `swatch` is a function of whether THIS row is the currently active
// service, not a static icon - per explicit direction, each row's own
// icon should read as "on brand" only while it's the active one, and
// desaturate to match its own now-gray text (text-text-secondary) while
// inactive - the opposite of what was first built (a fixed color per
// icon regardless of active state).
const SERVICE_OPTIONS: {
  id: ActiveService;
  label: string;
  swatch: (active: boolean) => React.ReactNode;
}[] = [
    {
      id: "shaders",
      label: "Shader gradients",
      // Active: the real 5-stop brand gradient. Inactive: the exact same
      // gradient shape/positions, each stop replaced with its own
      // perceptual luminance (Rec. 709 luma, e.g. #6FF5F1 -> #D8D8D8)
      // rather than a flat gray - keeps the gradient's own light/dark
      // rhythm recognizable instead of collapsing to one flat tone. Both
      // gradients are always defined; only which `url(#...)` the rect
      // references changes.
      swatch: (active) => (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="12" height="12" rx="1" fill={active ? "url(#paint0_linear_shader_color)" : "url(#paint0_linear_shader_gray)"} />
          <defs>
            <linearGradient id="paint0_linear_shader_color" x1="0" y1="0" x2="12" y2="12" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6FF5F1" />
              <stop offset="0.3" stop-color="#3B9DD6" />
              <stop offset="0.504808" stop-color="#0644BB" />
              <stop offset="0.701923" stop-color="#7442A4" />
              <stop offset="1" stop-color="#E23F8C" />
            </linearGradient>
            <linearGradient id="paint0_linear_shader_gray" x1="0" y1="0" x2="12" y2="12" gradientUnits="userSpaceOnUse">
              <stop stop-color="#D8D8D8" />
              <stop offset="0.3" stop-color="#8C8C8C" />
              <stop offset="0.504808" stop-color="#3F3F3F" />
              <stop offset="0.701923" stop-color="#545454" />
              <stop offset="1" stop-color="#676767" />
            </linearGradient>
          </defs>
        </svg>
      ),
    },
    {
      id: "webflowSolutions",
      label: "Webflow solutions",
      // fill="currentColor" (was a hardcoded #5C647A) - active: Webflow's
      // own real brand blue (#146EF5, not this app's own accent color).
      // Inactive: text-text-secondary, the same gray token its own label
      // text uses while inactive.
      swatch: (active) => (
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={active ? "text-[#146EF5]" : "text-text-secondary"}
        >
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 0L8.17096 7.48539H4.57441L6.17685 4.38312H6.10496C4.78295 6.09927 2.81048 7.22901 0 7.48539V4.42605C0 4.42605 1.79792 4.31985 2.85487 3.20863H0V5.33017e-05H3.20857V2.63906L3.28059 2.63876L4.59173 5.33017e-05H7.01828V2.62233L7.0903 2.62222L8.45063 0H12Z" fill="currentColor" />
        </svg>
      ),
    },
  ];

// After 10 characters, per explicit spec - a separate rule/constant from
// truncateLabel/LABEL_MAX_CHARS below, which truncates the SELECTED-
// ELEMENT label (a different piece of text, 12 chars) - the two just
// happen to share the same "count characters, add an ellipsis" shape.
const SERVICE_LABEL_MAX_CHARS = 10;

function truncateServiceLabel(label: string): string {
  return label.length > SERVICE_LABEL_MAX_CHARS ? `${label.slice(0, SERVICE_LABEL_MAX_CHARS)}...` : label;
}

// Persistent top bar for DashboardScreen - stays mounted across the
// Editor/Presets/Account tabs (see DashboardNav), unlike the auth flow's
// full-screen transitions. The "..." menu's open state is owned locally here
// (appMenuOpen below), the same way the chevron's gradientsMenuOpen already
// is - it used to be lifted to DashboardScreen via an onOpenMenu prop, back
// when the "About/Preferences/Cookies/version number" menu content wasn't
// built yet; now that HeaderAppMenu exists, that prop was dead weight (a
// permanent no-op stub) and was removed.
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

export function DashboardHeader({
  activeService,
  onSelectShaders,
  onSelectWebflowSolutions,
}: {
  activeService: ActiveService;
  onSelectShaders: () => void;
  onSelectWebflowSolutions: () => void;
}) {
  const { label } = useSelectedElement();
  const [gradientsMenuOpen, setGradientsMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
  const chevronButtonRef = useRef<HTMLButtonElement>(null);
  const appMenuButtonRef = useRef<HTMLButtonElement>(null);
  const serviceMenuButtonRef = useRef<HTMLButtonElement>(null);

  const activeOption = SERVICE_OPTIONS.find((option) => option.id === activeService) ?? SERVICE_OPTIONS[0];

  function handleSelectService(id: ActiveService) {
    setServiceMenuOpen(false);
    if (id === activeService) return;
    if (id === "shaders") onSelectShaders();
    else onSelectWebflowSolutions();
  }

  return (
    // `relative` lives here, not on the small label+chevron wrapper below -
    // AppliedGradientsMenu is positioned via `right-[60px]`, which needs to
    // resolve against this header's own full-width box (per explicit
    // design spec), not the narrow inner wrapper around just the label.
    <header
      id="dashboard-header"
      className="relative flex max-h-[48px] w-full items-center justify-between bg-background-dark px-[20px] py-[12px]"
    >
      {/* Replaces the Fluxa logo that used to live here - lets the user
          jump straight to the other service (shaders <-> Webflow
          solutions) from any tab, without going back through
          ServicesScreen. Same Dropdown shell as the two menus on the
          right, just anchored from the header's LEFT edge instead (see
          Dropdown.tsx's own new `align` prop). */}
      <button
        ref={serviceMenuButtonRef}
        type="button"
        onClick={() => setServiceMenuOpen((current) => !current)}
        aria-label="Switch service"
        className="flex items-center gap-1 text-text-white"
      >
        <span className="font-display text-mobile-header-h1">{truncateServiceLabel(activeOption.label)}</span>
        <Icon
          name="chevronDown"
          className={`cursor-pointer transition-transform duration-200 ease-out ${serviceMenuOpen ? "rotate-180" : "rotate-0"
            }`}
        />
      </button>
      <Dropdown
        open={serviceMenuOpen}
        onCloseRequest={() => setServiceMenuOpen(false)}
        triggerRef={serviceMenuButtonRef}
        offsetPx={20}
        align="left"
        scrollable={false}
      >
        {SERVICE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelectService(option.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-4 px-2 py-1.5 text-left font-sans text-mobile-text-md-regular ${option.id === activeService ? "text-text-color-accent" : "text-text-secondary"
              }`}
          >
            {option.swatch(option.id === activeService)}
            {option.label}
          </button>
        ))}
      </Dropdown>

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
              className={`cursor-pointer transition-transform duration-200 ease-out ${gradientsMenuOpen ? "rotate-180" : "rotate-0"
                }`}
            />
          </button>
        </div>

        <button
          ref={appMenuButtonRef}
          type="button"
          onClick={() => setAppMenuOpen((current) => !current)}
          aria-label="Open menu"
        >
          <Icon name="threeDots" className="text-text-white" />
        </button>
      </div>

      {/* Both rendered unconditionally (not `{someMenuOpen && ...}`) - each
          dropdown now owns its own mount lifecycle (via the shared Dropdown
          component) so it can stay mounted briefly after `open` goes false
          to actually play its exit animation instead of vanishing
          instantly. See Dropdown.tsx's own comment for the full reasoning. */}
      <AppliedGradientsMenu
        open={gradientsMenuOpen}
        onCloseRequest={() => setGradientsMenuOpen(false)}
        triggerRef={chevronButtonRef}
      />
      <HeaderAppMenu
        open={appMenuOpen}
        onCloseRequest={() => setAppMenuOpen(false)}
        triggerRef={appMenuButtonRef}
      />
    </header>
  );
}
