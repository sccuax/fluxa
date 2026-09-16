import { FullViewModal } from "./FullViewModal";
import { FluxaLogoLockup } from "./FluxaLogoLockup";
import { Icon } from "./Icon";

// Matches the copy-paste reference screenshot (HeaderAppMenu's own "About"
// row opens this). "Terms of service"/"Privacy policy"/"Website fluxa.app"
// are real links (the first two reuse LegalFooterLinks.tsx's own URLs, kept
// as separate literals here rather than a shared import - that component's
// own two-link row layout doesn't fit this list-row shape). "What's new"/
// "Licenses"/"Open source libraries" have no real destination yet - plain,
// non-interactive rows (no Tooltip "locked" treatment - that pattern was
// just removed from HeaderAppMenu's own menu per explicit direction, so a
// brand-new modal shouldn't reintroduce it here).
const PRIVACY_POLICY_URL = "https://app.notion.com/p/Fluxa-Privacy-Policy-3c8f1890e7c0819ebbb5e5edcc52dbf4";
const TERMS_OF_USE_URL = "https://app.notion.com/p/Fluxa-Terms-of-Use-3c8f1890e7c08196bc60d874c78da9a8";
const WEBSITE_URL = "https://fluxa.app";

const LINKS: Array<{ label: string; href?: string }> = [
  { label: "What's new" },
  { label: "Terms of service", href: TERMS_OF_USE_URL },
  { label: "Privacy policy", href: PRIVACY_POLICY_URL },
  { label: "Licenses" },
  { label: "Open source libraries" },
  { label: "Website fluxa.app", href: WEBSITE_URL },
];

function AboutLinkRow({ label, href }: { label: string; href?: string }) {
  const content = (
    <span className="flex w-full items-center justify-between pb-1">
      <span className="font-sans text-text-sm-medium text-text-black">{label}</span>
      <Icon name="chevronRight" className="text-text-secondary" />
    </span>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block border-b border-border-border">
      {content}
    </a>
  ) : (
    <div className="border-b border-border-border">{content}</div>
  );
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <FullViewModal title="About" titleIcon={<Icon name="help" />} onClose={onClose}>
      <div className="flex h-full flex-col px-[20px]">
        <div className="flex flex-col items-center gap-3 pb-6 pt-8">
          <FluxaLogoLockup className="h-8 w-auto" />
          <span className="font-sans text-mobile-text-md-regular text-text-secondary">Version 1.0.0</span>
          <p className="text-center font-sans text-mobile-text-md-regular text-text-secondary mt-1">
            Designed visually for <br></br> modern websites.
          </p>
        </div>

        <div className="flex flex-col gap-3 py-1">
          {LINKS.map((link) => (
            <AboutLinkRow key={link.label} {...link} />
          ))}
        </div>

        <p className="mt-auto py-6 text-center font-sans text-mobile-text-md-regular text-text-secondary">
          © 2026 Fluxa. All rights reserved.
        </p>
      </div>
    </FullViewModal>
  );
}
