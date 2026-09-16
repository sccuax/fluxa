import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { HeaderAppMenu } from "../components/HeaderAppMenu";
import { Icon } from "../components/Icon";
import { trackEvent } from "../services/analytics";

const SERVICES_SIZE = { width: 320, height: 660 };

interface ServiceCardProps {
  swatch: ReactNode;
  title: string;
  description: string;
  features: string[];
  featureColorClassName: string;
  buttonLabel: string;
  onClick: () => void;
  // Whether THIS card currently shows the rotating brand-gradient border
  // (see ROTATING_BORDER_STYLE/.service-card-rotating-border below,
  // index.css) - NOT cursor-tracked, a deliberate departure from
  // PresetSearchResultRow's own hover-tracking border, per explicit
  // direction ("el borde... debe moverse... los colores del borde deben
  // rotar"). Mutually exclusive between the two cards, computed by
  // ServicesScreen and passed down here rather than owned locally: Shader
  // gradients shows it by default (nothing hovered) and Webflow solutions
  // shows it instead the moment IT is hovered - real bug, fixed: an
  // earlier version only ever suppressed Shader gradients' own border
  // while Webflow was hovered, without ever turning Webflow's own border
  // ON in exchange, so hovering Webflow visibly turned the whole effect
  // off instead of moving it to the other card as intended.
  showRotatingBorder: boolean;
  // Reports this card's own hover state up to ServicesScreen, which is the
  // single source of truth deciding which card's showRotatingBorder is
  // true (see above) - every card passes this, not just one, since both
  // cards' hover now needs to be known up there.
  onHoverChange: (hovered: boolean) => void;
}

// Same two-layer gradient-border trick SupportModal.tsx's own "Email
// support" card and PresetCard.tsx's "Pro" badge both already use (padding-
// box gets a solid fill, border-box gets the moving gradient underneath,
// `border: 1px solid transparent` reveals a 1px ring of it) - except the
// border-box layer here is a `conic-gradient` driven by the registered
// `--services-border-angle` custom property (index.css) instead of a
// static `var(--gradient-gradient)`, so it can actually rotate via a plain
// CSS @keyframes animation (`.service-card-rotating-border`, applied
// unconditionally below - this card's border always moves, hover or not).
// Same 5 brand colors gradient-gradient itself uses (variables.css), just
// looped back to the first stop at 100% for a seamless rotation.
const ROTATING_BORDER_STYLE = {
  backgroundImage:
    "linear-gradient(var(--background-background-white), var(--background-background-white)), conic-gradient(from var(--services-border-angle), #6ff5f1 0%, #3b9cd6 20%, #0955e5 40%, #8e54c5 60%, #e23f8c 80%, #6ff5f1 100%)",
  backgroundOrigin: "padding-box, border-box",
  backgroundClip: "padding-box, border-box",
} as const;

