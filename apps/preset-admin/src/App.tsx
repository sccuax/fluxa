import { useEffect, useRef, useState } from "react";
import type { GalleryPreset, GalleryPresetKind } from "@fluxa/gradient-core";
import { GradientCanvas } from "../../designer-extension/src/components/GradientCanvas";
import { ControlPanel } from "../../designer-extension/src/components/ControlPanel";
import { GlassLiquidCanvas } from "../../designer-extension/src/components/GlassLiquidCanvas";
import { GlassLiquidControlPanel } from "../../designer-extension/src/components/GlassLiquidControlPanel";
import { RuidoEvolutivoCanvas } from "../../designer-extension/src/components/RuidoEvolutivoCanvas";
import { RuidoEvolutivoControlPanel } from "../../designer-extension/src/components/RuidoEvolutivoControlPanel";
import { useGradientStore } from "../../designer-extension/src/store/gradientStore";
import { useGlassLiquidStore } from "../../designer-extension/src/store/glassLiquidStore";
import { useRuidoEvolutivoStore } from "../../designer-extension/src/store/ruidoEvolutivoStore";
import { apiFetch, ApiRequestError } from "./services/apiClient";
import { captureThumbnail } from "./services/captureThumbnail";
import { GalleryPresetList } from "./components/GalleryPresetList";
import { FloatingPanel } from "./components/FloatingPanel";

type License = "free" | "pro";

const KIND_OPTIONS: Array<{ label: string; value: GalleryPresetKind }> = [
  { label: "Gradient", value: "shaderGradient" },
  { label: "Glass shader", value: "glassLiquid" },
  { label: "Ruido Evolutivo", value: "ruidoEvolutivo" },
];

