import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import { PanelHeader } from "./PanelHeader";
import { PresetSearchBar } from "./PresetSearchBar";
import { PresetCard } from "./PresetCard";
import { PresetFilterModal, DEFAULT_PRESET_FILTERS, hasActivePresetFilters, type PresetFilters } from "./PresetFilterModal";
import { fetchPublishedPresets, type GalleryPresetDisplay } from "../types/presetGallery";
import { useSelectedElement } from "../hooks/useSelectedElement";
import { applyGradientToElement, canApplyPreset } from "../services/applyGradient";
import { applyGlassLiquidToElement } from "../services/applyGlassLiquid";
import { applyRuidoEvolutivoToElement } from "../services/applyRuidoEvolutivo";
import { getWebflowDesigner } from "../services/webflowDesigner";

// Presets tab - a searchable/filterable gallery of Fluxa's own curated
// presets (built visually by an admin in apps/preset-admin, published via
// its "Publish" toggle - see apps/data-client's galleryPresets table/
// routes/galleryPresets.ts). Real data now, fetched from
// GET /api/gallery-presets/published (only ever returns isPublished: true
// rows) - the search/filter/sort logic below and PresetFilterModal/
// PresetCard didn't need to change from when this ran against mock data,
// only this component's own data-fetching did.
export function PresetsTab() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PresetFilters>(DEFAULT_PRESET_FILTERS);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [allPresets, setAllPresets] = useState<GalleryPresetDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Every preset kind is clickable here now (see PresetCard.tsx's own
  // comment) - this hook is the same one EditorTab.tsx already polls for
  // its own "Apply gradient" button's gating.
  const { element } = useSelectedElement();

  async function handleApply(preset: GalleryPresetDisplay) {
    if (!canApplyPreset(element)) {
      getWebflowDesigner().notify({
        type: "Error",
        message: "This element type doesn't support a background shader.",
      });
      return;
    }
    try {
      if (preset.kind === "glassLiquid") {
        await applyGlassLiquidToElement(element, preset.config);
      } else if (preset.kind === "ruidoEvolutivo") {
        await applyRuidoEvolutivoToElement(element, preset.config);
      } else {
        await applyGradientToElement(element, preset.config);
      }
      getWebflowDesigner().notify({ type: "Success", message: "Preset applied!" });
    } catch (error) {
      getWebflowDesigner().notify({
        type: "Error",
        message: error instanceof Error ? error.message : "Failed to apply the preset.",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchPublishedPresets()
      .then((results) => {
        if (!cancelled) setAllPresets(results);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const presets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = allPresets.filter((preset) => {
      if (normalizedQuery && !preset.name.toLowerCase().includes(normalizedQuery)) return false;
      if (filters.license !== "all" && preset.license !== filters.license) return false;
      if (filters.colorTag && preset.colorTag !== filters.colorTag) return false;
      return true;
    });

    // Both sort options rank by createdAt for now - there's no real
    // popularity signal yet (the backend has no usage/apply-count tracking,
    // deliberately left out of the v1 galleryPresets table since a
    // popularity field with nothing real behind it would be misleading).
    // "Popular" stays in the UI rather than being removed, since it's a
    // real, intended sort mode once that tracking exists - swap this
    // comparator for a real one then, no other change needed.
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [query, filters, allPresets]);

  const filtersActive = hasActivePresetFilters(filters);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PanelHeader title="Presets" titleUnderline />

      <div className="flex shrink-0 items-center gap-2 px-5 pt-3">
        <PresetSearchBar value={query} onChange={setQuery} />
        <button
          type="button"
          onClick={() => setFilterModalOpen(true)}
          aria-label="Filter presets"
          aria-pressed={filtersActive}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-4 border ${
            filtersActive ? "border-accent-500 text-accent-500" : "border-border-border text-text-secondary"
          }`}
        >
          <Icon name="filter" width={16} height={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
        {loading ? (
          <p className="pt-8 text-center font-sans text-mobile-text-md-regular text-text-secondary">Loading...</p>
        ) : loadError ? (
          <p className="pt-8 text-center font-sans text-mobile-text-md-regular text-text-secondary">
            Couldn't load presets. Try again later.
          </p>
        ) : presets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} canApply={canApplyPreset(element)} onApply={handleApply} />
            ))}
          </div>
        ) : (
          <p className="pt-8 text-center font-sans text-mobile-text-md-regular text-text-secondary">
            No presets found.
          </p>
        )}
      </div>

      {filterModalOpen && (
        <PresetFilterModal
          filters={filters}
          onClose={() => setFilterModalOpen(false)}
          onApply={(nextFilters) => {
            setFilters(nextFilters);
            setFilterModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
