import { useState } from "react";
import { FullViewModal } from "./FullViewModal";
import { ButtonPrimary } from "./ButtonPrimary";
import { Icon } from "./Icon";
import { GradientCanvas } from "./GradientCanvas";
import { GlassLiquidCanvas } from "./GlassLiquidCanvas";
import { RuidoEvolutivoCanvas } from "./RuidoEvolutivoCanvas";
import type { GalleryPresetDisplay } from "../types/presetGallery";

// Opens once a preset card/search result is clicked (PresetsTab.tsx) - per
// explicit direction/reference screenshot, clicking a preset no longer
// applies it immediately. It now shows the preset's REAL live shader first
// (the same *Canvas components EditorTab.tsx's own live-editing preview
// uses, each now taking an optional `config` override prop specifically for
// this - see e.g. GradientCanvas.tsx's own comment on that addition), full-
// bleed inside a FullViewModal, with a pinned "Apply gradient" button below
// it - so the customer can see the shader actually running before
// committing to applying it to their selected element.
export function PresetPreviewModal({
  preset,
  onClose,
  onApply,
}: {
  preset: GalleryPresetDisplay;
  onClose: () => void;
  // The real apply (PresetsTab.tsx's own handleApply) - already surfaces
  // success/error via webflow.notify, so this component doesn't need its
  // own error UI, only a busy state for the button label/disabled state.
  onApply: (preset: GalleryPresetDisplay) => Promise<void>;
}) {
  const [applying, setApplying] = useState(false);

  async function handleApplyClick() {
    setApplying(true);
    try {
      await onApply(preset);
    } finally {
      // Closes regardless of outcome - a failure is already communicated by
      // onApply's own toast, same as before this modal existed (clicking a
      // card used to apply-and-notify in one step with nothing to close).
      setApplying(false);
      onClose();
    }
  }

  return (
    <FullViewModal title={preset.name} onClose={onClose}>
      <div className="flex h-full flex-col">
        {/* min-h-0 is required for a flex child to actually shrink to the
            parent's remaining space instead of overflowing it - same fix
            this app's other scrollable/fixed-footer panels already rely on
            (BlogToStagingScreen's footer, DashboardScreen's own tab body). */}
        <div className="min-h-0 flex-1 bg-black">
          {preset.kind === "glassLiquid" ? (
            <GlassLiquidCanvas config={preset.config} />
          ) : preset.kind === "ruidoEvolutivo" ? (
            <RuidoEvolutivoCanvas config={preset.config} />
          ) : (
            <GradientCanvas config={preset.config} />
          )}
        </div>
        <div className="shrink-0 border-t border-border-border bg-background-white px-5 py-3">
          <ButtonPrimary disabled={applying} icon={<Icon name="stars" />} onClick={handleApplyClick}>
            {applying ? "Applying…" : "Apply gradient"}
          </ButtonPrimary>
        </div>
      </div>
    </FullViewModal>
  );
}
