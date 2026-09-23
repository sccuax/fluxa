import { Icon } from "./Icon";

// Generic destructive-confirm overlay, generalized from
// WebflowSolutionsScreen's own "Delete gallery?" confirmation (originally
// ConfirmDeleteGalleryModal.tsx, per explicit spec -
// copy-paste/Screenshot 202692211.png) once CmsImagesScreen.tsx needed the
// identical shell for its own "remove this image reuse?" confirmation - a
// real confirm step before any destructive delete actually runs, so a
// misclick on a dropdown's "Delete" row can't silently remove something
// with no way back. `title`/`description` are now props instead of
// hardcoded gallery copy; every other visual/behavioral detail (including
// the exact box size and gap structure) is unchanged.
//
// Built as its own standalone overlay+card rather than reusing the shared
// Modal.tsx shell: that component's card is content-sized up to a fixed
// max-w-[260px] with stacked full-width buttons (ConfirmDeleteAccountModal's
// own shape), while this one has an exact 232x218 box and a side-by-side
// button row - different enough that stretching Modal.tsx's own assumptions
// to fit would cost more than this small amount of duplication. Still
// reuses the same decorative top-left banner asset (modal-header-bg.svg)
// for visual consistency with every other modal in this app.
//
// Gap structure, matching the original spec exactly: the outer card is a
// flex-col with gap-4 (16px) - its two flow children (the icon+title+
// description group, and the button row) sit 16px apart via that same
// outer gap, which is also exactly the icon-to-title-group gap the spec
// calls out separately. The title/description pair gets its OWN nested
// gap-3 (12px), a tighter spacing than the rest of the column uses.
export function ConfirmDeleteModal({
  open,
  onCancel,
  onConfirm,
  isDeleting,
  title,
  description,
  confirmLabel = "Delete",
  confirmingLabel = "Deleting...",
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmingLabel?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="relative flex h-[218px] w-[232px] flex-col items-center justify-center gap-4 overflow-hidden rounded-8 bg-white p-8 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src="./images/modal-header-bg.svg"
          alt=""
          className="pointer-events-none absolute left-0 top-0 z-[1] h-auto w-full"
        />
        <div className="relative z-[2] flex w-full flex-col items-center gap-4">
          <Icon name="delete" className="h-8 w-8 shrink-0 text-text-color-accent" />
          <div className="flex flex-col gap-3">
            <p className="font-display text-mobile-header-h1 text-text-black">{title}</p>
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">{description}</p>
          </div>
        </div>
        <div className="relative z-[2] flex w-full gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-auto flex-1 rounded-32 border border-border-border py-2 font-sans text-text-sm-medium text-text-color-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-auto flex-1 rounded-32 bg-gradient-gradient py-2 font-sans text-text-sm-medium text-text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-none disabled:bg-background-white-2 disabled:border disabled:border-border-border disabled:text-text-secondary"
          >
            {isDeleting ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
