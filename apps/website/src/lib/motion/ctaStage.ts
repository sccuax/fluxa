// Section 5 -> 6 transition, in the spirit of the hero's scene hand-overs: the old scene dims, the background changes,
// then the letters come in. Pinned and scrubbed.
//
// Markup (components/sections/Cta.astro, wrapped with the FAQ in pages/index.astro):
//   <div data-cta-stage>                 FAQ section + the CTA "sheet"
//     <section id="faq">...</section>
//     <div data-cta-sheet> [top gap] [<section id="cta"> <div data-cta-panel> <div data-cta-content> ] [bottom gap] </div>
//   </div>
//
// From `lg` and with motion allowed, the stage gets `.is-stage`: the sheet leaves the flow and becomes a viewport-sized
// overlay (hidden) anchored to the stage's bottom. The stage is pinned when its bottom reaches the bottom of the
// viewport (the whole FAQ has been read) and the scroll then drives one timeline (units, ~1.35 in total):
//   0.00 - 0.20  hold: the FAQ stays as it is (a little slack before anything moves)
//   0.20 - 0.50  the sheet fades in over the FAQ. It has the FAQ's own background colour, so the FAQ just dims away
//   0.45 - 0.90  the dark panel (the new background) grows from a small rounded card to the full row between the page
//                paddings and the top / bottom gaps, fading in
//   0.62 - 0.87  the two section lines draw, as the panel passes the middle of its growth
//   0.80 - 1.20  headline, body and button come in
// Once the sheet fully covers the FAQ (0.50) the FAQ's 3D object is paused (event `fluxa:faq-covered`, same idea as pausing the
// shader behind a modal in the extension's editor).
// Below `lg` / with reduced motion nothing runs: the CTA is a plain section after the FAQ.
import { loadGsap } from "./gsap";

const COVERED_EVENT = "fluxa:faq-covered";
const COVER_AT = 0.5; // timeline time at which the sheet fully covers the FAQ

export async function initCtaStage(): Promise<void> {
  const stage = document.querySelector<HTMLElement>("[data-cta-stage]");
  const sheet = stage?.querySelector<HTMLElement>("[data-cta-sheet]");
  const panel = stage?.querySelector<HTMLElement>("[data-cta-panel]");
  const content = stage?.querySelector<HTMLElement>("[data-cta-content]");
  if (!stage || !sheet || !panel || !content) return;

  let mods: Awaited<ReturnType<typeof loadGsap>>;
  try {
    mods = await loadGsap();
  } catch (err) {
    console.warn("[ctaStage] GSAP failed to load, the CTA stays a plain section", err);
    return;
  }
  const { gsap, ScrollTrigger } = mods;

  let covered = false;
  const setCovered = (next: boolean) => {
    if (next === covered) return;
    covered = next;
    window.dispatchEvent(new CustomEvent(COVERED_EVENT, { detail: covered }));
  };

  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
    stage.classList.add("is-stage");
    const parts = Array.from(content.children) as HTMLElement[]; // headline, body, button

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: stage,
        start: "bottom bottom",
        end: () => "+=" + Math.round(window.innerHeight * 2.1),
        pin: true,
        anticipatePin: 1,
        scrub: 0.6,
        invalidateOnRefresh: true,
        refreshPriority: -1, // measured after the hero's pin spacer exists (see scrollDraw.ts)
        onUpdate: (self) => {
          const time = self.progress * (self.animation?.duration() ?? 1);
          setCovered(time >= COVER_AT);
          stage.classList.toggle("cta-live", time >= 0.3);
        },
        onLeaveBack: () => {
          setCovered(false);
          stage.classList.remove("cta-live");
        },
      },
    });
    tl.set(sheet, { "--cta-line": 0 }, 0)
      .fromTo(sheet, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.2)
      .fromTo(
        panel,
        { clipPath: "inset(30% 32% 30% 32% round 36px)", opacity: 0 },
        { clipPath: "inset(0% 0% 0% 0% round 0px)", opacity: 1, duration: 0.45, ease: "power2.inOut" },
        0.45,
      )
      .to(sheet, { "--cta-line": 1, duration: 0.25, ease: "power2.out" }, 0.62)
      .fromTo(parts, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.1, ease: "power2.out" }, 0.8)
      .to({}, { duration: 0.15 }); // hold at the end so the last motion settles before the pin releases

    // the CTA left the flow: positions below it changed
    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      stage.classList.remove("is-stage", "cta-live");
      setCovered(false);
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
  });
}
