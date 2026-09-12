import type { GalleryPresetDisplay } from "../types/presetGallery";

// Same "plain character-count slice, not CSS text-overflow: ellipsis"
// convention as DashboardHeader.tsx's own truncateLabel - a different max
// (15, per this card's own spec) so it's a separate local helper rather
// than reusing that one's hardcoded 12.
const PRESET_NAME_MAX_CHARS = 15;
function truncatePresetName(name: string): string {
  return name.length > PRESET_NAME_MAX_CHARS ? `${name.slice(0, PRESET_NAME_MAX_CHARS)}…` : name;
}

// A grid item - clickable for any preset kind with a valid current
// selection (`canApply`, passed down from PresetsTab.tsx, which owns the
// actual selected-element polling). All three kinds (`shaderGradient`,
// `glassLiquid`, `ruidoEvolutivo`) are applicable straight from the gallery
// - `shaderGradient` was applicable only via EditorTab's own "Apply
// gradient" button until this was explicitly widened. License (`free`/
// `pro`) plays no role in clickability - there's no plan/payment gating
// built yet (see the root CLAUDE.md), so every kind is equally applicable
// regardless of license tier.
// Prefers `thumbnailUrl` (a real admin-captured screenshot of the live
// shader, see presetGallery.ts's own comment) when the preset has one;
// falls back to a `previewColors`-derived linear-gradient approximation
// for presets nobody's captured a thumbnail for yet.
export function PresetCard({
  preset,
  canApply,
  onApply,
}: {
  preset: GalleryPresetDisplay;
  canApply: boolean;
  onApply: (preset: GalleryPresetDisplay) => void;
}) {
  const [color1, color2, color3] = preset.previewColors;
  const clickable = canApply;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onApply(preset) : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onApply(preset);
              }
            }
          : undefined
      }
      // No default border - only the radius stays, per explicit direction.
      // border-transparent (not just omitting the border classes) reserves
      // the same 1px box the hover state needs, so gaining a real
      // border-accent-500 on hover doesn't shift the card's own size against
      // its neighbors.
      className={`relative flex min-h-[134px] w-full flex-col overflow-hidden rounded-4 border border-transparent ${
        clickable ? "cursor-pointer hover:border-accent-500" : ""
      }`}
    >
      {/* Fills the card completely (100% width/height) - absolute rather
          than a normal-flow img, since the license/name overlay text below
          needs to sit on top of it, not below it in a separate row. */}
      {preset.thumbnailUrl ? (
        <img src={preset.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 h-full w-full"
          style={{ backgroundImage: `linear-gradient(135deg, ${color1}, ${color2}, ${color3})` }}
        />
      )}

      {/* Bottom-only name-legibility overlay - replaces the earlier top+
          bottom backdrop-blur strips entirely (no top strip anymore; the
          "Pro" badge above gets no protective treatment now, per explicit
          direction - only the name at the bottom does). A real 5-stop
          gradient (Background Dark 2 solid at the very bottom fading to
          fully transparent by the top) plus a genuine `filter: blur(2px)`
          on the overlay's OWN pixels (not backdrop-blur of the image
          beneath it, a real difference - see the gradient's own softened
          edges here vs. the old approach's sharp-edged translucent band).
          var(--background-background-dark-2, ...) is this app's own real
          CSS custom property for the token (packages/design-tokens/dist/
          variables.css) - not a copy-pasted Figma snippet's raw hex, so it
          stays correct if that token's value ever changes again.
          rounded-b-4 for the same reason the old strips had it: a filter
          child is a real case where an ancestor's overflow-hidden +
          border-radius clip can't always be trusted alone at the corners. */}
      <div
        className="absolute inset-x-0 bottom-0 h-10 rounded-b-4 blur-[2px]"
        style={{
          background:
            "linear-gradient(0deg, var(--background-background-dark-2, #20242D) 0%, rgba(15, 11, 18, 0.80) 19.78%, rgba(15, 11, 18, 0.50) 50%, rgba(15, 11, 18, 0.20) 80%, rgba(15, 11, 18, 0.00) 100%)",
        }}
      />

      {/* Free presets carry no license text at all, per explicit direction -
          only Pro gets the badge.

          Two nested elements, not one - background-clip:text affects EVERY
          background on an element, not just the one meant for the text
          fill. Putting bg-background-white on the same span as
          bg-gradient-gradient/bg-clip-text clipped the white fill to the
          letters' own shape too (the "mask" look) instead of filling the
          whole pill behind them - a real, previously-hit bug here.

          Outer span: the pill itself. Its own `background` is the standard
          two-layer gradient-border trick (a plain border-color can't be a
          gradient) - a solid background-white fill painted into the
          padding-box, and gradient-gradient painted into the border-box
          underneath/around it; `border: 1px solid transparent` is what
          actually reveals a 1px ring of that second layer as the visible
          "border". Inner span: bg-gradient-gradient/bg-clip-text/
          text-transparent reproduces the pasted webkit-mask recipe via the
          app's own already-corrected gradient token (3deg, not the pasted
          Figma snippet's stale 19deg fallback - see the root CLAUDE.md's
          gradient-fidelity lesson) rather than hand-copying stale stops -
          now isolated to just this inner span, with nothing else on it for
          background-clip to also catch. */}
      {preset.license === "pro" && (
        <span
          className="absolute flex left-2 top-2 z-10 rounded-16 border border-transparent px-3 py-[2px]"
          style={{
            background: "linear-gradient(var(--background-background-white), var(--background-background-white)) padding-box, var(--gradient-gradient) border-box",
            boxShadow: "4px 21px 6px 0 rgba(11, 13, 18, 0.00), 2px 13px 5px 0 rgba(11, 13, 18, 0.01), 1px 8px 5px 0 rgba(11, 13, 18, 0.05), 1px 3px 3px 0 rgba(11, 13, 18, 0.09), 0 1px 2px 0 rgba(11, 13, 18, 0.10)",
          }}
        >
          <span className="bg-gradient-gradient bg-clip-text font-sans text-mobile-text-md-medium text-transparent">
            Pro
          </span>
        </span>
      )}

      <span className="absolute bottom-2 left-2 z-10 font-sans text-mobile-text-md-medium text-text-white">
        {truncatePresetName(preset.name)}
      </span>
    </div>
  );
}
