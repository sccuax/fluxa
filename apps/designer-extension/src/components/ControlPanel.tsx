import { useState } from "react";
import type { GradientConfig } from "@fluxa/gradient-core";
import { useGradientStore } from "../store/gradientStore";
import { formatSliderValue } from "../helpers/format";
import { RangeSlider } from "./RangeSlider";

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
  { label: "Camera distance", key: "cDistance", min: 1, max: 10, step: 0.1 },
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
          <span className="min-w-[25px] shrink-0 text-right text-mobile-text-md-medium font-sans text-text-secondary">
            {formatSliderValue(config[key], step)}
          </span>
        </label>
      ))}
    </>
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
// - Colors: color1-3, Grain, Brightness, and the Environment toggle
//   (`lightType`) - when Environment is on (`lightType === "env"`), Env
//   preset + Reflection replace Brightness, matching @shadergradient/react's
//   own reference controls' hidden-field logic exactly (brightness hidden
//   when lightType==="env", envPreset/reflection hidden when
//   lightType==="3d").
// - Motion: Speed, plus Range (bounds the animation's time loop to
//   [rangeStart, rangeEnd] instead of running unbounded) and its two bounds,
//   shown only when Range is enabled.
// - Camera: Camera distance - its own tab now, split out of Shape.
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
          of pushing the tab bar or Apply button off screen. */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto px-5 py-3">
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
            {COLOR_FIELDS.map(({ label, key }) => (
              <label key={key} className="flex items-center justify-between gap-3">
                <span>{label}</span>
                <input
                  type="color"
                  value={config[key]}
                  onChange={(event) => setConfig({ [key]: event.target.value })}
                />
              </label>
            ))}

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
          <NumberFieldList fields={CAMERA_NUMBER_FIELDS} config={config} setConfig={setConfig} />
        )}
      </div>
    </div>
  );
}
