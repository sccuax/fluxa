// "Steps" widget: three stacked steps, one active at a time, with a progress line on the active one.
// Autoplay is driven by CSS (styles/global.css): the bare line fills (`step-progress`, 4s) and then its glow rises
// and brightens (`step-glow-rise`, 4s); when that ends we move to the next step. So the timing lives in CSS, and with reduced motion (no animation, so no
// `animationend`) it simply never auto-advances. Clicking a step selects it. Hover, or the widget being
// off-screen, pauses the bar (CSS `animation-play-state`).
//
// Markup contract:  [data-steps] > [data-step] (>  button, [data-step-bar]) ... and [data-step-panel] per step.
// The text of every step is in the HTML from the start, so the content is fully readable without JS.

export function initSteps(root: ParentNode = document): () => void {
  const cleanups: Array<() => void> = [];

  root.querySelectorAll<HTMLElement>("[data-steps]").forEach((widget) => {
    const steps = Array.from(widget.querySelectorAll<HTMLElement>("[data-step]"));
    const panels = Array.from(widget.querySelectorAll<HTMLElement>("[data-step-panel]"));
    if (steps.length === 0) return;

    function select(index: number) {
      steps.forEach((step, i) => {
        const active = i === index;
        step.dataset.active = String(active);
        step.querySelector("button")?.setAttribute("aria-current", active ? "step" : "false");
        // Restart the bar's animation for the newly active step.
        const bar = step.querySelector<HTMLElement>("[data-step-bar]");
        if (bar) {
          const animated = [bar, ...Array.from(bar.querySelectorAll<HTMLElement>("*"))];
          animated.forEach((el) => (el.style.animation = "none"));
          void bar.offsetWidth;
          animated.forEach((el) => (el.style.animation = ""));
        }
      });
      panels.forEach((panel, i) => {
        panel.dataset.active = String(i === index);
      });
    }

    const current = () => Math.max(0, steps.findIndex((s) => s.dataset.active === "true"));

    const onClick = (i: number) => () => select(i);
    const clickers = steps.map((step, i) => {
      const handler = onClick(i);
      step.querySelector("button")?.addEventListener("click", handler);
      return () => step.querySelector("button")?.removeEventListener("click", handler);
    });

    const onEnd = (e: AnimationEvent) => {
      if (e.animationName !== "step-glow-rise") return;
      select((current() + 1) % steps.length);
    };
    widget.addEventListener("animationend", onEnd);

    // Only run the bar while the widget is on screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        widget.dataset.paused = String(!entry.isIntersecting);
      },
      { threshold: 0.4 },
    );
    io.observe(widget);
    widget.dataset.paused = "true";

    select(current());
    cleanups.push(() => {
      clickers.forEach((off) => off());
      widget.removeEventListener("animationend", onEnd);
      io.disconnect();
    });
  });

  return () => cleanups.forEach((off) => off());
}