function ServiceCard({
  swatch,
  title,
  description,
  features,
  featureColorClassName,
  buttonLabel,
  onClick,
  showRotatingBorder,
  onHoverChange,
}: ServiceCardProps) {
  const [hovered, setHovered] = useState(false);
  // edgeProximity/cursorAngle drive only the glow overlay below now (the
  // border itself no longer tracks the cursor on either card) - starts
  // zeroed so the very first hover frame, before any real mousemove has
  // fired yet, shows something reasonable. Same geometry as
  // PresetSearchResultRow's own handlePointerMove - duplicated rather than
  // factored into a shared hook, since these two components don't share a
  // base shape (row vs. card), same reasoning GlassLiquidControlPanel's own
  // comment gives for copying ControlPanel.tsx wholesale instead of
  // extracting a shared piece from it.
  const [pointer, setPointer] = useState({ edgeProximity: 0, cursorAngle: 0 });

  function handlePointerMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
    const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
    const edgeProximity = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1) * 100;
    let cursorAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (cursorAngle < 0) cursorAngle += 360;
    setPointer({ edgeProximity, cursorAngle });
  }

  return (
    <div
      onMouseEnter={() => {
        setHovered(true);
        onHoverChange(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHoverChange(false);
      }}
      onMouseMove={handlePointerMove}
      className={`relative flex flex-col gap-4 rounded-8 border p-4 hover:shadow-[12px_57px_16px_0_rgba(96,96,93,0.00),8px_36px_15px_0_rgba(96,96,93,0.01),4px_20px_13px_0_rgba(96,96,93,0.05),2px_9px_9px_0_rgba(96,96,93,0.09),0_2px_5px_0_rgba(96,96,93,0.10)] ${showRotatingBorder ? "service-card-rotating-border border-transparent" : "border-border-border"}`}
      style={showRotatingBorder ? ROTATING_BORDER_STYLE : undefined}
    >
      {/* Same edge-glow overlay as PresetSearchResultRow's own (reuses that
          file's global .preset-result-edge-glow CSS class verbatim, see
          index.css) - near-invisible at the card's center, intensifying
          toward its edge, masked to only light up the border segment
          nearest the cursor. Local `hovered` state per card, not lifted -
          a real cursor can only be over one card at a time, so the sibling
          card's own onMouseLeave already fires as this one's onMouseEnter
          does, giving "hover A turns off B's glow" for free with no shared
          state needed. */}
      {hovered && (
        <span
          aria-hidden
          className="preset-result-edge-glow pointer-events-none absolute inset-0 rounded-[inherit]"
          style={
            {
              "--edge-proximity": pointer.edgeProximity,
              "--cursor-angle": `${pointer.cursorAngle}deg`,
            } as CSSProperties
          }
        />
      )}
      <div className="flex flex-col items-start gap-2">
      {swatch}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-mobile-header-h1 text-text-black">{title}</h2>
        <p className="font-sans max-w-[148px] text-mobile-text-sm-regular text-text-secondary">{description}</p>
      </div>
      <ul className="flex flex-col gap-2 pt-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Icon name="check" className={`shrink-0 ${featureColorClassName}`} />
            <span className="font-sans text-mobile-text-sm-regular whitespace-nowrap text-text-black">{feature}</span>
          </li>
        ))}
      </ul>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center rounded-32 border border-border-border bg-background-white px-4 py-2.5 font-sans text-text-sm-medium text-text-secondary gap-2"
      >
        {buttonLabel}
        <Icon name="chevronRight" className="text-text-secondary" />
      </button>
    </div>
  );
}

