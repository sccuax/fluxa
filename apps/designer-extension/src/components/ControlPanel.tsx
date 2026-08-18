import { useState } from "react";
import type { GradientConfig } from "@fluxa/gradient-core";
import { useGradientStore } from "../store/gradientStore";
import { formatSliderValue } from "../helpers/format";

type ControlTab = "type" | "shape" | "colors" | "motion";

const TABS: Array<{ tab: ControlTab; label: string }> = [
  { tab: "type", label: "Type" },
  { tab: "shape", label: "Shape" },
  { tab: "colors", label: "Colors" },
  { tab: "motion", label: "Motion" },
];

const TYPE_OPTIONS: Array<{ label: string; value: GradientConfig["type"] }> = [
  { label: "Plane", value: "plane" },
  { label: "Sphere", value: "sphere" },
  { label: "Water", value: "waterPlane" },
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
  { label: "3D Light", value: "3d" },
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

// Strength/Density/Frequency shape the noise wave pattern itself (a spatial
// property of the mesh), and Camera distance/Pixel density frame/resolve
// that shape - all live under Shape. Speed is the only temporal one, so it
// stays under Motion (see the tab-grouping comment on ControlPanel below).
const SHAPE_NUMBER_FIELDS: NumberField[] = [
  { label: "Strength", key: "uStrength", min: 0, max: 10, step: 0.1 },
  { label: "Density", key: "uDensity", min: 0, max: 4, step: 0.1 },
  { label: "Frequency", key: "uFrequency", min: 0, max: 10, step: 0.01 },
  { label: "Camera distance", key: "cDistance", min: 1, max: 10, step: 0.1 },
  { label: "Pixel density", key: "pixelDensity", min: 0.5, max: 3, step: 0.1 },
];

const MOTION_NUMBER_FIELDS: NumberField[] = [
  { label: "Speed", key: "uSpeed", min: 0, max: 1, step: 0.01 },
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
        <label key={key} className="flex flex-col gap-1">
          <span className="flex justify-between">
            <span>{label}</span>
            <span className="tabular-nums text-neutral-400">
              {formatSliderValue(config[key], step)}
            </span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={config[key]}
            onChange={(event) => setConfig({ [key]: Number(event.target.value) })}
          />
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
// copied 1:1 - Type/Shape/Colors/Motion, not Shape/Colors/Effects/View:
// - Type: `type` (Plane/Sphere/Water).
// - Shape: the noise-pattern/framing/resolution fields (Strength/Density/
//   Frequency/Camera distance/Pixel density) plus Grain.
// - Colors: color1-3, Brightness, and the Environment toggle (`lightType`) -
//   when Environment is on (`lightType === "env"`), Env preset + Reflection
//   replace Brightness, matching @shadergradient/react's own reference
//   controls' hidden-field logic exactly (brightness hidden when
//   lightType==="env", envPreset/reflection hidden when lightType==="3d").
// - Motion: Speed, plus Range (bounds the animation's time loop to
//   [rangeStart, rangeEnd] instead of running unbounded) and its two bounds,
//   shown only when Range is enabled.
export function ControlPanel() {
  const config = useGradientStore((state) => state.config);
  const setConfig = useGradientStore((state) => state.setConfig);
  const [activeTab, setActiveTab] = useState<ControlTab>("type");

  return (
    <div className="flex w-full flex-col text-sm">
      <div className="flex bg-background-white-2 border-b border-border-border gap-[8px] px-[20px] pt-[12px]">
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

      <div className="flex flex-col gap-2 px-5 py-3">
        {activeTab === "type" && (
          <SegmentedRow
            label="Type"
            options={TYPE_OPTIONS}
            value={config.type}
            onChange={(value) => setConfig({ type: value })}
          />
        )}

        {activeTab === "shape" && (
          <>
            <NumberFieldList fields={SHAPE_NUMBER_FIELDS} config={config} setConfig={setConfig} />
            <SegmentedRow
              label="Grain"
              options={GRAIN_OPTIONS}
              value={config.grain}
              onChange={(value) => setConfig({ grain: value })}
            />
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
              label="Environment"
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
      </div>
    </div>
  );
}
