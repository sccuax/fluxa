import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RangeSlider } from "./RangeSlider";
import { ColorPicker } from "./ColorPicker";
import { SegmentedRow } from "./SegmentedRow";
import { formatSliderValue } from "../helpers/format";
import { useGlassLiquidStore } from "../store/glassLiquidStore";

// The "glassLiquid" gallery preset kind's control panel - extracted from
// sandbox/src/experiments/ShaderGlassExperiment.tsx (see GlassLiquidCanvas.tsx's
// own header comment for the full extraction rationale). Unlike
// ControlPanel.tsx's own tabbed Shape/Colors/Motion/Camera layout, this
// stays one flat scrollable panel with the sandbox file's own section
// groupings (Trail/Glass/Edge line/Toggles/Colors) - the field count doesn't
// need a tab taxonomy.

const SWATCH_POPUP_WIDTH = 280;
const SWATCH_POPUP_GAP = 8;
const SWATCH_POPUP_VIEWPORT_MARGIN = 8;

// Swatch button + popover, opening ColorPicker.tsx's saturation/hue picker
// directly - a lighter version of this same file's own ColorSwatchPicker
// (which pulls in a FullViewModal + a different Zustand store + opacity/
// format fields that don't apply to this shader's own colors, which have no
// opacity concept). Rendered via a portal into document.body with
// position: fixed (computed from the button's own getBoundingClientRect)
// so it can never get clipped by a scrolling/overflow-hidden ancestor -
// this panel is itself a scrollable box (apps/preset-admin renders it at a
// fixed height), which a plain CSS-anchored `absolute` popup would clip.
function ColorSwatchControl({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - SWATCH_POPUP_WIDTH - SWATCH_POPUP_VIEWPORT_MARGIN);
    const estimatedHeight = 216 + 24; // ColorPicker's own fixed height + this popup's padding
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
    <div className="flex flex-col gap-1">
      <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="h-6 w-16 rounded-[4px] border border-border-border"
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
      <SliderField label="Highlight strength" value={config.highlightStrength} min={0} max={1} step={0.05} onChange={(v) => setConfig({ highlightStrength: v })} />
      <SliderField label="Grain strength" value={config.grainStrength} min={0} max={0.3} step={0.01} onChange={(v) => setConfig({ grainStrength: v })} />

      <SectionHeader>Edge line</SectionHeader>
      <SliderField label="Edge strength" value={config.edgeStrength} min={0} max={2} step={0.05} onChange={(v) => setConfig({ edgeStrength: v })} />
      <SliderField label="Edge width (px)" value={config.edgeWidth} min={0.2} max={4} step={0.1} onChange={(v) => setConfig({ edgeWidth: v })} />
      <SliderField label="Edge trail mod" value={config.edgeTrailMod} min={0} max={1} step={0.05} onChange={(v) => setConfig({ edgeTrailMod: v })} />

      <SectionHeader>Toggles</SectionHeader>
      <ToggleField label="Sampling" value={config.confine} onChange={(v) => setConfig({ confine: v })} onLabel="Confined" offLabel="Continuous" />
      <ToggleField label="Seam scroll" value={config.seamScroll} onChange={(v) => setConfig({ seamScroll: v })} />
      <ToggleField label="Seam wobble" value={config.seamWobble} onChange={(v) => setConfig({ seamWobble: v })} />
      <ToggleField label="Edge AA" value={config.edgeAA} onChange={(v) => setConfig({ edgeAA: v })} />
      <ToggleField label="Grain on edge" value={config.grainOnEdge} onChange={(v) => setConfig({ grainOnEdge: v })} />
      <ToggleField label="Isolate lines" value={config.isolateLines} onChange={(v) => setConfig({ isolateLines: v })} />

      <SectionHeader>Colors</SectionHeader>
      <div className="flex flex-wrap gap-4">
        <ColorSwatchControl label="Trail color 1" value={config.glowColor1} onChange={(v) => setConfig({ glowColor1: v })} />
        <ColorSwatchControl label="Trail color 2" value={config.glowColor2} onChange={(v) => setConfig({ glowColor2: v })} />
        <ColorSwatchControl label="Highlight" value={config.highlightColor} onChange={(v) => setConfig({ highlightColor: v })} />
        <ColorSwatchControl label="Glow" value={config.glowColor} onChange={(v) => setConfig({ glowColor: v })} />
        <ColorSwatchControl label="Edge color" value={config.edgeColor} onChange={(v) => setConfig({ edgeColor: v })} />
        <ColorSwatchControl label="Background" value={config.baseColor} onChange={(v) => setConfig({ baseColor: v })} />
      </div>
    </div>
  );
}
