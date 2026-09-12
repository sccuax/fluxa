import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GradientConfig } from "@fluxa/gradient-core";
import { useGradientStore } from "../store/gradientStore";
import { formatSliderValue } from "../helpers/format";
import { RangeSlider } from "./RangeSlider";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { SegmentedRow } from "./SegmentedRow";
import { clamp, parseHex } from "./ColorPicker";
import { ColorSwatchPicker, EditableValue } from "./ColorSwatchPicker";

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

// A real @shadergradient/react prop that had no UI control at all until it
// was added here (found while auditing the schema for fields with zero UI
// exposure) - type + shader together select which of the library's compiled
// GLSL shader variants actually runs (see ColorRow's own comment above on
// why color blending can't be reached by schema fields alone). "Glass" was
// tried too but dropped per explicit direction - only Default/Cosmic/
// Position mix are kept. Options match gradient-core's shaderTypeSchema
// exactly - the real variant names verified against the installed package's
// own compiled export list (dist/shaders/index.mjs), not the single invalid
// value this schema field originally shipped with (see that schema's own
// comment for the crash it caused).
const SHADER_OPTIONS: Array<{ label: string; value: GradientConfig["shader"] }> = [
  { label: "Default", value: "defaults" },
  { label: "Cosmic", value: "cosmic" },
  { label: "mix", value: "positionMix" },
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
  // Shown in an info-icon Tooltip next to the label - NumberFieldList rows
  // only (IconInputRow's own Orbit/Position/Rotation fields don't render
  // one, different row shape, no shared label to hang it off). Optional so
  // those arrays aren't forced to supply a value they'd never use.
  description?: string;
}

// Strength/Density/Pixel density/Frequency shape the noise wave pattern
// itself (a spatial property of the mesh) - all live under Shape, below the
// Type segmented control (Shape no longer has its own tab - see the
// tab-grouping comment on ControlPanel below). Speed is the only temporal
// one, so it stays under Motion; Camera distance now has its own Camera tab.
const SHAPE_NUMBER_FIELDS: NumberField[] = [
  { label: "Distortion", key: "uStrength", min: 0, max: 10, step: 0.1, description: "How strongly the noise pattern displaces the surface." },
  { label: "Detail", key: "uDensity", min: 0, max: 4, step: 0.1, description: "How much fine detail the noise pattern shows." },
  { label: "Quality", key: "pixelDensity", min: 0.5, max: 3, step: 0.1, description: "Render resolution of the canvas." },
  { label: "Frequency", key: "uFrequency", min: 0, max: 10, step: 0.01, description: "How tightly packed the noise pattern's waves are." },
];

const MOTION_NUMBER_FIELDS: NumberField[] = [
  { label: "Speed", key: "uSpeed", min: 0, max: 1, step: 0.01, description: "How fast the gradient animates." },
];

const CAMERA_NUMBER_FIELDS: NumberField[] = [
  { label: "Zoom", key: "cDistance", min: 1, max: 10, step: 0.1, description: "How close the camera sits to the gradient." },
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
  { label: "FOV", key: "fov", min: 10, max: 180, step: 1, description: "The camera's field of view." },
];

