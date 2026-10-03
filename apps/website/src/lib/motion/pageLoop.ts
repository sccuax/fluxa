// Infinite scroll: when the visitor keeps scrolling down at the very end of the page (the footer fully open), the page
// closes on a dark curtain, jumps back to the top, and the page-load intro plays again (Hero.astro exposes
// `window.__fluxaHeroReplay`), which starts the hero's scenes over. The footer's and the hero's Rive scenes are the same
// artwork, so the curtain (the footer's own colour) hides the cut.
//
// Intent is required, not just reaching the end: a wheel / swipe / key that keeps pushing down, with the footer's
// letters already revealed (`data-footer-reveal="true"`, set by lib/footer/glassFooter.ts; absent with reduced motion, where
// there is no intro to replay, so the loop is off too).
const CURTAIN = "#0b0d12";
const WHEEL_NEEDED = 90; // accumulated downward wheel delta (px) within WHEEL_WINDOW ms
const WHEEL_WINDOW = 700;
const SWIPE_NEEDED = 70; // upward finger travel (px)
const DOWN_KEYS = new Set(["ArrowDown", "PageDown", "End", " "]);

type Replay = () => void;

export function initPageLoop(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const html = document.documentElement;
  let busy = false;
  let wheelSum = 0;
  let wheelAt = 0;
  let touchY: number | null = null;

  const atBottom = () => window.scrollY + window.innerHeight >= html.scrollHeight - 3;
  const footerOpen = () => document.querySelector<HTMLElement>("[data-footer-stage]")?.dataset.footerReveal === "true";
  const ready = () => !busy && atBottom() && footerOpen() && !html.classList.contains("hero-locked");

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const curtain = document.createElement("div");
  curtain.setAttribute("aria-hidden", "true");
  curtain.style.cssText = `position:fixed;inset:0;z-index:200;background:${CURTAIN};opacity:0;pointer-events:none;transition:opacity .7s ease`;

  async function loop() {
    const replay = (window as unknown as { __fluxaHeroReplay?: Replay }).__fluxaHeroReplay;
    if (!replay) return;
    busy = true;
    document.body.append(curtain);
    html.classList.add("hero-locked"); // no scrolling while the curtain is closing
    curtain.style.pointerEvents = "auto";
    requestAnimationFrame(() => (curtain.style.opacity = "1"));
    await wait(750);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await wait(1100); // the pinned scenes rewind (their scrubs lag behind the jump) while nobody can see
    replay();
    curtain.style.opacity = "0";
    await wait(800);
    curtain.style.pointerEvents = "none";
    curtain.remove();
    // the intro keeps `hero-locked` until it has finished; busy stays true until then so a stray wheel cannot restart it
    while (html.classList.contains("hero-locked")) await wait(200);
    wheelSum = 0;
    busy = false;
  }

  window.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY <= 0 || !ready()) {
        wheelSum = 0;
        return;
      }
      const now = performance.now();
      wheelSum = now - wheelAt > WHEEL_WINDOW ? e.deltaY : wheelSum + e.deltaY;
      wheelAt = now;
      if (wheelSum >= WHEEL_NEEDED) void loop();
    },
    { passive: true },
  );
  window.addEventListener("touchstart", (e) => (touchY = e.touches[0]?.clientY ?? null), { passive: true });
  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchY === null || !ready()) return;
      if (touchY - (e.touches[0]?.clientY ?? touchY) >= SWIPE_NEEDED) {
        touchY = null;
        void loop();
      }
    },
    { passive: true },
  );
  window.addEventListener("keydown", (e) => {
    if (DOWN_KEYS.has(e.key) && ready()) void loop();
  });
}
