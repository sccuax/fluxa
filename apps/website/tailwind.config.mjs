import { createRequire } from "node:module";

// Same generated token theme the Designer Extension and Fluxa Studio consume,
// so the site and the product share one source of truth (Figma/Token Studio).
const require = createRequire(import.meta.url);
const tokens = require("@fluxa/design-tokens/dist/tailwind-theme.cjs");

// Tailwind's backgroundImage plugin only reads one level deep; see
// apps/designer-extension/tailwind.config.js for the same flattening.
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
  content: ["./src/**/*.{astro,html,md,mdx,ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      ...tokens,
      backgroundImage: flattenOneLevel(tokens.backgroundImage ?? {}),
      fontFamily: {
        ...tokens.fontFamily,
        sans: [...(tokens.fontFamily?.["general-sans"] ?? []), "system-ui", "sans-serif"],
        display: [...(tokens.fontFamily?.["bricolage-grotesque"] ?? []), "system-ui", "sans-serif"],
      },
      // Horizontal gutter of every page section (2.5rem desktop / 1.5rem mobile; the switch lives in
      // styles/global.css `--padding-global`). Class: `px-padding-global`.
      // `30` (7.5rem) is not in Tailwind's default scale (it jumps 28 -> 32); added so `mt-30`/`gap-30` work.
      spacing: { "padding-global": "var(--padding-global)", 30: "7.5rem" },
      // Content column of a section (see components/layout/Section.astro). Class: `max-w-section`.
      maxWidth: { section: "1440px" },
      transitionTimingFunction: {
        // Shared easing vocabulary for CSS and GSAP (see lib/motion/tokens.ts).
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-quart": "cubic-bezier(0.76, 0, 0.24, 1)",
      },
    },
  },
  plugins: [],
};
