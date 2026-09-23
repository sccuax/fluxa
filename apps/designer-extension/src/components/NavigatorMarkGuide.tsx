import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";

// Shared "how to mark this element" visual guide, used by wizard steps 4 and
// 5 of the multi-image wizard (slug/target - WebflowSolutionsScreen.tsx,
// copy-paste/Scree95228.png) AND step 4 of the CMS images wizard (image -
// CmsImagesScreen.tsx) - a fake, non-interactive Webflow Navigator panel
// that loops forever: a cursor (copy-paste/paste.txt's own gradient-stroke
// pointer, inlined below) glides down from above the tree to the relevant
// row, does a quick "click" bounce, and the row highlights with Webflow's
// own real selection color (#4A4067, also from that same paste.txt) - holds
// for a beat, then fades out and repeats. Originally built for step 4 alone
// (`NavigatorSlugGuide`, now this component's `variant="slug"`); step 5
// needed the identical mechanic pointed at a different row ("Div Block"
// instead of "Text Block"), and CmsImagesScreen.tsx later needed that exact
// same "target" mechanic again but marking a real `Image` element, not a
// generic div - so rather than a second/third near-duplicate file, the one
// `variant` prop below picks which row is the cursor's target, which of the
// candidate rows (Text Block/Heading vs Div Block) reads as emphasized vs
// muted, and (for "image" specifically, see CONTAINER_ROW_OVERRIDE below)
// what that one shared row actually displays - everything else (timeline
// choreography, tree chrome, cursor asset) is shared verbatim. Built with a
// single GSAP `repeat: -1` timeline (gsap is already wired into this app for
// GradientFileIcon's own MorphSVG animation) rather than plain CSS
// keyframes, since this needs to sequence four distinct phases (move, click,
// select, fade+reset) in order, in sync with each other. Wrapped in
// `gsap.context()` (React's own recommended GSAP integration pattern) so
// React 18 Strict Mode's real mount->cleanup->remount double-invoke in dev
// can't leave the cursor stuck mid-tween on a killed timeline - a real,
// confirmed cause of "the cursor doesn't show up" otherwise.
//
// The row list/icons are a simplified, hand-built approximation of a real
// Collection List's own Navigator tree (Collection List Wrapper > Collection
// List > Collection Item > its own children, plus its Empty State sibling) -
// no exact icon set was supplied for these specifically (unlike the
// cursor/selection-color, which came straight from a Figma export), close
// enough to read correctly at this size. Every row's own icon/chevron/label
// uses `currentColor`, driven by a per-row inline `color` so the "which rows
// read as emphasized right now" logic below is just a color computation, not
// a per-element override in a dozen places. The selection highlight itself is
// a plain colored div (bg #4A4067), not the raw "cuadro de seleccion" SVG
// asset also supplied - that asset is a FIXED 248x24 rect with its own baked-
// in corner radius, which would distort if stretched to this panel's own
// (different, and responsive) width; a plain rounded div reproduces the
// identical visual at any width instead. The vertical hierarchy guide lines
// (one per ancestor depth a row is nested under, per explicit direction -
// "lineas iguales a las de webflow") are drawn the same way real tree UIs do
// it: each row independently draws its own full-height segment at each
// ancestor indent column, so consecutive siblings under the same parent chain
// visually read as one continuous line down that column.
const ROW_HEIGHT = 24;
const DEFAULT_COLOR = "#A897D7";
const MUTED_COLOR = "#D9D9D9";

