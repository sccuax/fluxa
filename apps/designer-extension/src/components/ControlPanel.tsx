import { useEffect, useRef, useState, type ReactNode } from "react";
import { getEffectiveGradientColors, type GradientConfig } from "@fluxa/gradient-core";
import { useGradientStore } from "../store/gradientStore";
import { formatSliderValue } from "../helpers/format";
import { RangeSlider } from "./RangeSlider";
import { Icon } from "./Icon";
import { ColorPicker, hexToHslString, hexToRgbString, parseHex, parseHslString, parseRgbString } from "./ColorPicker";

type ControlTab = "shape" | "colors" | "motion" | "camera";

const TABS: Array<{ tab: ControlTab; label: string }> = [
  { tab: "shape", label: "Shape" },
  { tab: "colors", label: "Colors" },
  { tab: "motion", label: "Motion" },
  { tab: "camera", label: "Camera" },
];

const TYPE_OPTIONS: Array<{ label: string; value: GradientConfig["type"] }> = [
  { label: "Plane", value: "plane" },
  { label: "Sphere", value: "sphere" },
  { label: "Liquid", value: "waterPlane" },
];

const GRAIN_OPTIONS: Array<{ label: string; value: GradientConfig["grain"] }> = [
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
];

// lightType doubles as the "Environment" toggle: "env" shows Env preset +
// Reflection, "3d" shows Brightness instead - matches
// @shadergradient/react's own reference Framer controls (brightness is
// hidden when lightType==="env", envPreset/reflection hidden when
// lightType==="3d") rather than something invented for this app.
const LIGHT_TYPE_OPTIONS: Array<{ label: string; value: GradientConfig["lightType"] }> = [
  { label: "3D", value: "3d" },
  { label: "Environment", value: "env" },
];

const ENV_PRESET_OPTIONS: Array<{ label: string; value: GradientConfig["envPreset"] }> = [
  { label: "City", value: "city" },
  { label: "Dawn", value: "dawn" },
  { label: "Lobby", value: "lobby" },
];

const RANGE_OPTIONS: Array<{ label: string; value: GradientConfig["range"] }> = [
  { label: "Disabled", value: "disabled" },
  { label: "Enabled", value: "enabled" },
];

interface NumberField {
  label: string;
  key: keyof Pick<
    GradientConfig,
    | "uSpeed"
    | "uStrength"
    | "uDensity"
    | "uFrequency"
    | "cDistance"
    | "pixelDensity"
    | "brightness"
    | "reflection"
    | "rangeStart"
    | "rangeEnd"
    | "cAzimuthAngle"
    | "cPolarAngle"
    | "positionX"
    | "positionY"
    | "positionZ"
    | "rotationX"
    | "rotationY"
    | "rotationZ"
    | "fov"
  >;
  min: number;
  max: number;
  step: number;
}

// Strength/Density/Pixel density/Frequency shape the noise wave pattern
// itself (a spatial property of the mesh) - all live under Shape, below the
// Type segmented control (Shape no longer has its own tab - see the
// tab-grouping comment on ControlPanel below). Speed is the only temporal
// one, so it stays under Motion; Camera distance now has its own Camera tab.
const SHAPE_NUMBER_FIELDS: NumberField[] = [
  { label: "Distortion", key: "uStrength", min: 0, max: 10, step: 0.1 },
  { label: "Detail", key: "uDensity", min: 0, max: 4, step: 0.1 },
  { label: "Quality", key: "pixelDensity", min: 0.5, max: 3, step: 0.1 },
  { label: "Frequency", key: "uFrequency", min: 0, max: 10, step: 0.01 },
];

const MOTION_NUMBER_FIELDS: NumberField[] = [
  { label: "Speed", key: "uSpeed", min: 0, max: 1, step: 0.01 },
];

const CAMERA_NUMBER_FIELDS: NumberField[] = [
  { label: "Zoom", key: "cDistance", min: 1, max: 10, step: 0.1 },
];

// Azimuth/Polar min/max (0-360, 0-180) match @shadergradient/react's own
// reference Framer controls (cameraAngle group), verified against the
// installed package's compiled FramerControls chunk - same practice as the
// rest of this file's field ranges.
const CAMERA_ANGLE_FIELDS: NumberField[] = [
  { label: "Azimuth angle", key: "cAzimuthAngle", min: 0, max: 360, step: 1 },
  { label: "Polar angle", key: "cPolarAngle", min: 0, max: 180, step: 1 },
];

