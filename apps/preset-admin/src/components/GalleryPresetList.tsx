import type { GalleryPreset } from "@fluxa/gradient-core";

const KIND_LABEL: Record<GalleryPreset["kind"], string> = {
  shaderGradient: "Gradient",
  glassLiquid: "Glass",
  ruidoEvolutivo: "Ruido Evolutivo",
};

// Plain list, not a grid with real preview swatches (unlike the Designer
// Extension's own PresetCard, which this deliberately doesn't reuse - that
// component lives under designer-extension's mock-data-only PresetsTab, a
// different concern from this admin tool's own CRUD list) - kept simple on
// purpose, since the only thing an admin needs from this list is "what
// exists, is it published, can I load/toggle/delete it."
export function GalleryPresetList({
  presets,
  loading,
  onLoad,
  onTogglePublish,
  onDelete,
}: {
  presets: GalleryPreset[];
  loading: boolean;
  onLoad: (preset: GalleryPreset) => void;
  onTogglePublish: (preset: GalleryPreset) => void;
  onDelete: (preset: GalleryPreset) => void;
}) {
  if (loading) {
    return <p className="font-sans text-mobile-text-md-regular text-text-secondary">Loading...</p>;
  }

  if (presets.length === 0) {
    return <p className="font-sans text-mobile-text-md-regular text-text-secondary">No presets yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {presets.map((preset) => (
        <div
          key={preset.id}
          className="flex items-center gap-3 rounded-4 border border-border-border px-3 py-2"
        >
          {preset.thumbnailUrl ? (
            <img src={preset.thumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded-[4px] object-cover" />
          ) : (
            <div
              className="h-8 w-8 shrink-0 rounded-[4px]"
              style={{
                // glassLiquid has no color1/2/3 at all - glowColor1/glowColor2/
                // baseColor is that shader's own closest 3-stop approximation
                // (its two trail hues + the glass background). ruidoEvolutivo
                // stores a 2..5-entry `colors` array; show all of them.
                backgroundImage:
                  preset.kind === "glassLiquid"
                    ? `linear-gradient(135deg, ${preset.config.glowColor1}, ${preset.config.glowColor2}, ${preset.config.baseColor})`
                    : preset.kind === "ruidoEvolutivo"
                      ? `linear-gradient(135deg, ${preset.config.colors.join(", ")})`
                      : `linear-gradient(135deg, ${preset.config.color1}, ${preset.config.color2}, ${preset.config.color3})`,
              }}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-sans text-mobile-text-md-medium text-text-black">{preset.name}</span>
            <span className="font-sans text-mobile-text-sm-regular text-text-secondary">
              {preset.license} · {preset.isPublished ? "Published" : "Draft"} ·{" "}
              {KIND_LABEL[preset.kind]}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onLoad(preset)}
            className="shrink-0 rounded-[4px] border border-border-border px-2 py-1 font-sans text-mobile-text-sm-regular text-text-black"
          >
            Load
          </button>
          <button
            type="button"
            onClick={() => onTogglePublish(preset)}
            className="shrink-0 rounded-[4px] border border-border-border px-2 py-1 font-sans text-mobile-text-sm-regular text-text-black"
          >
            {preset.isPublished ? "Unpublish" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(preset)}
            className="shrink-0 rounded-[4px] border border-border-border px-2 py-1 font-sans text-mobile-text-sm-regular text-red-600"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
