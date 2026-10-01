// Static mock-up of the extension colour picker (section 3 card "Color, exact"), using the real shared ColorPicker
// (saturation square + hue bar), SegmentedRow and RangeSlider. Display-only.
import { ColorPicker, Icon, RangeSlider, SegmentedRow } from "@fluxa/ui";

const noop = () => {};

export function ColorPanel() {
  return (
    <div className="relative w-full max-w-[320px] overflow-hidden rounded-16 bg-background-white shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center justify-between bg-background-white-2 px-5 py-3">
        <span className="font-display text-mobile-header-h1 text-text-black">Color</span>
        <Icon name="close" className="h-4 w-4 text-text-secondary" />
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
          <span className="flex flex-1 items-center justify-between rounded-4 border border-border-border px-2 py-1 font-sans text-mobile-text-sm-regular text-text-secondary">
            #89BD56
            <Icon name="copy" className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-mobile-text-md-regular text-text-black">Opacity</span>
          <div className="flex flex-1 items-center justify-between gap-2">
            <RangeSlider min={0} max={100} step={1} value={100} onChange={noop} />
            <span className="rounded-[4px] border border-border-border px-1 font-sans text-mobile-text-sm-regular text-text-secondary">
              100%
            </span>
          </div>
        </div>
        <span className="flex items-center justify-center gap-1 rounded-4 border border-border-border py-2 font-sans text-mobile-text-md-regular text-text-secondary">
          Pick from screen
          <Icon name="chevronRight" className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
