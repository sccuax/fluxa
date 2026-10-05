// Section 6 -> footer hand-over. The CTA itself is a plain section now (only its text animates, see Cta.astro); this module
// only pins the stage (FAQ + CTA) when its bottom reaches the bottom of the viewport and plays the footer entrance: the
// footer rises over the finished CTA through the logo-shaped clip, dimming it.
//
// Markup (pages/index.astro): <div data-cta-stage> FAQ, CTA, [data-cta-dim], [data-cta-footer] </div>
// From `lg` and with motion allowed the stage gets `.is-stage` (the footer leaves the flow and waits hidden). Below `lg` /
// with reduced motion nothing runs and the footer is a normal section after the CTA.
// Once the footer entrance starts the FAQ's 3D object is paused (event `fluxa:faq-covered`).
import { loadGsap } from "./gsap";
import { MARK_PATH } from "@/config/wordmark";

const COVERED_EVENT = "fluxa:faq-covered";
const GATE_EVENT = "fluxa:footer-gate";
const VP_PER_UNIT = 2.1 / 1.35; // scroll length (viewports) per timeline unit
const CTA_DWELL = 0.8; // scroll the finished CTA stays on screen before the footer can fire (fast scrollers)
const FOOTER_HOLD = 0.35; // scroll left after the CTA settles: crossing the threshold plays the whole footer entrance
const REVEAL_EVENT = "fluxa:footer-reveal";
const FOOTER_SECONDS = 1.5; // the entrance is TIME-based: one scroll gesture past the threshold plays it all

