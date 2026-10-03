// Hover effect of the last features cell (the column of preset thumbnails): the column turns into a vertical 3D carousel
// while the pointer is over the cell, and settles back into a flat, aligned column when it leaves.
//
// Markup (components/sections/FeaturesIntro.astro):
//   <div data-pcar>                      the cell (hover target)
//     <div data-pcar-stage>              perspective + the top/bottom fade
//       <div data-pcar-card style="--o:-1.5">   one thumbnail; --o = its resting offset from the centre, in card pitches
//
// Without JS the cards are placed by CSS from `--o` (a flat column). Here, `s` is how far the carousel has turned (in
// cards) and `k` (0..1) how much of the 3D look is on: a card at offset `o` sits on a cylinder (y = R sin(a), z pulled back
// by R(1 - cos(a)), tilted by a, a = o * STEP * k), so k = 0 is exactly the flat column. On leave, k eases back to 0 while
// the turn finishes on the next whole card, so it always comes to rest as a plain aligned column.
const STEP = (24 * Math.PI) / 180; // angle between neighbouring cards when fully 3D
const SPEED = 0.55; // cards per second while hovered
const PITCH_REM = 9.1875 + 2.46; // card height + gap (matches FeaturesIntro)

export function initPresetCarousel(): void {
  const root = document.querySelector<HTMLElement>("[data-pcar]");
  const cards = root ? Array.from(root.querySelectorAll<HTMLElement>("[data-pcar-card]")) : [];
  if (!root || cards.length === 0) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(any-hover: hover)").matches) return;

  const N = cards.length;
  const rest = cards.map((c) => Number(c.style.getPropertyValue("--o")) || 0);
  const pitch = () => PITCH_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);

  let hover = false;
  let k = 0;
  let s = 0;
  let target = 0;
  let raf = 0;
  let last = 0;

  const wrap = (x: number) => ((((x + N / 2) % N) + N) % N) - N / 2;

  const paint = () => {
    const p = pitch();
    cards.forEach((card, i) => {
      const o = wrap(rest[i] - s);
      if (k < 0.001) {
        card.style.transform = `translate3d(0, ${o * p}px, 0)`;
        return;
      }
      const a = o * STEP * k;
      const R = p / (STEP * k);
      const y = R * Math.sin(a);
      const z = -R * (1 - Math.cos(a));
      card.style.transform = `translate3d(0, ${y}px, ${z}px) rotateX(${(-a * 180) / Math.PI}deg)`;
    });
  };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    k += ((hover ? 1 : 0) - k) * (1 - Math.exp(-dt * 6));
    if (hover) s += SPEED * dt * Math.min(1, k * 1.6);
    else s += (target - s) * (1 - Math.exp(-dt * 5));
    if (!hover && k < 0.002 && Math.abs(target - s) < 0.002) {
      k = 0;
      s = target % N;
      paint();
      raf = 0;
      return;
    }
    paint();
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  root.addEventListener("pointerenter", () => {
    hover = true;
    run();
  });
  root.addEventListener("pointerleave", () => {
    hover = false;
    target = Math.ceil(s - 0.001);
    run();
  });
}