// positionX/Y/Z have no min/max in @shadergradient/react's own reference
// controls (just a free-form step of .1) - -5..5 is a reasonable bounded
// range for a slider UI, not a value copied from upstream.
const POSITION_NUMBER_FIELDS: NumberField[] = [
  { label: "Position X", key: "positionX", min: -5, max: 5, step: 0.1 },
  { label: "Position Y", key: "positionY", min: -5, max: 5, step: 0.1 },
  { label: "Position Z", key: "positionZ", min: -5, max: 5, step: 0.1 },
];

// rotationX/Y/Z min/max (-360..360) match @shadergradient/react's own
// reference Framer controls (rotation group).
const ROTATION_NUMBER_FIELDS: NumberField[] = [
  { label: "Rotation X", key: "rotationX", min: -360, max: 360, step: 1 },
  { label: "Rotation Y", key: "rotationY", min: -360, max: 360, step: 1 },
  { label: "Rotation Z", key: "rotationZ", min: -360, max: 360, step: 1 },
];

// fov is a <ShaderGradientCanvas> prop, not a <ShaderGradient> mesh prop -
// see the fov field's comment in gradient-core's schema.ts. Min/max/default
// (10/180/45) match @shadergradient/react's own reference Framer controls
// (canvas.fov).
const FOV_NUMBER_FIELDS: NumberField[] = [
  { label: "FOV", key: "fov", min: 10, max: 180, step: 1 },
];

const RANGE_NUMBER_FIELDS: NumberField[] = [
  { label: "Range start", key: "rangeStart", min: 0, max: 100, step: 1 },
  { label: "Range end", key: "rangeEnd", min: 0, max: 100, step: 1 },
];

const COLOR_FIELDS: { label: string; key: "color1" | "color2" | "color3" }[] = [
  { label: "Color 1", key: "color1" },
  { label: "Color 2", key: "color2" },
  { label: "Color 3", key: "color3" },
];

// Lets the value readout next to a RangeSlider be typed into directly, not
// just dragged - a plain <input> rather than the old static <span>. Editing
// keeps its own "draft" text state (rather than parsing/clamping on every
// keystroke) so a half-typed value like "1" while aiming for "180" isn't
// fought/clamped mid-type; the numeric config value is only parsed, clamped
// to [min, max], and committed on blur or Enter. Escape reverts the draft
// via cancelledRef rather than relying on the draft state having already
// flushed to null by the time blur's own handler runs - calling
// element.blur() synchronously inside a React event handler dispatches the
// native blur event (and its onBlur handler) before React re-renders with
// the just-set state, so onBlur would otherwise still close over the
// pre-Escape draft and commit the very text Escape was meant to discard.
// Default look: a plain right-aligned value readout, no border/background -
// used by every NumberFieldList row. `className` lets a caller (e.g.
// IconInputRow below) swap in a different look driven by the same focus state,
// without duplicating the commit/cancel logic above.
const DEFAULT_EDITABLE_VALUE_CLASSNAME = () =>
  "max-w-[25px] shrink-0 appearance-none border-none bg-transparent text-right text-mobile-text-md-medium font-sans text-text-secondary focus:outline-none";

// Generic version of the draft/commit/cancel machinery above - `format`
// turns the real value into the text shown at rest, `parse` turns typed
// text back into a real value (returning null rejects the edit, same as a
// number that failed Number.isFinite before this was generalized). Pulled
// out once a second call site (HexColorInput below) needed the exact same
// focus/draft/blur/Enter/Escape behavior for a string instead of a number.
function EditableValue<T>({ value, format, parse, onCommit, className }: {
  value: T;
  format: (value: T) => string;
  parse: (raw: string) => T | null;
  onCommit: (value: T) => void;
  className: (focused: boolean) => string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const cancelledRef = useRef(false);

  function commit() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(null);
      return;
    }
    if (draft !== null) {
      const parsed = parse(draft);
      if (parsed !== null) {
        onCommit(parsed);
      }
    }
    setDraft(null);
  }

  return (
    <input
      type="text"
      value={draft ?? format(value)}
      onFocus={(event) => {
        setFocused(true);
        setDraft(format(value));
        event.target.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
          // Enter's own blur() call below would otherwise re-trigger onBlur's
          // commit() a second time (redundant, not wrong, but avoided anyway).
          cancelledRef.current = true;
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          cancelledRef.current = true;
          event.currentTarget.blur();
        }
      }}
      style={{ backgroundColor: "transparent" }}
      className={className(focused)}
    />
  );
}

