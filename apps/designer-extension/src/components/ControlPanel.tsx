import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { GradientConfig } from "@fluxa/gradient-core";
import { useGradientStore } from "../store/gradientStore";
import { formatSliderValue } from "../helpers/format";
import { RangeSlider } from "./RangeSlider";
import { Icon } from "./Icon";
import {
  ColorPicker,
  clamp,
  hexToHslString,
  hexToRgbString,
  parseHex,
  parseHslString,
  parseRgbString,
} from "./ColorPicker";

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

// A real @shadergradient/react prop that had no UI control at all until now
// (found while auditing the schema for fields with zero UI exposure) - type
// + shader together select which of the library's compiled GLSL shader
// variants actually runs (see ColorRow's own comment above on why color
// blending can't be reached by schema fields alone). Trying it per explicit
// user direction ("si no me gusta lo eliminamos") - not a confirmed keeper
// yet. Options match gradient-core's shaderTypeSchema exactly - the four
// real variant names verified against the installed package's own compiled
// export list (dist/shaders/index.mjs), not the single invalid value this
// schema field originally shipped with (see that schema's own comment for
// the crash it caused).
const SHADER_OPTIONS: Array<{ label: string; value: GradientConfig["shader"] }> = [
  { label: "Default", value: "defaults" },
  { label: "Cosmic", value: "cosmic" },
  { label: "Glass", value: "glass" },
  { label: "Position mix", value: "positionMix" },
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

// Every row shape in this panel (NumberFieldList/IconInputRow/SegmentedRow)
// pushes its own left-hand label out via mr-auto, then packs its
// buttons/pills/value-readout into one right-hand group - this caps that
// group's combined width at 203px across every one of them, so a row's
// right-hand content lines up to the same width no matter which tab or row
// shape it's in, without touching any left-hand label. Not an arbitrary
// number: it's exactly RangeSlider's own 161px TRACK_MAX_WIDTH + a 17px gap
// + a 25px value readout (NumberFieldList's own row), which the other row
// shapes' own per-pill max-widths were already independently tuned to land
// on too.
const ROW_CONTROLS_MAX_WIDTH = "max-w-[203px]";

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
          {/* Everything right of the label - slider + its value readout,
              combined - is capped at ROW_CONTROLS_MAX_WIDTH (203px), the same
              cap IconInputRow/SegmentedRow's own right-side groups share
              below, so every tab's rows line up to the same right-hand
              width regardless of row shape. */}
          <div className={`flex w-full items-center gap-[17px] ${ROW_CONTROLS_MAX_WIDTH}`}>
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
          </div>
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
      <div className={`flex w-full items-center gap-[8px] ${ROW_CONTROLS_MAX_WIDTH}`}>
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
function SegmentedRow<T extends string>({ label, options, value, onChange, className = "" }: {
  label?: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className="flex w-full justify-end items-center gap-[8px]">
      {label && <p className="font-sans mr-auto text-mobile-header-h2 text-text-black">{label}</p>}
      <div className={`flex w-full items-center justify-end gap-[8px] ${className || ROW_CONTROLS_MAX_WIDTH}`}>
        {options.map(({ label: optionLabel, value: optionValue }) => {
          const isActive = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`flex py-1 w-full size-fit items-center justify-center rounded-[4px] border px-2 font-sans text-mobile-text-md-regular ${
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

// px-1 (not px-2 like every other pill input in this file) - a real bug
// found by testing in the sandbox: a 7-char "#rrggbb" value needs ~65px of
// text width on its own, so px-2's 16px of combined padding left this input
// clipping the last character at the requested 64px max-width. px-1 frees up
// the extra room while keeping the 64px cap intact.
const HEX_INPUT_CLASSNAME = (focused: boolean) =>
  `flex max-w-[64px] size-fit items-center justify-center rounded-[4px] border border-border-border px-1 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-black"
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
//
// animate-modal-slide-up/animate-modal-slide-down (tailwind.config.js) fade +
// slide the whole modal between 24px below its final position and there -
// plain CSS @keyframes (same pattern as WelcomeScreen's animate-fill-bar).
// ColorSwatchPicker's `open` state still fully mounts/unmounts this
// component, but the *close* button here doesn't call the real `onClose`
// (which would unmount instantly, cutting the animation off) - it flips a
// local `closing` flag to swap in the reverse animation first, then delays
// the real `onClose` by MODAL_ANIMATION_MS so the exit actually gets to play
// before the component disappears. That constant has to stay in sync with
// the animate-modal-slide-down duration in tailwind.config.js - there's no
// single source of truth linking a Tailwind animation's CSS duration to a JS
// timer, so both were set to the same 320ms deliberately and must be changed
// together.
const MODAL_ANIMATION_MS = 540;

function FullViewModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { top, bottom } = useChromeInsets();
  const [closing, setClosing] = useState(false);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, MODAL_ANIMATION_MS);
  }

  return (
    // The outer div is a fixed-size clipping mask (exactly the
    // header-to-nav rect, overflow-hidden) - the inner div is what actually
    // carries the slide animation. Without this split, translateY(100%)
    // (a % transform is relative to the element's own height) moves the
    // *whole* header-to-nav box down by its own full height - since that box
    // already ends flush with the nav's top edge, sliding it down by its own
    // height lands its new top edge exactly at the nav's top edge too,
    // rendering the modal on top of the nav for most of the animation
    // instead of hidden below it. Clipping the outer box to that same rect
    // means anything the inner div slides past that boundary just gets cut
    // off there, so the modal appears to rise from behind/under the nav and
    // sink back below it, never actually covering it.
    <div className="fixed left-0 right-0 z-40 overflow-hidden" style={{ top, bottom }}>
      <div
        className={`flex h-full w-full flex-col bg-background-white ${
          closing ? "animate-modal-slide-down" : "animate-modal-slide-up"
        }`}
      >
        <div className="flex h-[48px] bg-background-white-2 shrink-0 items-center justify-between border-b border-border-border px-[20px] py-[12px]">
          <span className="font-display text-mobile-display-d1 text-text-black">{title}</span>
          <button type="button" onClick={handleClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

type ColorFormat = "hex" | "rgb" | "hsl";

const FORMAT_OPTIONS: Array<{ label: string; value: ColorFormat }> = [
  { label: "Hex", value: "hex" },
  { label: "RGB", value: "rgb" },
  { label: "HSL", value: "hsl" },
];

// Lives in the spacious modal, below ColorPicker, and needs to fit
// "rgb(255, 255, 255)"-length strings too, so it's w-full/flex-1 rather than
// a small max-width pill like the row's own HEX_INPUT_CLASSNAME. Border
// itself lives on the wrapper (see ColorValueField below), not here - pr-8
// reserves room so typed text never runs under the copy icon sitting inside
// the input's own right edge.
const COLOR_VALUE_INPUT_CLASSNAME = (focused: boolean) =>
  `w-full min-w-0 pl-2 pr-8 py-1 text-left font-sans text-mobile-text-md-medium appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-black"
  }`;

const FORMAT_LABEL: Record<ColorFormat, string> = { hex: "Hex", rgb: "RGB", hsl: "HSL" };

function formatColorValue(format: ColorFormat, hex: string): string {
  if (format === "rgb") return hexToRgbString(hex);
  if (format === "hsl") return hexToHslString(hex);
  return hex;
}

// The modal's format-aware value field (ColorSwatchPicker below) - a label
// naming the current format ("Hex"/"RGB"/"HSL") above an EditableValue input
// (same machinery as every other editable field in this file, with
// format/parse swapped per the selected ColorFormat), with a copy button
// sitting inside the input's own bordered box (same relative-wrapper +
// absolutely-positioned-icon pattern AuthPasswordField.tsx already uses for
// its show/hide toggle) rather than beside it. rounded-4/border are the
// wrapper's own (a real border-radius token, 4px - not Tailwind's built-in
// border-4 border-*width* utility, which would make the border itself 4px),
// so the input can stay a plain flex-1 text field with no border/radius of
// its own. The stored value is always hex underneath (gradient-core's
// schema only knows color1-3 as hex strings), so switching format never
// changes what's actually saved - only how it's displayed/typed/copied here.
function ColorValueField({ format, value, onChange }: {
  format: ColorFormat;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-sans text-mobile-text-md-medium text-text-black">{FORMAT_LABEL[format]}</span>
      <div className="relative flex items-center rounded-4 border border-border-border">
        <EditableValue
          value={value}
          format={(hex) => formatColorValue(format, hex)}
          parse={(raw) => {
            if (format === "rgb") return parseRgbString(raw);
            if (format === "hsl") return parseHslString(raw);
            return parseHex(raw);
          }}
          onCommit={onChange}
          className={COLOR_VALUE_INPUT_CLASSNAME}
        />
        <div className="absolute right-2 flex">
          <Tooltip side="left" text="Copy">
            <button
              type="button"
              aria-label="Copy color code"
              onClick={() => {
                navigator.clipboard.writeText(formatColorValue(format, value)).catch(() => {});
              }}
              className="shrink-0 text-text-secondary transition-transform duration-150 ease-out hover:scale-110 hover:text-text-color-accent active:scale-90"
            >
              <Icon name="copy" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// Same pill styling as HEX_INPUT_CLASSNAME (the row's own hex input) - only
// the padding (px-2 here, not px-1 - a percent value never runs as tight on
// space as a 7-char "#rrggbb") and the resting text color (text-secondary,
// not text-black) differ, per explicit design spec.
const OPACITY_INPUT_CLASSNAME = (focused: boolean) =>
  `flex max-w-[64px] size-fit items-center justify-center rounded-[4px] border border-border-border px-2 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

const OPACITY_THUMB_SIZE = 12;

// Same bleed-fix pattern as every other thumb in this file (ColorPicker.tsx's
// insetPercent, GradientColorsBar's old markers) - insets the 0%/100%
// extremes by half the thumb's own size so its center lands exactly on the
// track's outer edge instead of hanging half its own width past it.
function insetOpacityPercent(fraction: number): string {
  return `calc(${OPACITY_THUMB_SIZE / 2}px + (100% - ${OPACITY_THUMB_SIZE}px) * ${fraction})`;
}

// Decorative triangle tiling behind the alpha gradient below (paste.txt's
// own pasted svg was actually still the hue thumb's line-and-circles asset,
// not a new pattern one, so this is a hand-built approximation, not a copied
// Figma asset like everything else in this file - re-paste the real one if
// this doesn't match). Two triangles per 16x6 tile, base-to-base at each
// tile edge with their apexes meeting at the tile's own horizontal center -
// a bowtie, fully contained within the bar's own 6px height rather than a
// shape clipped in from outside the viewBox (a diamond was tried first) -
// repeated via background-repeat: repeat-x rather than drawn once and
// stretched.
const TRIANGLE_PATTERN_URL = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="6" viewBox="0 0 16 6"><polygon points="0,0 0,6 8,3" fill="#D9D3C6"/><polygon points="16,0 16,6 8,3" fill="#D9D3C6"/></svg>',
)}")`;

// The slider's own thumb - a real Figma Dev Mode SVG (copy-paste'd, see
// paste.txt), not a plain flat-color circle: the stroke itself is the brand
// 5-stop gradient (same stops as RangeSlider.tsx's ACTIVE_FILL_GRADIENT/the
// gradient-gradient design token), not a solid color, so it has to stay real
// SVG rather than a div with a border color. useId() namespaces the
// <linearGradient>'s id per instance - only one OpacitySlider is ever
// mounted at a time in this app today (one modal open at once), but a
// hardcoded id would silently break the moment that stops being true, since
// SVG gradient ids are global to the document.
function OpacityThumb({ left }: { left: string }) {
  const gradientId = useId();

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ left }}
      className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      <circle cx="6" cy="6" r="5.25" fill="#FBFBFA" stroke={`url(#${gradientId})`} strokeWidth="1.5" />
      <defs>
        <linearGradient
          id={gradientId}
          x1="3.93403"
          y1="12"
          x2="8.06597"
          y2="-4.34155e-08"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6FF5F1" />
          <stop offset="0.2548" stopColor="#3B9CD6" />
          <stop offset="0.5" stopColor="#0955E5" />
          <stop offset="0.75" stopColor="#8E54C5" />
          <stop offset="1" stopColor="#E23F8C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// The always-visible alpha scale for the color currently open in the modal -
// a horizontal 6px bar, not a RangeSlider-style split fill/track, since the
// point is to show what every opacity level from 0-100% looks like at once
// (the same "always render the full range, drag a thumb over it" shape
// ColorPicker.tsx's own hue bar already uses, just horizontal here instead
// of vertical). Two background-image layers: the triangle tiling behind a
// left-to-right transparent -> opaque-`color` gradient - the triangle
// backdrop is what makes "0% opacity" read as "this color, fully
// see-through" rather than just empty space, the same role a checkerboard
// plays behind alpha sliders elsewhere.
function OpacitySlider({ color, value, onChange }: {
  color: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // Same "latest ref" fix as ColorPicker.tsx's onChangeRef - `onChange` is a
  // fresh inline function every render at the call site (ColorRow's
  // `(value) => setConfig({ [opacityKey]: value })`), which used to make the
  // effect below tear down and re-add both window listeners on every single
  // pointermove -> onChange -> store update -> re-render cycle for the whole
  // duration of a drag - a real, measured cause of the lag reported across
  // all three thumbs (this slider's own listener churn added on top of
  // ColorPicker's identical pre-existing one).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const rafRef = useRef<number | null>(null);
  const pendingValueRef = useRef<number | null>(null);

  // Same rAF-coalescing fix as ColorPicker.tsx's scheduleOnChange (see its
  // own comment for the full diagnosis) - onChange cascades into the
  // Zustand store and a full GradientCanvas 3D re-render (even hidden behind
  // this modal - it stays mounted, see EditorTab.tsx), which is too
  // expensive to run on every single native pointermove event without
  // visibly delaying this thumb's own next paint. Only the last value
  // computed within a frame is ever sent onward.
  function scheduleOnChange(nextValue: number) {
    pendingValueRef.current = nextValue;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingValueRef.current !== null) {
          onChangeRef.current(pendingValueRef.current);
          pendingValueRef.current = null;
        }
      });
    }
  }

  // Mounts its window listeners once ([] deps) rather than on every render.
  useEffect(() => {
    function handleMove(event: PointerEvent) {
      if (!draggingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      scheduleOnChange(Math.round(fraction * 100));
    }
    function handleUp() {
      draggingRef.current = false;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={trackRef}
      onPointerDown={(event) => {
        // Suppresses the browser's native drag-select gesture - without
        // this, a fast drag off the track ends the gesture under a
        // "not-allowed" cursor, the same real bug already found and fixed on
        // ColorPicker.tsx's saturation/hue drag handlers.
        event.preventDefault();
        draggingRef.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        const fraction = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        onChange(Math.round(fraction * 100));
      }}
      className="relative h-[6px] flex-1 touch-none select-none cursor-pointer rounded-[4px]"
      style={{
        backgroundImage: `linear-gradient(to right, transparent, ${color}), ${TRIANGLE_PATTERN_URL}`,
        backgroundRepeat: "no-repeat, repeat-x",
        backgroundSize: "auto, 16px 6px",
      }}
    >
      <OpacityThumb left={insetOpacityPercent(value / 100)} />
    </div>
  );
}

// Same overall shape as ColorValueField above (a label, then a row below it)
// but with a 12px gap between them (gap-3) instead of ColorValueField's 4px
// (gap-1), and the row itself holds the slider + a percent input rather than
// one full-width text field - gap-2 (8px) between those two, per spec.
function OpacityField({ color, opacity, onOpacityChange }: {
  color: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-sans text-mobile-text-md-medium text-text-black">Opacity</span>
      <div className="flex items-center gap-2">
        <OpacitySlider color={color} value={opacity} onChange={onOpacityChange} />
        <EditableValue
          value={opacity}
          format={(v) => `${Math.round(v)}%`}
          parse={(raw) => {
            const parsed = Number(raw.replace(/[^0-9.]/g, ""));
            return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : null;
          }}
          onCommit={onOpacityChange}
          className={OPACITY_INPUT_CLASSNAME}
        />
      </div>
    </div>
  );
}

// Real OS/browser-level color sampling (window.EyeDropper), not a DOM-content
// trick - it samples the actual composited screen pixels (per its own spec),
// so it can pick up a color from anywhere the OS renders anything, including
// Webflow's own Designer canvas (a completely different iframe/origin from
// this extension) - CORS/iframe content boundaries don't apply the way they
// would to reading DOM/canvas pixels directly, since this reads the final
// screen buffer instead. Chromium-only as of this writing (Chrome/Edge/
// Opera) - also absent from this repo's installed TypeScript's own
// lib.dom.d.ts, hence the ambient declaration in types/eyedropper.d.ts.
// Feature-detected once at module load (the API's availability can't change
// mid-session) rather than assumed; unsupported browsers get a disabled
// button with a Tooltip explaining why - the same disabled-button-with-
// Tooltip pattern ColorRow's own non-removable color rows already use.
// NOT YET verified inside the real Designer iframe specifically - only
// buildable/typecheckable from here. Webflow's own iframe embedding could
// still block it via a permissions policy this repo doesn't control (it
// wasn't hit by any of the iframe-specific bugs documented elsewhere in this
// codebase, but none of those were tested for this API either) - confirm in
// the actual Designer before trusting this fully, per this file's own
// established practice for anything iframe-specific.
const EYEDROPPER_SUPPORTED = typeof window !== "undefined" && !!window.EyeDropper;

function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
  async function handleClick() {
    if (!window.EyeDropper) return;
    try {
      const result = await new window.EyeDropper().open();
      onPick(result.sRGBHex);
    } catch {
      // AbortError - the user pressed Escape or clicked away to cancel the
      // pick. Not a real failure, nothing to surface.
    }
  }

  const button = (
    <button
      type="button"
      disabled={!EYEDROPPER_SUPPORTED}
      onClick={handleClick}
      aria-label="Pick color from screen"
      className={`flex h-8 w-full justify-center items-center gap-2 rounded-4 border border-border-border py-2 px-2 font-sans text-mobile-text-md-regular ${
        EYEDROPPER_SUPPORTED
          ? "text-text-secondary transition-colors hover:text-text-color-accent"
          : "cursor-not-allowed text-text-secondary opacity-40"
      }`}
    >
      <Icon name="eyedropper" />
      Pick from screen
    </button>
  );

  if (EYEDROPPER_SUPPORTED) return button;
  return (
    <Tooltip side="left" text="Not supported in this browser">
      {button}
    </Tooltip>
  );
}

// Swatch button (ColorRow below) - opens ColorPicker.tsx's saturation
// square + vertical hue bar inside a FullViewModal rather than a small
// anchored popover (an earlier version used react-colorful in a small
// popover; replaced per explicit direction - both to occupy the whole
// working view, and because a real vertical hue bar isn't achievable with
// react-colorful at all, see ColorPicker.tsx's own comment). The modal also
// gets an EyeDropperButton, a Hex/RGB/HSL format toggle above the picker, a
// value field (label + copyable input) below it, and an Opacity field
// (slider + percent input) below that - separate from the row's own
// always-hex HexColorInput next to the swatch (that one stays hex-only; the
// row's compact 64px max-width has no room for an "rgb(255, 255, 255)"-
// length string anyway).
function ColorSwatchPicker({ value, onChange, label, opacity, onOpacityChange }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>("hex");
  const setColorModalOpen = useGradientStore((state) => state.setColorModalOpen);

  // Mirrors this instance's own `open` into the shared store - see
  // colorModalOpen's own comment in gradientStore.ts for why EditorTab.tsx
  // needs to know this at all (it unmounts GradientCanvas while true). Only
  // one ColorSwatchPicker can ever actually be open at once in practice (the
  // modal is `fixed` and covers the other rows too, so there's no way to
  // open a second one from underneath), so a single shared boolean is
  // correct here, not a per-instance concern. The cleanup call guards
  // against this specific instance unmounting while open (e.g. the whole
  // panel swaps away on a selection change) leaving the flag stuck true.
  useEffect(() => {
    setColorModalOpen(open);
    return () => setColorModalOpen(false);
  }, [open, setColorModalOpen]);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="h-6 w-[132px] shrink-0 rounded-[4px]"
        style={{ background: value }}
      />
      {open && (
        <FullViewModal title="Color" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 p-5">
            <SegmentedRow className="w-full" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
            <ColorPicker value={value} onChange={onChange} />
            <ColorValueField format={format} value={value} onChange={onChange} />
            <OpacityField color={value} opacity={opacity} onOpacityChange={onOpacityChange} />
            <EyeDropperButton onPick={onChange} />
          </div>
        </FullViewModal>
      )}
    </>
  );
}

// One color's row (Colors tab): the "Color 1"/"Color 2"/"Color 3" label on
// the left (untouched), then the 64x24 swatch + hex input grouped together
// on the right inside the same ROW_CONTROLS_MAX_WIDTH (203px) cap every
// other row in this panel already uses for its own right-hand group.
function ColorRow({ field, config, setConfig }: {
  field: { label: string; key: "color1" | "color2" | "color3" };
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
}) {
  const { key } = field;
  const opacityKey = `${key}Opacity` as `${typeof key}Opacity`;

  return (
    <div className="flex items-center justify-between gap-[14px] border-b border-border-border pb-2">
      <span className="font-sans text-mobile-header-h2 text-text-black">{field.label}</span>

      <div className={`flex w-full items-center gap-[8px] ${ROW_CONTROLS_MAX_WIDTH}`}>
        <ColorSwatchPicker
          value={config[key]}
          onChange={(value) => setConfig({ [key]: value })}
          label={field.label}
          opacity={config[opacityKey]}
          onOpacityChange={(value) => setConfig({ [opacityKey]: value })}
        />
        <HexColorInput value={config[key]} onCommit={(value) => setConfig({ [key]: value })} />
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
// - Colors: an optional "Add color" button (only when colorCount is "2"),
//   then one ColorRow (swatch + "Color N" label + hex input) per color -
//   color3's row hidden when colorCount is "2" - followed by Grain,
//   Brightness, and the Environment toggle (`lightType`) -
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
          a narrow safety net against any stray horizontal overflow (e.g. a
          wide Tooltip bubble near either edge). */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden px-5 py-3">
        {activeTab === "shape" && (
          <>
            <SegmentedRow
              label="Type"
              options={TYPE_OPTIONS}
              value={config.type}
              onChange={(value) => setConfig({ type: value })}
            />
            <SegmentedRow
              label="Shader"
              options={SHADER_OPTIONS}
              value={config.shader}
              onChange={(value) => setConfig({ shader: value })}
            />
            <NumberFieldList fields={SHAPE_NUMBER_FIELDS} config={config} setConfig={setConfig} />
          </>
        )}

        {activeTab === "colors" && (
          <>
            {config.colorCount === "2" && (
              <div className="flex w-full items-center justify-end">
                <button
                  type="button"
                  onClick={() => setConfig({ colorCount: "3" })}
                  className="flex items-center gap-1 rounded-[4px] border border-border-border px-2 py-1"
                >
                  <Icon name="add" />
                  <span className="font-sans text-mobile-text-md-regular text-text-black">Add color</span>
                </button>
              </div>
            )}

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