// Admins build a preset visually by reusing the exact same ControlPanel +
// GradientCanvas the Designer Extension itself uses (both confirmed to have
// zero Webflow-Designer-specific coupling before this app was built - see
// this file's own imports, which reach into designer-extension/src via a
// relative path rather than a shared package). That's a deliberate v1
// tradeoff: a shared package (e.g. packages/gradient-editor-ui) would be
// the cleaner long-term home for these components once *two* real apps
// depend on them this way and the coupling starts to hurt - not done yet
// since it's more upfront work than this tool currently needs.
type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "fluxa-studio-theme";

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage unavailable */
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export default function App() {
  const config = useGradientStore((state) => state.config);
  const reset = useGradientStore((state) => state.reset);
  const setConfig = useGradientStore((state) => state.setConfig);

  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* localStorage unavailable */
    }
  }, [theme]);

  const glassLiquidConfig = useGlassLiquidStore((state) => state.config);
  const resetGlassLiquid = useGlassLiquidStore((state) => state.reset);
  const setGlassLiquidConfig = useGlassLiquidStore((state) => state.setConfig);

  const ruidoEvolutivoConfig = useRuidoEvolutivoStore((state) => state.config);
  const resetRuidoEvolutivo = useRuidoEvolutivoStore((state) => state.reset);
  const setRuidoEvolutivoConfig = useRuidoEvolutivoStore((state) => state.setConfig);

  // Which preset kind is currently being edited - only choosable for a
  // brand-new, unsaved preset (the picker below is hidden once editingId is
  // set), since a preset's kind is fixed forever once it exists as a real
  // row.
  const [kind, setKind] = useState<GalleryPresetKind>("shaderGradient");

  const [presets, setPresets] = useState<GalleryPreset[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [license, setLicense] = useState<License>("free");
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The live GradientCanvas preview's own wrapper - captureThumbnail reads
  // the real <canvas> element ShaderGradientCanvas renders inside it
  // (querySelector, not a ref threaded through GradientCanvas itself,
  // deliberately - see that function's own comment for why this stays
  // entirely on this app's side rather than touching the shared component
  // apps/designer-extension's real customers also depend on).
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [capturingThumbnail, setCapturingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  async function refreshList() {
    setLoadingList(true);
    setListError(null);
    try {
      const results = await apiFetch<GalleryPreset[]>("/api/gallery-presets");
      setPresets(results);
    } catch (err) {
      setListError(err instanceof ApiRequestError ? err.message : "Failed to load presets.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refreshList();
  }, []);

  function startNew() {
    setEditingId(null);
    setName("");
    setLicense("free");
    setIsPublished(false);
    setThumbnailUrl(null);
    setThumbnailError(null);
    setKind("shaderGradient");
    reset();
    resetGlassLiquid();
    resetRuidoEvolutivo();
  }

  function loadForEditing(preset: GalleryPreset) {
    setEditingId(preset.id);
    setName(preset.name);
    setLicense(preset.license);
    setIsPublished(preset.isPublished);
    setThumbnailUrl(preset.thumbnailUrl);
    setThumbnailError(null);
    setKind(preset.kind);
    if (preset.kind === "glassLiquid") {
      setGlassLiquidConfig(preset.config);
    } else if (preset.kind === "ruidoEvolutivo") {
      setRuidoEvolutivoConfig(preset.config);
    } else {
      setConfig(preset.config);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setSaveError("Name is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const activeConfig =
        kind === "glassLiquid"
          ? glassLiquidConfig
          : kind === "ruidoEvolutivo"
            ? ruidoEvolutivoConfig
            : config;
      const body = { kind, name: name.trim(), license, config: activeConfig, isPublished };
      if (editingId) {
        await apiFetch(`/api/gallery-presets/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        await refreshList();
        startNew();
      } else {
        // Switches straight into editing the newly-created row (instead of
        // startNew()'s full reset) so a thumbnail can be captured for it
        // right away, without a round trip through "find it in the list,
        // click Load" - capturing requires a real id (see
        // handleCaptureThumbnail), which only exists after this POST
        // resolves.
        const created = await apiFetch<GalleryPreset>("/api/gallery-presets", {
          method: "POST",
          body: JSON.stringify(body),
        });
        await refreshList();
        loadForEditing(created);
      }
    } catch (err) {
      setSaveError(err instanceof ApiRequestError ? err.message : "Failed to save preset.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCaptureThumbnail() {
    if (!editingId || !previewContainerRef.current) return;

    setCapturingThumbnail(true);
    setThumbnailError(null);
    try {
      const blob = await captureThumbnail(previewContainerRef.current);
      if (!blob) {
        setThumbnailError("Couldn't read the preview canvas - is it still rendering?");
        return;
      }

      const formData = new FormData();
      formData.append("file", blob, "thumbnail.webp");
      const updated = await apiFetch<GalleryPreset>(`/api/gallery-presets/${editingId}/thumbnail`, {
        method: "POST",
        body: formData,
      });
      setThumbnailUrl(updated.thumbnailUrl);
      await refreshList();
    } catch (err) {
      setThumbnailError(err instanceof ApiRequestError ? err.message : "Failed to upload thumbnail.");
    } finally {
      setCapturingThumbnail(false);
    }
  }

  async function handleTogglePublish(preset: GalleryPreset) {
    // `kind` must be included even though only isPublished is actually
    // changing - updateGalleryPresetSchema is a discriminated union keyed
    // on `kind`, so it's required on every PATCH regardless of which other
    // fields are present (see that schema's own comment in gradient-core).
    await apiFetch(`/api/gallery-presets/${preset.id}`, {
      method: "PATCH",
      body: JSON.stringify({ kind: preset.kind, isPublished: !preset.isPublished }),
    });
    await refreshList();
  }

  async function handleDelete(preset: GalleryPreset) {
    if (!confirm(`Delete "${preset.name}"? This can't be undone.`)) return;
    await apiFetch(`/api/gallery-presets/${preset.id}`, { method: "DELETE" });
    if (editingId === preset.id) startNew();
    await refreshList();
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-mobile-display-d1 text-text-black">Fluxa Preset Studio</h1>
        <button
          type="button"
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          className="shrink-0 rounded-[4px] border border-border-border px-3 py-1.5 font-sans text-mobile-text-sm-regular text-text-black"
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      {/* Only *choosable* for a brand-new, unsaved preset - a preset's kind
          is fixed forever once it exists as a real row. When editing an
          existing row the picker is replaced by a read-only label so it's
          still visible which shader this preset uses (mirrors the "Start a
          new preset instead" link's own editingId-gating below). */}
      {editingId ? (
        <p className="font-sans text-mobile-text-md-regular text-text-secondary">
          Shader:{" "}
          <span className="text-text-black">
            {KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind}
          </span>{" "}
          <span className="text-mobile-text-sm-regular">· fixed for an existing preset</span>
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-sans text-mobile-text-md-regular text-text-black">Shader</span>
          <div className="inline-flex rounded-[6px] border border-border-border p-0.5">
            {KIND_OPTIONS.map((option) => {
              const active = option.value === kind;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  className={`whitespace-nowrap rounded-[4px] px-3 py-1.5 font-sans text-mobile-text-sm-regular transition-colors ${
                    active ? "bg-accent-500 text-white" : "text-text-secondary hover:text-text-black"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={previewContainerRef} className="h-[560px] w-full overflow-hidden rounded-4 border border-border-border">
        {/* preserveDrawingBuffer: required for captureThumbnail.ts's
            drawImage read to reliably see real pixels instead of a blank
            frame - see GradientCanvas.tsx's own comment on this prop for
            why it's off by default and only turned on here. */}
        {kind === "glassLiquid" ? (
          <GlassLiquidCanvas preserveDrawingBuffer />
        ) : kind === "ruidoEvolutivo" ? (
          <RuidoEvolutivoCanvas preserveDrawingBuffer />
        ) : (
          <GradientCanvas preserveDrawingBuffer />
        )}
      </div>

      {/* Full-width canvas above needs the control panel out of normal flow
          (see FloatingPanel.tsx's own comment) - dragging its handle moves
          it anywhere in the viewport instead of it permanently taking a
          320px bite out of the canvas's own width. */}
      <FloatingPanel>
        {kind === "glassLiquid" ? (
          <GlassLiquidControlPanel />
        ) : kind === "ruidoEvolutivo" ? (
          <RuidoEvolutivoControlPanel />
        ) : (
          <ControlPanel />
        )}
      </FloatingPanel>

      <div className="flex flex-col gap-3 rounded-4 border border-border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-mobile-header-h1 text-text-black">
            {editingId ? "Edit preset" : "New preset"}
          </h2>
          {editingId && (
            <button type="button" onClick={startNew} className="font-sans text-mobile-text-sm-regular text-text-secondary underline">
              Start a new preset instead
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-mobile-text-sm-regular text-text-secondary">Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-[240px] rounded-[4px] border border-border-border bg-transparent px-2 py-1 font-sans text-mobile-text-md-regular text-text-black focus:border-accent-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-sans text-mobile-text-sm-regular text-text-secondary">License</span>
            <select
              value={license}
              onChange={(event) => setLicense(event.target.value as License)}
              className="rounded-[4px] border border-border-border bg-transparent px-2 py-1 font-sans text-mobile-text-md-regular text-text-black focus:border-accent-500 focus:outline-none"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </label>

          <label className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(event) => setIsPublished(event.target.checked)}
            />
            <span className="font-sans text-mobile-text-md-regular text-text-black">Published</span>
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-4 bg-accent-500 px-4 py-2 font-sans text-mobile-text-md-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Create preset"}
          </button>
        </div>

        {saveError && <p className="font-sans text-mobile-text-sm-regular text-red-600">{saveError}</p>}

        <div className="flex items-center gap-3 border-t border-border-border pt-3">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-16 w-32 shrink-0 rounded-[4px] object-cover" />
          ) : (
            <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-[4px] bg-background-white-2 font-sans text-mobile-text-sm-regular text-text-secondary">
              No thumbnail
            </div>
          )}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleCaptureThumbnail}
              disabled={!editingId || capturingThumbnail}
              className="w-fit rounded-4 border border-border-border px-3 py-1.5 font-sans text-mobile-text-sm-regular text-text-black disabled:opacity-50"
            >
              {capturingThumbnail ? "Capturing..." : "Capture thumbnail"}
            </button>
            <span className="font-sans text-mobile-text-sm-regular text-text-secondary">
              {editingId
                ? "Captures the live preview on the left, exactly as it looks right now."
                : "Save the preset first, then capture its thumbnail."}
            </span>
            {thumbnailError && <p className="font-sans text-mobile-text-sm-regular text-red-600">{thumbnailError}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-mobile-header-h1 text-text-black">Gallery presets</h2>
        {listError && <p className="font-sans text-mobile-text-sm-regular text-red-600">{listError}</p>}
        <GalleryPresetList
          presets={presets}
          loading={loadingList}
          onLoad={loadForEditing}
          onTogglePublish={handleTogglePublish}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
