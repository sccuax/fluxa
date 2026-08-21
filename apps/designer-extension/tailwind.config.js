import tokens from "@fluxa/design-tokens/dist/tailwind-theme.cjs";

// Unlike `colors`, Tailwind's `backgroundImage` core plugin doesn't flatten
// nested theme objects on its own - it only reads one level deep. Our tokens
// keep `backgroundImage.gradient.gradient` nested on purpose (see CLAUDE.md),
// so flatten it here to `"gradient-gradient"` or the class (`bg-gradient-gradient`)
// never gets generated at all.
function flattenOneLevel(obj) {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[key, value]]
        : Object.entries(value).map(([subKey, subValue]) => [`${key}-${subKey}`, subValue]),
    ),
  );
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      ...tokens,
      backgroundImage: flattenOneLevel(tokens.backgroundImage),
      fontFamily: {
        ...tokens.fontFamily,
        sans: [...tokens.fontFamily["general-sans"], "sans-serif"],
        display: [...tokens.fontFamily["bricolage-grotesque"], "sans-serif"],
      },
      keyframes: {
        "fill-bar": {
          "0%": { width: "0%" },
          "15%": { width: "50%" },
          "35%": { width: "50%" },
          "55%": { width: "75%" },
          "75%": { width: "75%" },
          "100%": { width: "100%" },
        },
        // translateY(100%) - a percentage transform is relative to the
        // element's own height, not a fixed px nudge - so the modal starts
        // fully below its own bounding box (genuinely off-screen, below the
        // visible panel) and slides all the way up into place, like a real
        // bottom sheet. A small px offset (24px was tried first) reads as
        // "already mostly in place" against a modal this tall (it spans
        // nearly the full panel height, header to nav) - barely perceptible
        // motion, not a slide.
        "modal-slide-up": {
          "0%": { opacity: "0.75", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // The literal reverse of modal-slide-up (not just the same keyframes
        // played backwards via animation-direction: reverse) - ControlPanel.tsx's
        // FullViewModal swaps between these two classes on close rather than
        // toggling a CSS direction, since it also needs a plain JS number
        // (MODAL_ANIMATION_MS) to delay the real unmount until the animation
        // finishes - the duration below must stay in sync with that constant.
        "modal-slide-down": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0.75", transform: "translateY(100%)" },
        },
        // AppliedGradientsMenu's own entrance - same fade-in language as the
        // color modal above, but a much shorter travel distance (-8px, not
        // 100% of its own height) since this is a small anchored dropdown
        // hanging right off the header, not a full panel-covering sheet -
        // reads as "unfolding" down from the header edge rather than
        // sliding up from off-screen.
        "dropdown-fade-in": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // The literal reverse of dropdown-fade-in - AppliedGradientsMenu.tsx
        // swaps between these two classes on close (same pattern as
        // ControlPanel.tsx's FullViewModal modal-slide-up/-down above) and
        // delays its own real unmount by DROPDOWN_ANIMATION_MS so the exit
        // actually gets to play instead of the dropdown just vanishing the
        // instant `open` goes false - that constant must stay in sync with
        // the duration below.
        "dropdown-fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fill-bar": "fill-bar 3s ease-out forwards",
        // 540ms - must match ControlPanel.tsx's MODAL_ANIMATION_MS exactly
        // (see that constant's own comment for why the two can't be linked
        // automatically). ease-in-out (accelerate then decelerate) on both
        // the entrance and the exit, per explicit direction - same curve for
        // both rather than the ease-out/ease-in pairing tried first.
        "modal-slide-up": "modal-slide-up 540ms ease-in-out forwards",
        "modal-slide-down": "modal-slide-down 540ms ease-in-out forwards",
        // 200ms - must match AppliedGradientsMenu.tsx's DROPDOWN_ANIMATION_MS.
        "dropdown-fade-in": "dropdown-fade-in 200ms ease-out forwards",
        "dropdown-fade-out": "dropdown-fade-out 200ms ease-in forwards",
      },
    },
  },
  plugins: [],
};
