import { useEffect, useRef } from "react";

// Wizard step 1's "waiting for a selection" reveal (WebflowSolutionsScreen.tsx),
// adapted from a supplied example (copy-paste/paste.txt - an "SVG Unmask
// Previewer" demo). The example drove its spotlight from the cursor
// (mousemove/touchmove setting --cursor-x/-y); per explicit direction this
// version is autonomous instead - no pointer involvement at all, the
// spotlight wanders to a fresh random point on its own, forever, while
// mounted (i.e. while the wizard is on step "collection" - it unmounts,
// stopping itself, the moment WebflowSolutionsScreen advances past it).
//
// The reveal mechanism itself is unchanged from the example, just re-driven:
// the art layer (wizard-unmask-pattern.svg - the exact default SVG that demo
// itself loaded, public/images/ per this app's own "hand-typed public/
// asset needs a relative path" rule) sits underneath a solid overlay colored
// to match this box's own background (bg-background-white-2's real hex -
// #d7dae2 - so the art reads as "hidden inside the panel", not behind a
// mismatched color). That overlay isn't a real CSS mask: it's a plain
// radial-gradient background that's fully opaque almost everywhere and
// fades to fully transparent only right at the spotlight's own center,
// punching a soft circular "window" down to the art layer underneath.
const SPOTLIGHT_DIAMETER_PX = 170;
// How often a fresh random target is picked - the spotlight keeps easing
// toward whatever the current target is every frame in between, so this is
// "how long between wander decisions", not an animation duration.
// Reverted to the original pace (from the 4200 "professional/searching"
// tuning) so the two speeds can be compared side by side before picking
// one for good.
const MOVE_INTERVAL_MS = 2600;
// Keeps a picked target's own center at least this fraction of the
// container's size away from each edge, so the soft circle around it
// doesn't spend most of its life half-clipped against a wall.
const TARGET_EDGE_PADDING = 0.22;
// Per-frame easing factor (current -> target) - reverted alongside
// MOVE_INTERVAL_MS above, same reason (was 0.012 in the slower "searching"
// pass).
const EASE_PER_FRAME = 0.025;

export function UnmaskReveal() {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Plain refs, not state - this updates every animation frame, and a
  // React re-render per frame would be wasted work for a value that only
  // ever drives an inline CSS custom property. Same "latest ref, mutate the
  // DOM directly" reasoning ColorPicker.tsx's own drag handling already
  // uses for exactly this class of "smooth every-frame value" problem.
  const currentRef = useRef({ x: 50, y: 50 });
  const targetRef = useRef({ x: 50, y: 50 });

  useEffect(() => {
    let rafId = 0;

    function pickTarget() {
      const min = TARGET_EDGE_PADDING * 100;
      const range = 100 - min * 2;
      targetRef.current = { x: min + Math.random() * range, y: min + Math.random() * range };
    }

    function tick() {
      const current = currentRef.current;
      const target = targetRef.current;
      current.x += (target.x - current.x) * EASE_PER_FRAME;
      current.y += (target.y - current.y) * EASE_PER_FRAME;
      overlayRef.current?.style.setProperty("--spotlight-x", `${current.x}%`);
      overlayRef.current?.style.setProperty("--spotlight-y", `${current.y}%`);
      rafId = requestAnimationFrame(tick);
    }

    pickTarget();
    const intervalId = setInterval(pickTarget, MOVE_INTERVAL_MS);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-4">
      <img
        src="./images/wizard-unmask-pattern.svg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle ${SPOTLIGHT_DIAMETER_PX / 2}px at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(215, 218, 226, 0) 0%, rgba(215, 218, 226, 0.4) 45%, rgba(215, 218, 226, 0.85) 75%, rgba(215, 218, 226, 1) 100%)`,
        }}
      />
    </div>
  );
}
