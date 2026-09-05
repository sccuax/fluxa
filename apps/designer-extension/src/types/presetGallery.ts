// PresetsTab's searchable/filterable gallery. Reads real data now - see
// `fetchPublishedPresets` below - published via apps/preset-admin, a small
// internal tool admins use to build these visually, and stored in the
// `gallery_presets` table (apps/data-client). Deliberately NOT the same
// thing as `GradientPreset`/`gradientConfigSchema`'s `presets` table: that
// model is "a Fluxa user's own saved config for one of their sites" (id,
// siteId, name, config, createdAt); this is Fluxa's own curated template
// gallery (license tier, a color filter, no site ownership).
import {
  getEffectiveGradientColors,
  type GalleryPreset as BackendGalleryPreset,
  type GradientConfig,
  type GlassLiquidConfig,
} from "@fluxa/gradient-core";
import { apiFetch } from "../services/apiClient";

export type PresetLicense = "free" | "pro";
export type PresetSort = "popular" | "recent";
export type PresetColorTag = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";

interface GalleryPresetDisplayBase {
  id: string;
  name: string;
  license: PresetLicense;
  colorTag: PresetColorTag;
  createdAt: string;
  // Three CSS-safe hex stops for a cheap linear-gradient preview swatch -
  // derived from the preset's real config (getEffectiveGradientColors,
  // the same helper GradientCanvas.tsx/the published embed already use for
  // the colorCount==="2" collapse). Used as PresetCard.tsx's fallback when
  // `thumbnailUrl` below is null - never both at once.
  previewColors: [string, string, string];
  // An admin-captured screenshot of the live shader (apps/preset-admin's
  // "Capture thumbnail" button - see apps/data-client's
  // routes/galleryPresets.ts POST /:id/thumbnail), far more accurate than
  // the CSS approximation above (which can't represent noise/distortion/
  // lighting/camera angle). Null until an admin captures one - not every
  // published preset necessarily has this yet.
  thumbnailUrl: string | null;
}

// A real discriminated union (on `kind`), not a plain Pick<BackendGalleryPreset,
// "kind"|"config"> intersected in - Pick distributes indexed access across a
// union's members independently per property, which would produce
// `{kind: "shaderGradient" | "glassLiquid", config: GradientConfig | GlassLiquidConfig}`
// as one flat type instead of keeping `kind` and `config` correctly paired,
// silently allowing e.g. `{kind: "glassLiquid", config: GradientConfig}`.
// `config` is included at all now (previously this type was deliberately
// config-free, "decoupled from the wire format so PresetCard.tsx doesn't
// have to know anything about gradient-core's schema") because PresetCard
// now needs the real config to actually apply a glassLiquid preset -
// see PresetsTab.tsx's handleApply.
export type GalleryPresetDisplay =
  | (GalleryPresetDisplayBase & { kind: "shaderGradient"; config: GradientConfig })
  | (GalleryPresetDisplayBase & { kind: "glassLiquid"; config: GlassLiquidConfig });

// The color filter's own swatch palette (PresetFilterModal) - also doubles
// as the reference palette `nearestColorTag` matches a real preset's
// primary color against, since the backend doesn't store a manual tag
// (there's nothing for an admin to manually pick - it's derived).
export const PRESET_COLOR_TAGS: Array<{ tag: PresetColorTag; hex: string }> = [
  { tag: "red", hex: "#E8523F" },
  { tag: "orange", hex: "#F2994A" },
  { tag: "yellow", hex: "#F2C94C" },
  { tag: "green", hex: "#4FBA6F" },
  { tag: "blue", hex: "#4F8FF2" },
  { tag: "purple", hex: "#9B6DE0" },
  { tag: "pink", hex: "#E23F8C" },
];

function hexToRgbTuple(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized.length === 3 ? normalized.replace(/./g, (ch) => ch + ch) : normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Picks whichever PRESET_COLOR_TAGS swatch is closest to `hex` by plain
// squared RGB distance - good enough for a 7-color reference palette (no
// need for a perceptual color-distance model at this granularity), and
// keeps the color filter an exact tag match under the hood (simpler and
// more predictable than fuzzy-matching every card against every filter
// click) even though the tag itself is now derived rather than manually
// picked.
export function nearestColorTag(hex: string): PresetColorTag {
  const [r, g, b] = hexToRgbTuple(hex);
  let closest = PRESET_COLOR_TAGS[0];
  let closestDistance = Infinity;
  for (const candidate of PRESET_COLOR_TAGS) {
    const [cr, cg, cb] = hexToRgbTuple(candidate.hex);
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }
  return closest.tag;
}

// Three CSS-safe hex stops for whichever kind this preset actually is -
// getEffectiveGradientColors only applies to a ShaderGradient config
// (color1/2/3 don't exist at all on a glassLiquid config), so this branches
// on `kind` first. glowColor1/glowColor2/baseColor is the glassLiquid
// shader's own closest 3-stop approximation (its two trail hues + the glass
// background), matching the same 3-stop shape GalleryPresetList.tsx's own
// swatch fallback uses.
function previewColorsFor(preset: BackendGalleryPreset): [string, string, string] {
  if (preset.kind === "glassLiquid") {
    return [preset.config.glowColor1, preset.config.glowColor2, preset.config.baseColor];
  }
  const { color1, color2, color3 } = getEffectiveGradientColors(preset.config);
  return [color1, color2, color3];
}

function toDisplay(preset: BackendGalleryPreset): GalleryPresetDisplay {
  const previewColors = previewColorsFor(preset);
  const base: GalleryPresetDisplayBase = {
    id: preset.id,
    name: preset.name,
    license: preset.license,
    createdAt: preset.createdAt,
    previewColors,
    colorTag: nearestColorTag(previewColors[0]),
    thumbnailUrl: preset.thumbnailUrl,
  };
  // The two branches below look identical, but aren't a copy-paste
  // accident: narrowing `preset` via `if (preset.kind === ...)` first is
  // what keeps `kind`/`config` correctly paired per-branch in the return
  // type. Building `{kind: preset.kind, config: preset.config}` directly
  // from the still-unnarrowed union would widen `config` to
  // `GradientConfig | GlassLiquidConfig` for BOTH kind values, which isn't
  // assignable back to GalleryPresetDisplay's discriminated union.
  if (preset.kind === "glassLiquid") {
    return { ...base, kind: preset.kind, config: preset.config };
  }
  return { ...base, kind: preset.kind, config: preset.config };
}

// GET /api/public/gallery-presets/published (apps/data-client's
// publicGalleryPresetRoutes, deliberately mounted at a different prefix
// from the admin-only /api/gallery-presets routes - see that file's own
// comment) - no auth required, only ever returns isPublished: true rows.
export async function fetchPublishedPresets(): Promise<GalleryPresetDisplay[]> {
  const results = await apiFetch<BackendGalleryPreset[]>("/api/public/gallery-presets/published");
  return results.map(toDisplay);
}