// Matches the copy-paste reference screenshot (shader-pressets-copy-paste) -
// shown right after the welcome intro (App.tsx routes here instead of
// straight to "dashboard" once a session is confirmed, whether restored on
// load or via a fresh sign-in). Picking a service is currently one-way:
// there's no screen this app can route back to yet from either destination
// (the reference's own "You can switch services anytime from settings"
// footer note describes a Preferences destination that doesn't exist yet -
// see HeaderAppMenu.tsx's own still-unbuilt Preferences row) - deliberately
// not built here, per the same "don't fake a destination" stance the rest
// of this app already takes for other not-yet-built links.
export function ServicesScreen({
  onSelectShaders,
  onSelectWebflowSolutions,
}: {
  onSelectShaders: () => void;
  onSelectWebflowSolutions: () => void;
}) {
  useExtensionSize(SERVICES_SIZE);
  // Single source of truth for which card currently shows the rotating
  // border - see ServiceCardProps' own comment on showRotatingBorder for
  // why this has to live up here rather than in each card locally. Shaders
  // is the default/rest-state owner (matches the reference screenshot,
  // where it shows without any hover at all); Webflow solutions takes over
  // for as long as it's the one actually hovered.
  const [webflowHovered, setWebflowHovered] = useState(false);
  const shadersShowBorder = !webflowHovered;
  const webflowShowBorder = webflowHovered;

  // Same "..." menu wiring as DashboardHeader.tsx's own appMenuOpen/
  // appMenuButtonRef - per explicit direction to reuse HeaderAppMenu here
  // exactly the way it already works there (About/Cookies modals, the
  // still-unbuilt Preferences stub, "Version 1.0").
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const appMenuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex overflow-hidden h-full min-h-0 w-full flex-col bg-background-white">
      {/* This is a real screen, not a modal - so it reuses AuthHeaderBanner,
          the same decorative gray banner every Auth* screen (SignInScreen
          etc.) already layers its own logo over, rather than a modal-style
          dark bar or a hand-rolled CSS blur. `relative` + a fixed height
          matching the banner's own real 86px, with the logo/menu row
          layered on top via `relative z-10` (so it paints above the
          `absolute` banner underneath it, same stacking SignInScreen's own
          FluxaLogoLockup already relies on). */}
      <header className="relative h-auto w-full shrink-0">
        <AuthHeaderBanner className="inset-bs-[-41px]" />
        <div className="relative z-10 flex items-center justify-between px-5 pt-10">
          <FluxaLogoLockup className="h-4 w-auto" />
          <button
            ref={appMenuButtonRef}
            type="button"
            onClick={() => setAppMenuOpen((current) => !current)}
            aria-label="Open menu"
            className="text-text-black"
          >
            <Icon name="threeDots" />
          </button>
          <HeaderAppMenu
            open={appMenuOpen}
            onCloseRequest={() => setAppMenuOpen(false)}
            triggerRef={appMenuButtonRef}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-8 pt-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display max-w-[174px] text-mobile-display-d1 text-text-black">What do you want to create today?</h1>
          <p className="font-sans text-mobile-text-md-regular text-text-secondary">Choose a Fluxa service to get started.</p>
        </div>

        <ServiceCard
          showRotatingBorder={shadersShowBorder}
          // Shader gradients' own hover doesn't need to change anything -
          // it already shows the border by default, and hovering it
          // doesn't need to take the border away from Webflow solutions
          // (which never has it to begin with unless it's the one hovered).
          onHoverChange={() => {}}
          swatch={<div className="h-6 w-6 rounded-[2px] bg-gradient-gradient" />}
          title="Shader gradients"
          description="Design, customize and apply stunning shader gradients."
          features={["Shader gradient editor", "Real-time preview", "One-click apply"]}
          featureColorClassName="text-text-color-accent"
          buttonLabel="Open gradients"
          onClick={() => {
            trackEvent("select_service", "shaders");
            onSelectShaders();
          }}
        />

        {/* "W" is a plain monogram placeholder, not Webflow's own logomark -
            deliberately kept simple rather than reproducing their real
            brand asset without one provided, same as this whole screen
            (Webflow solutions' own dashboard is explicitly still to be
            designed - see WebflowSolutionsScreen.tsx). */}
        <ServiceCard
          showRotatingBorder={webflowShowBorder}
          onHoverChange={setWebflowHovered}
          swatch={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="24" height="24" rx="2" fill="#386BFD"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M20.046 7.75L15.2717 17.0833H10.7872L12.7853 13.2152H12.6956C11.0472 15.355 8.58781 16.7637 5.0835 17.0833V13.2687C5.0835 13.2687 7.32527 13.1363 8.64316 11.7508H5.0835V7.75007H9.08419V11.0406L9.17399 11.0402L10.8088 7.75007H13.8344V11.0197L13.9242 11.0196L15.6204 7.75H20.046Z" fill="white"/>
</svg>

          }
          title="Webflow solutions"
          description="Powerful tools and solutions to enhance your Webflow site."
          features={["Use multi-image CMS fields in components.", "Use CMS images in the Designer.", "Publish a blog to Staging"]}
          featureColorClassName="text-primary-500"
          buttonLabel="Explore solutions"
          onClick={() => {
            trackEvent("select_service", "webflow_solutions");
            onSelectWebflowSolutions();
          }}
        />

        <p className="flex items-center justify-center gap-2 pt-3 text-center font-sans text-mobile-text-sm-regular text-text-secondary">
      <div className="w-7 h-7 flex items-center rounded-4 justify-center bg-background-white-2">
          <Icon name="lightbulb" className="text-text-secondary" />
          </div>
          You can switch services <br />anytime from settings
        </p>
      </div>
    </div>
  );
}
