import { useState } from "react";

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

// Design spec (from a fresh Figma Dev Mode copy, see CLAUDE.md's "Gradient
// token fidelity lesson" for why this is pasted verbatim rather than
// hand-approximated): the fill's gradient must look like a stable, coherent
// picture as the bar grows, not a re-stretched one - background-size is
// fixed to TRACK_MAX_WIDTH and left-anchored, so a wider fill just reveals
// more of the same painting instead of restretching it.
const TRACK_MAX_WIDTH = 161;

// A floor on the fill's own width (not the track's) so a value at/near `min`
// still shows a sliver of fill - otherwise it reads as "this input doesn't
// work" rather than "this is at its minimum". Smaller in the inactive state
// since the whole track is thinner there too.
const MIN_FILL_PX = { active: 10, inactive: 5 };

// The interactive hit area (wrapper + native input below) is always this
// tall, regardless of active/inactive - only the visual track animates
// between INACTIVE_HEIGHT and this. Letting the hit area itself resize with
// hover caused a flicker right at its edge: growing on hover could move its
// boundary out from under the cursor mid-transition, firing pointerleave,
// which shrank it back under the cursor, re-firing pointerenter, and so on.
const ACTIVE_HEIGHT = 15;
const INACTIVE_HEIGHT = 4;

const ACTIVE_FILL_GRADIENT =
  "linear-gradient(83deg, rgba(111, 245, 241, 0.80) -81.2%, rgba(59, 156, 214, 0.80) -37.05%, rgba(9, 85, 229, 0.80) 5.44%, rgba(142, 84, 197, 0.80) 48.76%, rgba(226, 63, 140, 0.80) 92.09%)";

const ACTIVE_FILL_GLOW =
  "0 0 250px 0 #AC4098, 0 0 144.72px 0 #AC4098, 0 0 84.42px 0 #AC4098, 0 0 42.21px 0 #AC4098, 0 0 12.06px 0 #AC4098, 0 0 6.03px 0 #AC4098";

// Reusable range input with a two-state design: a thin flat inactive bar,
// and a taller bar with the brand gradient + glow + a small rectangular
// "thumb" (not a real slider ring/ball) on hover/focus. A real
// `<input type="range">` still drives it (opacity-0, stacked on top) for
// native drag/keyboard/focus behavior - everything visible is a separate
// layer purely reflecting `value`, not read off the native thumb's position.
export function RangeSlider({ value, min, max, step, onChange }: RangeSliderProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isActive = hovered || focused;

  const percent = ((value - min) / (max - min)) * 100;
  const minFillPx = isActive ? MIN_FILL_PX.active : MIN_FILL_PX.inactive;

  return (
    <div
      className="relative w-full"
      style={{ maxWidth: TRACK_MAX_WIDTH, height: ACTIVE_HEIGHT }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 m-0 w-full max-w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />

      {/* Purely visual - the native input above owns all interaction and,
          like the wrapper around it, stays a fixed ACTIVE_HEIGHT regardless
          of state (see the comment on ACTIVE_HEIGHT above for why). Only
          this track visually shrinks to INACTIVE_HEIGHT, vertically centered
          within that fixed space. overflow-hidden here contains the fill's
          glow (below) to inside the track - it can bleed rightward into the
          unfilled portion, but never past the track's own bounds. Track
          background never changes between states (was `inherit` in the
          active state before - that made it disappear on hover). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-1/2 w-full -translate-y-1/2 overflow-hidden rounded-[4px] bg-border-border transition-[height] duration-150 ease-out"
        style={{ height: isActive ? ACTIVE_HEIGHT : INACTIVE_HEIGHT }}
      >
        <div
          className={`relative h-full rounded-[4px] ${isActive ? "" : "bg-text-secondary"}`}
          style={{
            width: `max(${percent}%, ${minFillPx}px)`,
            boxShadow: isActive ? ACTIVE_FILL_GLOW : undefined,
          }}
        >
          {isActive && (
            <>
              {/* A second, separate clip - unlike the track's above, this one
                  tracks the fill's own (growing) width, so the gradient
                  paint is only ever revealed up to the current value, not
                  the whole track. Kept off the fill div itself so the glow
                  above isn't clipped by it too. */}
              <div className="absolute inset-0 overflow-hidden rounded-[4px]">
                <div className="h-full" style={{ width: TRACK_MAX_WIDTH, background: ACTIVE_FILL_GRADIENT }} />
              </div>
              {/* The rectangular "thumb" replacement - 4px from the fill's
                  own right edge, so it travels with the value. */}
              <div className="absolute right-1 top-1/2 h-[7px] w-[2px] -translate-y-1/2 rounded-[4px] bg-text-white" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
