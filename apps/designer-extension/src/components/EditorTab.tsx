import { useState } from "react";
import { useSelectedElement } from "../hooks/useSelectedElement";
import { useGradientStore } from "../store/gradientStore";
import { applyGradientToElement, canApplyGradient } from "../services/applyGradient";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { EditorEmptyState } from "./EditorEmptyState";
import { SupportedElementsGuide } from "./SupportedElementsGuide";
import { ControlPanel } from "./ControlPanel";
import { GradientCanvas } from "./GradientCanvas";
import { ButtonPrimary } from "./ButtonPrimary";

// Editor tab content: DashboardScreen renders this inside its flex-1 center
// area. Two independent regions, each its own swap on selection state:
// - Top: EditorEmptyState (heading + SVG) when nothing is selected <->
//   GradientCanvas (live WebGL preview) once something is selected -
//   min-h-[195px] matches EditorEmptyState's own min-height so there's no
//   layout jump swapping between the two, and gives the canvas's h-full a
//   definite height to fill.
// - Bottom: SupportedElementsGuide (no selection) <-> ControlPanel
//   (selection) - siblings that swap places, not one nested in the other.
//   GradientCanvas and ControlPanel both read/write the same
//   useGradientStore, so the preview already updates live as the (still
//   unstyled) controls change - no extra wiring needed for that part.
// ControlPanel itself is still the rough, unstyled gradient-core prototype
// (raw color/range inputs) - wired in here as a functional placeholder per
// explicit direction, real Figma styling comes later. The Apply button
// lives outside both swaps entirely, always at the very bottom, just gated
// by `disabled`.
export function EditorTab() {
  const { element } = useSelectedElement();
  const config = useGradientStore((state) => state.config);
  const hasSelection = element !== null;
  const [applying, setApplying] = useState(false);

  async function handleApplyGradient() {
    if (!canApplyGradient(element)) {
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
    <div className="flex justify-between h-full w-full flex-col">
      <div className="min-h-[195px] w-full">{hasSelection ? <GradientCanvas /> : <EditorEmptyState />}</div>

      <div className="w-full">{hasSelection ? <ControlPanel /> : <SupportedElementsGuide />}</div>

      <div className="w-full px-[20px] py-[12px]">
        <ButtonPrimary disabled={!hasSelection || applying} onClick={handleApplyGradient}>
          {applying ? "Applying…" : "Apply gradient"}
        </ButtonPrimary>
      </div>
    </div>
  );
}
