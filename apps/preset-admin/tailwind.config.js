import tokens from "@fluxa/design-tokens/dist/tailwind-theme.cjs";

// Mirrors apps/designer-extension/tailwind.config.js exactly (same tokens,
// same flattening, same keyframes) so the reused ControlPanel/GradientCanvas
// components render pixel-identical here - content also scans
// designer-extension's own src, since that's where the actual className
// strings for those reused components live (Tailwind can't generate classes
// for strings it never sees).
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
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../designer-extension/src/**/*.{ts,tsx}"],
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
        "modal-slide-up": {
          "0%": { opacity: "0.75", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "modal-slide-down": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0.75", transform: "translateY(100%)" },
        },
      },
      animation: {
        // Must match FullViewModal.tsx's MODAL_ANIMATION_MS - see that
        // constant's own comment for why the two can't be linked
        // automatically.
        "modal-slide-up": "modal-slide-up 540ms ease-in-out forwards",
        "modal-slide-down": "modal-slide-down 540ms ease-in-out forwards",
      },
    },
  },
  plugins: [],
};
