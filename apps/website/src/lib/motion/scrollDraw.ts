// Scroll-driven page furniture (all one-way: nothing is un-drawn when scrolling back up):
//   .page-grid           the two vertical rules are scrubbed: the drawing tip follows the 80% viewport line
//   [data-rule="t b"]    an element's own top and/or bottom rule draws left -> right, once, at the 80% viewport line
//   .rule-line           free-standing decorative rules (--h left -> right, --v top -> bottom), same behaviour
//   [data-scroll-reveal] fades/rises in as it scrolls into view
// Everything is driven through CSS custom properties (styles/global.css), whose defaults mean "fully drawn",
// so without JS / with reduced motion the page is complete and static.

import { loadGsap } from "./gsap";

// ScrollTrigger measures triggers in order of refreshPriority (higher first). Ours are created before the hero's
// pin exists, so without a lower priority they would be measured before the pin spacer is added and fire while the
// hero is still pinned. Negative = measured after every pin.
const REFRESH_AFTER_PINS = -1;
// Viewport line at which every rule draws, and at which the vertical rules' drawing tip travels, so a horizontal rule
// fires exactly as the vertical line reaches it.
const RULE_LINE = "80%";
// clamp(): never ask for a position past the end of the page (rules near the bottom still fire at max scroll).
const RULE_START = `clamp(top ${RULE_LINE})`;

export async function initScrollDraw(root: ParentNode = document): Promise<void> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    console.info("[scrollDraw] prefers-reduced-motion is ON: lines and reveals are static");
    return;
  }
  const grids = Array.from(root.querySelectorAll<HTMLElement>(".page-grid"));
  const ruled = Array.from(root.querySelectorAll<HTMLElement>("[data-rule]"));
  const lines = Array.from(root.querySelectorAll<HTMLElement>(".rule-line"));
  const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-reveal]"));
  if (grids.length + ruled.length + lines.length + reveals.length === 0) return;

  let mods: Awaited<ReturnType<typeof loadGsap>>;
  try {
    mods = await loadGsap();
  } catch (err) {
    console.warn("[scrollDraw] GSAP failed to load, showing everything statically", err);
    reveals.forEach((el) => (el.style.opacity = "1")); // GSAP failed: show everything
    return;
  }
  const { gsap, ScrollTrigger } = mods;

  // Vertical rules: the drawing tip rides the 80% viewport line (visible on screen; each horizontal rule fires as
  // the tip reaches it) with a little smoothing. It only ever advances: scrolling back up never un-draws it.
  grids.forEach((g) => {
    let drawn = 0; // furthest progress reached (0..1)
    g.style.setProperty("--grid-draw", "0%");
    ScrollTrigger.create({
      trigger: g,
      start: `top ${RULE_LINE}`,
      end: `bottom ${RULE_LINE}`,
      refreshPriority: REFRESH_AFTER_PINS,
      onUpdate: (self) => {
        if (self.progress <= drawn) return;
        drawn = self.progress;
        gsap.to(g, { "--grid-draw": `${(drawn * 100).toFixed(2)}%`, duration: 0.8, ease: "power2.out", overwrite: true });
      },
    });
  });

  // Every other rule is TIME-based and one-shot: it draws (a fixed duration) the first time it crosses the 80%
  // viewport line and then stays drawn; scrolling back up does not un-draw it.
  function drawOnce(el: HTMLElement, prop: string, start: string, duration: number) {
    gsap.fromTo(
      el,
      { [prop]: 0 },
      {
        [prop]: 1,
        duration,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start, once: true, refreshPriority: REFRESH_AFTER_PINS },
      },
    );
  }

  ruled.forEach((el) => {
    const sides = (el.dataset.rule ?? "").split(/\s+/);
    if (sides.includes("t")) drawOnce(el, "--rule-t", RULE_START, 1.2);
    if (sides.includes("b")) drawOnce(el, "--rule-b", `clamp(bottom ${RULE_LINE})`, 1.2);
  });

  lines.forEach((el) => drawOnce(el, "--rule-draw", RULE_START, el.classList.contains("rule-line--v") ? 1.5 : 1.2));

  // Reveals are one-shot too: they play in full (time-based) the first time they cross the 80% line.
  reveals.forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: Number(el.dataset.scrollRevealY ?? 36) },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: RULE_START, once: true, refreshPriority: REFRESH_AFTER_PINS },
      },
    );
  });

  if (import.meta.env.DEV) {
    console.info(`[scrollDraw] ready: ${grids.length} grid(s), ${ruled.length} ruled, ${lines.length} lines, ${reveals.length} reveals, ${ScrollTrigger.getAll().length} triggers`);
  }

  // Positions depend on the hero's pin spacer and web fonts: re-measure once everything has settled.
  const refresh = () => ScrollTrigger.refresh();
  if (document.readyState === "complete") refresh();
  else window.addEventListener("load", refresh, { once: true });
  document.fonts?.ready.then(refresh).catch(() => {});
}
