// Infinite scroll: when the visitor keeps scrolling down at the very end of the page (the footer fully open), the footer's
// glass letters melt away (and its legal row fades), the page jumps to the top WITHOUT any curtain, and the page-load intro
// plays again (Hero.astro exposes `window.__fluxaHeroReplay`): navbar drops, the mark rises and flips, the hero's wordmark
// appears, and the hero's scenes start over. Nothing reloads and the screen never goes black, because the footer and the
// top of the page show the same picture: the same Rive scene on the same bottom-aligned 1440px stage with the same mask and
// overlay (sections/HeroScene.astro uses the footer's own renderer), so once the letters are gone the jump is invisible.
//
// Intent is required, not just reaching the end: a wheel / swipe / key that keeps pushing down, with the footer's letters
// already revealed (`data-footer-reveal="true"`, set by lib/footer/glassFooter.ts; absent with reduced motion, where there is no
// intro to replay, so the loop is off too).
import { loadGsap } from "./gsap";

const DISMISS_MS = 800; // the letters melt away (glassFooter's DISMISS_MS + a beat)
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

  async function loop() {
    const replay = (window as unknown as { __fluxaHeroReplay?: Replay }).__fluxaHeroReplay;
    if (!replay) return;
    busy = true;
    html.classList.add("hero-locked"); // no scrolling while the letters go
    window.dispatchEvent(new CustomEvent("fluxa:footer-dismiss"));
    await wait(DISMISS_MS);

    // The jump. The pinned scenes are scrubbed (they lag behind the scroll position), so without help the whole page would
    // visibly rewind: finish every scrub tween on the spot, so the top of the page is already at scene 1 when it appears.
    const { ScrollTrigger } = await loadGsap();
    // All in one tick, in this order: jump, finish the scrubs, THEN put the hero in its intro's start pose (letters, mark and navbar
    // hidden) and restart the intro. The first paint at the top never shows the finished wordmark (it used to flash for a
    // moment), and nothing the scroll timeline rewinds can undo the start pose.
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    ScrollTrigger.update();
    ScrollTrigger.getAll().forEach((st) => st.getTween?.(false)?.progress(1));
    replay();

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
