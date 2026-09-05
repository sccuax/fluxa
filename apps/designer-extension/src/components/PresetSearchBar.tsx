import { Icon } from "./Icon";

// A compact search input for PresetsTab - same "relative wrapper + a
// leading/trailing icon positioned absolutely inside the border" shape as
// AuthPasswordField's show/hide toggle and ColorValueField's copy button,
// just with the icon on the left instead of the right. bg-transparent is
// explicit for the same reason ManageProfileScreen's fields need it -
// Tailwind's preflight only resets background-color for button-*type*
// inputs, never plain text ones, so this would otherwise render a plain
// white box that mismatches whatever background it sits on.
export function PresetSearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative flex h-8 w-full items-center">
      <Icon name="search" className="pointer-events-none absolute left-2 text-text-secondary" width={14} height={14} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search presets"
        className="h-full w-full appearance-none rounded-4 border border-border-border bg-transparent py-1 pl-7 pr-2 font-sans text-mobile-text-md-regular text-text-black placeholder:text-text-secondary focus:border-accent-500 focus:outline-none"
      />
    </div>
  );
}
