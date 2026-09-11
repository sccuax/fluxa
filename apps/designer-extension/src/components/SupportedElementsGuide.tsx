import { Icon } from "./Icon";

// Guide shown in the Editor tab's controls area when nothing is selected -
// swaps places with ControlPanel once something is selected (see EditorTab,
// which toggles between the two as siblings, not nested).
//
// Reformulated (was three inline "Div block / Section / Link block"
// buttons): now an "Enable custom code?" row plus a bordered two-step
// "how to preview" card. Structure/spacing per the Figma spec:
//   parent            flex-col, py-4, gap-4 (+ the app's standard 20px gutter)
//   ├─ row 1          flex-row justify-between
//   │  ├─ label group flex-row gap-2  (icon + a flex-col of two <p>)
//   │  └─ switch graphic
//   └─ steps card     flex-col gap-4, p-[10px], rounded-[4px], border
//      └─ step x2      flex-row gap-3  (round numbered badge + a <p>)
//
// The switch is a STATIC graphic, not an interactive control. It mirrors
// Webflow Preview's own "Enable custom code?" toolbar toggle (which must be
// on for a shader to render in Preview - see the designer-extension
// CLAUDE.md "Applying the gradient to the published site" note), but that
// toggle is a Designer-session-local preference: neither the Designer
// Extension API nor the REST API exposes it, so this component can't read
// or flip it. Hence the two numbered steps telling the user to do it
// themselves, and no local state here.
const PREVIEW_STEPS = [
  "Click the preview button in Webflow.",
  "Click the preview toggle in Webflow's top-left corner.",
];

export function SupportedElementsGuide() {
  return (
    <div className="flex w-full flex-col gap-4 py-4 px-[20px]">
      <div className="flex w-full flex-row items-center justify-between">
        <div className="flex flex-row gap-2">
          <Icon name="code" className="mt-[2px] size-4 shrink-0 text-text-secondary" />
          <div className="flex flex-col gap-[2px]">
            <p className="font-sans text-mobile-text-md-medium text-text-secondary">Enable custom code?</p>
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
              Enable it to preview your shaders.
            </p>
          </div>
        </div>

        <svg
          width="32"
          height="16"
          viewBox="0 0 32 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
          aria-hidden="true"
        >
          <g filter="url(#filter0_i_823_3889)">
            <rect width="32" height="16" rx="8" fill="#0955E5" />
          </g>
          <rect
            x="16.25"
            y="0.25"
            width="15.5"
            height="15.5"
            rx="7.75"
            fill="url(#paint0_linear_823_3889)"
            stroke="#D9D3C6"
            strokeWidth="0.5"
          />
          <defs>
            <filter
              id="filter0_i_823_3889"
              x="0"
              y="0"
              width="32"
              height="16.7059"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feOffset dy="0.705882" />
              <feGaussianBlur stdDeviation="2.35294" />
              <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
              <feBlend mode="normal" in2="shape" result="effect1_innerShadow_823_3889" />
            </filter>
            <linearGradient
              id="paint0_linear_823_3889"
              x1="24"
              y1="3.29412"
              x2="24"
              y2="14.4706"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FBFBFA" />
              <stop offset="0.927083" stopColor="#ECE8E2" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex w-full flex-col rounded-[4px] border border-border-border p-[10px]">
        {PREVIEW_STEPS.map((text, index) => {
          const isLast = index === PREVIEW_STEPS.length - 1;
          return (
            <div key={text} className="flex flex-row gap-3">
              {/* badge column: the number, plus a 1px connector that fills
                  the rest of the row height down to the next badge (the
                  next <p>'s pb-4 is what gives it something to span). */}
              <div className="flex shrink-0 flex-col items-center">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border-border font-sans text-mobile-text-sm-regular text-text-secondary">
                  {index + 1}
                </div>
                {!isLast && <div className="w-px flex-1 bg-border-border" />}
              </div>
              <p className={`font-sans text-mobile-text-md-regular text-text-secondary ${isLast ? "" : "pb-4"}`}>
                {text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
