// The implementation (and its long design history) lives in packages/ui so the marketing site can render the
// exact same button. Kept as a re-export so every existing `./ButtonPrimary` import in this app is untouched.
export { ButtonPrimary } from "@fluxa/ui";
