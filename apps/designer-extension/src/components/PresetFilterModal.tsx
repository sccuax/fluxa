import { useId, useState } from "react";
import { FullViewModal } from "./FullViewModal";
import { ButtonPrimary } from "./ButtonPrimary";
import { Icon } from "./Icon";
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

const LICENSE_OPTIONS: Array<{ label: string; value: PresetLicense }> = [
  { label: "Free", value: "free" },
  { label: "Pro", value: "pro" },
];

const SORT_OPTIONS: Array<{ label: string; value: PresetSort }> = [
  { label: "Popular", value: "popular" },
  { label: "Recent", value: "recent" },
];

// A real <input type="radio"> group, per explicit direction - License/Sort
// by must be genuine radio inputs, not SegmentedRow's own pill <button>s
// (which stay unchanged everywhere else they're used). The native input
// carries the actual interaction/keyboard/a11y semantics; it's visually
// hidden (sr-only, not display:none, so it stays tabbable, and taken out of
// flow so the label's own justify-between only ever sees its two visible
// children: the option text and the circle) - a sibling span paints the
// real 16x16 circle + selected dot.
//
// `onDeselect` is optional and only fires from a click on an ALREADY-active
// option (native radio inputs never re-fire onChange for that, only
// onClick does) - License needs this to get back to "no filter" now that
// the explicit "All" pill is gone (see PresetFilterModal's own comment);
// Sort by omits it, since it must always have exactly one real value.
function RadioRow<T extends string>({
  label,
  options,
  value,
  onChange,
  onDeselect,
}: {
  label?: string;
  options: Array<{ label: string; value: T }>;
  value: string;
  onChange: (value: T) => void;
  onDeselect?: () => void;
}) {
  const name = useId();
  return (
    <div className="flex flex-col justify-start gap-3">
      {label && <p className="font-sans text-text-sm-medium text-text-black">{label}</p>}
      <div className="flex flex-col gap-3 pl-4">
        {options.map(({ label: optionLabel, value: optionValue }) => {
          const isActive = value === optionValue;
          return (
            <label key={optionValue} className="flex flex-row items-center justify-between cursor-pointer">
              <span className="font-sans text-mobile-text-md-regular text-text-secondary">{optionLabel}</span>
              <input
                type="radio"
                name={name}
                value={optionValue}
                checked={isActive}
                onChange={() => onChange(optionValue)}
                onClick={() => {
                  if (isActive) onDeselect?.();
                }}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isActive ? "border-text-color-accent" : "border-border-border"
                }`}
              >
                {isActive && <span className="h-2 w-2 rounded-full bg-text-color-accent" />}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

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
    <FullViewModal title="Filter" titleIcon={<Icon name="filterFunnel" />} onClose={onClose}>
      <div className="flex h-full flex-col justify-between px-5 py-4">
        <div className="flex flex-col gap-5">
          <RadioRow
            label="License"
            options={LICENSE_OPTIONS}
            value={draft.license}
            onChange={(license) => setDraft((current) => ({ ...current, license }))}
            // Re-clicking the already-active option is the only way back to
            // "all" now that the explicit "All" pill is gone - see RadioRow's
            // own comment on why this needs onClick, not onChange.
            onDeselect={() => setDraft((current) => ({ ...current, license: "all" }))}
          />
          <RadioRow
            label="Sort by"
            options={SORT_OPTIONS}
            value={draft.sort}
            onChange={(sort) => setDraft((current) => ({ ...current, sort }))}
          />

          <div className="flex w-full flex-col items-center gap-3">
            <p className="mr-auto font-sans text-text-sm-medium text-text-black">By color</p>
            <div className="flex w-full items-center gap-2">
              {/* "No color" swatch - first in the row, per explicit direction
                  (copy-paste/paste.txt's reference asset). A white square with
                  a 1px diagonal line corner-to-corner, same size/radius as
                  every other swatch below so it reads as one of the row, not
                  a separate control. error-800 (#e46962) matches the
                  reference asset's own diagonal stroke exactly - used as a
                  real token via currentColor rather than hardcoding that hex. */}
              <button
                type="button"
                aria-label="Clear color filter"
                aria-pressed={draft.colorTag === null}
                onClick={() => setDraft((current) => ({ ...current, colorTag: null }))}
                className={`relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-border-border bg-background-white text-error-800 ${
                  draft.colorTag === null ? "ring-2 ring-accent-500 ring-offset-0" : ""
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                  <line x1="0.5" y1="0.5" x2="19.5" y2="19.5" stroke="currentColor" strokeWidth="1" />
                </svg>
              </button>
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
                    // separate "All" swatch to click back to (same
                    // re-click-to-clear idea as License's own onDeselect
                    // above, since neither has a visible "All" option).
                    onClick={() => setDraft((current) => ({ ...current, colorTag: current.colorTag === tag ? null : tag }))}
                    className={`size-5 shrink-0 rounded-[4px] border ${
                      isActive ? "ring-2 ring-accent-500 ring-offset-0" : "border-border-border"
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
