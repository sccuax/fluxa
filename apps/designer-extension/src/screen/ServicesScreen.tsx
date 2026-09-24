import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { AuthHeaderBanner } from "../components/AuthHeaderBanner";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { FluxaLogoLockup } from "../components/FluxaLogoLockup";
import { HeaderAppMenu } from "../components/HeaderAppMenu";
import { Icon } from "../components/Icon";
import { trackEvent } from "../services/analytics";

const SERVICES_SIZE = { width: 320, height: 652 };

// Carousel geometry - fixed pixel math, not measured at runtime, matching
// every other screen in this app that hardcodes against the Designer
// panel's known fixed width (see SignInScreen.tsx's own w-[320px] gotcha).
// The viewport itself bleeds past the content column's own right padding
// (see the `-mr-5` on its wrapper below) so only the RIGHT edge ever shows
// a peek of the next card - matches the reference screenshots exactly
// (copy-paste/Screenshot 2026-09-17 111846.png, 112007.png), which both
// show a sliver peeking in from the right and never from the left.
const CARD_GAP = 12;
const SLIDE_WIDTH = 270;
const SLIDE_STEP = SLIDE_WIDTH + CARD_GAP;
// A drag has to cross this many px before release counts as "advance/go
// back" rather than snapping back to the current slide.
const DRAG_THRESHOLD_PX = 50;

interface ServiceCardProps {
  swatch: ReactNode;
  title: string;
  description: string;
  previewImage: { src: string; alt: string;  className?: string};
  titleColorClassName: string;
  descriptionColorClassName: string;
  featureTextColorClassName: string;
  features: string[];
  featureColorClassName: string;
  bgServiceColor: string;
  buttonLabel: string;
  onClick: () => void;
}

// Same two-layer gradient-border trick SupportModal.tsx's own "Email
// support" card and PresetCard.tsx's "Pro" badge both already use (padding-
// box gets a solid fill, border-box gets the moving gradient underneath,
// `border: 1px solid transparent` reveals a 1px ring of it) - except the
// border-box layer here is a `conic-gradient` driven by the registered
// `--services-border-angle` custom property (index.css) instead of a
// static `var(--gradient-gradient)`, so it can actually rotate via a plain
// CSS @keyframes animation (`.service-card-rotating-border`). `@property`
// registers a fresh, independently-animating angle per element instance,
// so both cards can carry this at once with their own free-running phase -
// unlike the old side-by-side layout, there's no longer a reason to make
// the two cards take turns owning it (only one card is ever really in
// focus at a time here; the peeking sliver of the other one showing the
// same moving border too is what the reference screenshots show).
// Same 5 brand colors gradient-gradient itself uses (variables.css), just
// looped back to the first stop at 100% for a seamless rotation.
//
// The padding-box layer's fill takes `fillColor` instead of a hardcoded
// white - real bug, found while wiring up `bgServiceColor`: this fill is a
// `background-image` (an opaque solid-color gradient), and `background-
// image` always paints ON TOP of `background-color` for the same element
// per the CSS spec - so a `bg-*` Tailwind class on this card could never
// have shown through this layer no matter how it was spelled. The card's
// own background color has to be threaded into this exact gradient
// instead of set as a separate class.
function buildRotatingBorderStyle(fillColor: string) {
  return {
    backgroundImage: `linear-gradient(${fillColor}, ${fillColor}), conic-gradient(from var(--services-border-angle), #6ff5f1 0%, #3b9cd6 20%, #0955e5 40%, #8e54c5 60%, #e23f8c 80%, #6ff5f1 100%)`,
    backgroundOrigin: "padding-box, border-box",
    backgroundClip: "padding-box, border-box",
  } as const;
}

