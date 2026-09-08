import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RUIDO_EVOLUTIVO_MAX_COLORS } from "@fluxa/gradient-core";
import { RangeSlider } from "./RangeSlider";
import { ColorPicker } from "./ColorPicker";
import { SegmentedRow } from "./SegmentedRow";
import { formatSliderValue } from "../helpers/format";
import { useRuidoEvolutivoStore } from "../store/ruidoEvolutivoStore";

// The "ruidoEvolutivo" gallery preset kind's control panel - one flat
// scrollable panel with section groupings (Colors/Surface/Motion/Color
// flow/Texture/Lighting/Camera), same shape as GlassLiquidControlPanel.tsx.
// The small field helpers below (ColorSwatchControl / NumberInput /
// SliderField / ToggleField / SectionHeader) are deliberately copied from
// that file rather than shared - it only exports its panel component, not
// its internals, and glassLiquid itself made the same copy from
// ControlPanel.tsx's EditableValue. Every value defined/bounded in
// ruidoEvolutivoConfigSchema (packages/gradient-core); step values are the
// literals in this file's JSX.

const SWATCH_POPUP_WIDTH = 280;
const SWATCH_POPUP_GAP = 8;
const SWATCH_POPUP_VIEWPORT_MARGIN = 8;

function ColorSwatchControl({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - SWATCH_POPUP_WIDTH - SWATCH_POPUP_VIEWPORT_MARGIN);
    const estimatedHeight = 216 + 24;
    const opensAbove = rect.top - estimatedHeight - SWATCH_POPUP_GAP > SWATCH_POPUP_VIEWPORT_MARGIN;
    const top = opensAbove ? rect.top - estimatedHeight - SWATCH_POPUP_GAP : rect.bottom + SWATCH_POPUP_GAP;
    setPopupPosition({ top, left: Math.max(left, SWATCH_POPUP_VIEWPORT_MARGIN) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="flex items-center gap-3">
      <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="h-6 w-16 shrink-0 rounded-[4px] border border-border-border"
        style={{ background: value }}
      />
      {open && popupPosition &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-50 rounded-md bg-neutral-900 p-3 shadow-xl"
            style={{ top: popupPosition.top, left: popupPosition.left, width: SWATCH_POPUP_WIDTH }}
          >
            <ColorPicker value={value} onChange={onChange} />
          </div>,
          document.body,
        )}
    </div>
  );
}

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