function EditableNumberValue({ value, min, max, step, onCommit, className = DEFAULT_EDITABLE_VALUE_CLASSNAME }: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
  className?: (focused: boolean) => string;
}) {
  return (
    <EditableValue
      value={value}
      format={(v) => formatSliderValue(v, step)}
      parse={(raw) => {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : null;
      }}
      onCommit={onCommit}
      className={className}
    />
  );
}

// Hex swatch input (ColorRow below) - same editable-pill behavior as
// EditableNumberValue, but parses/validates a "#rrggbb" string instead of a
// clamped number. An invalid hex on commit (Enter/blur) is simply rejected -
// the draft reverts to the last valid stored value, same "bad input just
// doesn't stick" behavior EditableValue already gives EditableNumberValue.
function HexColorInput({ value, onCommit, className = HEX_INPUT_CLASSNAME }: {
  value: string;
  onCommit: (value: string) => void;
  className?: (focused: boolean) => string;
}) {
  return (
    <EditableValue
      value={value}
      format={(v) => v}
      parse={parseHex}
      onCommit={onCommit}
      className={className}
    />
  );
}

function NumberFieldList({ fields, config, setConfig }: {
  fields: NumberField[];
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
}) {
  return (
    <>
      {fields.map(({ label, key, min, max, step }) => (
        <label key={key} className="flex flex-row items-center justify-end gap-[17px]">
          <span className="flex justify-between mr-auto">
            <span className="font-sans mr-auto text-mobile-header-h2 text-text-black">{label}</span>
          </span>
          <RangeSlider
            min={min}
            max={max}
            step={step}
            value={config[key]}
            onChange={(value) => setConfig({ [key]: value })}
          />
          <EditableNumberValue
            min={min}
            max={max}
            step={step}
            value={config[key]}
            onCommit={(value) => setConfig({ [key]: value })}
          />
        </label>
      ))}
    </>
  );
}

// Orbit icon (copy-paste/paste.txt) - reused for both the Azimuth and Polar
// inputs in the Orbit row below, no per-axis variant.
function OrbitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.129 9.13804L12.6717 10.378L11.4317 12.9207M10.9811 5.01861C10.7029 3.9058 10.2745 2.97089 9.74449 2.31963C9.21443 1.66838 8.60383 1.32678 7.98176 1.33347C7.35968 1.34016 6.75096 1.69487 6.22443 2.35748C5.69791 3.02009 5.27461 3.96416 5.0024 5.0829C4.73019 6.20164 4.61995 7.4504 4.68414 8.68792C4.74833 9.92545 4.98439 11.1024 5.36561 12.0855C5.74684 13.0687 6.25802 13.8189 6.84134 14.2512C7.42466 14.6836 8.05683 14.7808 8.66634 14.532M14.5316 7.33337C14.2353 6.60737 13.4635 5.95143 12.3383 5.4692C11.2132 4.98698 9.7987 4.70595 8.31843 4.67052C6.83817 4.63509 5.37649 4.84728 4.16434 5.27357C2.95218 5.69985 2.05865 6.31593 1.62492 7.02446C1.1912 7.733 1.24199 8.49359 1.76929 9.18608C2.29659 9.87857 3.27033 10.4635 4.53666 10.8484C5.80299 11.2333 7.28972 11.3962 8.76196 11.3115C10.2342 11.2268 11.608 10.8992 12.6663 10.3805"
        stroke="#858179"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A plain X/Y/Z letter marker - Position/Rotation's equivalent of OrbitIcon
// above, derived from the field's own key suffix (positionX -> "X") rather
// than separate per-axis metadata, since every position/rotation key already
// ends in its axis letter.
function AxisLabel({ field }: { field: NumberField }) {
  return (
    <span className="font-sans text-mobile-text-sm text-text-black">
      {field.key.slice(-1).toUpperCase()}
    </span>
  );
}

// Same pill styling as SegmentedRow's option buttons below (border-border-border,
// rounded-[4px], px-2/py-1, text-mobile-text-md-regular) - but unlike
// SegmentedRow's isActive state (border + background + text all change),
// only the text color changes here, on focus rather than a toggled
// selection, since this is a real editable value input, not a discrete
// option picker - border/background stay put regardless of focus. Orbit's
// pills (2 per row) get a 73.5px max-width with a 61px floor; Position/
// Rotation's (3 per row, narrower to fit) get 46.33px with no floor - both
// per explicit design spec, not derived from one another.
const ORBIT_INPUT_CLASSNAME = (focused: boolean) =>
  `flex min-w-[61px] max-w-[73.5px] size-fit items-center justify-center rounded-[4px] border border-border-border px-2 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

const AXIS_INPUT_CLASSNAME = (focused: boolean) =>
  `flex max-w-[46.33px] size-fit items-center justify-center rounded-[4px] border border-border-border px-2 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