function ServiceCard({
  swatch,
  title,
  description,
  previewImage,
  titleColorClassName,
  descriptionColorClassName,
  featureTextColorClassName,
  features,
  bgServiceColor,
  featureColorClassName,
  buttonLabel,
  onClick,
}: ServiceCardProps) {
  const [hovered, setHovered] = useState(false);
  // edgeProximity/cursorAngle drive only the glow overlay below (the
  // border itself doesn't track the cursor - see PresetSearchResultRow's
  // own handlePointerMove, duplicated rather than shared for the same
  // reason documented there: these two components don't share a base
  // shape).
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handlePointerMove}
      className="service-card-rotating-border overflow-hidden relative flex h-full flex-col justify-between gap-3 rounded-8 border border-transparent px-4 py-6 hover:shadow-[12px_57px_16px_0_rgba(96,96,93,0.00),8px_36px_15px_0_rgba(96,96,93,0.01),4px_20px_13px_0_rgba(96,96,93,0.05),2px_9px_9px_0_rgba(96,96,93,0.09),0_2px_5px_0_rgba(96,96,93,0.10)]"
      style={buildRotatingBorderStyle(bgServiceColor)}
    >
      {/* Same edge-glow overlay as PresetSearchResultRow's own (reuses that
          file's global .preset-result-edge-glow CSS class verbatim, see
          index.css) - near-invisible at the card's center, intensifying
          toward its edge, masked to only light up the border segment
          nearest the cursor. */}
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
          <h2 className={`font-display text-mobile-header-h1 ${titleColorClassName}`}>{title}</h2>
          <p className={`font-sans max-w-[148px] text-mobile-text-sm-regular ${descriptionColorClassName}`}>{description}</p>
        </div>
        <img src={previewImage.src} alt={previewImage.alt} className={`w-full object-contain ${previewImage.className ?? ""}`} />
      </div>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 pt-[18px]">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Icon name="check" className={`shrink-0 ${featureColorClassName}`} />
              <span className={`font-sans text-mobile-text-sm-regular whitespace-nowrap ${featureTextColorClassName}`}>{feature}</span>
            </li>
          ))}
        </ul>
        <ButtonPrimary onClick={onClick}>
          {buttonLabel}
          <Icon name="chevronRight" />
        </ButtonPrimary>
      </div>
    </div>
  );
}

interface Service extends ServiceCardProps {
  id: string;
}