export async function initCtaStage(): Promise<void> {
  const stage = document.querySelector<HTMLElement>("[data-cta-stage]");
  const footer = stage?.querySelector<HTMLElement>("[data-cta-footer]");
  const dim = stage?.querySelector<HTMLElement>("[data-cta-dim]");
  // the var goes on the grid's PARENT: scrollDraw owns tweens (overwrite) on the grid element itself and would kill ours
  const grid = stage?.closest<HTMLElement>(".page-grid")?.parentElement;
  const clip = document.getElementById("footer-reveal-path");
  if (!stage || !footer || !dim || !grid || !clip) return;

  let mods: Awaited<ReturnType<typeof loadGsap>>;
  try {
    mods = await loadGsap();
  } catch (err) {
    console.warn("[ctaStage] GSAP failed to load, the CTA stays a plain section", err);
    return;
  }
  const { gsap, ScrollTrigger } = mods;

  let covered = false;
  let footerAt = Infinity; // timeline time at which the footer entrance fires (set once the timeline is built)
  const setCovered = (next: boolean) => {
    if (next === covered) return;
    covered = next;
    window.dispatchEvent(new CustomEvent(COVERED_EVENT, { detail: covered }));
  };

  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
    stage.classList.add("is-stage");

    // The footer entrance: a circle that starts complete at the bottom of the viewport and grows; its lower left / right
    // points stay on the bottom edge of the screen (the centre is fixed, so the circle just outgrows the viewport).
    // Not scrubbed: crossing the threshold plays it (and scrolling back up reverses it).
    footer.dataset.gate = "closed"; // the footer's scene sleeps until the entrance runs (lib/footer/glassFooter.ts)
    // The shape is the LOGO: #footer-reveal's path (32-unit space) is scaled to 2r and centred on (w/2, h - min(r, r0)), so
    // it starts complete at the bottom edge and its lower lobes slide along it as it outgrows the screen.
    const markPath = new Path2D(MARK_PATH);
    const probe = document.createElement("canvas").getContext("2d")!;
    const startR = () => Math.max(window.innerWidth, window.innerHeight) * 0.04;
    const place = (r: number) => {
      const w = footer.offsetWidth;
      const h = footer.offsetHeight;
      const cy = h - Math.min(r, startR());
      clip.setAttribute("transform", `translate(${w / 2 - r} ${cy - r}) scale(${(2 * r) / 32})`);
    };
    // smallest half-size at which the logo (not just its bounding square) covers the whole footer
    const coverRadius = () => {
      const w = footer.offsetWidth;
      const h = footer.offsetHeight;
      const cy = h - startR();
      const pts: [number, number][] = [];
      // the whole border, finely: the logo's waist (its notches sit at the height of the centre) leaves thin slivers
      for (let x = 0; x <= w; x += 6) pts.push([x, 0], [x, h]);
      for (let y = 0; y <= h; y += 6) pts.push([0, y], [w, y]);
      for (let r = Math.max(w, h) / 2; r < Math.max(w, h) * 8; r *= 1.08) {
        const k = 32 / (2 * r);
        if (pts.every(([x, y]) => probe.isPointInPath(markPath, (x - (w / 2 - r)) * k, (y - (cy - r)) * k))) return r * 1.05;
      }
      return Math.max(w, h) * 8;
    };
    const reveal = { r: 0 };
    const ftl = gsap.timeline({
      paused: true,
      defaults: { ease: "power3.inOut" },
      onReverseComplete: () => openGate(false),
    });
    ftl
      .set(footer, { autoAlpha: 1 }, 0)
      .to(reveal, { r: 1, duration: FOOTER_SECONDS, onUpdate: () => place(reveal.r) }, 0) // r: set by refit()
      .fromTo(dim, { opacity: 0 }, { opacity: 0.75, duration: FOOTER_SECONDS, ease: "none" }, 0)
      // the page's vertical rules would draw over the footer: fade them out as it covers the page
      .fromTo(grid, { "--grid-fade": 1 }, { "--grid-fade": 0, duration: FOOTER_SECONDS * 0.4, ease: "none" }, FOOTER_SECONDS * 0.3)
      // the letters melt in and the legal row appears once the logo is well open (the footer's scene listens)
      .call(() => window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: !ftl.reversed() })), [], FOOTER_SECONDS * 0.5);
    const grow = ftl.getTweensOf(reveal)[0];
    const refit = () => {
      grow.vars.r = coverRadius();
      grow.invalidate();
      place(reveal.r);
    };
    refit();
    ScrollTrigger.addEventListener("refresh", refit);
    let footerOn = false;
    const setFooter = (on: boolean) => {
      if (on === footerOn) return;
      footerOn = on;
      if (on) {
        openGate(true);
        ftl.play();
      } else ftl.reverse();
    };
    const openGate = (open: boolean) => {
      footer.dataset.gate = open ? "open" : "closed";
      window.dispatchEvent(new CustomEvent(GATE_EVENT));
    };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: stage,
        start: "bottom bottom",
        end: () => "+=" + Math.round(window.innerHeight * VP_PER_UNIT * tl.duration()),
        pin: true,
        anticipatePin: 1,
        scrub: 0.6,
        invalidateOnRefresh: true,
        refreshPriority: -1, // measured after the hero's pin spacer exists (see scrollDraw.ts)
        onUpdate: (self) => {
          const time = self.progress * (self.animation?.duration() ?? 1);
          setCovered(time >= footerAt);
          setFooter(time >= footerAt);
        },
        onLeaveBack: () => {
          setFooter(false);
          setCovered(false);
        },
      },
    });
    tl.to({}, { duration: CTA_DWELL }); // the finished CTA stays: a fast scroller does not skip straight to the footer
    footerAt = tl.duration();
    tl.to({}, { duration: FOOTER_HOLD }); // scroll left for the footer: it plays by itself once footerAt is crossed

    // the CTA left the flow: positions below it changed
    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      ScrollTrigger.removeEventListener("refresh", refit);
      ftl.kill();
      window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: true })); // plain layout: the footer simply shows
      delete footer.dataset.gate;
      window.dispatchEvent(new CustomEvent(GATE_EVENT));
      stage.classList.remove("is-stage");
      setCovered(false);
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
  });
}
