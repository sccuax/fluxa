// Standard section-heading entrance, the same one the hero copy uses: the badge floats in, the title rises word by
// word out of a line mask, an optional paragraph follows line by line. Time-based (not scrubbed) and triggered by
// scroll position; scrolling back above the trigger plays a quick exit so it replays on the next pass.
// Needs GSAP + SplitText, loaded lazily (lib/motion/gsap.ts); with reduced motion everything just shows.
//
// Markup contract (any element can be the block):
//   <div data-heading-reveal>
//     <div data-hr-badge>...</div>                 optional
//     <h2 data-hr-title>Plain <span data-hr-accent>accent words</span> more</h2>
//     <p data-hr-body>...</p>                      optional
//   </div>
//
// `[data-hr-accent]` words keep a continuous brand gradient across the accent text even though SplitText gives
// every word its own transform (which would break one `background-clip:text` on the parent): each word paints
// the gradient of the whole accent box, shifted by its own offset (styles/global.css `.hr-accent-word`).
// Optional per-block attribute: data-hr-start="78%" (viewport line where the entrance fires; default 78%).

import { loadGsap, loadSplitText } from "./gsap";

// Hero headline gradient: resting position is --tg 0; it starts shifted left by TG_START (see global.css).
const TG_START = -47.44;
const MAX_STAGGER = 0.055; // gap between words for a short title
const WORDS_BUDGET = 0.7; // s the words' stagger may span in total: longer titles get a smaller gap
const VISIBLE_LAND = 0.55; // s after a word starts until expo.out has visually settled

interface SplitSelf {
  words: Element[];
  lines: Element[];
}

