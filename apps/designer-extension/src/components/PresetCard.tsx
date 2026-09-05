import type { GalleryPresetDisplay } from "../types/presetGallery";

// A grid item - clickable ONLY for a `glassLiquid` preset with a valid
// current selection (`canApply`, passed down from PresetsTab.tsx, which
// owns the actual selected-element polling). `shaderGradient` cards stay
// exactly as inert as they always were - applying THAT kind from the
// gallery is out of scope for now (it's only ever set from EditorTab's own
// live-editing "Apply gradient" button); wiring both kinds through this
// same card is a natural follow-up once that's wanted, not a limitation of
// this component's own shape.
// Prefers `thumbnailUrl` (a real admin-captured screenshot of the live
// shader, see presetGallery.ts's own comment) when the preset has one;
// falls back to a `previewColors`-derived linear-gradient approximation
// for presets nobody's captured a thumbnail for yet.
export function PresetCard({
  preset,
  canApply,
  onApply,
}: {
  preset: GalleryPresetDisplay;
  canApply: boolean;
  onApply: (preset: GalleryPresetDisplay) => void;
}) {
  const [color1, color2, color3] = preset.previewColors;
  const clickable = preset.kind === "glassLiquid" && canApply;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onApply(preset) : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onApply(preset);
              }
            }
          : undefined
      }
      className={`flex flex-col gap-2 rounded-4 border border-border-border p-2 ${
        clickable ? "cursor-pointer hover:border-accent-500" : ""
      }`}
    >
      {preset.thumbnailUrl ? (
        <img
          src={preset.thumbnailUrl}
          alt=""
          className="h-16 w-full shrink-0 rounded-[4px] object-cover"
        />
      ) : (
        <div
          className="h-16 w-full shrink-0 rounded-[4px]"
          style={{ backgroundImage: `linear-gradient(135deg, ${color1}, ${color2}, ${color3})` }}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-sans text-mobile-text-sm-medium text-text-black">{preset.name}</span>
        <span
          className={`shrink-0 rounded-[4px] px-1.5 py-0.5 font-sans text-mobile-text-sm-regular ${
            preset.license === "pro" ? "bg-accent-50 text-accent-500" : "bg-background-white-2 text-text-secondary"
          }`}
        >
          {preset.license === "pro" ? "Pro" : "Free"}
        </span>
      </div>
    </div>
  );
}
