import { Tooltip } from "./Tooltip";

// Extracted from ControlPanel.tsx once PresetFilterModal needed the exact
// same "label on the left via mr-auto, pill buttons on the right" pattern a
// second time - same reasoning Dropdown.tsx/Tooltip.tsx were already
// extracted for the first time something in this app needed reuse.
// max-w-[203px] (ControlPanel's own ROW_CONTROLS_MAX_WIDTH constant,
// inlined here as the literal default) is what every call site that omits
// `className` still gets, unchanged from before the extraction.
//
// `description`, when given, makes the label text itself the trigger for a
// hover Tooltip explaining the control (side="bottom" - these rows tend to
// sit near the top of ControlPanel's scrolling list, and a "top" bubble
// there opens past the scroll container into the fixed header/tab bar and
// gets clipped/lost - see NumberFieldRow's identical choice). A separate
// info icon was tried first for NumberFieldList's own rows and dropped -
// it ate too much of an already-tight row width - so this reuses the
// "label text is the trigger" fix instead of that icon.
export function SegmentedRow<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
  className = "",
}: {
  label?: string;
  description?: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const labelNode = label
    ? description
      ? (
          // mr-auto moves to the Tooltip's own wrapper here (via its
          // className prop) - it's what actually sits in the flex row below
          // once the label is wrapped, not the plain <p> anymore.
          <Tooltip text={description} side="bottom" align="start" className="mr-auto">
            <p className="font-sans text-mobile-header-h2 text-text-black">{label}</p>
          </Tooltip>
        )
      : (
          <p className="font-sans mr-auto text-mobile-header-h2 text-text-black">{label}</p>
        )
    : null;
  return (
    <div className="flex w-full justify-end items-center gap-[8px]">
      {labelNode}
      <div className={`flex w-full items-center justify-end gap-[8px] ${className || "max-w-[203px]"}`}>
        {options.map(({ label: optionLabel, value: optionValue }) => {
          const isActive = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`flex py-1 w-full size-fit items-center justify-center rounded-[4px] border px-2 font-sans text-mobile-text-md-regular ${
                isActive
                  ? "border-accent-500 text-accent-500 bg-accent-50"
                  : "border-border-border text-text-secondary"
              }`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