export async function initHeadingReveal(root: ParentNode = document): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-heading-reveal]"));
  if (blocks.length === 0) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    console.info("[headingReveal] prefers-reduced-motion is ON: heading shown without animation");
    blocks.forEach((b) => b.classList.add("hr-ready"));
    return;
  }

  let gsapMods: Awaited<ReturnType<typeof loadGsap>>;
  let SplitText: Awaited<ReturnType<typeof loadSplitText>>;
  try {
    [gsapMods, SplitText] = await Promise.all([loadGsap(), loadSplitText()]);
    await document.fonts.ready;
  } catch (err) {
    console.warn("[headingReveal] GSAP/SplitText failed to load, showing the heading statically", err);
    blocks.forEach((b) => b.classList.add("hr-ready")); // never leave the heading hidden if GSAP fails to load
    return;
  }
  const { gsap, ScrollTrigger } = gsapMods;

  for (const block of blocks) {
    const badge = block.querySelector<HTMLElement>("[data-hr-badge]");
    const title = block.querySelector<HTMLElement>("[data-hr-title]");
    const body = block.querySelector<HTMLElement>("[data-hr-body]");
    if (!title) {
      block.classList.add("hr-ready");
      continue;
    }

    let on = false;
    let words: Element[] = [];
    let lines: Element[] = [];
    let titleLines: HTMLElement[] = [];
    // data-hr-gradient: the title is painted with the hero headline gradient, which sweeps in line by line.
    const gradient = title.hasAttribute("data-hr-gradient");
    const hidden = () => {
      if (badge) gsap.set(badge, { opacity: 0, y: 14, scale: 0.94, filter: "blur(6px)" });
      gsap.set(words, { yPercent: 115, rotation: 3, opacity: 0 });
      if (lines.length) gsap.set(lines, { yPercent: 110, opacity: 0 });
      if (gradient && titleLines.length) gsap.set(titleLines, { "--tg": TG_START });
    };
    const shown = () => {
      if (badge) gsap.set(badge, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" });
      gsap.set(words, { yPercent: 0, rotation: 0, opacity: 1 });
      if (lines.length) gsap.set(lines, { yPercent: 0, opacity: 1 });
      if (gradient && titleLines.length) gsap.set(titleLines, { "--tg": 0 });
    };

    SplitText.create(title, {
      type: "lines,words",
      mask: "lines",
      linesClass: "hr-line",
      wordsClass: "hr-word",
      autoSplit: true,
      onSplit: (self: SplitSelf) => {
        words = self.words;
        titleLines = self.lines as HTMLElement[];
        if (gradient) {
          // Every word paints the gradient of the whole title box, shifted by its own offset, so it reads as one
          // continuous gradient across lines; `--tg` (set per line, inherited by its words) slides the ramp.
          const box = title.getBoundingClientRect();
          title.style.setProperty("--tg-w", box.width + "px");
          title.style.setProperty("--tg-h", box.height + "px");
          for (const w of words as HTMLElement[]) {
            const r = w.getBoundingClientRect();
            w.classList.add("hr-gradient-word");
            w.style.setProperty("--wx", box.left - r.left + "px");
            w.style.setProperty("--wy", box.top - r.top + "px");
          }
        }
        // Accent gradient offsets, measured before any pose is applied (no transforms on the words yet).
        const groups = new Map<Element, HTMLElement[]>();
        for (const w of words as HTMLElement[]) {
          const accent = w.closest("[data-hr-accent]");
          if (!accent) continue;
          accent.classList.remove("text-gradient-x"); // the per-word gradient replaces the parent's
          groups.set(accent, [...(groups.get(accent) ?? []), w]);
        }
        groups.forEach((ws) => {
          const rects = ws.map((w) => w.getBoundingClientRect());
          const left = Math.min(...rects.map((r) => r.left));
          const top = Math.min(...rects.map((r) => r.top));
          const width = Math.max(...rects.map((r) => r.right)) - left;
          const height = Math.max(...rects.map((r) => r.bottom)) - top;
          ws.forEach((w, i) => {
            w.classList.add("hr-accent-word");
            w.style.backgroundSize = `${width}px ${height}px`;
            w.style.backgroundPosition = `${left - rects[i].left}px ${top - rects[i].top}px`;
          });
        });
        on ? shown() : hidden();
      },
    });
    if (body) {
      SplitText.create(body, {
        type: "lines",
        mask: "lines",
        linesClass: "hr-line",
        autoSplit: true,
        onSplit: (self: SplitSelf) => {
          lines = self.lines;
          on ? shown() : hidden();
        },
      });
    }

    const play = (next: boolean) => {
      if (next === on) return;
      on = next;
      gsap.killTweensOf([...(badge ? [badge] : []), ...words, ...lines, ...titleLines]);
      if (on) {
        hidden(); // replay the full rise even if a previous exit only faded
        if (badge) gsap.to(badge, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "power3.out" });
        // Words appear faster the more of them there are: the gap between words shrinks so the whole title is in
        // within ~WORDS_BUDGET s however long it is (capped at MAX_STAGGER for short titles).
        const stagger = Math.min(MAX_STAGGER, WORDS_BUDGET / Math.max(1, words.length));
        gsap.to(words, { yPercent: 0, rotation: 0, opacity: 1, duration: 1, ease: "expo.out", stagger, delay: 0.1 });
        if (lines.length) gsap.to(lines, { yPercent: 0, opacity: 1, duration: 1, ease: "expo.out", stagger: 0.1, delay: 0.35 });
        if (gradient) {
          // Strictly line by line: a line's ramp starts only once the previous line's has finished (and not before
          // its own first word starts rising), and runs until its last word has visibly landed.
          let cursor = 0;
          titleLines.forEach((line) => {
            const inLine = (words as HTMLElement[]).filter((w) => line.contains(w));
            if (inLine.length === 0) return;
            const start = Math.max(cursor, 0.1 + stagger * words.indexOf(inLine[0]));
            const duration = stagger * (inLine.length - 1) + VISIBLE_LAND;
            gsap.to(line, { "--tg": 0, duration, ease: "none", delay: start, overwrite: "auto" });
            cursor = start + duration;
          });
        }
      } else {
        if (gradient && titleLines.length) gsap.to(titleLines, { "--tg": TG_START, duration: 0.3, ease: "power2.in", overwrite: "auto" });
        gsap.to([...(badge ? [badge] : []), ...words, ...lines], {
          opacity: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            if (!on) hidden();
          },
        });
      }
    };

    hidden();
    block.classList.add("hr-ready");
    if (import.meta.env.DEV) console.info("[headingReveal] ready:", title.textContent?.trim().slice(0, 40));
    ScrollTrigger.create({
      trigger: block,
      refreshPriority: -1, // measured after the hero's pin spacer exists (see scrollDraw.ts)
      start: `top ${block.dataset.hrStart ?? "78%"}`,
      onEnter: () => play(true),
      onLeaveBack: () => play(false),
    });
  }
}
