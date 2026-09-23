import type { ReactNode } from "react";
import { Icon } from "./Icon";

// Shared "one CMS post, expandable into its own controls" row chrome -
// factored out of ManageGalleryImagesScreen.tsx once CmsVisibilityScreen.tsx
// needed the identical accordion behavior (chevron toggle, bordered card,
// per-item highlight) with different expanded content (that screen shows an
// image grid + a "hide this post" toggle; CmsVisibilityScreen.tsx shows only
// the toggle, no images) - one component, two call sites, rather than a
// second near-copy that could drift.
export function ExpandableItemRow({
  title,
  meta,
  expanded,
  onToggle,
  highlighted,
  children,
}: {
  title: ReactNode;
  // Rendered to the left of the chevron, inside the same always-visible
  // header row - e.g. Manage's own "N images" count.
  meta?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  // Paints the row's own background with the soft `#CABEF4`/50 this app
  // already uses for an "active/highlighted" row elsewhere
  // (WebflowSolutionsScreen.tsx's own gallery-card menu-open state) when
  // true, the plain neutral background otherwise - purely a color switch,
  // no fixed meaning of its own. Both call sites (ManageGalleryImagesScreen.tsx,
  // CmsVisibilityScreen.tsx) pass `true` for a VISIBLE post and `false` for
  // a hidden one, per explicit direction - inverted from this row's
  // original "flag what's hidden" convention.
  highlighted?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-4 border border-border-border px-3 py-2 ${
        highlighted ? "bg-[#CABEF4]/50" : "bg-background-white-2"
      }`}
    >
      <button type="button" onClick={onToggle} className="flex items-center justify-between gap-2 text-left">
        <span className="min-w-0 truncate font-sans text-mobile-text-sm-regular text-text-black">{title}</span>
        <span className="flex shrink-0 items-center gap-2 font-sans text-mobile-text-sm-regular text-text-secondary">
          {meta}
          <Icon name="chevronDown" className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      {expanded && children && (
        <div className="flex flex-col gap-3 border-t border-border-border pt-2">{children}</div>
      )}
    </div>
  );
}
