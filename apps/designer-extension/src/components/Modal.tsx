import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      {/* relative + overflow-hidden on the card itself (not the full-screen
          backdrop above) - the decorative banner is absolutely positioned
          against *this* box so it's clipped to the card's own rounded
          corners, same pattern as AuthHeaderBanner.tsx. It was previously a
          ~100-line inline <svg> pasted straight from Figma's export sitting
          in the backdrop div instead: besides breaking the intended look
          (position: absolute there anchors to the full-screen backdrop, not
          the card, so it rendered pinned to the corner of the whole panel
          instead of behind the card content), a raw Figma SVG export also
          isn't safe to inline as JSX as-is - see CLAUDE.md's note on
          AuthHeaderBanner for why (e.g. `style="mask-type:luminance"` is a
          *string*, but React's `style` prop must be an object; it silently
          did nothing rather than crashing, but that's exactly the kind of
          quiet failure this component pattern exists to avoid). Extracted
          to a static asset instead: public/images/modal-header-bg.svg. */}
      <div
        className="relative mx-6 flex max-w-[260px] flex-col items-center gap-4 overflow-hidden rounded-8 bg-white p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="./images/modal-header-bg.svg"
          alt=""
          className="pointer-events-none absolute left-0 top-0 z-[1] h-auto w-full"
        />
        <div className="relative z-[2] flex w-full flex-col items-center gap-3">{children}</div>
      </div>
    </div>
  );
}
