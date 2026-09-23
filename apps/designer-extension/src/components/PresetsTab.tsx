import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { PanelHeader } from "./PanelHeader";
import { PresetSearchBar } from "./PresetSearchBar";
import { PresetSearchResults } from "./PresetSearchResults";
import { PresetCard } from "./PresetCard";
import { PresetPreviewModal } from "./PresetPreviewModal";
import { PresetFilterModal, DEFAULT_PRESET_FILTERS, hasActivePresetFilters, type PresetFilters } from "./PresetFilterModal";
import { fetchPublishedPresets, PRESET_COLOR_TAGS, type GalleryPresetDisplay } from "../types/presetGallery";
import { useSelectedElement } from "../hooks/useSelectedElement";
import { applyGradientToElement, canApplyPreset } from "../services/applyGradient";
import { applyGlassLiquidToElement } from "../services/applyGlassLiquid";
import { applyRuidoEvolutivoToElement } from "../services/applyRuidoEvolutivo";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { trackEvent } from "../services/analytics";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// One removable chip for the active-filters row above "Featured" - `swatch`
// (a hex string) only renders for the color filter's own chip. The outer
// row's own gap-2 (8px) separates this whole chip from its siblings and,
// inside a chip, the swatch+label from the close button; a nested gap-1
// (4px) group is what actually sits between the swatch and its own label,
// per explicit direction (the two gaps are deliberately different, not the
// same value applied twice).
function FilterChip({ swatch, children, onRemove }: { swatch?: string; children: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-2 rounded-4 border border-border-border py-1 pl-[6px] pr-2">
      <span className="flex items-center gap-1">
        <span className="font-sans text-mobile-text-md-medium text-text-secondary">{children}</span>
        {swatch && <span className="h-4 w-4 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />}
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${children} filter`} className="shrink-0 text-text-secondary">
        {/* closeChip's viewBox is fixed at 6x6 - bumping width/height alone
            scales the whole glyph (stroke included) proportionally, so this
            stays the same hairline weight relative to its own size, not a
            separate icon variant. */}
        <Icon name="closeChip" width={8} height={8} />
      </button>
    </span>
  );
}

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
  // Dismissed by an outside click on the floating search-results panel
  // (PresetSearchResults) - reset back to false on every keystroke so
  // typing again after a dismiss reopens it, rather than staying closed
  // until the query is cleared entirely.
  const [resultsDismissed, setResultsDismissed] = useState(false);
  const [filters, setFilters] = useState<PresetFilters>(DEFAULT_PRESET_FILTERS);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [allPresets, setAllPresets] = useState<GalleryPresetDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // The preset currently shown in PresetPreviewModal, or null when it's
  // closed - per explicit direction/reference screenshot, selecting a
  // preset now opens a preview (its own real live shader + an "Apply
  // gradient" button) instead of applying it immediately on click.
  const [previewPreset, setPreviewPreset] = useState<GalleryPresetDisplay | null>(null);

  // Every preset kind is clickable here now (see PresetCard.tsx's own
  // comment) - this hook is the same one EditorTab.tsx already polls for
  // its own "Apply gradient" button's gating.
  const { element } = useSelectedElement();

  // The real apply - now only ever called from inside PresetPreviewModal's
  // own "Apply gradient" button, not directly from a card/search-result
  // click (see PresetCard.tsx's own comment on the onSelect rename).
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
      trackEvent("apply_preset", preset.id);
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
  const searchRowRef = useRef<HTMLDivElement>(null);
  const searchResultsOpen = Boolean(query.trim()) && !resultsDismissed;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PanelHeader title="Presets" titleUnderline />

      {/* ref - PresetSearchResults measures this row's own real bottom edge
          (getBoundingClientRect, same technique FullViewModal's own
          useChromeInsets already uses for header/nav) rather than a
          hardcoded top offset, so its floating panel starts exactly where
          this row ends even if this row's own height ever changes. */}
      <div ref={searchRowRef} className="flex shrink-0 items-center gap-2 px-5 py-3 border-b border-border-border">
        <PresetSearchBar
          value={query}
          onChange={(value) => {
            // Fires once per search, on the empty -> non-empty transition -
            // not once per keystroke, which would be noisy and would leak a
            // rough shape of what's being typed (length/timing) for no real
            // benefit over a single "a search happened" event.
            if (!query.trim() && value.trim()) trackEvent("search_presets");
            setQuery(value);
            setResultsDismissed(false);
          }}
        />
        <button
          type="button"
          onClick={() => {
            trackEvent("open_preset_filter_modal");
            setFilterModalOpen(true);
          }}
          aria-label="Filter presets"
          aria-pressed={filtersActive}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-4 border ${
            filtersActive ? "border-accent-500 text-accent-500" : "border-border-border text-text-secondary"
          }`}
        >
          <Icon name="filter" width={16} height={16} />
        </button>

        {/* Floats over Featured/the grid (which stay mounted underneath,
            unchanged) rather than replacing them in place - per explicit
            direction, matching the reference mockup's autocomplete-style
            dropdown. Reuses the same already-filtered `presets` list (query
            + license/colorTag filters together), so whatever's showing here
            is never out of sync with what the grid underneath would show
            once this closes. */}
        {searchResultsOpen && (
          <PresetSearchResults
            query={query.trim()}
            results={presets}
            clickable={canApplyPreset(element)}
            onSelect={setPreviewPreset}
            onDismiss={() => setResultsDismissed(true)}
            anchorRef={searchRowRef}
          />
        )}
      </div>

      {/* pt-4 (16px) from the search/filter row above, pb-3 (12px) down to
          the presets grid below - both real Tailwind scale steps, not
          arbitrary values, per explicit direction.

          pl-5/pr-[14px] + [scrollbar-gutter:stable] - same fix as
          ControlPanel.tsx's own scrolling field list (see that div's own
          comment for the full reasoning): the global custom scrollbar's 6px
          otherwise eats straight into this div's right padding only while
          it's actually showing, making the grid visibly narrower/misaligned
          against the non-scrolling search/filter row above (which has no
          scrollbar and keeps its full symmetric px-5). Reallocating 14px of
          the existing 20px right padding to the gutter - not widening the
          div - keeps total right-side space at a constant 20px either way,
          scrolling or not.

          overflow-hidden while searchResultsOpen - PresetSearchResults
          floats fixed on top of this whole area but doesn't block wheel/
          touch input reaching whatever's underneath it, so without this the
          Featured grid would still visibly scroll behind the (opaque)
          results panel. scrollbar-gutter:stable's own reserved space stays
          either way (it's not tied to overflow-y's value), so nothing
          shifts width when this toggles. */}
      <div
        className={`min-h-0 flex-1 pl-5 pr-[9px] pb-8 [scrollbar-gutter:stable] ${
          searchResultsOpen ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        <div className="flex flex-col gap-3 pb-3 pt-4">
          {filtersActive && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.colorTag && (
                <FilterChip
                  swatch={PRESET_COLOR_TAGS.find((c) => c.tag === filters.colorTag)?.hex}
                  onRemove={() => setFilters((current) => ({ ...current, colorTag: null }))}
                >
                  {capitalize(filters.colorTag)}
                </FilterChip>
              )}
              {filters.license !== "all" && (
                <FilterChip onRemove={() => setFilters((current) => ({ ...current, license: "all" }))}>
                  {filters.license === "pro" ? "Pro" : "Free"}
                </FilterChip>
              )}
              {filters.sort !== "popular" && (
                <FilterChip onRemove={() => setFilters((current) => ({ ...current, sort: "popular" }))}>
                  {capitalize(filters.sort)}
                </FilterChip>
              )}
            </div>
          )}
          <p className="font-sans text-text-sm-medium text-text-black">Featured</p>
        </div>
        {loading ? (
          <p className="pt-8 text-center font-sans text-mobile-text-md-regular text-text-secondary">Loading...</p>
        ) : loadError ? (
          <p className="pt-8 text-center font-sans text-mobile-text-md-regular text-text-secondary">
            Couldn't load presets. Try again later.
          </p>
        ) : presets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} canApply={canApplyPreset(element)} onSelect={setPreviewPreset} />
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
            trackEvent("filter_presets", `${nextFilters.license}|${nextFilters.colorTag ?? "none"}|${nextFilters.sort}`);
            setFilters(nextFilters);
            setFilterModalOpen(false);
          }}
        />
      )}

      {previewPreset && (
        <PresetPreviewModal
          preset={previewPreset}
          onClose={() => setPreviewPreset(null)}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
