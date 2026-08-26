import { Icon } from "./Icon";
import { useAvatarUpload } from "../hooks/useAvatarUpload";

// 40x40 rounded-full avatar - clickable, opens the native file picker. See
// hooks/useAvatarUpload.ts for the actual upload/preview logic (shared with
// ManageProfileScreen's own "Change photo" trigger).
export function ProfilePicture({
  src,
  onUploaded,
}: {
  src: string | null;
  onUploaded: (url: string) => void;
}) {
  const { preview, inputRef, openFilePicker, handleFileChange } = useAvatarUpload(onUploaded);
  const displaySrc = preview ?? src;

  return (
    <>
      <button
        type="button"
        onClick={openFilePicker}
        aria-label="Change profile picture"
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background-white-2"
      >
        {displaySrc ? (
          // object-cover + scale-[2] (not object-cover alone; and not the
          // Tailwind-scale class "scale-200" - this project's Tailwind scale
          // tops out at 150/1.5x, so "scale-200" would silently generate no
          // CSS at all, hence the arbitrary-value syntax) - object-cover
          // on its own only crops to the *box's own aspect ratio*, which for
          // a roughly-square source photo barely crops anything, showing
          // almost the entire photo shrunk into the 40x40 circle instead of
          // a proper close-up avatar crop. scale(2) (per explicit direction:
          // "80x80" is the source-pixel region this should effectively
          // capture, i.e. 2x the 40x40 box) zooms into the already-cover-
          // fitted image around its own center - since transforms apply
          // after object-fit has already computed the crop, scaling *up*
          // (unlike the smaller scale tried before, which only shrank the
          // result with padding) genuinely crops in tighter: the enlarged
          // image overflows the 40x40 box and everything past its edges is
          // clipped by the button's own overflow-hidden, so only the center
          // ~half of what object-cover would show remains visible - the
          // same "moderate close-up, not the whole photo" crop Facebook/
          // LinkedIn avatars use.
          <img src={displaySrc} alt="" className="h-full w-full scale-[2] object-cover" />
        ) : (
          <Icon name="account" className="text-text-secondary" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
