// Magnetic hover: an element marked `data-magnet` drifts toward the cursor while the cursor is near it,
// and eases back when it leaves. The pull is bounded on purpose (small reach around the element, small
// max offset), so the element never chases the pointer across the page.
//
// It drives the individual CSS `translate` property, which composes with `transform`, so an element's own
// transform (e.g. a hover lift) keeps working untouched.
//
// Usage in markup:  <span data-magnet>  (optional: data-magnet-reach="24" px around the element,
//                   data-magnet-strength="0.2" of the cursor offset from the centre, data-magnet-max="6" px)

const DEFAULT_REACH = 24;
const DEFAULT_STRENGTH = 0.2;
const DEFAULT_MAX = 6;
const EASE = 0.18;

interface Magnet {
  el: HTMLElement;
  x: number;
  y: number;
  tx: number;
  ty: number;
  reach: number;
  strength: number;
  max: number;
}

// Product of opacities up the tree: a CTA that is still faded out by the hero intro must not react.
function effectiveOpacity(el: HTMLElement): number {
  let o = 1;
  for (let n: HTMLElement | null = el; n && o > 0; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
  return o;
}

export function initMagnet(root: ParentNode = document): () => void {
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-magnet]"));
  if (!canHover || reduced || els.length === 0) return () => {};

  const magnets: Magnet[] = els.map((el) => ({
    el,
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    reach: Number(el.dataset.magnetReach ?? DEFAULT_REACH),
    strength: Number(el.dataset.magnetStrength ?? DEFAULT_STRENGTH),
    max: Number(el.dataset.magnetMax ?? DEFAULT_MAX),
  }));

  let raf = 0;
  let px = -1e6;
  let py = -1e6;

  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

  function aim() {
    for (const m of magnets) {
      const r = m.el.getBoundingClientRect();
      // The rect includes the current offset; subtract it to get the resting centre (no feedback loop).
      const cx = r.left + r.width / 2 - m.x;
      const cy = r.top + r.height / 2 - m.y;
      const near =
        px > r.left - m.x - m.reach &&
        px < r.right - m.x + m.reach &&
        py > r.top - m.y - m.reach &&
        py < r.bottom - m.y + m.reach;
      if (near && effectiveOpacity(m.el) > 0.9) {
        m.tx = clamp((px - cx) * m.strength, m.max);
        m.ty = clamp((py - cy) * m.strength, m.max);
      } else {
        m.tx = 0;
        m.ty = 0;
      }
    }
  }

  function tick() {
    let moving = false;
    for (const m of magnets) {
      m.x += (m.tx - m.x) * EASE;
      m.y += (m.ty - m.y) * EASE;
      if (Math.abs(m.tx - m.x) < 0.05 && Math.abs(m.ty - m.y) < 0.05) {
        m.x = m.tx;
        m.y = m.ty;
      } else {
        moving = true;
      }
      m.el.style.translate = m.x === 0 && m.y === 0 ? "" : `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
    }
    raf = moving ? requestAnimationFrame(tick) : 0;
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  const onMove = (e: PointerEvent) => {
    px = e.clientX;
    py = e.clientY;
    aim();
    kick();
  };
  const onLeave = () => {
    px = py = -1e6;
    aim();
    kick();
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  return () => {
    window.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    cancelAnimationFrame(raf);
    for (const m of magnets) m.el.style.translate = "";
  };
}
