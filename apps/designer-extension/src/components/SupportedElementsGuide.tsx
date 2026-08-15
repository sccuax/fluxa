// Guide shown in the Editor tab's controls area when nothing is selected -
// swaps places with ControlPanel once something is selected (see EditorTab,
// which toggles between the two as siblings, not nested). Deliberately not
// a shared Tag/Chip component for the element-type list - just three
// inline, non-interactive <button>s, since there's nothing reusable about
// this specific list elsewhere in the app.
const SUPPORTED_ELEMENTS = ["Div block", "Section", "Link block"];

export function SupportedElementsGuide() {
  return (
    <div className="flex w-full flex-col justify-center items-center gap-[12px] px-[20px]">
      <span className="text-mobile-text-md-regular font-sans text-text-secondary">Supported elements</span>

      <div className="flex w-full gap-[8px]">
        {SUPPORTED_ELEMENTS.map((label) => (
          <button
            key={label}
            type="button"
            className="flex min-h-[32px] flex-1 items-center justify-center pointer-events-none rounded-4 border border-border-border px-4 font-sans text-mobile-text-md-regular text-text-secondary"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
