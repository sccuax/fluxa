import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { FullViewModal } from "./FullViewModal";
import { SegmentedRow } from "./SegmentedRow";
import {
  ColorPicker,
  clamp,
  hexToHslString,
  hexToRgbString,
  parseHex,
  parseHslString,
  parseRgbString,
} from "./ColorPicker";

// The full colour picker modal - a Hex/RGB/HSL format toggle, ColorPicker's
// saturation square + vertical hue bar, a format-aware copyable value field,
// an always-visible opacity slider + percent input, and an OS-level
// eyedropper button. Lifted out of ControlPanel.tsx once glassLiquid and
// ruidoEvolutivo also needed the exact same picker for their own colour
// selectors (per explicit direction - "cualquier selector de color... debe
// abrir el modal"). ControlPanel.tsx re-imports ColorSwatchPicker + the
// generic EditableValue from here; the shaderGradient-store coupling that
// used to be baked in (setColorModalOpen) is now the optional `onOpenChange`
// prop - only ControlPanel passes it (its ShaderGradientCanvas can't be
// paused from outside, so EditorTab unmounts it while the modal is open;
// GlassLiquidCanvas/RuidoEvolutivoCanvas own a cancelable rAF loop and don't
// need it).

// Generic draft/commit/cancel text input - `format` turns the real value
// into the text shown at rest, `parse` turns typed text back into a real
// value (returning null rejects the edit). Used here by the value/opacity
// fields, and re-exported for ControlPanel's own EditableNumberValue /
// HexColorInput.
export function EditableValue<T>({ value, format, parse, onCommit, className }: {
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

type ColorFormat = "hex" | "rgb" | "hsl";

const FORMAT_OPTIONS: Array<{ label: string; value: ColorFormat }> = [
  { label: "Hex", value: "hex" },
  { label: "RGB", value: "rgb" },
  { label: "HSL", value: "hsl" },
];

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

// Label ("Hex"/"RGB"/"HSL") above a format-aware EditableValue input with a
// copy button inside its own bordered box. The stored value is always hex
// underneath - switching format only changes how it's displayed/typed/copied.
function ColorValueField({ format, value, onChange }: {
  format: ColorFormat;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-row items-center my-5 justify-between gap-1">
      <span className="font-sans text-mobile-text-md-medium text-text-black">{FORMAT_LABEL[format]}</span>
      <div className="relative w-full flex items-center rounded-4 border border-border-border max-[480px]:max-w-[194px]">
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

const OPACITY_INPUT_CLASSNAME = (focused: boolean) =>
  `flex max-w-[48px] size-fit items-center justify-center rounded-[4px] border border-border-border px-2 py-1 text-center font-sans text-mobile-text-md-regular appearance-none focus:outline-none ${
    focused ? "text-text-color-accent" : "text-text-secondary"
  }`;

const OPACITY_THUMB_SIZE = 12;

// Insets the 0%/100% extremes by half the thumb's own size so its center
// lands exactly on the track's outer edge.
function insetOpacityPercent(fraction: number): string {
  return `calc(${OPACITY_THUMB_SIZE / 2}px + (100% - ${OPACITY_THUMB_SIZE}px) * ${fraction})`;
}

// Bowtie triangle tiling behind the alpha gradient - repeated via
// background-repeat: repeat-x.
const TRIANGLE_PATTERN_URL = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="6" viewBox="0 0 16 6"><polygon points="0,0 0,6 8,3" fill="#D9D3C6"/><polygon points="16,0 16,6 8,3" fill="#D9D3C6"/></svg>',
)}")`;

// The slider's thumb - the stroke itself is the brand 5-stop gradient, so it
// stays real SVG. useId() namespaces the <linearGradient> id per instance.
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

// The always-visible alpha scale for the colour currently open - a
// horizontal 6px bar showing every opacity level at once, triangle tiling
// behind a transparent -> opaque-`color` gradient. Same "latest ref" +
// rAF-coalescing drag pattern as ColorPicker.tsx (avoids drag lag from the
// onChange cascade into the store + canvas re-render).
function OpacitySlider({ color, value, onChange }: {
  color: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const rafRef = useRef<number | null>(null);
  const pendingValueRef = useRef<number | null>(null);

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

function OpacityField({ color, opacity, onOpacityChange }: {
  color: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-row items-center mb-5 justify-between gap-3">
      <span className="font-sans text-mobile-text-md-medium text-text-black">Opacity</span>
      <div className="flex items-center gap-2 w-full max-[480px]:max-w-[194px]">
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

// Real OS/browser-level color sampling (window.EyeDropper) - samples the
// actual composited screen pixels, so it works across iframe/origin
// boundaries (Webflow's own Designer canvas included). Chromium-only;
// unsupported browsers get a disabled button with a Tooltip. Feature-
// detected once at module load.
const EYEDROPPER_SUPPORTED = typeof window !== "undefined" && !!window.EyeDropper;

function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
  async function handleClick() {
    if (!window.EyeDropper) return;
    try {
      const result = await new window.EyeDropper().open();
      onPick(result.sRGBHex);
    } catch {
      // AbortError - user pressed Escape / clicked away to cancel. Not a failure.
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

// The swatch preview shows the colour AT its opacity, over a checkerboard,
// so the modal's opacity slider has visible feedback (a plain `background:
// <hex>` swatch ignored opacity entirely). `linear-gradient(rgba, rgba)` is
// the flat fill layer; the checker shows through wherever alpha < 1.
function hexToRgba(hex: string, opacityPct: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacityPct)) / 100})`;
}

function swatchStyle(value: string, opacity: number): CSSProperties {
  const fill = hexToRgba(value, opacity);
  return {
    backgroundImage: `linear-gradient(${fill}, ${fill}), repeating-conic-gradient(#c9c9c9 0 25%, #ffffff 0 50%)`,
    backgroundSize: "100% 100%, 8px 8px",
  };
}

// Swatch button -> opens ColorPicker's saturation square + vertical hue bar
// inside a FullViewModal, with an EyeDropperButton, a Hex/RGB/HSL format
// toggle above the picker, a value field below it, and an Opacity field
// (slider + percent input) below that. `onOpenChange` is optional - see the
// file header on why only ControlPanel passes it.
export function ColorSwatchPicker({
  value,
  onChange,
  label,
  opacity,
  onOpacityChange,
  onOpenChange,
  className = "h-6 w-[132px] shrink-0 rounded-[4px]",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>("hex");

  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className={className}
        style={swatchStyle(value, opacity)}
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