function ToggleField({ label, value, onChange, onLabel = "On", offLabel = "Off" }: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
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

export function RuidoEvolutivoControlPanel() {
  const config = useRuidoEvolutivoStore((state) => state.config);
  const setConfig = useRuidoEvolutivoStore((state) => state.setConfig);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <SectionHeader>Colors</SectionHeader>
      {config.colors.map((hex, i) => (
        <div key={i} className="flex items-center gap-3">
          <ColorSwatchControl
            label={`Color ${i + 1}`}
            value={hex}
            onChange={(v) => {
              const next = [...config.colors];
              next[i] = v;
              setConfig({ colors: next });
            }}
          />
          {config.colors.length > 2 && (
            <button
              type="button"
              aria-label={`Remove color ${i + 1}`}
              onClick={() => setConfig({ colors: config.colors.filter((_, j) => j !== i) })}
              className="ml-auto shrink-0 rounded-[4px] border border-border-border px-2 py-0.5 font-sans text-mobile-text-sm-regular text-text-secondary"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {config.colors.length < RUIDO_EVOLUTIVO_MAX_COLORS && (
        <button
          type="button"
          onClick={() => setConfig({ colors: [...config.colors, "#ffffff"] })}
          className="w-fit rounded-[4px] border border-border-border px-2 py-1 font-sans text-mobile-text-sm-regular text-text-black"
        >
          + Add color
        </button>
      )}
      <SliderField label="Saturation" value={config.saturation} min={0.5} max={1.6} step={0.02} onChange={(v) => setConfig({ saturation: v })} />

      <SectionHeader>Surface</SectionHeader>
      <SliderField label="Frequency" value={config.frequency} min={0.1} max={3} step={0.05} onChange={(v) => setConfig({ frequency: v })} />
      <SliderField label="Relief" value={config.relief} min={0} max={1} step={0.01} onChange={(v) => setConfig({ relief: v })} />
      <SliderField label="Detail (octaves)" value={config.detail} min={1} max={6} step={1} onChange={(v) => setConfig({ detail: v })} />
      <SliderField label="Roughness" value={config.roughness} min={0.3} max={0.7} step={0.01} onChange={(v) => setConfig({ roughness: v })} />
      <SliderField label="Lacunarity" value={config.lacunarity} min={1.5} max={3} step={0.05} onChange={(v) => setConfig({ lacunarity: v })} />
      <ToggleField label="Wireframe" value={config.wireframe} onChange={(v) => setConfig({ wireframe: v })} />
      {config.wireframe && (
        <SliderField
          label="Wireframe grid density"
          value={config.gridDensity}
          min={8}
          max={256}
          step={4}
          onChange={(v) => setConfig({ gridDensity: v })}
        />
      )}

      <SectionHeader>Motion</SectionHeader>
      <SliderField label="Speed" value={config.speed} min={0} max={3} step={0.05} onChange={(v) => setConfig({ speed: v })} />
      <SliderField label="Evolution rate" value={config.evolution} min={0} max={1} step={0.05} onChange={(v) => setConfig({ evolution: v })} />
      <ToggleField label="Animate" value={config.animate === "on"} onChange={(v) => setConfig({ animate: v ? "on" : "off" })} />

      <SectionHeader>Color flow</SectionHeader>
      <SliderField label="Warp amount" value={config.warp} min={0} max={2} step={0.05} onChange={(v) => setConfig({ warp: v })} />
      <SliderField label="Warp scale" value={config.warpScale} min={0.2} max={2} step={0.05} onChange={(v) => setConfig({ warpScale: v })} />
      <SliderField label="Wave scale" value={config.waveScale} min={0.3} max={3} step={0.05} onChange={(v) => setConfig({ waveScale: v })} />
      <SliderField label="Distortion" value={config.distortion} min={0} max={1.5} step={0.05} onChange={(v) => setConfig({ distortion: v })} />
      <SliderField label="Band contrast" value={config.contrast} min={1} max={4} step={0.05} onChange={(v) => setConfig({ contrast: v })} />
      <SliderField label="Color mix" value={config.colorMix} min={0} max={1} step={0.05} onChange={(v) => setConfig({ colorMix: v })} />
      <SliderField label="Flow angle" value={config.flowAngle} min={0} max={360} step={1} onChange={(v) => setConfig({ flowAngle: v })} />
      <SliderField label="Flow spread" value={config.flowSpread} min={0} max={1} step={0.05} onChange={(v) => setConfig({ flowSpread: v })} />

      <SectionHeader>Texture</SectionHeader>
      <SliderField label="Shimmer" value={config.shimmer} min={0} max={0.3} step={0.01} onChange={(v) => setConfig({ shimmer: v })} />
      <SliderField label="Grain (halftone)" value={config.grain} min={0} max={1} step={0.02} onChange={(v) => setConfig({ grain: v })} />
      <SliderField label="Grain dot size" value={config.grainScale} min={2} max={12} step={0.5} onChange={(v) => setConfig({ grainScale: v })} />

      <SectionHeader>Lighting</SectionHeader>
      <SliderField label="Light angle" value={config.lightAngle} min={0} max={360} step={1} onChange={(v) => setConfig({ lightAngle: v })} />
      <SliderField label="Light strength" value={config.lightStrength} min={0} max={0.6} step={0.01} onChange={(v) => setConfig({ lightStrength: v })} />

      <SectionHeader>Camera</SectionHeader>
      <SliderField label="Zoom" value={config.zoom} min={0.35} max={2.2} step={0.05} onChange={(v) => setConfig({ zoom: v })} />
      <ToggleField label="Auto orbit" value={config.orbit} onChange={(v) => setConfig({ orbit: v })} />
    </div>
  );
}
