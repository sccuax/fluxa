import type { GradientConfig } from "@fluxa/gradient-core";
import { useGradientStore } from "../store/gradientStore";
import { formatSliderValue } from "../helpers/format";

interface NumberField {
  label: string;
  key: keyof Pick<
    GradientConfig,
    "uSpeed" | "uStrength" | "uDensity" | "uFrequency" | "cDistance"
  >;
  min: number;
  max: number;
  step: number;
}

const NUMBER_FIELDS: NumberField[] = [
  { label: "Speed", key: "uSpeed", min: 0, max: 1, step: 0.01 },
  { label: "Strength", key: "uStrength", min: 0, max: 10, step: 0.1 },
  { label: "Density", key: "uDensity", min: 0, max: 4, step: 0.1 },
  { label: "Frequency", key: "uFrequency", min: 0, max: 10, step: 0.01 },
  { label: "Camera distance", key: "cDistance", min: 1, max: 10, step: 0.1 },
];

const COLOR_FIELDS: { label: string; key: "color1" | "color2" | "color3" }[] = [
  { label: "Color 1", key: "color1" },
  { label: "Color 2", key: "color2" },
  { label: "Color 3", key: "color3" },
];

export function ControlPanel() {
  const config = useGradientStore((state) => state.config);
  const setConfig = useGradientStore((state) => state.setConfig);

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
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

      {NUMBER_FIELDS.map(({ label, key, min, max, step }) => (
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
            onChange={(event) =>
              setConfig({ [key]: Number(event.target.value) })
            }
          />
        </label>
      ))}
    </div>
  );
}
