import { useState } from "react";
import { FullViewModal } from "./FullViewModal";
import { SegmentedRow } from "./SegmentedRow";
import { ButtonPrimary } from "./ButtonPrimary";
import { PRESET_COLOR_TAGS, type PresetColorTag, type PresetLicense, type PresetSort } from "../types/presetGallery";

export interface PresetFilters {
  license: PresetLicense | "all";
  sort: PresetSort;
  colorTag: PresetColorTag | null;
}

export const DEFAULT_PRESET_FILTERS: PresetFilters = { license: "all", sort: "popular", colorTag: null };

export function hasActivePresetFilters(filters: PresetFilters): boolean {
  return filters.license !== "all" || filters.sort !== "popular" || filters.colorTag !== null;
}

const LICENSE_OPTIONS: Array<{ label: string; value: PresetLicense | "all" }> = [
  { label: "All", value: "all" },
  { label: "Free", value: "free" },
  { label: "Pro", value: "pro" },
];

const SORT_OPTIONS: Array<{ label: string; value: PresetSort }> = [
  { label: "Popular", value: "popular" },
  { label: "Recent", value: "recent" },
];

// Reuses the same FullViewModal shell as the Editor tab's color picker
// (ControlPanel.tsx) - per explicit direction to give this the identical
// popup treatment. Holds its own draft copy of `filters`, only committed to
// the parent (PresetsTab) via `onApply` - closing through the header's own
// X (FullViewModal's built-in onClose) discards any in-progress change
// instead of live-applying it, the standard "modal with an Apply button"
// behavior implied by having an Apply button at all.
export function PresetFilterModal({
  filters,
  onApply,
  onClose,
}: {
  filters: PresetFilters;
  onApply: (filters: PresetFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);

  return (
    <FullViewModal title="Filter" onClose={onClose}>
      <div className="flex h-full flex-col justify-between px-5 py-4">
        <div className="flex flex-col gap-4">
          <SegmentedRow
            label="License"
            options={LICENSE_OPTIONS}
            value={draft.license}
            onChange={(license) => setDraft((current) => ({ ...current, license }))}
          />
          <SegmentedRow
            label="Sort by"
            options={SORT_OPTIONS}
            value={draft.sort}
            onChange={(sort) => setDraft((current) => ({ ...current, sort }))}
          />

          <div className="flex w-full items-center gap-[8px]">
            <p className="mr-auto font-sans text-mobile-header-h2 text-text-black">By color</p>
            <div className="flex items-center gap-2">
              {PRESET_COLOR_TAGS.map(({ tag, hex }) => {
                const isActive = draft.colorTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-label={`Filter by ${tag}`}
                    aria-pressed={isActive}
                    // Clicking the already-active swatch clears the color
                    // filter back to "any color" - a toggle, not a
                    // permanently-sticky single-select, since there's no
                    // separate "All" swatch to click back to (unlike
                    // License/Sort, which both have a real "All"/default
                    // option of their own).
                    onClick={() => setDraft((current) => ({ ...current, colorTag: current.colorTag === tag ? null : tag }))}
                    className={`size-5 shrink-0 rounded-[4px] border ${
                      isActive ? "border-text-black ring-2 ring-accent-500 ring-offset-1" : "border-border-border"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <ButtonPrimary className="mt-6" onClick={() => onApply(draft)}>
          Apply
        </ButtonPrimary>
      </div>
    </FullViewModal>
  );
}