const RANGE_NUMBER_FIELDS: NumberField[] = [
  { label: "Range start", key: "rangeStart", min: 0, max: 100, step: 1, description: "Where the animation loop starts." },
  { label: "Range end", key: "rangeEnd", min: 0, max: 100, step: 1, description: "Where the animation loop ends." },
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
// Default look for every NumberFieldList row's value readout. Rest state:
// a plain right-aligned number, transparent 1px border (reserved so the
// active state doesn't reflow). Highlighted state (the row's slider is
// being hovered/dragged, OR this input itself is focused): the number
// turns accent-500 and the 1px border becomes visible (border-border-border).
// 4px horizontal padding is always present. `className` lets a caller (e.g.
// IconInputRow below) swap in a different look driven by the same flag,
// without duplicating the commit/cancel logic above.
// Rest state: a plain centred number, no border, no padding - close to the
// old readout. Highlighted (the row's slider is hovered/dragged, OR this
// input is focused): the number turns accent-500 and gains a 1px
// border-border-border box with 4px side padding. Capped at max-w-[28px]
// in both states per explicit direction (the widest readout, "10.00" on
// uFrequency, can clip slightly in the highlighted state once the
// padding+border eat into that 28px - accepted).
const DEFAULT_EDITABLE_VALUE_CLASSNAME = (highlighted: boolean) =>
  `flex max-w-[32px] shrink-0 appearance-none items-center rounded-[4px] bg-transparent text-center text-mobile-text-md-medium font-sans transition-colors focus:outline-none ${
    highlighted ? "border border-border-border px-[2px] text-accent-500" : "border-0 px-0 text-text-secondary"
  }`;

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

// EditableValue (the generic draft/commit/cancel text input) moved to
// ColorSwatchPicker.tsx when the picker was extracted there - re-imported
// above so EditableNumberValue / HexColorInput below are unchanged.

// `active` = an external highlight trigger (the row's RangeSlider is
// hovered/dragged). It's OR'd with the input's own focus state, so the
// className fn receives a single "highlighted" flag and callers don't have
// to know which of the two caused it.
function EditableNumberValue({ value, min, max, step, onCommit, active = false, className = DEFAULT_EDITABLE_VALUE_CLASSNAME }: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
  active?: boolean;
  className?: (highlighted: boolean) => string;
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
      className={(focused) => className(focused || active)}
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

// One NumberFieldList row. Its own `sliderActive` state is what lets the
// value readout light up (accent-500 + visible border) while the sibling
// RangeSlider is hovered/dragged, not only when the input itself is focused.
//
// A separate info icon next to the label was tried and dropped - it ate
// ~20px (icon + gap) out of a label column that only has ~70-80px to begin
// with (the range+value group on the right is fixed at up to
// ROW_CONTROLS_MAX_WIDTH/203px), so on the longer labels it visibly
// crowded/broke the row. Instead, when `description` is given, the label
// TEXT ITSELF is the Tooltip trigger - same hover-to-explain behavior, zero
// extra width, and it removes the "Frequency has to wrap" problem too,
// since there's no icon competing for that same tight space anymore.
// side="bottom" (not "top"): these rows can sit at the very top of
// ControlPanel's scrolling field list, and a "top" bubble there opens
// upward past the scroll container into the fixed header/tab bar above it
// and gets clipped/lost - "bottom" opens down into the rest of the
// (taller) scrolling list instead, which has far more clearance.
function NumberFieldRow({ label, description, min, max, step, value, onChange }: {
  label: string;
  description?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [sliderActive, setSliderActive] = useState(false);
  const labelSpan = <span className="font-sans text-mobile-header-h2 text-text-black">{label}</span>;
  return (
    <label className="flex w-full flex-row items-center justify-between">
      {description ? (
        <Tooltip text={description} side="bottom" align="start">
          {labelSpan}
        </Tooltip>
      ) : (
        labelSpan
      )}
      {/* Everything right of the label - slider + its value readout,
          combined - is capped at ROW_CONTROLS_MAX_WIDTH (203px), the same
          cap IconInputRow/SegmentedRow's own right-side groups share
          below, so every tab's rows line up to the same right-hand
          width regardless of row shape. */}
      <div className={`flex w-full items-center justify-between ${ROW_CONTROLS_MAX_WIDTH}`}>
        <RangeSlider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          onActiveChange={setSliderActive}
        />
        <EditableNumberValue
          min={min}
          max={max}
          step={step}
          value={value}
          onCommit={onChange}
          active={sliderActive}
        />
      </div>
    </label>
  );
}

function NumberFieldList({ fields, config, setConfig }: {
  fields: NumberField[];
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
}) {
  return (
    <>
      {fields.map(({ label, key, min, max, step, description }) => (
        <NumberFieldRow
          key={key}
          label={label}
          description={description}
          min={min}
          max={max}
          step={step}
          value={config[key]}
          onChange={(value) => setConfig({ [key]: value })}
        />
      ))}
    </>
  );
}

// Orbit icon (copy-paste/paste.txt) - reused for both the Azimuth and Polar
// inputs in the Orbit row below, no per-axis variant.
function OrbitIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <span className="font-sans text-mobile-text-xsm-regular text-text-secondary">
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
//
// Orbit's own border/rounded/padding moved OFF the input itself and onto
// ORBIT_PILL_CLASSNAME below, so the "°" suffix can sit inside that same
// bordered box, immediately next to the digits, instead of being a sibling
// outside it (a first attempt at this put the "°" outside the input's own
// border, which visibly read as "detached" from the value it labels).
const ORBIT_INPUT_CLASSNAME = (focused: boolean) =>
  `w-auto [field-sizing:content] shrink-0 appearance-none bg-transparent text-center font-sans text-mobile-text-md-regular focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

// The bordered pill Orbit's input used to be styled as directly - now wraps
// the (borderless) input + the static "°" suffix together via IconInputRow's
// `valueSuffix`, so they render as one visual unit inside one box.
const ORBIT_PILL_CLASSNAME =
  "flex min-w-[61px] w-full items-center justify-center rounded-[4px] border border-border-border px-2 py-1 shadow-[-1px_4px_3px_0_rgba(133,129,121,0.05),-1px_2px_2px_0_rgba(133,129,121,0.09),0_0_1px_0_rgba(133,129,121,0.10)]";

// w-full (was max-w-[46.33px] size-fit) so the input actually fills the
// leftover space in its row instead of shrinking to its own content -
// pairs with the ScrubHandle wrapping it below getting flex-1, which is
// what actually gives this w-full something real to resolve against.
const AXIS_INPUT_CLASSNAME = (focused: boolean) =>
  `flex w-full items-center justify-center rounded-[4px] border border-border-border px-2 py-1 text-center font-sans text-mobile-text-md-regular appearance-none cursor-ew-resize focus:outline-none shadow-[-1px_4px_3px_0_rgba(133,129,121,0.05),-1px_2px_2px_0_rgba(133,129,121,0.09),0_0_1px_0_rgba(133,129,121,0.10)] ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

// Sensitivity for ScrubHandle below: dragging this many horizontal pixels
// slides across a field's entire [min,max] range - a simple default that at
// least normalizes "how far you drag" across fields with very different
// ranges (Azimuth's 360 vs Position's 10), not a value taken from any design
// spec. DRAG_THRESHOLD_PX is how far the pointer has to move before a
// pointerdown on an editable input (not an icon) is treated as a drag rather
// than a click - see ScrubHandle's own comment for why that distinction
// matters there.
const DRAG_RANGE_PX = 300;
const DRAG_THRESHOLD_PX = 3;

// Makes its child "scrubbable" (Blender/Figma-style number scrubbing): hover
// shows a horizontal resize cursor, click-and-drag left/right changes the
// field's value proportionally to horizontal movement, as an alternative to
// RangeSlider dragging or typing directly. Reused for two different targets
// with different pointerdown behavior:
// - `immediate` (OrbitIcon, in the Camera tab's Orbit row below) - the child
//   is a plain icon, not a text input, so the drag starts the instant the
//   pointer goes down, calling preventDefault right away - the same pattern
//   OpacitySlider/ColorPicker's saturation+hue handles already use to dodge
//   the documented "not-allowed cursor" bug from a native drag-select
//   gesture starting instead.
// - non-`immediate` (wraps EditableNumberValue for Position/Rotation's
//   inputs) - that input is still a real click-to-edit text field, and
//   calling preventDefault on pointerdown would block its native
//   focus-on-click behavior entirely. So there, nothing happens on
//   pointerdown itself; only once movement crosses DRAG_THRESHOLD_PX does
//   this treat the gesture as a scrub - blurring whatever's focused (which
//   cancels any text edit the initial click may have started) and taking
//   over from there. A plain click/tap (no real movement) never crosses the
//   threshold, so it still focuses the input for typing exactly as before.
function ScrubHandle({ value, min, max, step, onChange, immediate = false, className = "", children }: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  immediate?: boolean;
  // Extra classes for the wrapping span - e.g. Position/Rotation's own use
  // passes "flex-1" so the input inside can actually grow to fill the
  // leftover row space once its own className drops its old fixed max-width
  // (see AXIS_INPUT_CLASSNAME) - a percentage width on the <input> only
  // resolves against a definite size, which this span otherwise doesn't have
  // as a plain content-sized flex item.
  className?: string;
  children: ReactNode;
}) {
  const stateRef = useRef<{ dragging: boolean; startX: number; startValue: number } | null>(null);

  // Same "latest ref" + rAF-coalescing fix already applied to
  // OpacitySlider/ColorPicker's own drag handlers - see OpacitySlider's
  // onChangeRef/scheduleOnChange comments for the full diagnosis (listener
  // churn from a fresh onChange closure every render, then uncoalesced
  // onChange calls competing with the drag's own next paint).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const rafRef = useRef<number | null>(null);
  const pendingValueRef = useRef<number | null>(null);
  function scheduleOnChange(next: number) {
    pendingValueRef.current = next;
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

  // Keeps the resize cursor visible for the rest of the drag even once the
  // pointer moves off the small handle itself (a plain CSS :hover cursor
  // would otherwise revert to the default arrow there) - reset back to ""
  // on pointerup. Also cancels whatever's currently focused, so starting a
  // scrub (from either target) always cuts off any in-progress text edit
  // elsewhere in the panel.
  function startDrag() {
    document.body.style.cursor = "ew-resize";
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const state = stateRef.current;
      if (!state) return;
      const deltaX = event.clientX - state.startX;
      if (!state.dragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
        state.dragging = true;
        startDrag();
      }
      const rawValue = state.startValue + (deltaX / DRAG_RANGE_PX) * (max - min);
      const stepped = Math.round(rawValue / step) * step;
      scheduleOnChange(clamp(stepped, min, max));
    }
    function handleUp() {
      if (stateRef.current?.dragging) {
        document.body.style.cursor = "";
      }
      stateRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- max/step also
    // read on every move, but only min/max/step ever actually change - see
    // OpacitySlider's own identical [] mount-once effect for why re-adding
    // window listeners per render is the thing being avoided here.
  }, [min, max, step]);

  return (
    <span
      onPointerDown={(event) => {
        if (immediate) {
          event.preventDefault();
          stateRef.current = { dragging: true, startX: event.clientX, startValue: value };
          startDrag();
        } else {
          stateRef.current = { dragging: false, startX: event.clientX, startValue: value };
        }
      }}
      className={`cursor-ew-resize select-none touch-none ${className}`}
    >
      {children}
    </span>
  );
}

// Shared row shape for Orbit/Position/Rotation (Camera tab): a label, then
// one gap-[8px] row holding a gap-[8px] marker+input group per field -
// distinct from every other NumberFieldList row in this panel. `renderMarker`
// is the only thing that differs between them (OrbitIcon vs an AxisLabel
// letter), so it's a prop rather than three near-identical row components.
// `scrubInput` wraps each field's EditableNumberValue in a ScrubHandle too -
// on for Position/Rotation (per explicit direction: hover *the input* there),
// off for Orbit, whose own scrub trigger is its icon instead (wrapped
// directly in the renderMarker call site, see the Camera tab's Orbit row).
function IconInputRow({
  label,
  description,
  fields,
  config,
  setConfig,
  renderMarker,
  inputClassName,
  scrubInput = false,
  valueSuffix,
}: {
  label: string;
  description?: string;
  fields: NumberField[];
  config: GradientConfig;
  setConfig: (patch: Partial<GradientConfig>) => void;
  renderMarker: (field: NumberField) => ReactNode;
  inputClassName: (focused: boolean) => string;
  scrubInput?: boolean;
  // A static, non-editable label always shown right next to every field's
  // value (e.g. "°" for Orbit's Azimuth/Polar) - rendered INSIDE the same
  // bordered pill as the input itself (see ORBIT_PILL_CLASSNAME), not as a
  // sibling outside it, so it visually reads as part of the value ("45°"),
  // not a detached label floating next to the input's own box.
  valueSuffix?: string;
}) {
  const labelNode = description ? (
    // Same "label text is the trigger, mr-auto moves to the Tooltip
    // wrapper" fix as SegmentedRow/NumberFieldRow - see either's comment.
    <Tooltip text={description} side="bottom" align="start" className="mr-auto">
      <p className="font-sans text-mobile-header-h2 text-text-black">{label}</p>
    </Tooltip>
  ) : (
    <p className="font-sans mr-auto text-mobile-header-h2 text-text-black">{label}</p>
  );
  return (
    <div className="flex w-full items-center justify-end gap-[8px]">
      {labelNode}
      <div className={`flex w-full items-center gap-[8px] ${ROW_CONTROLS_MAX_WIDTH}`}>
        {fields.map((field) => {
          const editableValue = (
            <EditableNumberValue
              min={field.min}
              max={field.max}
              step={field.step}
              value={config[field.key]}
              onCommit={(value) => setConfig({ [field.key]: value })}
              className={inputClassName}
            />
          );
          // With a suffix (Orbit only), wrap the input + suffix together in
          // the bordered pill - one visual box, "°" always inside it right
          // after the digits. Without one (Position/Rotation), the input
          // keeps drawing its own border via inputClassName, unchanged.
          const input = valueSuffix ? (
            <div className={ORBIT_PILL_CLASSNAME}>
              {editableValue}
              <span className="shrink-0 font-sans text-mobile-text-md-regular text-text-secondary">
                {valueSuffix}
              </span>
            </div>
          ) : (
            editableValue
          );
          return (
            <div key={field.key} className="flex w-full items-center gap-[8px]">
              {renderMarker(field)}
              {scrubInput ? (
                <ScrubHandle
                  value={config[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(value) => setConfig({ [field.key]: value })}
                  className="flex-1"
                >
                  {input}
                </ScrubHandle>
              ) : (
                input
              )}
            </div>
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
// px-1 (not px-2 like every other pill input in this file) - a real bug
// found by testing in the sandbox: a 7-char "#rrggbb" value needs ~65px of
// text width on its own, so px-2's 16px of combined padding left this input
// clipping the last character at the requested 64px max-width. px-1 frees up
// the extra room while keeping the 64px cap intact.
const HEX_INPUT_CLASSNAME = (focused: boolean) =>
  `flex max-w-[64px] size-fit items-center justify-center rounded-[4px] border border-border-border px-1 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none shadow-[-1px_4px_3px_0_rgba(133,129,121,0.05),-1px_2px_2px_0_rgba(133,129,121,0.09),0_0_1px_0_rgba(133,129,121,0.10)] ${
    focused ? "text-text-color-accent" : "text-text-black"
  }`;

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
  const setColorModalOpen = useGradientStore((state) => state.setColorModalOpen);

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
          onOpenChange={setColorModalOpen}
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
      <div className="flex shrink-0 bg-background-white-2 border-b border-border-border gap-4 px-[20px] pt-[12px]">
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
          wide Tooltip bubble near either edge).

          The global custom scrollbar's own 6px width eats directly into
          this div's content box whenever it shows - scrollbar-gutter:stable
          (kept below) only makes that loss *consistent* across tabs/states
          (always reserved, not just while actively showing), it doesn't
          give the 6px back, so every fixed-pixel row shape here
          (ROW_CONTROLS_MAX_WIDTH, RangeSlider's own TRACK_MAX_WIDTH) would
          still render a uniform 6px under its real Figma spec. A first
          attempt tried to reclaim that 6px by widening this div itself
          (`w-[calc(100%+6px)]` + a matching negative right margin) - wrong,
          because unlike a normal scrolling page this div's ultimate ancestor
          is the extension's own fixed 320px viewport, not a wider document
          with slack to expand into: the extra 6px had nowhere real to go,
          so the browser clipped most of the scrollbar itself off past the
          panel's true right edge (down to a sliver, confirmed visually -
          "yo diria que mide 2px"). Fixed instead by *reallocating* existing
          space rather than conjuring new space: pl-5/pr-[14px] replaces the
          old symmetric px-5, handing the scrollbar's 6px straight out of
          the right padding's own slack (20px -> 14px) instead of out of
          the content - total right-side space consumed (padding + gutter)
          stays exactly 20px either way, so the content area is back to
          being pixel-identical to how it measured before the scrollbar
          existed at all, and the scrollbar itself renders fully within the
          panel's true bounds (nothing pushed past the edge to clip).
          scrollbar-gutter:stable stays alongside this - it's what keeps
          that reallocated 14px right-padding gutter reserved consistently
          (not silently reclaimed as content width) on a tab whose current
          field list is short enough not to need scrolling (e.g. Camera, or
          Colors with colorCount==="2") - confirmed unrelated to the WebGL
          preview's own frame-rate stutter investigated separately (see
          GradientCanvas.tsx's own powerPreference comment) - removed as one
          of two isolation tests while chasing that, with the stutter
          persisting either way, before being restored here. */}
      <div className="flex flex-1 min-h-0 flex-col gap-5 overflow-y-auto overflow-x-hidden pl-5 pr-[14px] py-3 [scrollbar-gutter:stable]">
        {activeTab === "shape" && (
          <>
            <SegmentedRow
              label="Type"
              description="The mesh shape the gradient renders on."
              options={TYPE_OPTIONS}
              value={config.type}
              onChange={(value) => setConfig({ type: value })}
            />
            <SegmentedRow
              label="Shader"
              description="Which shader variant renders the gradient."
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
                  className="flex items-center gap-1 rounded-[4px] border border-border-border px-2 py-1 shadow-[-1px_4px_3px_0_rgba(133,129,121,0.05),-1px_2px_2px_0_rgba(133,129,121,0.09),0_0_1px_0_rgba(133,129,121,0.10)]"
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
              description="Adds a dotted halftone texture over the gradient."
              options={GRAIN_OPTIONS}
              value={config.grain}
              onChange={(value) => setConfig({ grain: value })}
            />

            <SegmentedRow
              label="Lighting"
              description="3D lighting, or an environment reflection instead."
              options={LIGHT_TYPE_OPTIONS}
              value={config.lightType}
              onChange={(value) => setConfig({ lightType: value })}
            />

            {config.lightType === "env" ? (
              <>
                <SegmentedRow
                  label="Env preset"
                  description="The environment map used for lighting/reflections."
                  options={ENV_PRESET_OPTIONS}
                  value={config.envPreset}
                  onChange={(value) => setConfig({ envPreset: value })}
                />
                <NumberFieldList
                  fields={[
                    {
                      label: "Reflection",
                      key: "reflection",
                      min: 0,
                      max: 1,
                      step: 0.1,
                      description: "How reflective the surface looks under the environment lighting.",
                    },
                  ]}
                  config={config}
                  setConfig={setConfig}
                />
              </>
            ) : (
              <NumberFieldList
                fields={[
                  {
                    label: "Brightness",
                    key: "brightness",
                    min: 0,
                    max: 3,
                    step: 0.1,
                    description: "Overall brightness of the 3D lighting.",
                  },
                ]}
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
              description="Loop the animation within a fixed time range instead of running it freely."
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
              description="Orbits the camera around the gradient (azimuth/polar angle)."
              fields={CAMERA_ANGLE_FIELDS}
              config={config}
              setConfig={setConfig}
              renderMarker={(field) => (
                <ScrubHandle
                  value={config[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(value) => setConfig({ [field.key]: value })}
                  immediate
                >
                  <OrbitIcon />
                </ScrubHandle>
              )}
              inputClassName={ORBIT_INPUT_CLASSNAME}
              valueSuffix="°"
            />
            <NumberFieldList fields={CAMERA_NUMBER_FIELDS} config={config} setConfig={setConfig} />
            <NumberFieldList fields={FOV_NUMBER_FIELDS} config={config} setConfig={setConfig} />
            <IconInputRow
              label="Position"
              description="Moves the camera along X/Y/Z."
              fields={POSITION_NUMBER_FIELDS}
              config={config}
              setConfig={setConfig}
              renderMarker={(field) => <AxisLabel field={field} />}
              inputClassName={AXIS_INPUT_CLASSNAME}
              scrubInput
            />
            <IconInputRow
              label="Rotation"
              description="Rotates the camera along X/Y/Z."
              fields={ROTATION_NUMBER_FIELDS}
              config={config}
              setConfig={setConfig}
              renderMarker={(field) => <AxisLabel field={field} />}
              inputClassName={AXIS_INPUT_CLASSNAME}
              scrubInput
            />
          </>
        )}
      </div>
    </div>
  );
}