// Shared row shape for Orbit/Position/Rotation (Camera tab): a label, then
// one gap-[8px] row holding a gap-[8px] marker+input group per field -
// distinct from every other NumberFieldList row in this panel. `renderMarker`
// is the only thing that differs between them (OrbitIcon vs an AxisLabel
// letter), so it's a prop rather than three near-identical row components.
function IconInputRow({ label, fields, config, setConfig, renderMarker, inputClassName }: {
  label: string;
  fields: NumberField[];
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
  renderMarker: (field: NumberField) => ReactNode;
  inputClassName: (focused: boolean) => string;
}) {
  return (
    <div className="flex w-full items-center justify-end gap-[8px]">
      <p className="font-sans mr-auto text-mobile-header-h2 text-text-black">{label}</p>
      <div className="flex items-center gap-[8px]">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-[8px]">
            {renderMarker(field)}
            <EditableNumberValue
              min={field.min}
              max={field.max}
              step={field.step}
              value={config[field.key]}
              onCommit={(value) => setConfig({ [field.key]: value })}
              className={inputClassName}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Same row layout/pill styling as Type's segmented control (label pushed
// left via mr-auto, options pushed right, min-w-[61px] pills, bg-accent-50
// tint on the active pill) - reused here so Grain/Environment/Env preset/
// Range don't each reimplement it.
function SegmentedRow<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex w-full justify-end items-center gap-[8px]">
      <p className="font-sans mr-auto text-mobile-header-h2 text-text-black">{label}</p>
      {options.map(({ label: optionLabel, value: optionValue }) => {
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`flex py-1 min-w-[61px] size-fit items-center justify-center rounded-[4px] border px-2 font-sans text-mobile-text-md-regular ${
              isActive
                ? "border-accent-500 text-accent-500 bg-accent-50"
                : "border-border-border text-text-secondary"
            }`}
          >
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}

// A small pill+tail popover, built to a real Figma Dev Mode reference
// (copy-paste/paste.txt) rather than hand-approximated - see the "Gradient
// token fidelity lesson" in CLAUDE.md for why verbatim measurements are the
// standing practice here. The reference bakes its text as vector paths (a
// normal Figma export artifact) and its "tail" as a half-circle - `text` is
// rendered as real DOM text instead (so this can hold any string, not just
// the one baked into that export) and the tail is reproduced as a small
// circle overlapping the bubble's own edge (same fill, so the visible half
// reads as a bump) rather than hand-drawing the half-circle path. `side`
// picks which edge the bubble opens toward - `"left"` puts the bubble to the
// trigger's left with the tail pointing right at it (the remove icon, which
// sits at a row's own right edge, needs this direction so the bubble doesn't
// run off the panel); `"right"` mirrors it for triggers nearer the left of
// their row (the percent input's lock hint).
//
// max-w-[140px] + normal wrapping (not whitespace-nowrap) is load-bearing,
// not cosmetic: a real bug found by testing this in the sandbox - the lock
// hint's text is a full sentence, and `whitespace-nowrap` forced it onto one
// ~800px-wide line. That line is `invisible`, but `position: absolute` boxes
// still count toward their nearest scrolling ancestor's scrollWidth even
// when invisible, which blew the whole Colors tab's content out to ~1000px
// and forced the entire tab (including the gradient bar, `w-full` against
// that now-oversized container) into a horizontal scroll - reported as "the
// color bar doesn't show" and "the inputs' max-width came out wrong", since
// both were really just scrolled/stretched out of view. Wrapping onto
// several short lines within a fixed cap keeps the bubble's real box small
// enough that this doesn't happen. 140px (not the first fix's 180px) is a
// second, smaller correction - measured again in the sandbox: the percent
// input's own trigger sits close to the Colors tab's left edge, leaving only
// ~150px of real room before the bubble (opening rightward) exceeds the
// scrolling container's own clientWidth - 180px still overflowed that by a
// measured 6px, invisibly clipping the bubble on hover once overflow-x-hidden
// (ControlPanel's own scrolling region) was added as a separate safety net.
function Tooltip({ text, side, children }: { text: string; side: "left" | "right"; children: ReactNode }) {
  const isLeft = side === "left";
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        className={`pointer-events-none invisible absolute top-1/2 z-20 flex max-w-[140px] -translate-y-1/2 items-center rounded-[4px] bg-background-dark/80 py-[6px] px-[10px] font-sans text-mobile-text-sm-regular text-text-white group-hover:visible ${
          isLeft ? "right-full mr-2" : "left-full ml-2"
        }`}
      >
        {text}
        <span
          className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-background-dark/80 ${
            isLeft ? "-right-1" : "-left-1"
          }`}
        />
      </div>
    </div>
  );
}

// The gradient preview bar above the color rows: a 6px-tall strip painted
// with the currently *effective* colors (getEffectiveGradientColors - so a
// colorCount==="2" gradient shows a real 2-color bar, not a 3-stop one with
// a hidden third stop), plus one 12x12 ring marker per active color -
// background-white fill, a 1.5px stroke in that marker's own color - evenly
// spaced along the bar (0%/100% for two, 0%/50%/100% for three).
function GradientColorsBar({ config }: { config: GradientConfig }) {
  const effective = getEffectiveGradientColors(config);
  const colors = config.colorCount === "3"
    ? [effective.color1, effective.color2, effective.color3]
    : [effective.color1, effective.color2];

  return (
    <div
      className="relative mb-[2px] h-[6px] w-full rounded-[4px]"
      style={{ background: `linear-gradient(90deg, ${colors.join(", ")})` }}
    >
      {colors.map((color, index) => {
        // A marker's *center* sits at this %, but the marker itself is 12px
        // wide (h-3 w-3) and centered via -translate-x-1/2, so a plain 0%/
        // 100% at the extremes lets its outer edge hang 6px (half its own
        // width) past the bar's own edge - a real, measured bug (confirmed
        // in the sandbox: scrollWidth 6px > clientWidth on both the bar and
        // its scrolling ancestor). Insetting the travel range by half the
        // marker's width (6px) on each side keeps the center's 0%/100%
        // extremes exactly at the marker's own outer edge instead, so it
        // never crosses the bar's bounds.
        const percent = (index / (colors.length - 1)) * 100;
        return (
          <div
            key={index}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background-white"
            style={{
              left: `calc(6px + (100% - 12px) * ${percent / 100})`,
              borderWidth: 1.5,
              borderStyle: "solid",
              borderColor: color,
            }}
          />
        );
      })}
    </div>
  );
}

// Same pill styling as Orbit/Axis's inputs (border-border-border, rounded-[4px],
// text-color-only focus state) - the percentage input just gets a narrower
// 48px cap, the hex input 64px, per explicit design spec.
const PERCENT_INPUT_CLASSNAME = (focused: boolean) =>
  `flex max-w-[48px] size-fit items-center justify-center rounded-[4px] border border-border-border px-2 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

// px-1 (not px-2 like every other pill input in this file) - a real bug
// found by testing in the sandbox: a 7-char "#rrggbb" value needs ~65px of
// text width on its own, so px-2's 16px of combined padding left this input
// clipping the last character at the requested 64px max-width. px-1 frees up
// the extra room while keeping the 64px cap intact.
const HEX_INPUT_CLASSNAME = (focused: boolean) =>
  `flex max-w-[64px] size-fit items-center justify-center rounded-[4px] border border-border-border px-1 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

// DashboardHeader/DashboardNav aren't fixed-height in code (header has a
// max-h-[48px] cap, but nav's height is whatever its own padding+icon+label
// content computes to - no explicit height class to read off) - measuring
// both for real via getBoundingClientRect, instead of hardcoding a guessed
// nav height, is what makes FullViewModal's fixed positioning below actually
// robust: it stays correct even if nav's own content/spacing changes later,
// rather than silently drifting out of sync with a hardcoded number. Falls
// back to {top:48, bottom:0} when the ids aren't found at all (e.g. testing
// ControlPanel in isolation in the sandbox's Components list, outside a real
// DashboardScreen) - a reasonable default for that context rather than a
// crash.
function useChromeInsets() {
  const [insets, setInsets] = useState({ top: 48, bottom: 0 });

  useEffect(() => {
    const header = document.getElementById("dashboard-header");
    const nav = document.getElementById("dashboard-nav");
    setInsets({
      top: header ? header.getBoundingClientRect().height : 48,
      bottom: nav ? nav.getBoundingClientRect().height : 0,
    });
  }, []);

  return insets;
}

// A modal that fills the app's whole working area - everything between
// DashboardHeader and DashboardNav - without covering either, per explicit
// direction. `fixed` (not a React portal) matches this app's one existing
// modal (Modal.tsx, `fixed inset-0`) - there's no real benefit to a portal
// here, since the whole app is one small fixed-size panel/iframe, not a
// real page with distant DOM nodes to escape. Unlike Modal.tsx's `inset-0`
// though, this one insets `top`/`bottom` to useChromeInsets()'s measured
// values instead of covering the full panel.
function FullViewModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { top, bottom } = useChromeInsets();

  return (
    <div className="fixed left-0 right-0 z-40 flex flex-col bg-background-white" style={{ top, bottom }}>
      <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-border px-[20px] py-[12px]">
        <span className="font-display text-mobile-header-h1 text-text-black">{title}</span>
        <button type="button" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

type ColorFormat = "hex" | "rgb" | "hsl";

const FORMAT_OPTIONS: Array<{ label: string; value: ColorFormat }> = [
  { label: "Hex", value: "hex" },
  { label: "RGB", value: "rgb" },
  { label: "HSL", value: "hsl" },
];

// Wider than the row's own HEX_INPUT_CLASSNAME (which is sized tight for a
// 7-char "#rrggbb" only) - this one lives in the spacious modal and needs to
// fit "rgb(255, 255, 255)"-length strings too, so it's w-full instead of a
// small max-width pill.
const COLOR_VALUE_INPUT_CLASSNAME = (focused: boolean) =>
  `w-full rounded-[4px] border border-border-border px-2 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

// The modal's format-aware value input (ColorSwatchPicker below) - same
// EditableValue machinery as every other editable field in this file, just
// with format/parse swapped per the selected ColorFormat. The stored value
// is always hex underneath (gradient-core's schema only knows color1-3 as
// hex strings), so switching format never changes what's actually saved -
// only how it's displayed/typed here.
function ColorValueInput({ format, value, onChange }: {
  format: ColorFormat;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <EditableValue
      value={value}
      format={(hex) => {
        if (format === "rgb") return hexToRgbString(hex);
        if (format === "hsl") return hexToHslString(hex);
        return hex;
      }}
      parse={(raw) => {
        if (format === "rgb") return parseRgbString(raw);
        if (format === "hsl") return parseHslString(raw);
        return parseHex(raw);
      }}
      onCommit={onChange}
      className={COLOR_VALUE_INPUT_CLASSNAME}
    />
  );
}

// Swatch button (ColorRow below) - opens ColorPicker.tsx's saturation
// square + vertical hue bar inside a FullViewModal rather than a small
// anchored popover (an earlier version used react-colorful in a small
// popover; replaced per explicit direction - both to occupy the whole
// working view, and because a real vertical hue bar isn't achievable with
// react-colorful at all, see ColorPicker.tsx's own comment). The modal also
// gets its own Hex/RGB/HSL format toggle + value input, above the picker -
// separate from the row's own always-hex HexColorInput next to the swatch
// (that one stays hex-only; the row's compact 64px max-width has no room for
// an "rgb(255, 255, 255)"-length string anyway).
function ColorSwatchPicker({ value, onChange, label }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>("hex");

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="h-6 w-16 shrink-0 rounded-[4px]"
        style={{ background: value }}
      />
      {open && (
        <FullViewModal title="Color" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 p-5">
            <SegmentedRow label="Format" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
            <ColorValueInput format={format} value={value} onChange={onChange} />
            <ColorPicker value={value} onChange={onChange} />
          </div>
        </FullViewModal>
      )}
    </>
  );
}

// One color's row (Colors tab): a 64x24 swatch, then a percent input (locked
// - see its Tooltip below) + hex input, then a remove icon on the row's own
// right edge. Only color3 is ever actually removable - ShaderGradient's
// shader has exactly 3 hardcoded color uniforms (see colorCount's own
// comment in gradient-core/schema.ts), so "removing" color1 or color2 isn't
// something the schema can express at all, not just a UI restriction. Their
// rows show the same remove icon permanently disabled, with a tooltip
// explaining why, rather than hiding it and leaving the row looking
// unfinished.
function ColorRow({ field, config, setConfig }: {
  field: { label: string; key: "color1" | "color2" | "color3" };
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
}) {
  const { key } = field;
  const percentKey = `${key}Percent` as `${typeof key}Percent`;
  const removable = key === "color3";

  return (
    <div className="flex items-center justify-between gap-[14px] border-b border-border-border pb-2">
      <ColorSwatchPicker
        value={config[key]}
        onChange={(value) => setConfig({ [key]: value })}
        label={field.label}
      />

      <div className="flex flex-1 items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <Tooltip
            side="right"
            text="Lock: doesn't affect the live gradient yet - @shadergradient/react has no color-weight prop, needs a custom shader (planned, not built)."
          >
            <EditableNumberValue
              min={0}
              max={100}
              step={1}
              value={config[percentKey]}
              onCommit={(value) => setConfig({ [percentKey]: value })}
              className={PERCENT_INPUT_CLASSNAME}
            />
          </Tooltip>

          <HexColorInput value={config[key]} onCommit={(value) => setConfig({ [key]: value })} />
        </div>

        {removable ? (
          <button
            type="button"
            onClick={() => setConfig({ colorCount: "2" })}
            className="text-text-secondary transition-colors hover:text-text-color-accent"
          >
            <Icon name="remove" />
          </button>
        ) : (
          <Tooltip side="left" text="Only one can be removed">
            <button type="button" disabled className="cursor-not-allowed text-text-secondary opacity-40">
              <Icon name="remove" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// Rough, unstyled-per-field prototype (raw color/range inputs) - only the tab
// bar and the segmented rows are built to the real Figma/@shadergradient/react
// reference spec, individual sliders stay functional placeholders (see
// CLAUDE.md "Dashboard: header, nav, and the Editor tab").
//
// Tab grouping, cross-checked against @shadergradient/react's own reference
// Framer controls (its "Shape"/"Colors"/"Effects" activeTab groups) but
// mapped onto this app's four tabs per explicit user direction rather than
// copied 1:1 - Shape/Colors/Motion/Camera, not Shape/Colors/Effects/View.
// There used to be a separate Type tab - removed per a later redistribution,
// `type` now lives at the top of Shape instead:
// - Shape: `type` (Plane/Sphere/Liquid) first, then the noise-pattern fields
//   (Strength/Density/Pixel density/Frequency).
// - Colors: a single "Colors" label, a GradientColorsBar preview strip, then
//   one ColorRow per color (color3's row hidden when colorCount is "2" - see
//   ColorRow's own comment for why only color3 is ever actually removable),
//   followed by Grain, Brightness, and the Environment toggle (`lightType`) -
//   when Environment is on (`lightType === "env"`), Env preset + Reflection
//   replace Brightness, matching @shadergradient/react's own reference
//   controls' hidden-field logic exactly (brightness hidden when
//   lightType==="env", envPreset/reflection hidden when lightType==="3d").
//   There used to be a "2/3" segmented toggle here (COLOR_COUNT_OPTIONS) -
//   replaced by ColorRow's own remove icon, which drives the same
//   `colorCount` field.
// - Motion: Speed, plus Range (bounds the animation's time loop to
//   [rangeStart, rangeEnd] instead of running unbounded) and its two bounds,
//   shown only when Range is enabled.
// - Camera: Camera distance (its own tab now, split out of Shape), plus
//   camera angle (Azimuth/Polar), object position (X/Y/Z), object rotation
//   (X/Y/Z), and field of view - mirroring @shadergradient/react's own
//   reference "View" tab grouping (cameraAngle/position/rotation/canvas.fov),
//   added to this app's Camera tab specifically.
export function ControlPanel() {
  const config = useGradientStore((state) => state.config);
  const setConfig = useGradientStore((state) => state.setConfig);
  const [activeTab, setActiveTab] = useState<ControlTab>("shape");

  return (
    // h-full min-h-0 so this fills EditorTab's flex-1 middle region exactly
    // (not more, not less) - required for the fields list below to be able
    // to overflow-y-auto against a real bounded height instead of just
    // growing the whole panel.
    <div className="flex h-full min-h-0 w-full flex-col text-sm">
      {/* shrink-0: the tab bar itself never scrolls, only the fields below
          it do - see the "only the controls container scrolls" direction
          on EditorTab.tsx above this component. */}
      <div className="flex shrink-0 bg-background-white-2 border-b border-border-border gap-[8px] px-[20px] pt-[12px]">
        {TABS.map(({ tab, label }) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b pb-[8px] pt-[4px] font-display text-mobile-header-h1 ${
                isActive
                  ? "border-b-accent-500 text-text-black"
                  : "border-b-transparent text-text-secondary"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* The only scrolling region in the Editor tab - flex-1 min-h-0 to
          actually claim/be bounded by the remaining height, overflow-y-auto
          so a tab's full field list (e.g. Shape) scrolls internally instead
          of pushing the tab bar or Apply button off screen. overflow-x-hidden
          (not a blanket overflow-hidden on the outer panel, which would risk
          clipping this div's own legitimate vertical overflow - see the
          "h-full vs h-screen" caution already documented for this panel) is
          a narrow safety net against any stray horizontal overflow, on top
          of fixing GradientColorsBar's actual marker-overhang bug at its
          source (see that component's own comment). */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden px-5 py-3">
        {activeTab === "shape" && (
          <>
            <SegmentedRow
              label="Type"
              options={TYPE_OPTIONS}
              value={config.type}
              onChange={(value) => setConfig({ type: value })}
            />
            <NumberFieldList fields={SHAPE_NUMBER_FIELDS} config={config} setConfig={setConfig} />
          </>
        )}

        {activeTab === "colors" && (
          <>
            <div className="flex w-full items-center justify-between">
              <p className="font-sans text-mobile-header-h2 text-text-black">Colors</p>
              {config.colorCount === "2" && (
                <button
                  type="button"
                  onClick={() => setConfig({ colorCount: "3" })}
                  className="flex items-center gap-1 rounded-[4px] border border-border-border px-2 py-1"
                >
                  <Icon name="add" />
                  <span className="font-sans text-mobile-text-md-regular text-text-black">Add color</span>
                </button>
              )}
            </div>

            <GradientColorsBar config={config} />

            <div className="flex flex-col gap-[16px]">
              {COLOR_FIELDS.filter(({ key }) => key !== "color3" || config.colorCount === "3").map((field) => (
                <ColorRow key={field.key} field={field} config={config} setConfig={setConfig} />
              ))}
            </div>

            <SegmentedRow
              label="Noise"
              options={GRAIN_OPTIONS}
              value={config.grain}
              onChange={(value) => setConfig({ grain: value })}
            />

            <SegmentedRow
              label="Lighting"
              options={LIGHT_TYPE_OPTIONS}
              value={config.lightType}
              onChange={(value) => setConfig({ lightType: value })}
            />

            {config.lightType === "env" ? (
              <>
                <SegmentedRow
                  label="Env preset"
                  options={ENV_PRESET_OPTIONS}
                  value={config.envPreset}
                  onChange={(value) => setConfig({ envPreset: value })}
                />
                <NumberFieldList
                  fields={[{ label: "Reflection", key: "reflection", min: 0, max: 1, step: 0.1 }]}
                  config={config}
                  setConfig={setConfig}
                />
              </>
            ) : (
              <NumberFieldList
                fields={[{ label: "Brightness", key: "brightness", min: 0, max: 3, step: 0.1 }]}
                config={config}
                setConfig={setConfig}
              />
            )}
          </>
        )}

        {activeTab === "motion" && (
          <>
            <NumberFieldList fields={MOTION_NUMBER_FIELDS} config={config} setConfig={setConfig} />
            <SegmentedRow
              label="Range"
              options={RANGE_OPTIONS}
              value={config.range}
              onChange={(value) => setConfig({ range: value })}
            />
            {config.range === "enabled" && (
              <NumberFieldList fields={RANGE_NUMBER_FIELDS} config={config} setConfig={setConfig} />
            )}
          </>
        )}

        {activeTab === "camera" && (
          <>
            <IconInputRow
              label="Orbit"
              fields={CAMERA_ANGLE_FIELDS}
              config={config}
              setConfig={setConfig}
              renderMarker={() => <OrbitIcon />}
              inputClassName={ORBIT_INPUT_CLASSNAME}
            />
            <NumberFieldList fields={CAMERA_NUMBER_FIELDS} config={config} setConfig={setConfig} />
            <NumberFieldList fields={FOV_NUMBER_FIELDS} config={config} setConfig={setConfig} />
            <IconInputRow
              label="Position"
              fields={POSITION_NUMBER_FIELDS}
              config={config}
              setConfig={setConfig}
              renderMarker={(field) => <AxisLabel field={field} />}
              inputClassName={AXIS_INPUT_CLASSNAME}
            />
            <IconInputRow
              label="Rotation"
              fields={ROTATION_NUMBER_FIELDS}
              config={config}
              setConfig={setConfig}
              renderMarker={(field) => <AxisLabel field={field} />}
              inputClassName={AXIS_INPUT_CLASSNAME}
            />
          </>
        )}
      </div>
    </div>
  );
}
