import { FullViewModal } from "./FullViewModal";
import { Icon, type IconName } from "./Icon";
import { trackEvent } from "../services/analytics";

const REPORT_BUG_URL = "https://forms.cloud.microsoft/r/acxA3Y92YJ";
const REQUEST_FEATURE_URL = "https://forms.cloud.microsoft/r/Z6j28m5pHs";

const SUPPORT_LINKS: Array<{ label: string; icon: IconName; href?: string; trackAs?: string }> = [
  { label: "Documentation", icon: "documentation" },
  { label: "Contact support", icon: "chat" },
  { label: "Report a bug", icon: "bug", href: REPORT_BUG_URL, trackAs: "click_report_bug" },
  { label: "Request a feature", icon: "lightbulb", href: REQUEST_FEATURE_URL, trackAs: "click_request_feature" },
];

// `trackAs` only exists for rows with a real `href` - "Documentation"/
// "Contact support" have no destination at all yet (plain, non-interactive
// rows, same "no Tooltip, no fake link" stance AboutModal.tsx's own
// unfinished rows take), so there's no real click to measure there.
function SupportLinkRow({ label, icon, href, trackAs, last = false }: { label: string; icon: IconName; href?: string; trackAs?: string; last?: boolean }) {
  const content = (
    <span className={`flex w-full items-center justify-between gap-2 py-3 ${last ? "" : "border-b border-border-border"}`}>
      <span className="flex items-center gap-2">
        <Icon name={icon} className="text-text-secondary" />
        <span className="font-sans text-mobile-text-md-medium text-text-black">{label}</span>
      </span>
      <Icon name="chevronRight" className="text-text-secondary" />
    </span>
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      onClick={() => trackAs && trackEvent(trackAs)}
    >
      {content}
    </a>
  ) : (
    content
  );
}

// Matches the copy-paste reference screenshot (LinksCard's own "Support"
// row opens this). "Report a bug"/"Request a feature" open real Microsoft
// Forms links (given directly, not guessed). Documentation/Contact support
// still have no real destination - plain non-interactive rows, same "no
// Tooltip, no fake link" stance AboutModal.tsx's own unfinished rows
// already take (its own "What's new"/"Licenses"/"Open source libraries").
// "Email support" is a real mailto: link, same as before.
export function SupportModal({ onClose }: { onClose: () => void }) {
  return (
    <FullViewModal title="Support" titleIcon={<Icon name="supportHeader" />} onClose={onClose}>
      <div className="flex flex-col gap-3 px-[20px] pb-8 pt-8">
        <div className="">
          {SUPPORT_LINKS.map((link, index) => (
            <SupportLinkRow key={link.label} {...link} last={index === SUPPORT_LINKS.length - 1} />
          ))}
        </div>
        {/* Same two-layer gradient-border trick PresetCard.tsx's own "Pro"
            badge uses (see that file's comment) - a solid white fill on
            the padding-box layer, the brand gradient underneath on the
            border-box layer, `border: 1px solid transparent` revealing a
            1px ring of it. A separate low-opacity gradient wash sits behind
            the content for the pastel tint the reference screenshot shows -
            kept as its own absolutely-positioned layer rather than folded
            into the border trick's own background shorthand, since that
            shorthand is already spoken for by the border effect. */}
        <a
          href="mailto:support@fluxa.app"
          onClick={() => trackEvent("click_email_support")}
          className="relative flex items-center shadow-[0_19px_5px_0_rgba(0,0,0,0.00),0_12px_5px_0_rgba(0,0,0,0.01),0_7px_4px_0_rgba(0,0,0,0.05),0_3px_3px_0_rgba(0,0,0,0.09),0_1px_2px_0_rgba(0,0,0,0.10)] justify-between overflow-hidden rounded-4 p-3"
          style={{
            background:
              "linear-gradient(var(--background-background-white), var(--background-background-white)) padding-box, var(--gradient-gradient) border-box",
            border: "1px solid transparent",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-gradient opacity-10" />
          <div className="relative flex flex-col gap-2">
            <span className="font-sans text-text-sm-medium text-text-black">Email support</span>
            <span className="font-sans text-mobile-text-sm-regular text-text-secondary">support@fluxa.app</span>
          </div>
          <Icon name="mail" className="relative w-8 h-8 shrink-0 text-text-black" />
        </a>
      </div>
    </FullViewModal>
  );
}
