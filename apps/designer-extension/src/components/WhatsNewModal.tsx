import type { CSSProperties } from "react";
import { FullViewModal } from "./FullViewModal";
import { Icon } from "./Icon";

// Matches the copy-paste reference screenshot (copy-paste/what's new.png) -
// AboutModal.tsx's "What's new" row opens this. Content is currently the
// beta-phase placeholder card from that screenshot, not a real per-version
// changelog yet - see AboutModal.tsx's own comment for why "What's new" had
// no destination until now.

// The outer card's own background - the same 5-stop brand gradient this app
// already reuses elsewhere (ProfileCard.tsx's own CARD_BACKGROUND_GRADIENT,
// ButtonPrimary's hover ripple), but at 50% opacity per explicit spec (rgba
// alpha on each color stop, not a CSS `opacity` on the whole element - that
// would also fade the text sitting on top of it). Set on the outer "father"
// div per explicit direction, matching Figma - the "We are in the beta
// phase."/"Welcome to Fluxa app." sections sit on top of it as opaque white
// blocks, so the gradient only actually shows through the third
// (backgroundless) "More updates coming soon" section.
const CARD_GRADIENT =
  "linear-gradient(107deg, #FBFBFA 0.38%, rgba(251, 251, 250, 0.00) 100.08%), linear-gradient(56deg, rgba(111, 245, 241, 0.50) -0.13%, rgba(59, 156, 214, 0.50) 25.38%, rgba(9, 85, 229, 0.50) 49.94%, rgba(142, 84, 197, 0.50) 74.97%, rgba(226, 63, 140, 0.50) 100%)";

// "Beta" pill's border - the gradient-gradient token (var(--gradient-gradient),
// same 5-stop brand gradient ProfileCard.tsx's own CARD_BORDER_GRADIENT/
// PresetCard.tsx's "Pro" badge reuse), not a plain border-border-border. A
// gradient can't be a plain `border-color`, so this uses the standard
// padding-box/border-box double-background trick those two components
// already use: a transparent 1px border reserves the ring, a solid white
// padding-box layer fills the pill's own interior (matching the white
// "We are in the beta phase." row it sits on), and the gradient paints the
// border-box layer underneath, only ever visible in the 1px ring itself.
const BETA_PILL_STYLE: CSSProperties = {
  border: "1px solid transparent",
  backgroundImage: "linear-gradient(#fff, #fff), var(--gradient-gradient)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
  boxShadow:
    "4px 21px 6px 0 rgba(11, 13, 18, 0.00), 2px 13px 5px 0 rgba(11, 13, 18, 0.01), 1px 8px 5px 0 rgba(11, 13, 18, 0.05), 1px 3px 3px 0 rgba(11, 13, 18, 0.09), 0 1px 2px 0 rgba(11, 13, 18, 0.10)",
};

export function WhatsNewModal({ onClose }: { onClose: () => void }) {
  return (
    <FullViewModal title="What's new" titleIcon={<Icon name="whatsNew" />} onClose={onClose}>
      <div className="flex flex-col gap-5 px-[20px] pb-8 pt-8">
        <h2 className="font-display text-mobile-display-d1 text-text-black">
          See what's new in Fluxa and what we're working on next.
        </h2>

        <div
          className="overflow-hidden rounded-4 border border-border-border"
          style={{ backgroundImage: CARD_GRADIENT }}
        >
          <div className=" bg-white w-full h-full px-3">
          <div className="flex items-center justify-between border-b-[0.5px] border-border-border py-3">
            <span className="font-display text-text-sm-medium text-text-black">We are in the beta phase.</span>
            <span className="flex shrink-0 items-center gap-1 rounded-full pl-[6px] pr-2 py-[2px]" style={BETA_PILL_STYLE}>
              <span className="h-[5px] w-[10px] shrink-0 rounded-full bg-gradient-gradient" />
              <span className="font-sans text-mobile-text-sm-medium text-text-secondary">Beta</span>
            </span>
          </div>
          </div>

          <div className="flex flex-col gap-2 rounded-b-4 bg-white p-3">
            <p className="font-sans text-mobile-text-md-regular text-text-secondary">Welcome to Fluxa app.</p>
            <p className="font-sans text-mobile-text-md-regular text-text-secondary">
              We're actively testing the app, collecting feedback, and improving the experience.
            </p>
          </div>

          {/* flex, not a plain block div: a block container's line box gets a
              "strut" sized from its own INHERITED font-size/line-height (here,
              Tailwind's base 16px/24px - nothing here resets it), which pads
              the row to at least that height regardless of the span's own
              smaller line-height token. flex items are sized purely from
              content, no strut - same fix already implicit in the two rows
              above, which are flex for other reasons. */}
          <div className="flex items-center border-t border-border-border px-3 pt-2 pb-3">
            <span className="font-sans text-mobile-text-sm-medium text-text-black">More updates coming soon.</span>
          </div>
        </div>
      </div>
    </FullViewModal>
  );
}
