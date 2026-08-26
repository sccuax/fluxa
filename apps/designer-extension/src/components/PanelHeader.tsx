import { Icon } from "./Icon";

export function PanelHeader({
  title,
  onClose,
  titleUnderline = false,
}: {
  title: string;
  // Also doubles as ManageProfileScreen's "back to Account" trigger - per
  // explicit direction to reuse the Color modal's own X affordance for that
  // instead of a dedicated back-arrow button (which this component used to
  // have as a separate `onBack` prop, now removed since nothing else needs
  // it).
  onClose?: () => void;
  titleUnderline?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between border-b border-border-border bg-background-white-2 px-[20px] ${
        // h-[48px]/py-[12px] is the Color modal's own verified spec (see
        // ControlPanel.tsx's FullViewModal, this component's original call
        // site) - fine there since its plain title has no extra vertical
        // spacing of its own. The titleUnderline variant's span already
        // carries its own py-3 (Account/ManageProfile's "tab" look, ~44px
        // tall with the accent border under it) - forcing it into the same
        // fixed 48px/py-12px box (24px of actual content room) made it
        // overflow, which is what threw its own border-b-accent-500 out of
        // alignment with this div's real border-b. Left unconstrained here
        // instead, so the span's own height fully determines the box's
        // height and its border sits flush with this div's, with nothing
        // separating them.
        titleUnderline ? "" : "h-[48px] py-[12px]"
      }`}
    >
      <span
        className={
          titleUnderline
            ? " py-3 border-b border-b-accent-500 font-display text-header-h5 text-text-black"
            : "font-display text-mobile-display-d1 text-text-black"
        }
      >
        {title}
      </span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
