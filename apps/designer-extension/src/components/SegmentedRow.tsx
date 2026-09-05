// Extracted from ControlPanel.tsx once PresetFilterModal needed the exact
// same "label on the left via mr-auto, pill buttons on the right" pattern a
// second time - same reasoning Dropdown.tsx/Tooltip.tsx were already
// extracted for the first time something in this app needed reuse.
// max-w-[203px] (ControlPanel's own ROW_CONTROLS_MAX_WIDTH constant,
// inlined here as the literal default) is what every call site that omits
// `className` still gets, unchanged from before the extraction.
export function SegmentedRow<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label?: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className="flex w-full justify-end items-center gap-[8px]">
      {label && <p className="font-sans mr-auto text-mobile-header-h2 text-text-black">{label}</p>}
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
