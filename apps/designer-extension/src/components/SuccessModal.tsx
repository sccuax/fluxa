import { Modal } from "./Modal";

// Shared success content (checkmark icon + title + caption), factored out of
// ResetPasswordScreen.tsx's "Password changed successfully" modal - its
// original sole call site - once ManageProfileScreen needed the same
// indicator for both its "Change password" button and its "Save" button
// ("Saved successfully"), per explicit direction to reuse "el icono que
// usamos para el password change" rather than duplicate the icon a third
// time. title/caption are both props since, unlike the icon, the copy
// genuinely differs per context.
export function SuccessModal({
  open,
  onClose,
  title,
  caption,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  caption: string;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full">
        <svg width="38" height="32" viewBox="0 0 38 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="25.9287" cy="12" r="5" fill="#E23F8C" />
          <circle cx="32.9287" cy="5" r="5" fill="#E23F8C" />
          <path
            d="M15.5358 15.5357C17.4884 13.5831 20.6544 13.5831 22.607 15.5357C24.5595 17.4883 24.5596 20.6544 22.607 22.607L16.0641 29.149C15.9254 29.3327 15.7735 29.5099 15.6061 29.6773C14.6258 30.6576 13.3401 31.1452 12.0553 31.1412C10.7573 31.1555 9.45488 30.6686 8.46446 29.6783C8.29341 29.5072 8.13777 29.3263 7.99669 29.1382L1.46446 22.607C-0.488156 20.6544 -0.488154 17.4883 1.46446 15.5357C3.41709 13.5831 6.58313 13.5831 8.53575 15.5357L12.0348 19.0357L15.5358 15.5357Z"
            fill="url(#paint0_linear_381_2635)"
          />
          <defs>
            <linearGradient
              id="paint0_linear_381_2635"
              x1="7.89148"
              y1="31.1413"
              x2="12.2915"
              y2="13.1218"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6FF5F1" />
              <stop offset="0.2548" stopColor="#3B9CD6" />
              <stop offset="0.5" stopColor="#0955E5" />
              <stop offset="0.75" stopColor="#8E54C5" />
              <stop offset="1" stopColor="#E23F8C" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <p className="text-mobile-header-h1 mt-3 font-display text-text-black">{title}</p>
      <p className="text-mobile-text-md-regular font-sans text-text-secondary">{caption}</p>
    </Modal>
  );
}
