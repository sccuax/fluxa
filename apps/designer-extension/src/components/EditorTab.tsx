import { useState } from "react";
import { useSelectedElement } from "../hooks/useSelectedElement";
import { useGradientStore } from "../store/gradientStore";
import { applyGradientToElement, canApplyPreset } from "../services/applyGradient";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { trackEvent } from "../services/analytics";
import { EditorEmptyState } from "./EditorEmptyState";
import { SupportedElementsGuide } from "./SupportedElementsGuide";
import { ControlPanel } from "./ControlPanel";
import { GradientCanvas } from "./GradientCanvas";
import { ButtonPrimary } from "./ButtonPrimary";
import { BetaFeedbackModal } from "./BetaFeedbackModal";
import { Icon } from "./Icon";

// Editor tab content: DashboardScreen renders this inside its flex-1
// min-h-0 overflow-hidden center area.
//
// `accepted` is owned by DashboardScreen (survives tab switches, resets
// only on a fresh sign-in) and threaded in here:
// - Before accepting: BOTH regions show the intro (EditorEmptyState +
//   SupportedElementsGuide) regardless of selection, and the bottom button
//   is an enabled "Accept" that just calls onAccept.
// - After accepting: the top region is the live GradientCanvas preview and
//   the bottom region is the ControlPanel - shown unconditionally, no
//   longer gated by selection. The "Apply gradient" button is always
//   enabled (only disabled while a previous apply is in flight); with no
//   element selected, clicking it just surfaces handleApplyGradient's own
//   "no supported element" toast. min-h-[195px] on the top region matches
//   EditorEmptyState's own min-height so there's no layout jump on accept,
//   and gives the canvas's h-full a definite height to fill. shrink-0
//   keeps it pinned at its natural height instead of being squashed once
//   the region below claims flex-1.
//   The bottom wrapper is flex-1 min-h-0 so it claims all height left over
//   after the preview and the Apply button - ControlPanel's own tab bar
//   stays fixed inside it and only its fields list scrolls (see
//   ControlPanel.tsx). The Apply button itself is shrink-0, always
//   visible, never part of the scrolling area.
// ControlPanel itself is still the rough, unstyled gradient-core prototype
// (raw color/range inputs) - wired in here as a functional placeholder per
// explicit direction, real Figma styling comes later.
//
// Props default so a standalone <EditorTab /> (e.g. the sandbox harness)
// still renders - it just stays on the intro with a no-op Accept.
export function EditorTab({
  accepted = false,
  onAccept = () => {},
}: {
  accepted?: boolean;
  onAccept?: () => void;
}) {
  const { element } = useSelectedElement();
  const config = useGradientStore((state) => state.config);
  const colorModalOpen = useGradientStore((state) => state.colorModalOpen);
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
      trackEvent("apply_gradient");
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
        {accepted ? (colorModalOpen ? null : <GradientCanvas />) : <EditorEmptyState />}
      </div>

      <div className="w-full items-center flex min-h-0 flex-1">
        {accepted ? <ControlPanel /> : <SupportedElementsGuide />}
      </div>

      {/* border-t only once accepted - the initial Accept screen is the one
          deliberate exception, per explicit direction. */}
      <div className={`w-full shrink-0 px-[20px] py-[12px] ${accepted ? "border-t border-border-border" : ""}`}>
        {accepted ? (
          <ButtonPrimary disabled={applying} icon={<Icon name="stars" />} onClick={handleApplyGradient}>
            {applying ? "Applying…" : "Apply gradient"}
          </ButtonPrimary>
        ) : (
          <ButtonPrimary onClick={onAccept}>Accept</ButtonPrimary>
        )}
      </div>

      <BetaFeedbackModal open={showBetaFeedback} onClose={() => setShowBetaFeedback(false)} />
    </div>
  );
}
