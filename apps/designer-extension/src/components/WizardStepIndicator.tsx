import type { ReactNode } from "react";

// Generic step-dot progress indicator, extracted from
// WebflowSolutionsScreen.tsx's own (originally hardcoded to that screen's
// 6-step multi-image wizard) once CmsImagesScreen.tsx needed the identical
// look for its own, differently-shaped 4-step wizard - genuinely nothing
// here is multi-image-specific, so it's now generic over any ordered list
// of step keys rather than a second near-copy.
//
// 1-indexed step circles (20x20), connected by thin neutral lines - a step
// is "filled" once the wizard has reached it OR passed it (current step
// included, per explicit spec: "en el paso uno aparece la bolita asi" -
// step 1's own dot is already filled while ON step 1, not only once past
// it). Lines stay a plain neutral color throughout, not progress-colored -
// only the dots themselves carry progress, per the reference.
//
// `orientation` defaults to "horizontal" (every existing caller - the
// multi-image and CMS-images wizards, both 4+ steps) - "vertical" is for
// BlogToStagingScreen.tsx's own 2-step wizard, per explicit direction
// ("la instalación solo serían dos pasos entonces por ende las bolitas
// irían vertical y no horizontal"). Both orientations share the exact same
// per-dot styling; only the axis flex runs along, and which line dimension
// (`h-px w-full` vs `w-px h-full`) connects consecutive dots, differ.
//
// `renderLabel` (vertical only, opt-in) switches to a THIRD layout: a
// compact stacked checklist, one (dot + label) row per step, connected by a
// short FIXED-height line instead of the plain `flex-1` one above. Added
// because BlogToStagingScreen.tsx's original vertical usage put the whole
// indicator in a `flex items-stretch` row next to a tall content box, so its
// `flex-1` line stretched to match that box's own height - reading as "the
// two dots are way too far apart" once that box had any real height (see
// the reference screenshot this was fixed against). A step list that shows
// its own per-step labels doesn't have that problem: each row's height is
// just its own label's height, so the line between two rows can be a short,
// fixed length instead of stretching into a sibling it has no relation to.
export function WizardStepIndicator<Step extends string>({
  steps,
  currentStep,
  orientation = "horizontal",
  renderLabel,
}: {
  steps: readonly Step[];
  currentStep: Step;
  orientation?: "horizontal" | "vertical";
  renderLabel?: (step: Step, index: number) => ReactNode;
}) {
  const currentIndex = steps.indexOf(currentStep);
  const vertical = orientation === "vertical";

  if (renderLabel) {
    return (
      <div className="flex flex-col">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={step} className="flex flex-col">
              <div className="flex items-center gap-3">
                <StepDot index={i} filled={i <= currentIndex} />
                {renderLabel(step, i)}
              </div>
              {/* `ml-[9px]` centers this 1px line under the 20px dot above it
                  (half of 20px, minus half of 1px, rounds to 9px) - a short
                  fixed height (`h-2`), not `flex-1`, is the whole point of
                  this layout: see this function's own top comment. */}
              {!isLast && <span className="ml-[9px] h-2 w-px bg-border-border" />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={vertical ? "flex flex-col items-center" : "flex w-full items-center"}>
      {steps.map((step, i) => {
        const filled = i <= currentIndex;
        const isLast = i === steps.length - 1;
        return (
          <div
            key={step}
            className={
              vertical
                ? `flex flex-col items-center ${isLast ? "" : "flex-1"}`
                : `flex items-center ${isLast ? "" : "flex-1"}`
            }
          >
            <StepDot index={i} filled={filled} />
            {!isLast && <span className={vertical ? "w-px flex-1 bg-border-border" : "h-px flex-1 bg-border-border"} />}
          </div>
        );
      })}
    </div>
  );
}

// Extracted from the two layouts above once `renderLabel`'s stacked-list
// variant needed the exact same dot styling as the original - kept as one
// definition rather than risking the two drifting apart over time.
function StepDot({ index, filled }: { index: number; filled: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-transparent font-sans text-[10px] font-medium leading-none ${STEP_DOT_SHADOW} ${
        filled ? "text-white" : "border-border-border bg-background-white text-text-secondary"
      }`}
      style={
        filled
          ? { background: `${STEP_DOT_FILL_GRADIENT} padding-box, var(--gradient-gradient) border-box` }
          : undefined
      }
    >
      {index + 1}
    </span>
  );
}

// Same shared bordered-control drop shadow token every other small
// bordered control in this app uses (ButtonSecondary, SegmentedRow's
// pills, the hex/opacity inputs, ...) - per explicit spec, reused here
// verbatim rather than re-typed, so it stays in sync with the rest of the
// app if that shadow is ever revisited.
const STEP_DOT_SHADOW =
  "shadow-[-1px_4px_3px_0_rgba(133,129,121,0.05),-1px_2px_2px_0_rgba(133,129,121,0.09),0_0_1px_0_rgba(133,129,121,0.10)]";

// The literal gradient given for the dot's own fill (232deg - a distinct
// angle/stop set from this app's shared `gradient-gradient` token, which is
// 3deg - not interchangeable, per explicit spec). The border reuses the
// shared token instead (var(--gradient-gradient)) via the same two-layer
// padding-box/border-box trick PresetCard.tsx's own "Pro" badge already
// uses for a gradient BORDER - a plain CSS border-color can't be a
// gradient on its own.
const STEP_DOT_FILL_GRADIENT =
  "linear-gradient(232deg, #6FF5F1 17.32%, #3B9CD6 35.12%, #0955E5 52.25%, #8E54C5 69.72%, #E23F8C 87.18%)";
