import { useEffect, useRef, useState } from "react";

interface Hsv {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Standard hex <-> HSV conversion. react-colorful (previously used here) did
// this internally but never exported it, and - more importantly - its own
// bundled hue slider only ever reads the mouse's horizontal screen position
// (confirmed by reading its actual source, not guessed): it computes
// `left = (event.pageX - rect.left) / rect.width` from a live
// getBoundingClientRect() every drag frame, so rotating it with CSS just
// changes what rect.width/height report - it can never redirect a vertical
// drag into that calculation. There's also no lower-level Saturation/Hue
// export to compose a custom vertical bar around. So this whole picker is
// hand-rolled instead, the same way LiquidGradientBackground/RangeSlider
// already hand-roll their own interactions in this codebase - see the user
// decision recorded in chat for why react-colorful was dropped rather than
// CSS-hacked.
function hexToHsv(hex: string): Hsv {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Hex/RGB/HSL string conversions, for the modal's format toggle ---
// (ColorSwatchPicker/ControlPanel.tsx) - separate from the hex<->HSV
// conversions above, which exist purely to drive the picker's own thumb
// positions, not to render/parse the RGB or HSL *strings* a user types.

export function parseHex(raw: string): string | null {
  const trimmed = raw.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hexToRgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

export function hexToHslString(hex: string): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

// Both parsers just pull the first 3 numbers out of the string rather than
// requiring the exact "rgb(r, g, b)"/"hsl(h, s%, l%)" shape - accepts
// "255, 80, 5" or a pasted "rgb(255, 80, 5)" equally, same permissiveness
// as a real color-picker input, not a strict-format validator.
export function parseRgbString(raw: string): string | null {
  const numbers = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 3) return null;
  const [r, g, b] = numbers.slice(0, 3).map(Number);
  return rgbToHex({ r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) });
}

export function parseHslString(raw: string): string | null {
  const numbers = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 3) return null;
  const [h, s, l] = numbers.slice(0, 3).map(Number);
  return rgbToHex(
    hslToRgb({ h: ((h % 360) + 360) % 360, s: clamp(s / 100, 0, 1), l: clamp(l / 100, 0, 1) }),
  );
}

const THUMB_SIZE = 12;
const THUMB_RADIUS = THUMB_SIZE / 2;

// Insets a 0-1 fraction so a THUMB_SIZE thumb, centered via
// -translate-1/2, never crosses its track's own edge at the 0%/100%
// extremes - the exact same bleed bug already found and fixed once on
// GradientColorsBar's ring markers, generalized here as a CSS `calc()`
// string. Uses "100%" rather than a hardcoded track size so it stays correct
// regardless of the track's actual rendered pixel size (the saturation
// square's width is whatever's left in its flex row, not a fixed number).
function insetPercent(fraction: number): string {
  return `calc(${THUMB_RADIUS}px + (100% - ${THUMB_SIZE}px) * ${fraction})`;
}

const THUMB_CLASSNAME =
  "pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border-border bg-background-white";

// Saturation square (left, fills remaining row width) + a real vertical hue
// bar (right, 23px) - a row with an 8px gap, both capped at 216px tall, per
// explicit design spec.
export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"saturation" | "hue" | null>(null);

  // Re-derive from `value` only when it changed for a reason other than our
  // own onChange below (e.g. the row's hex text input was edited directly) -
  // comparing against what our own hsv would currently produce avoids
  // fighting an in-progress drag with a redundant (and possibly
  // rounded-slightly-differently) hex round-trip on every single move event.
  useEffect(() => {
    if (hsvToHex(hsv).toLowerCase() !== value.toLowerCase()) {
      setHsv(hexToHsv(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      if (draggingRef.current === "saturation" && saturationRef.current) {
        const rect = saturationRef.current.getBoundingClientRect();
        const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
        setHsv((current) => {
          const next = { ...current, s, v };
          onChange(hsvToHex(next));
          return next;
        });
      } else if (draggingRef.current === "hue" && hueRef.current) {
        const rect = hueRef.current.getBoundingClientRect();
        const h = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 360;
        setHsv((current) => {
          const next = { ...current, h };
          onChange(hsvToHex(next));
          return next;
        });
      }
    }
    function handleUp() {
      draggingRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [onChange]);

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div className="flex w-full select-none gap-[8px]">
      <div
        ref={saturationRef}
        onPointerDown={(event) => {
          draggingRef.current = "saturation";
          const rect = event.currentTarget.getBoundingClientRect();
          const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
          const v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
          const next = { ...hsv, s, v };
          setHsv(next);
          onChange(hsvToHex(next));
        }}
        className="relative h-[216px] max-h-[216px] w-full shrink-0 touch-none rounded-[4px] cursor-crosshair"
        style={{
          backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
          backgroundColor: hueColor,
        }}
      >
        <div
          className={THUMB_CLASSNAME}
          style={{ left: insetPercent(hsv.s), top: insetPercent(1 - hsv.v) }}
        />
      </div>

      <div
        ref={hueRef}
        onPointerDown={(event) => {
          draggingRef.current = "hue";
          const rect = event.currentTarget.getBoundingClientRect();
          const h = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 360;
          const next = { ...hsv, h };
          setHsv(next);
          onChange(hsvToHex(next));
        }}
        className="relative h-[216px] max-h-[216px] w-[23px] shrink-0 touch-none rounded-[4px] cursor-pointer"
        style={{ background: "linear-gradient(180deg, red, #ff0, #0f0, #0ff, #00f, #f0f, red)" }}
      >
        <div className={THUMB_CLASSNAME} style={{ left: "50%", top: insetPercent(hsv.h / 360) }} />
      </div>
    </div>
  );
}
