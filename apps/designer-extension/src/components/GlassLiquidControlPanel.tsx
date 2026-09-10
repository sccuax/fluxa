import { useState } from "react";
import { RangeSlider } from "./RangeSlider";
import { SegmentedRow } from "./SegmentedRow";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import { formatSliderValue } from "../helpers/format";
import { useGlassLiquidStore } from "../store/glassLiquidStore";

// The "glassLiquid" gallery preset kind's control panel - extracted from
// sandbox/src/experiments/ShaderGlassExperiment.tsx (see GlassLiquidCanvas.tsx's
// own header comment for the full extraction rationale). Unlike
// ControlPanel.tsx's own tabbed Shape/Colors/Motion/Camera layout, this
// stays one flat scrollable panel with the sandbox file's own section
// groupings (Trail/Glass/Edge line/Toggles/Colors) - the field count doesn't
// need a tab taxonomy.

// Label above the shared ColorSwatchPicker modal (Hex/RGB/HSL + opacity +
// eyedropper), used for every colour in this panel. Replaced this file's old
// lightweight portal popover (`ColorSwatchControl`) once every colour
// selector had to open the same modal shaderGradient uses - per explicit
// direction. `opacity`/`onOpacityChange` bind to the matching `*Opacity`
// field: purely UI/data (this shader has no per-colour alpha), same as
// shaderGradient's colorNOpacity - see gradient-core's schema comment.
// GlassLiquidCanvas owns a cancelable rAF loop, so unlike ControlPanel this
// passes no `onOpenChange`.
function ColorField({ label, value, onChange, opacity, onOpacityChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{label}</span>
      <ColorSwatchPicker
        label={label}
        value={value}
        onChange={onChange}
        opacity={opacity}
        onOpacityChange={onOpacityChange}
        className="h-6 w-16 rounded-[4px] border border-border-border"
      />
    </div>
  );
}

// The numeric text input paired with every slider below - same commit-on-
// blur/Enter, revert-on-Escape behavior as ControlPanel.tsx's own
// EditableValue/EditableNumberValue (not imported directly since that file
// only exports the ControlPanel component itself, not its internal
// helpers). Lets a value be typed exactly instead of only dragged.
function NumberInput({ value, min, max, step, onCommit }: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft !== null) {
      const parsed = Number(draft);
      if (Number.isFinite(parsed)) {
        onCommit(Math.min(max, Math.max(min, parsed)));
      }
    }
    setDraft(null);
  }

  return (
    <input
      type="text"
      value={draft ?? formatSliderValue(value, step)}
      onFocus={(event) => {
        setDraft(formatSliderValue(value, step));
        event.target.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      className="w-14 shrink-0 rounded-[4px] border border-border-border bg-transparent px-1.5 py-0.5 text-right font-sans text-mobile-text-sm-regular text-text-black focus:border-accent-500 focus:outline-none"
    />
  );
}

// A slider paired with a NumberInput - every numeric control in this panel
// uses this, not a bare RangeSlider, so every value is typeable by hand.
function SliderField({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <RangeSlider min={min} max={max} step={step} value={value} onChange={onChange} />
        <NumberInput min={min} max={max} step={step} value={value} onCommit={onChange} />
      </div>
    </label>
  );
}

// A boolean toggle, rendered as a real SegmentedRow (the app's own
// exclusive-pick component) with two options rather than a checkbox.
function ToggleField({ label, value, onChange, onLabel = "On", offLabel = "Off" }: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{label}</span>
      <SegmentedRow<"on" | "off">
        options={[{ label: offLabel, value: "off" }, { label: onLabel, value: "on" }]}
        value={value ? "on" : "off"}
        onChange={(next) => onChange(next === "on")}
        className="max-w-[140px]"
      />
    </div>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <div className="w-full basis-full font-sans text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
      {children}
    </div>
  );
}

