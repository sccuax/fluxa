import { useState } from "react";
import { useSelectedElement } from "../hooks/useSelectedElement";
import { useGradientStore } from "../store/gradientStore";
import { applyGradientToElement, canApplyPreset } from "../services/applyGradient";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { EditorEmptyState } from "./EditorEmptyState";
import { SupportedElementsGuide } from "./SupportedElementsGuide";
import { ControlPanel } from "./ControlPanel";
import { GradientCanvas } from "./GradientCanvas";
import { ButtonPrimary } from "./ButtonPrimary";
import { BetaFeedbackModal } from "./BetaFeedbackModal";

// Editor tab content: DashboardScreen renders this inside its flex-1
// min-h-0 overflow-hidden center area. Two independent regions, each its own
// swap on selection state:
// - Top: EditorEmptyState (heading + SVG) when nothing is selected <->
//   GradientCanvas (live WebGL preview) once something is selected -
//   min-h-[195px] matches EditorEmptyState's own min-height so there's no
//   layout jump swapping between the two, and gives the canvas's h-full a
//   definite height to fill. shrink-0 keeps it pinned at its natural height
//   instead of being squashed once the region below claims flex-1.
// - Bottom: SupportedElementsGuide (no selection) <-> ControlPanel
//   (selection) - siblings that swap places, not one nested in the other.
//   GradientCanvas and ControlPanel both read/write the same
//   useGradientStore, so the preview already updates live as the (still
//   unstyled) controls change - no extra wiring needed for that part.
//   This wrapper is flex-1 min-h-0 so it claims all height left over after
//   the preview and the Apply button - ControlPanel's own tab bar stays
//   fixed inside it and only its fields list scrolls (see ControlPanel.tsx).
//   Apply button itself is shrink-0, always visible, never part of the
//   scrolling area - per explicit direction: preview, tab bar, and Apply
//   button all stay fixed in view, only the controls scroll.
// ControlPanel itself is still the rough, unstyled gradient-core prototype
// (raw color/range inputs) - wired in here as a functional placeholder per
// explicit direction, real Figma styling comes later. The Apply button
// lives outside both swaps entirely, always at the very bottom, just gated
// by `disabled`.
export function EditorTab() {
  const { element } = useSelectedElement();
  const config = useGradientStore((state) => state.config);
  const colorModalOpen = useGradientStore((state) => state.colorModalOpen);
  const hasSelection = element !== null;
  const [applying, setApplying] = useState(false);
  // Beta feedback-collection popup - shown every time Apply gradient
  // actually succeeds (not on a no-op/error), per explicit direction that
  // this is the beta's main channel for gathering user feedback.
  const [showBetaFeedback, setShowBetaFeedback] = useState(false);

  async function handleApplyGradient() {
    if (!canApplyPreset(element)) {
      getWebflowDesigner().notify({
        type: "Error",
        message: "This element type doesn't support a background gradient.",
      });
      return;
    }
    setApplying(true);
    try {
      await applyGradientToElement(element, config);
      getWebflowDesigner().notify({type: "Success", message: "Gradient applied!"});
      setShowBetaFeedback(true);
    } catch (error) {
      getWebflowDesigner().notify({
        type: "Error",
        message: error instanceof Error ? error.message : "Failed to apply the gradient.",
      });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="min-h-[195px] w-full shrink-0">
        {/* colorModalOpen: fully unmounted, not just hidden, while a color
            modal is open - GradientCanvas keeps its own R3F render loop
            running continuously regardless of CSS visibility, and
            ShaderGradientCanvas exposes no way to pause that loop from
            outside. It's also completely covered by the modal the whole
            time anyway (FullViewModal spans this entire header-to-nav
            area), so there's nothing lost by not rendering anything here
            in its place. */}
        {hasSelection ? (colorModalOpen ? null : <GradientCanvas />) : <EditorEmptyState />}
      </div>

      <div className="w-full items-center flex min-h-0 flex-1">{hasSelection ? <ControlPanel /> : <SupportedElementsGuide />}</div>

      <div className="w-full shrink-0 px-[20px] py-[12px] border-t border-border-border">
        <ButtonPrimary disabled={!hasSelection || applying} onClick={handleApplyGradient}>
          {applying ? "Applying…" : "Apply gradient"}
        </ButtonPrimary>
      </div>

      <BetaFeedbackModal open={showBetaFeedback} onClose={() => setShowBetaFeedback(false)} />
    </div>
  );
}