// Matches the copy-paste reference screenshots (copy-paste/Screenshot
// 2026-09-17 111846.png, 112007.png) - shown right after the welcome
// intro (App.tsx routes here instead of straight to "dashboard" once a
// session is confirmed, whether restored on load or via a fresh sign-in).
// Each service now takes over the whole screen as its own "slide" (a
// carousel of exactly the two services below), rather than the two cards
// being stacked and both visible at once - per explicit direction, with
// a peek of the next slide visible at the right edge (only ever the one
// "hidden" card - see the pagination dots' own comment for why that's
// singular, not stacked to show all future slides at once). Picking a
// service is still one-way beyond this screen (see the removed
// mutual-exclusion hover comment this file used to carry - there's still
// no "back to services" destination, per that same still-true reasoning).
export function ServicesScreen({
  onSelectShaders,
  onSelectWebflowSolutions,
}: {
  onSelectShaders: () => void;
  onSelectWebflowSolutions: () => void;
}) {
  useExtensionSize(SERVICES_SIZE);

  const services: Service[] = [
    {
      id: "shaders",
      swatch: <div className="h-6 w-6 rounded-[2px] bg-gradient-gradient" />,
      title: "Shader gradients",
      description: "Design, customize and apply stunning shader gradients.",
      previewImage: { src: "./images/Presets-sahders.png", alt: "Sample shader gradient presets", className: "pt-1 !w-[433px] self-center max-w-none" },
      titleColorClassName: "text-text-black",
      descriptionColorClassName: "text-text-secondary",
      featureTextColorClassName: "text-text-black",
      features: ["Shader gradient editor", "Real-time preview", "One-click apply"],
      featureColorClassName: "text-text-color-accent",
      bgServiceColor: "var(--background-background-white)",
      buttonLabel: "Open editor",
      onClick: () => {
        trackEvent("select_service", "shaders");
        onSelectShaders();
      },
    },
    {
      id: "webflow",
      // "W" is a plain monogram placeholder, not Webflow's own logomark -
      // deliberately kept simple rather than reproducing their real brand
      // asset without one provided.
      swatch: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="24" height="24" rx="2" fill="#386BFD"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M20.0458 7.75L15.2715 17.0833H10.787L12.7851 13.2152H12.6954C11.0471 15.355 8.58764 16.7637 5.08333 17.0833V13.2687C5.08333 13.2687 7.32511 13.1363 8.64299 11.7508H5.08333V7.75007H9.08402V11.0406L9.17382 11.0402L10.8086 7.75007H13.8342V11.0197L13.924 11.0196L15.6202 7.75H20.0458Z" fill="white"/>
</svg>

      ),
      title: "Webflow solutions",
      description: "Powerful tools and solutions to enhance your Webflow site.",
      previewImage: { src: "./images/presets-services.png", alt: "Select a multi-image CMS field" },
      titleColorClassName: "text-text-white",
      descriptionColorClassName: "text-text-white",
      featureTextColorClassName: "text-text-white",
      features: ["Use multi-image CMS fields in components.", "Use CMS images in the Designer.", "Publish a blog to Staging"],
      featureColorClassName: "text-primary-500",
      bgServiceColor: "var(--background-background-dark)",
      buttonLabel: "Explore solutions",
      onClick: () => {
        trackEvent("select_service", "webflow_solutions");
        onSelectWebflowSolutions();
      },
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDeltaPx, setDragDeltaPx] = useState(0);
  const dragStartXRef = useRef(0);

  // A trailing clone of the first slide, appended after the last real one,
  // so the last slide's own peek (the sliver visible at the viewport's
  // right edge) loops back to the first service instead of showing empty
  // space - a plain, low-effort "infinite tease" rather than real infinite
  // drag looping (dragging itself still clamps to the two real indices
  // below; only the visual peek loops).
  const renderSlides: Service[] = [...services, { ...services[0], id: `${services[0].id}-loop-peek` }];

  function goTo(index: number) {
    setActiveIndex(Math.min(Math.max(index, 0), services.length - 1));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Real bug, fixed (again - this keeps getting reverted by unrelated
    // saves, see the file's git history/conversation): setPointerCapture
    // redirects the subsequent pointerup (and the native mouseup it's
    // based on) to THIS track element, silently breaking the browser's
    // own click synthesis on whatever was actually pressed - a native
    // "click" needs mousedown+mouseup on the same target. That's why
    // ButtonPrimary ("Open editor"/"Explore solutions") stops navigating
    // anywhere every time this guard goes missing. Skip capturing (and
    // the whole drag gesture) when the press started on a real button -
    // let its native click behave normally.
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartXRef.current = event.clientX;
    setIsDragging(true);
    setDragDeltaPx(0);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    setDragDeltaPx(event.clientX - dragStartXRef.current);
  }

  function endDrag() {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragDeltaPx <= -DRAG_THRESHOLD_PX) {
      goTo(activeIndex + 1);
    } else if (dragDeltaPx >= DRAG_THRESHOLD_PX) {
      goTo(activeIndex - 1);
    }
    setDragDeltaPx(0);
  }

  const trackOffsetPx = -(activeIndex * SLIDE_STEP) + (isDragging ? dragDeltaPx : 0);

  // Same "..." menu wiring as DashboardHeader.tsx's own appMenuOpen/
  // appMenuButtonRef - per explicit direction to reuse HeaderAppMenu here
  // exactly the way it already works there (About/Cookies modals, the
  // still-unbuilt Preferences stub, "Version 1.0").
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const appMenuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    // h-screen (100vh), not h-full (100%) - real bug, same class this app
    // has hit repeatedly elsewhere (DashboardScreen.tsx, SignInScreen.tsx,
    // WebflowSolutionsScreen.tsx, ...): h-full needs a definite-height
    // ancestor chain all the way up, which isn't guaranteed here, so it
    // silently collapsed to this screen's own CONTENT height instead of
    // the real panel height - the visible symptom being a gap left below
    // the actual content rather than this root filling the panel. h-screen
    // reads the iframe's own viewport height directly regardless of that
    // chain, which is what every other real screen in this app already
    // uses for the same reason.
    //
    // No overflow-hidden here anymore - it was clipping the card's own
    // hover:shadow-[...] just like the carousel viewport did (see that
    // div's own comment below). Nothing in this screen intentionally
    // bleeds past this root horizontally (the carousel's own -mr-5 bleed
    // stays fully within this box, it only cancels the column's padding),
    // so there's no clipping need here at all.
    <div className="flex h-screen min-h-0 w-full flex-col bg-background-white">
      {/* This is a real screen, not a modal - so it reuses AuthHeaderBanner,
          the same decorative gray banner every Auth* screen (SignInScreen
          etc.) already layers its own logo over, rather than a modal-style
          dark bar or a hand-rolled CSS blur. `relative` + a fixed height
          matching the banner's own real 86px, with the logo/menu row
          layered on top via `relative z-10` (so it paints above the
          `absolute` banner underneath it, same stacking SignInScreen's own
          FluxaLogoLockup already relies on). */}
      <header className="relative h-auto w-full shrink-0">
        <AuthHeaderBanner className="top-[-41px]" />
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

      {/* overflow-y-auto removed - it clipped the card's hover shadow the
          same way the carousel viewport's own overflow-hidden did (see
          that div's comment). This column doesn't need horizontal
          clipping either, so it's just left at the default (visible) on
          both axes now. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 pb-8 pt-5">
        <div className="flex shrink-0 flex-col gap-2">
          <h1 className="font-display max-w-[174px] text-mobile-display-d1 text-text-black">What do you want to create today?</h1>
          <p className="font-sans text-mobile-text-md-regular text-text-secondary">Choose a Fluxa service to get started.</p>
        </div>


        {/* overflow-x: clip (not overflow-x-hidden, and not clip-path -
            both tried first, both wrong for real, distinct reasons):
            - overflow-x-hidden + overflow-y-visible: per the CSS Overflow
              spec, setting only overflow-x to something other than
              visible/clip forces the OTHER axis's USED value to `auto`
              regardless of what overflow-y is literally written as, and
              `auto` clips exactly like `hidden` with no genuine scrollable
              content needed to trigger it - confirmed empirically
              (getComputedStyle still read overflowY as "auto" here).
            - clip-path: inset(...) avoids that coupling (each side clips
              independently), but clip-path is purely a PAINT-time effect -
              it doesn't constrain the box's real layout overflow the way
              `overflow` does, so the track's true (wider than visible)
              width started a real horizontal scrollbar on the page once
              overflow-x-hidden was removed entirely - confirmed visually.
            `clip` is explicitly exempt from the visible-pairing coercion
            rule above (only hidden/scroll/auto trigger it) - confirmed
            empirically too (overflow-x:clip left overflow-y's computed
            value as genuine "visible", not "auto"). It also still
            establishes a real clipping/layout box like `hidden` does (no
            scrollbar), just without ever creating a scroll container -
            exactly what the peek-crop needs, with the shadow finally
            bleeding freely on the other axis. */}
        <div className="relative -mr-5" style={{ overflowX: "clip", overflowY: "visible" }}>
          <div
            className={`flex items-stretch ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{
              gap: CARD_GAP,
              transform: `translateX(${trackOffsetPx}px)`,
              transition: isDragging ? "none" : "transform 300ms ease-out",
              touchAction: "pan-y",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {renderSlides.map((service, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={service.id}
                  className="shrink-0 select-none"
                  style={{ width: SLIDE_WIDTH }}
                  // Clicking the peeking (non-active) slide brings it
                  // forward - the only reachable click-to-advance case
                  // here, since only the slide immediately after the
                  // active one is ever partially visible (see the loop
                  // clone above for the last-slide case).
                  onClick={!isActive ? () => goTo(index % services.length) : undefined}
                >
                  <ServiceCard
                    swatch={service.swatch}
                    title={service.title}
                    description={service.description}
                    previewImage={service.previewImage}
                    titleColorClassName={service.titleColorClassName}
                    descriptionColorClassName={service.descriptionColorClassName}
                    featureTextColorClassName={service.featureTextColorClassName}
                    features={service.features}
                    featureColorClassName={service.featureColorClassName}
                    bgServiceColor={service.bgServiceColor}
                    buttonLabel={service.buttonLabel}
                    onClick={service.onClick}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination dots - exactly one "hidden" card is ever partially
            visible at a time (the peek above), so the active dot only
            ever needs to read as bigger than the ONE other dot, per
            explicit direction ("el dot que muestra la card debe ser mas
            grande que el otro dot de la card oculta"). A wider pill for
            the active slide, a small plain circle otherwise - matches the
            reference screenshots' own dot treatment. */}
        <div className="flex shrink-0 items-center justify-center gap-1">
          {services.map((service, index) => (
            <button
              key={service.id}
              type="button"
              aria-label={`Show ${service.title}`}
              aria-current={index === activeIndex}
              onClick={() => goTo(index)}
              className={`rounded-full transition-all duration-300 ${
                index === activeIndex ? "h-2 w-4 bg-border-border" : "h-2 w-2 bg-border-border"
              }`}
            />
          ))}
        </div>

        <p className="flex shrink-0 text-left items-center justify-center gap-2 pt-3 font-sans text-mobile-text-sm-regular text-text-secondary">
      <div className="w-7 h-7 flex items-center rounded-4 justify-center bg-background-white-2">
          <Icon name="lightbulb" className="text-text-secondary" />
          </div>
          You can switch services <br />anytime from the header
        </p>
      </div>
    </div>
  );
}
