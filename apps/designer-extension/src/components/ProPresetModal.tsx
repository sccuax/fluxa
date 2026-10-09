import { ButtonPrimary } from "./ButtonPrimary";
import { ButtonSecondary } from "./ButtonSecondary";
import { Icon } from "./Icon";

const PRICING_URL = "https://fluxa.agency/#pricing";

// Gradient-border pill: a white padding-box layer over the brand gradient
// painted in the border-box, revealed through a 1px transparent border (same
// trick as PresetCard's "Pro" badge).
const PRO_PILL_STYLE = {
  border: "1px solid transparent",
  background:
    "linear-gradient(var(--background-background-white), var(--background-background-white)) padding-box, var(--gradient-gradient) border-box",
  boxShadow:
    "4px 21px 6px 0 rgba(11, 13, 18, 0), 2px 13px 5px 0 rgba(11, 13, 18, 0.01), 1px 8px 5px 0 rgba(11, 13, 18, 0.05), 1px 3px 3px 0 rgba(11, 13, 18, 0.09), 0 1px 2px 0 rgba(11, 13, 18, 0.10)",
} as const;

const COPY = {
  preset: {
    noun: "preset",
    description:
      "You're using a free account. Upgrade to Pro to unlock all presets and animated gradients, and take your Webflow projects to the next level.",
    benefits: [
      "Access to all gradient presets",
      "Unlimited animated gradients",
      "Works on any Div block, Section or Link block",
      "Team library (coming soon)",
    ],
  },
  solution: {
    noun: "solution",
    description:
      "You're using a free account. Upgrade to Pro to unlock all solutions, and take your Webflow projects to the next level.",
    benefits: ["Multi-image", "CMS images", "Blogs to staging"],
  },
  // Free account already used its 3 shaders (ShaderLimitModal.tsx). No noun:
  // its title swaps the Pro pill for an accent-coloured "Free".
  limit: {
    noun: null,
    description:
      "You're using a free account. Upgrade to Pro to be able to apply more animated gradients, and take your Webflow projects to the next level.",
    benefits: [
      "Unlimited presets",
      "Webflow solutions included",
      "Unlimited shaders from editor",
      "Team library (coming soon)",
    ],
  },
};

// Shown when a Free account clicks "Apply gradient" inside the preview of a
// Pro preset (PresetsTab.tsx), or reaches the last step of a Webflow Solution
// (`variant="solution"`, via hooks/useProSolutionGate). Own markup rather than
// Modal.tsx: that one is a fixed 260px centered card, this design is wider and
// left-aligned.
export function ProPresetModal({
  open,
  onClose,
  onUpgrade,
  upgrading,
  variant = "preset",
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  upgrading: boolean;
  variant?: keyof typeof COPY;
}) {
  if (!open) return null;
  const { noun, description, benefits } = COPY[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[498px] w-full max-w-[300px] flex-col gap-4 overflow-y-auto rounded-8 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="./images/modal-header-bg.svg"
          alt=""
          className="pointer-events-none absolute left-0 top-0 z-[1] h-auto w-full"
        />
        <div className="relative z-[2] flex flex-col gap-3">
          <p className="pt-10 font-display text-mobile-header-h1 text-text-black">
            {noun ? (
              <>
                This {noun} is available
                <br />
                in the{" "}
                <span
                  className="inline-block max-w-[41px] rounded-16 px-3 py-[2px] align-middle"
                  style={PRO_PILL_STYLE}
                >
                  <span className="bg-gradient-gradient bg-clip-text font-sans text-mobile-text-sm-medium text-transparent">
                    Pro
                  </span>
                </span>{" "}
                plan
              </>
            ) : (
              <>
                You have reached the
                <br />
                limits in the <span className="text-text-color-accent">Free</span> plan
              </>
            )}
          </p>
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
            {description}
          </p>
          <ul className="flex flex-col pt-5">
            {benefits.map((benefit, index) => (
              <li
                key={benefit}
                className={`flex items-center gap-2 pb-3 font-sans text-mobile-text-sm-medium text-text-black ${
                  index === 0 ? "" : "pt-3"
                } ${index === benefits.length - 1 ? "" : "border-b border-border-border"}`}
              >
                <span className="text-text-color-accent">✓</span>
                {benefit}
              </li>
            ))}
          </ul>
          <ButtonPrimary icon={<Icon name="sparkle" />} onClick={onUpgrade} disabled={upgrading}>
            {upgrading ? "Waiting for payment…" : "Upgrade to Pro"}
          </ButtonPrimary>
          <ButtonSecondary onClick={() => window.open(PRICING_URL, "_blank", "noopener,noreferrer")}>
            View pricing
          </ButtonSecondary>
          <div className="flex items-center gap-3 font-sans text-mobile-text-md-regular text-text-secondary">
            <span className="h-px flex-1 bg-border-border" />
            or
            <span className="h-px flex-1 bg-border-border" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-sans text-mobile-text-md-medium text-text-color-accent hover:underline"
          >
            Continue with free plan
          </button>
        </div>
      </div>
    </div>
  );
}