export function GlassLiquidControlPanel() {
  const config = useGlassLiquidStore((state) => state.config);
  const setConfig = useGlassLiquidStore((state) => state.setConfig);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <SectionHeader>Trail</SectionHeader>
      <SliderField label="Cursor radius" value={config.cursorRadius} min={0.02} max={0.4} step={0.01} onChange={(v) => setConfig({ cursorRadius: v })} />
      <SliderField label="Glow strength" value={config.glowStrength} min={0} max={1} step={0.05} onChange={(v) => setConfig({ glowStrength: v })} />
      <SliderField label="Ceiling" value={config.ceiling} min={1} max={4} step={0.1} onChange={(v) => setConfig({ ceiling: v })} />
      <SliderField label="Floor" value={config.floorPerSecond} min={0} max={0.24} step={0.012} onChange={(v) => setConfig({ floorPerSecond: v })} />
      <SliderField label="Fade duration" value={config.fadeDuration} min={0.3} max={4} step={0.1} onChange={(v) => setConfig({ fadeDuration: v })} />
      <SliderField label="Velocity decay" value={config.velocityDecay} min={0.0005} max={0.5} step={0.0005} onChange={(v) => setConfig({ velocityDecay: v })} />

      <SectionHeader>Glass</SectionHeader>
      <SliderField label="Refraction" value={config.refraction} min={0} max={0.4} step={0.01} onChange={(v) => setConfig({ refraction: v })} />
      <SliderField label="Flutes angle" value={config.flutesAngle} min={-90} max={90} step={1} onChange={(v) => setConfig({ flutesAngle: v })} />
      <SliderField label="Flutes frequency" value={config.flutesFrequency} min={2} max={20} step={0.5} onChange={(v) => setConfig({ flutesFrequency: v })} />
      <SliderField label="Scroll speed" value={config.scrollSpeed} min={0} max={0.5} step={0.01} onChange={(v) => setConfig({ scrollSpeed: v })} />
      <SliderField label="Wobble amount" value={config.wobbleAmount} min={0} max={0.2} step={0.005} onChange={(v) => setConfig({ wobbleAmount: v })} />
      <SliderField label="Flute variation" value={config.fluteVariation} min={0} max={1} step={0.05} onChange={(v) => setConfig({ fluteVariation: v })} />
      <SliderField label="Flutes depth" value={config.flutesDepth} min={0} max={1} step={0.05} onChange={(v) => setConfig({ flutesDepth: v })} />
      {config.flutesDepth > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-mobile-text-sm-regular text-text-secondary">Depth pattern</span>
          <SegmentedRow<"full" | "zones" | "random">
            options={[
              { label: "Full", value: "full" },
              { label: "Zones", value: "zones" },
              { label: "Random", value: "random" },
            ]}
            value={config.flutesDepthMask}
            onChange={(v) => setConfig({ flutesDepthMask: v })}
            className="w-full"
          />
        </div>
      )}
      <SliderField label="Highlight strength" value={config.highlightStrength} min={0} max={1} step={0.05} onChange={(v) => setConfig({ highlightStrength: v })} />

      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-mobile-text-sm-regular text-text-secondary">Surface texture</span>
        <SegmentedRow<"off" | "grain" | "noise">
          options={[
            { label: "Off", value: "off" },
            { label: "Grain", value: "grain" },
            { label: "Noise", value: "noise" },
          ]}
          value={config.grainMode}
          onChange={(v) => setConfig({ grainMode: v })}
          className="w-full"
        />
      </div>
      {config.grainMode !== "off" && (
        <>
          <SliderField
            label={config.grainMode === "grain" ? "Grain strength" : "Noise strength"}
            value={config.grainStrength}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setConfig({ grainStrength: v })}
          />
          <SliderField
            label={config.grainMode === "grain" ? "Grain scale" : "Noise scale"}
            value={config.grainScale}
            min={2}
            max={12}
            step={0.5}
            onChange={(v) => setConfig({ grainScale: v })}
          />
        </>
      )}

      <SectionHeader>Edge line</SectionHeader>
      <SliderField label="Edge strength" value={config.edgeStrength} min={0} max={2} step={0.05} onChange={(v) => setConfig({ edgeStrength: v })} />
      <SliderField label="Edge width (px)" value={config.edgeWidth} min={0.2} max={4} step={0.1} onChange={(v) => setConfig({ edgeWidth: v })} />
      <SliderField label="Edge trail mod" value={config.edgeTrailMod} min={0} max={1} step={0.05} onChange={(v) => setConfig({ edgeTrailMod: v })} />

      <SectionHeader>Toggles</SectionHeader>
      <ToggleField label="Sampling" value={config.confine} onChange={(v) => setConfig({ confine: v })} onLabel="Confined" offLabel="Continuous" />
      <ToggleField label="Seam scroll" value={config.seamScroll} onChange={(v) => setConfig({ seamScroll: v })} />
      <ToggleField label="Seam wobble" value={config.seamWobble} onChange={(v) => setConfig({ seamWobble: v })} />
      <ToggleField label="Edge AA" value={config.edgeAA} onChange={(v) => setConfig({ edgeAA: v })} />
      <ToggleField label="Isolate lines" value={config.isolateLines} onChange={(v) => setConfig({ isolateLines: v })} />
      <ToggleField label="Ambient gradient" value={config.ambientGradient} onChange={(v) => setConfig({ ambientGradient: v })} />
      {config.ambientGradient && (
        <>
          <SliderField label="Ambient strength" value={config.ambientStrength} min={0} max={1} step={0.01} onChange={(v) => setConfig({ ambientStrength: v })} />
          <div className="flex flex-wrap gap-4">
            <ColorField label="Ambient color 1" value={config.ambientColor1} onChange={(v) => setConfig({ ambientColor1: v })} opacity={config.ambientColor1Opacity} onOpacityChange={(v) => setConfig({ ambientColor1Opacity: v })} />
            <ColorField label="Ambient color 2" value={config.ambientColor2} onChange={(v) => setConfig({ ambientColor2: v })} opacity={config.ambientColor2Opacity} onOpacityChange={(v) => setConfig({ ambientColor2Opacity: v })} />
          </div>
        </>
      )}

      <SectionHeader>Colors</SectionHeader>
      <div className="flex flex-wrap gap-4">
        <ColorField label="Trail color 1" value={config.glowColor1} onChange={(v) => setConfig({ glowColor1: v })} opacity={config.glowColor1Opacity} onOpacityChange={(v) => setConfig({ glowColor1Opacity: v })} />
        <ColorField label="Trail color 2" value={config.glowColor2} onChange={(v) => setConfig({ glowColor2: v })} opacity={config.glowColor2Opacity} onOpacityChange={(v) => setConfig({ glowColor2Opacity: v })} />
        <ColorField label="Highlight" value={config.highlightColor} onChange={(v) => setConfig({ highlightColor: v })} opacity={config.highlightColorOpacity} onOpacityChange={(v) => setConfig({ highlightColorOpacity: v })} />
        <ColorField label="Glow" value={config.glowColor} onChange={(v) => setConfig({ glowColor: v })} opacity={config.glowColorOpacity} onOpacityChange={(v) => setConfig({ glowColorOpacity: v })} />
        <ColorField label="Edge color" value={config.edgeColor} onChange={(v) => setConfig({ edgeColor: v })} opacity={config.edgeColorOpacity} onOpacityChange={(v) => setConfig({ edgeColorOpacity: v })} />
        <ColorField label="Background" value={config.baseColor} onChange={(v) => setConfig({ baseColor: v })} opacity={config.baseColorOpacity} onOpacityChange={(v) => setConfig({ baseColorOpacity: v })} />
      </div>
    </div>
  );
}
