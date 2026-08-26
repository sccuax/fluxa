import type { CSSProperties } from "react";
import { Icon } from "./Icon";
import { ProfilePicture } from "./ProfilePicture";
import type { AccountUser } from "../hooks/useAccountUser";

// This card's own 1px stroke + background, both real Figma-specified
// gradients (copy-paste/paste.txt for the background; the border reuses the
// exact same 5-stop token ButtonPrimary's bg-gradient-gradient class
// resolves to, per explicit direction "el mismo que habiamos usado para el
// boton principal"). No Tailwind utility can express a gradient *border*
// directly, so this uses the standard border-box/padding-box double-
// background trick: a transparent 1px border reserves the ring, the first
// two (padding-box) layers paint the card's own interior without spilling
// under that ring, and the last (border-box) layer is only ever visible in
// the ring itself, since the padding-box layers sit on top of it everywhere
// else.
const CARD_BORDER_GRADIENT =
  "linear-gradient(3deg, #6ff5f1 8.4%, #3b9cd6 29.6%, #0955e5 50%, #8e54c5 70.8%, #e23f8c 91.6%)";
const CARD_BACKGROUND_GRADIENT =
  "linear-gradient(180deg, #FBFBFA 0%, rgba(251, 251, 250, 0.00) 230.47%), linear-gradient(19deg, #6FF5F1 8.4%, #3B9CD6 29.6%, #0955E5 50%, #8E54C5 70.8%, #E23F8C 91.6%)";

const PROFILE_CARD_STYLE: CSSProperties = {
  border: "1px solid transparent",
  backgroundImage: `${CARD_BACKGROUND_GRADIENT}, ${CARD_BORDER_GRADIENT}`,
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, padding-box, border-box",
};

// Profile row: avatar + name/email, then a chevron that opens
// ManageProfileScreen (see that file). Reuses the dashboard header's own
// chevronDown icon rotated to point right (-90deg - a clockwise rotation
// would swing a down-pointing chevron's tip to the left, so the
// right-pointing rotation is counterclockwise/-90) rather than a new icon
// asset, per explicit direction ("es la misma flecha... mirando hacia la
// derecha").
export function ProfileCard({
  user,
  onAvatarUploaded,
  onManageProfile,
}: {
  user: AccountUser | null;
  onAvatarUploaded: (url: string) => void;
  onManageProfile: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-8 p-2" style={PROFILE_CARD_STYLE}>
      <ProfilePicture src={user?.image ?? null} onUploaded={onAvatarUploaded} />
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="truncate font-sans text-sm-medium text-text-black">{user?.name ?? "…"}</span>
        <span className="truncate font-sans text-mobile-text-md-regular text-text-black">{user?.email ?? ""}</span>
      </div>
      <button type="button" aria-label="Manage profile" className="shrink-0" onClick={onManageProfile}>
        <Icon name="chevronDown" className="-rotate-90" />
      </button>
    </div>
  );
}
