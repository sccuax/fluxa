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
      },
      animation: {
        "fill-bar": "fill-bar 3s ease-out forwards",
      },
    },
  },
  plugins: [],
};