// The "Image" row's own icon (copy-paste/paste.txt, a Figma export of the
// combined icon+"Image"-label asset as it reads in Webflow's real
// Navigator) - only the icon half is used here; the label stays real text
// (see NavRow's own `label` field) rather than the pasted asset's own
// vector-drawn letters, since those are a hardcoded `fill="#D9D9D9"` that
// can't pick up this row's dynamic active/muted `color` the way a real
// `<span>` does (every other row's own label already relies on that).
// `viewBox="15 0 16 16"` crops the icon's own native coordinate space
// (originally positioned at x 15-31 inside a wider combined asset, via a
// clipPath) directly, rather than hand-shifting every path point by -15.
function ImageGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="15 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21 7C21.5523 7 22 6.55228 22 6C22 5.44772 21.5523 5 21 5C20.4477 5 20 5.44772 20 6C20 6.55228 20.4477 7 21 7Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17 3C17 2.44772 17.4477 2 18 2H28C28.5523 2 29 2.44772 29 3V13C29 13.5523 28.5523 14 28 14H18C17.4477 14 17 13.5523 17 13V3ZM28 3H18V12.2929L23 7.29289L28 12.2929V3ZM23 8.70711L27.2929 13H18.7071L23 8.70711Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CodeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 3L1.5 6L4 9M8 3L10.5 6L8 9"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The real cursor asset (copy-paste/paste.txt), inlined as JSX with its own
// useId()-scoped filter/gradient ids (GradientFileIcon's own precedent for
// exactly this reason) rather than loaded as a separate <img> - moved via
// GSAP x/y/scale/opacity tweens on the wrapping <span>, since animating an
// inline SVG's own transform works identically to any other element for a
// pure translate/scale (no path morphing needed here, unlike
// GradientFileIcon's own inlined path).
function CursorGlyph({ innerRef }: { innerRef: RefObject<HTMLSpanElement> }) {
  const filterId = useId();
  const gradientId = useId();
  return (
    <span ref={innerRef} className="pointer-events-none absolute left-0 top-0 z-20 block h-[30px] w-[25px] opacity-0">
      <svg width="31" height="38" viewBox="0 0 31 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g filter={`url(#${filterId})`}>
          <path
            d="M10.8872 22.6766L5.2216 2.80147C5.0482 2.19319 5.67999 1.66792 6.25446 1.94275L25.0249 10.9225C25.6165 11.2055 25.572 12.0545 24.9542 12.2734L16.8805 15.1341C16.7143 15.193 16.5749 15.3088 16.4875 15.4608L12.2423 22.8422C11.9174 23.4071 11.0658 23.303 10.8872 22.6766Z"
            fill="#D7DAE2"
          />
          <path
            d="M4.67366 2.95373C4.36728 1.87785 5.48453 0.949083 6.50067 1.43475L25.2716 10.4146C26.3181 10.9152 26.2395 12.4168 25.1468 12.8043L17.0727 15.6653C17.0344 15.6789 17.002 15.7058 16.9819 15.7409L12.7369 23.1219C12.1622 24.1212 10.6553 23.9375 10.3394 22.8293L4.67366 2.95373Z"
            stroke={`url(#${gradientId})`}
            strokeWidth="1.13334"
          />
        </g>
        <defs>
          <filter
            id={filterId}
            x="7.15256e-05"
            y="-9.799e-05"
            width="30.6346"
            height="37.9688"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="0.73667" />
            <feGaussianBlur stdDeviation="0.73667" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.0431373 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.1 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="2.57835" />
            <feGaussianBlur stdDeviation="1.28917" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.0431373 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.09 0" />
            <feBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="5.52503" />
            <feGaussianBlur stdDeviation="1.65751" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.0431373 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.05 0" />
            <feBlend mode="normal" in2="effect2_dropShadow" result="effect3_dropShadow" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="9.57671" />
            <feGaussianBlur stdDeviation="2.02584" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.0431373 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.01 0" />
            <feBlend mode="normal" in2="effect3_dropShadow" result="effect4_dropShadow" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect4_dropShadow" result="shape" />
          </filter>
          <linearGradient id={gradientId} x1="16.3671" y1="20.2062" x2="8.94305" y2="-1.47595" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6FF5F1" />
            <stop offset="0.2548" stopColor="#3B9CD6" />
            <stop offset="0.5" stopColor="#0955E5" />
            <stop offset="0.75" stopColor="#8E54C5" />
            <stop offset="1" stopColor="#E23F8C" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

// `role` marks the two rows that swap emphasis depending on `variant`:
// "text" (Text Block/Heading - the slug step's own candidates) vs
// "container" (Div Block - the target step's own candidate). A row with no
// `role` keeps a fixed color regardless of variant (the structural
// Collection List chrome stays emphasized either way; Code Embed stays
// muted either way - it's structurally excluded from both flows, see the
// real "Code Embed can not be placed in a Collection List Wrapper"
// restriction noted in WebflowSolutionsScreen.tsx).
type NavRow = {
  label: string;
  depth: number;
  icon: ReactNode;
  chevron?: "open" | "closed";
  role?: "text" | "container";
  color?: string;
  // Approximate x-offset (from the row's own left edge) where this row's own
  // label text ends - tuned by eye per label, used as the cursor's landing
  // spot when this row is the active target. Only needed on rows a variant
  // can actually target.
  landingX?: number;
};

const ROWS: NavRow[] = [
  { label: "Code Embed", depth: 0, icon: <CodeGlyph className="h-3 w-3" />, color: MUTED_COLOR },
  { label: "Collection List Wrapper", depth: 0, icon: <Icon name="collection" className="h-3 w-3" />, chevron: "open", color: DEFAULT_COLOR },
  { label: "Collection List", depth: 1, icon: <Icon name="collection" className="h-3 w-3" />, chevron: "open", color: DEFAULT_COLOR },
  { label: "Collection Item", depth: 2, icon: <Icon name="collection" className="h-3 w-3" />, chevron: "open", color: DEFAULT_COLOR },
  {
    label: "Text Block",
    depth: 3,
    icon: <span className="font-serif text-[10px] font-semibold leading-none">T</span>,
    role: "text",
    landingX: 150,
  },
  {
    label: "Heading",
    depth: 3,
    icon: <span className="text-[7px] font-bold leading-none">H1</span>,
    role: "text",
  },
  {
    label: "Div Block",
    depth: 3,
    icon: <span className="block h-2.5 w-2.5 rounded-[2px] border border-current" />,
    role: "container",
    landingX: 143,
  },
  { label: "Empty State", depth: 2, icon: <Icon name="collection" className="h-3 w-3" />, chevron: "closed", color: DEFAULT_COLOR },
];

export type NavigatorMarkVariant = "slug" | "target" | "image";

// The cursor's actual landing row per variant - "Text Block" for slug (index
// into ROWS), "Div Block"/"Image" for target/image (same physical row,
// see CONTAINER_ROW_OVERRIDE below for why "image" shows different content
// there). Both are the one row of their own `role` this guide ever
// animates the cursor onto; "Heading" shares the "text" role for coloring
// purposes but isn't itself a landing spot.
const TARGET_ROW_INDEX: Record<NavigatorMarkVariant, number> = { slug: 4, target: 6, image: 6 };
const ACTIVE_ROLE: Record<NavigatorMarkVariant, NavRow["role"]> = {
  slug: "text",
  target: "container",
  image: "container",
};

// CmsImagesScreen.tsx's own step 4 reuses this exact same guide (per
// explicit direction) but is marking a real Webflow `Image` element, not a
// generic div - "Div Block" would be actively wrong there. Rather than a
// second, near-duplicate ROWS array just to rename one row, this overrides
// that one row's label/icon/landingX for the "image" variant only; "slug"
// and "target" (both from the multi-image wizard) are untouched and keep
// showing the real "Div Block" row exactly as before.
const CONTAINER_ROW_OVERRIDE: Partial<Record<NavigatorMarkVariant, { label: string; icon: ReactNode; landingX: number }>> = {
  image: { label: "Image", icon: <ImageGlyph className="h-3 w-3" />, landingX: 122 },
};

// x-offset (from the row's own left edge) of the guide line drawn for
// ancestor depth `d` - lands roughly under that depth's own icon column,
// matching the +14px-per-depth indentation the rows themselves already use.
function guideLineX(depth: number): number {
  return 16 + depth * 14;
}

export function NavigatorMarkGuide({ variant }: { variant: NavigatorMarkVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const targetRowIndex = TARGET_ROW_INDEX[variant];
  const activeRole = ACTIVE_ROLE[variant];
  const containerOverride = CONTAINER_ROW_OVERRIDE[variant];
  const targetRow = ROWS[targetRowIndex];
  const targetLandingX = containerOverride?.landingX ?? targetRow.landingX;

  useEffect(() => {
    if (!containerRef.current) return;

    // gsap.context() scopes the timeline to this component and gives back
    // a `revert()` that's the actually-correct cleanup for React - unlike
    // a bare `tl.kill()`, it's safe against Strict Mode's real dev-only
    // mount->cleanup->remount double-invoke, which otherwise can leave a
    // freshly-created timeline killed before its own first `.set()` calls
    // ever got to paint - the concrete, confirmed cause behind "the cursor
    // never shows up" the first time this was built without it.
    const ctx = gsap.context(() => {
      // Landing spot is approximate (this row's own text width can't be
      // measured before paint without extra layout-thrashing machinery for
      // a purely decorative loop) - tuned by eye against the reference
      // screenshot, roughly at the end of the target row's own label.
      const landingX = targetLandingX ?? 150;
      const landingY = targetRowIndex * ROW_HEIGHT + ROW_HEIGHT / 2 - 4;
      const startX = landingX - 70;
      const startY = -30;

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.7 });
      tl.set(cursorRef.current, { x: startX, y: startY, opacity: 1, scale: 1 })
        .set(highlightRef.current, { opacity: 0 })
        .to(cursorRef.current, { x: landingX, y: landingY, duration: 1.1, ease: "power2.inOut" })
        .to(cursorRef.current, { scale: 0.82, duration: 0.09, ease: "power1.in" }, "+=0.15")
        .to(cursorRef.current, { scale: 1, duration: 0.18, ease: "back.out(3)" })
        .to(highlightRef.current, { opacity: 1, duration: 0.15 }, "<")
        .to({}, { duration: 1.7 })
        .to(highlightRef.current, { opacity: 0, duration: 0.3 })
        .to(cursorRef.current, { opacity: 0, duration: 0.3 }, "<");
    }, containerRef);

    return () => ctx.revert();
    // Re-run whenever the variant changes the landing spot/row - each
    // variant is a fixed prop per mount in practice (the wizard step that
    // renders this never changes `variant` without also unmounting this
    // component via React's own key-less step swap), but depending on the
    // real inputs is cheap correctness, not premature optimization.
  }, [targetRowIndex, targetLandingX]);

  return (
    <div
      ref={containerRef}
      className="relative flex w-full flex-col overflow-hidden rounded-4 bg-[#353535] py-1 font-sans text-[11px]"
    >
      {/* A thin clipped sliver of a row above the visible list, matching
          the reference screenshot's own "scrolled slightly down" look -
          purely decorative, not a real scrollable list. */}
      <div className="-mb-1 h-2 overflow-hidden pl-2 text-[10px] opacity-40" style={{ color: DEFAULT_COLOR }}>
        Section
      </div>

      {ROWS.map((row, i) => {
        const color = row.role ? (row.role === activeRole ? DEFAULT_COLOR : MUTED_COLOR) : row.color ?? DEFAULT_COLOR;
        // Only the one row CONTAINER_ROW_OVERRIDE actually names is ever
        // swapped - every other row renders its own real ROWS entry
        // unchanged regardless of variant.
        const displayIcon = i === targetRowIndex && containerOverride ? containerOverride.icon : row.icon;
        const displayLabel = i === targetRowIndex && containerOverride ? containerOverride.label : row.label;
        return (
          <div
            key={row.label}
            className="relative z-10 flex items-center gap-1.5 pr-2"
            style={{ height: ROW_HEIGHT, paddingLeft: 10 + row.depth * 14, color }}
          >
            {/* Hierarchy guide lines - one full-height segment per ancestor
                depth this row is nested under, per explicit direction
                ("lineas iguales a las de webflow"). A sibling row at the
                same depth draws the identical segment right below the
                previous one, so the run of them reads as one continuous
                line down that ancestor's own column. */}
            {Array.from({ length: row.depth }, (_, d) => (
              <span
                key={d}
                aria-hidden
                className="absolute top-0 h-full w-px bg-white/10"
                style={{ left: guideLineX(d) }}
              />
            ))}
            {row.chevron ? (
              <Icon
                name="chevronRight"
                className={`h-2.5 w-2.5 shrink-0 transition-transform ${row.chevron === "open" ? "rotate-90" : ""}`}
              />
            ) : (
              <span className="w-2.5 shrink-0" />
            )}
            <span className="flex h-3 w-3 shrink-0 items-center justify-center">{displayIcon}</span>
            <span className={i === targetRowIndex ? "text-white" : ""}>{displayLabel}</span>
          </div>
        );
      })}

      {/* Selection highlight - see this file's own top comment for why
          this is a plain div, not the supplied "cuadro de seleccion" SVG
          asset. Full row width, not the row's own content width, matching
          Webflow's real Navigator selection exactly. */}
      <div
        ref={highlightRef}
        className="pointer-events-none absolute left-0 z-[5] w-full bg-[#4A4067] opacity-0"
        style={{ top: targetRowIndex * ROW_HEIGHT + 8, height: ROW_HEIGHT }}
      />

      <CursorGlyph innerRef={cursorRef} />
    </div>
  );
}
