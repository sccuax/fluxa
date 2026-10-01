// Static mock-up of the Designer Extension editor panel for the marketing site (section 3 cards). It is built from the
// SAME components the real panel uses (packages/ui: PanelTabs, SegmentedRow, RangeSlider) with the same Tailwind
// tokens, so it cannot drift from the product. Rendered as plain HTML (no client directive): the controls are
// display-only here.
//
// Scale: the design shows the panel ~1.594x larger than the extension (labels, button text and input values are 19px /
// 25.5px line-height / medium, i.e. the app's 12px / 16px). The controls are rendered at the app's real size and scaled
// with CSS `zoom`, so every size, padding and radius follows the app exactly instead of being re-measured by hand.
import type { ReactNode } from "react";
import { PanelTabs, RangeSlider, SegmentedRow } from "@fluxa/ui";

const noop = () => {};
const ZOOM = 1.59375; // 19px / 12px, 25.5px / 16px

const TABS = [
  { tab: "shape", label: "Shape" },
  { tab: "colors", label: "Colors" },
  { tab: "motion", label: "Motion" },
  { tab: "camera", label: "Camera" },
] as const;
type TabId = (typeof TABS)[number]["tab"];

const TYPES = [
  { label: "Plane", value: "plane" },
  { label: "Sphere", value: "sphere" },
  { label: "Liquid", value: "liquid" },
];

// Same box as the app's Orbit pill (ControlPanel ORBIT_PILL_CLASSNAME): a 4px-radius button, not a pill.
const PILL_BOX =
  "flex min-w-[61px] items-center justify-center rounded-[4px] border px-2 py-1 font-sans text-mobile-text-md-medium shadow-[-1px_4px_3px_0_rgba(133,129,121,0.05),-1px_2px_2px_0_rgba(133,129,121,0.09),0_0_1px_0_rgba(133,129,121,0.10)]";

function Label({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1 font-sans text-mobile-header-h2 text-text-black">
      {children}
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 text-text-secondary"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 7.2v4M8 4.9v.1" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** One "label + slider + value" row, like the extension's NumberFieldRow. */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  shown,
  active,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  /** Show the slider in its hover/focus look (gradient fill) and highlight the value, like while it is dragged. */
  active?: boolean;
}) {
  return (
    <div className="flex w-full flex-row items-center justify-between">
      <Label>{label}</Label>
      <div className="flex w-full max-w-[203px] items-center justify-between">
        <RangeSlider min={min} max={max} step={step} value={value} onChange={noop} forceActive={active} />
        <span
          className={`flex max-w-[32px] shrink-0 items-center rounded-[4px] bg-transparent text-center font-sans text-mobile-text-md-medium ${
            active ? "border border-border-border px-[2px] text-accent-500" : "px-0 text-text-secondary"
          }`}
        >
          {shown}
        </span>
      </div>
    </div>
  );
}

interface ShapePanelProps {
  /** CSS `background` of the live-preview area; only used when no image is passed as `children`. */
  preview: string;
  /** The live-preview image (an Astro <Picture> passed as the child). Replaces the `preview` gradient. */
  children?: ReactNode;
  /** Max width of the panel in px (each card has its own, from the design). */
  maxWidth?: number;
  /** Which tab is highlighted; ignored when `showTabs` is false. */
  tab?: TabId;
  showTabs?: boolean;
  /** "shape" = Type + Distortion rows; "camera" = Orbit + Zoom rows. */
  rows?: "shape" | "camera";
  /** Preview height as a CSS aspect ratio (gradient fallback only). */
  aspect?: string;
  /** The panel continues past the bottom of its card (cropped, flush, no bottom radius). */
  cropBottom?: boolean;
}

export function ShapePanel({
  preview,
  children,
  maxWidth,
  tab = "shape",
  showTabs = true,
  rows = "shape",
  aspect = "16 / 9",
  cropBottom = false,
}: ShapePanelProps) {
  return (
    <div
      className={`panel-mock w-full overflow-hidden bg-background-white shadow-2xl ring-1 ring-black/5 ${
        cropBottom ? "rounded-t-16 rounded-b-none" : "rounded-16"
      }`}
      style={{ maxWidth }}
    >
      {children ? (
        <div className="[&_img]:block [&_img]:h-auto [&_img]:w-full">{children}</div>
      ) : (
        <div style={{ background: preview, aspectRatio: aspect }} />
      )}
      <div style={{ zoom: ZOOM }}>
        {showTabs && <PanelTabs tabs={[...TABS]} active={tab} />}
        <div className="flex flex-col gap-4 bg-background-white px-5 py-4">
          {rows === "shape" ? (
            <>
              <SegmentedRow label="Type" options={TYPES} value="plane" onChange={noop} />
              <SliderRow label="Distortion" min={0} max={10} step={0.1} value={3.4} shown="3,4" active={!showTabs} />
            </>
          ) : (
            <>
              <div className="flex w-full items-center justify-end gap-[8px]">
                <Label>Orbit</Label>
                <div className="ml-auto flex w-full max-w-[203px] items-center gap-[8px]">
                  <span className={`${PILL_BOX} w-full border-border-border text-accent-500`}>180°</span>
                  <span className={`${PILL_BOX} w-full border-border-border text-text-secondary`}>90°</span>
                </div>
              </div>
              <SliderRow label="Zoom" min={0} max={10} step={0.1} value={3.4} shown="3,4" active />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
