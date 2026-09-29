// Motion vocabulary shared by CSS (tailwind.config.mjs `ease-*`), the reveal
// helper and GSAP timelines, so an animation never invents its own timing.

export const DURATION = {
  fast: 0.2,
  base: 0.5,
  slow: 0.9,
} as const;

/** CSS cubic-bezier strings, mirrored in tailwind.config.mjs. */
export const EASE_CSS = {
  outExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOutQuart: "cubic-bezier(0.76, 0, 0.24, 1)",
} as const;

/** GSAP ease names equivalent to the CSS curves above. */
export const EASE_GSAP = {
  outExpo: "expo.out",
  inOutQuart: "power4.inOut",
} as const;

export const STAGGER = 0.08;
