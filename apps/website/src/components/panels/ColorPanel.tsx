// Static mock-up of the extension colour picker (section 3 card "Color, exact"), using the real shared ColorPicker
// (saturation square + hue bar), SegmentedRow and the extension's icons. Display-only. Rendered at the picker's natural
// 320px and scaled with CSS `zoom` (the card shows it 238px wide: zoom 0.74375), like ShapePanel does for its panels.
import { ColorPicker, Icon, SegmentedRow } from "@fluxa/ui";

const noop = () => {};
const ZOOM = 0.74375; // 238px / 320px

/** Opacity track: the picked colour fading in over a transparency checker, and a ring thumb with a rainbow edge. */
function OpacitySlider() {
  return (
    <div className="relative flex h-4 flex-1 items-center">
      <div
        className="h-[7px] w-full rounded-full"
        style={{
          background:
            "linear-gradient(90deg, rgb(205 246 122 / 0), #cdf67a), conic-gradient(#fff 25%, #eceef2 0 50%, #fff 0 75%, #eceef2 0) 0 0 / 7px 7px",
        }}
      />
      <span
        className="absolute right-0 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full p-[2px]"
        style={{ background: "conic-gradient(from 200deg, #2d6bff, #d44cf0, #ff5a9a, #ffb84d, #2d6bff)" }}
      >
        <span className="block h-full w-full rounded-full bg-background-white" />
      </span>
    </div>
  );
}

export function ColorPanel({ className = "", zoom = ZOOM }: { className?: string; zoom?: number }) {
  return (
    <div
      className={`relative w-[320px] overflow-hidden rounded-16 bg-background-white shadow-2xl ring-1 ring-black/5 ${className}`}
      style={{ zoom }}
    >
      <div className="flex items-center justify-between border-b border-border-border bg-background-white-2 px-5 py-4">
        <span className="font-display text-mobile-header-h1 text-text-black">Color</span>
        <Icon name="close" className="h-4 w-4 text-text-black" />
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <SegmentedRow
          options={[
            { label: "HEX", value: "hex" },
            { label: "RGB", value: "rgb" },
            { label: "HSL", value: "hsl" },
          ]}
          value="hex"
          onChange={noop}
          className="max-w-none"
        />
        <ColorPicker value="#89bd56" onChange={noop} />
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-mobile-text-md-regular text-text-black">Hex</span>
          <span className="flex flex-1 items-center justify-between rounded-8 border border-border-border px-3 py-[6px] font-sans text-mobile-text-md-regular text-text-black">
            #89BD56
            <Icon name="copy" className="h-4 w-4 text-text-secondary" />
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-mobile-text-md-regular text-text-black">Opacity</span>
          <div className="flex flex-1 items-center justify-between gap-2">
            <OpacitySlider />
            <span className="rounded-8 border border-border-border px-3 py-[6px] font-sans text-mobile-text-md-regular text-text-secondary">
              100%
            </span>
          </div>
        </div>
        <span className="flex items-center justify-center gap-2 rounded-full border border-border-border py-[10px] font-sans text-mobile-text-md-regular text-text-secondary">
          Pick from screen
          <Icon name="chevronRight" className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

// The eyedropper's magnifier: a round window onto the screen's pixels (a 7x7 grid of rounded cells, light lime at the
// bottom left to deep green at the top right) with a white rounded-square marking the pixel being picked.
const LIGHT = [220, 245, 110];
const DARK = [24, 74, 18];
const mix = (k: number) => LIGHT.map((c, i) => Math.round(c + (DARK[i] - c) * k));

export function EyedropperLoupe({ className = "" }: { className?: string }) {
  const N = 7;
  const cell = 100 / N;
  const cells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = Math.min(1, Math.max(0, 0.7 * (c / (N - 1)) + 0.4 * (1 - r / (N - 1)) - 0.12));
      const [R, G, B] = mix(k);
      cells.push(<rect key={`${r}-${c}`} x={c * cell + 0.5} y={r * cell + 0.5} width={cell - 1} height={cell - 1} rx="2" fill={`rgb(${R} ${G} ${B})`} />);
    }
  }
  return (
    <svg viewBox="0 0 100 100" className={`rounded-full bg-white shadow-xl ring-1 ring-white ${className}`} aria-hidden="true">
      <defs>
        <clipPath id="loupe-clip">
          <circle cx="50" cy="50" r="49" />
        </clipPath>
      </defs>
      <g clipPath="url(#loupe-clip)">{cells}</g>
      <rect x={3 * cell + 1.5} y={3 * cell + 1.5} width={cell - 3} height={cell - 3} rx="5" fill="#8fc055" stroke="#fff" strokeWidth="4" />
    </svg>
  );
}
