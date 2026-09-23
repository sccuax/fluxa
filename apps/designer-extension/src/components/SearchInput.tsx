import { Icon } from "./Icon";

// Shared search bar - ManageGalleryImagesScreen.tsx's original one-off
// `<input>` restyled per explicit spec, then reused as-is by
// CmsVisibilityScreen.tsx (its own "reuse the search bar we already have in
// Manage" direction) rather than a second copy that could drift. A 16x16
// magnifying-glass icon (Icon.tsx's own `magnifyingGlass`, already the exact
// asset this app's "Detect Collection List" button uses) sits 8px from the
// input's left edge, colored with the same `border-border` token the
// input's own border already uses - `pointer-events-none` so it never
// steals a click meant for the input under it. `pl-8` (not the `p-3`
// baseline's own 12px) gives it enough clearance so typed/placeholder text
// never overlaps the icon.
export function SearchInput({
  value,
  onChange,
  placeholder = "Search posts...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Icon
        name="magnifyingGlass"
        className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-border-border"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-4 border border-border-border bg-background-white p-3 pl-8 font-sans text-mobile-text-sm-regular text-text-black outline-none placeholder:font-sans placeholder:text-mobile-text-sm-regular placeholder:text-border-border focus:border-accent-500"
      />
    </div>
  );
}
