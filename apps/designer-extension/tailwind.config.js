import tokens from "@fluxa/design-tokens/dist/tailwind-theme.cjs";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      ...tokens,
      fontFamily: {
        ...tokens.fontFamily,
        sans: [...tokens.fontFamily["general-sans"], "sans-serif"],
        display: [...tokens.fontFamily["bricolage-grotesque"], "sans-serif"],
      },
    },
  },
  plugins: [],
};
