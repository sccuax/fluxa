// Subtle 3D parallax for the hero's final card scene: the cards tilt and drift a little with the mouse, each with its
// own depth. It only runs while `setActive(true)` (the hero calls it once the cards are static), and lives on its own
// layer ([data-gcard-tilt], between the wrapper the timeline moves and the button that owns the hover lift), so it
// composes with both instead of fighting them.
import { loadGsap } from "@/lib/motion/gsap";
import { isCardOpen } from "./gradientCards";

// Per-card depth (0..1): nearer cards (the outer columns) travel and tilt more, the central card the least.
const DEPTH: Record<string, number> = { A: 1, B: 0.7, C: 0.85, D: 1, E: 1, F: 0.55, G: 0.85, H: 1 };
const MAX_SHIFT_X = 14; // px at depth 1
const MAX_SHIFT_Y = 10;
const MAX_TILT_Y = 5; // deg (rotateY follows the mouse's x)
const MAX_TILT_X = 4; // deg (rotateX follows the mouse's y)
const PERSPECTIVE = 900;

export interface CardParallax {
  setActive(on: boolean): void;
}

export function initCardParallax(root: HTMLElement): CardParallax {
  const inert: CardParallax = { setActive() {} };
  // Touch has no hover position, and reduced-motion users get a still scene.
  if (
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return inert;
  }
  const tilts = Array.from(root.querySelectorAll<HTMLElement>("[data-gcard-tilt]"));
  if (!tilts.length) return inert;

  let active = false;
  let nx = 0; // mouse position, -1..1 from the viewport centre
  let ny = 0;
  let apply: ((x: number, y: number) => void) | null = null;

  void loadGsap().then(({ gsap }) => {
    gsap.set(tilts, { transformPerspective: PERSPECTIVE, transformOrigin: "50% 50%" });
    const setters = tilts.map((el) => {
      const d = DEPTH[el.dataset.gcardTilt ?? ""] ?? 0.8;
      const opts = { duration: 0.9, ease: "power3.out" };
      const qx = gsap.quickTo(el, "x", opts);
      const qy = gsap.quickTo(el, "y", opts);
      const rx = gsap.quickTo(el, "rotationX", opts);
      const ry = gsap.quickTo(el, "rotationY", opts);
      return (mx: number, my: number) => {
        // Moving the mouse right shifts the cards left (they sit "behind" the pointer) and turns them towards it.
        qx(-mx * MAX_SHIFT_X * d);
        qy(-my * MAX_SHIFT_Y * d);
        rx(-my * MAX_TILT_X * d);
        ry(mx * MAX_TILT_Y * d);
      };
    });
    apply = (x, y) => setters.forEach((s) => s(x, y));
    if (active) apply(nx, ny);
  });

  const update = () => (active && !isCardOpen() ? apply?.(nx, ny) : apply?.(0, 0));

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      nx = (e.clientX / window.innerWidth - 0.5) * 2;
      ny = (e.clientY / window.innerHeight - 0.5) * 2;
      if (active) update();
    },
    { passive: true },
  );
  // Pointer left the window: ease back to the resting pose.
  document.documentElement.addEventListener("mouseleave", () => {
    nx = 0;
    ny = 0;
    if (active) update();
  });

  return {
    setActive(on) {
      if (on === active) return;
      active = on;
      update(); // off: everything eases back to flat, so the timeline's measurements are never taken mid-tilt
    },
  };
}
