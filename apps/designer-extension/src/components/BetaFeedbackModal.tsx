import { Modal } from "./Modal";

const SURVEY_URL = "https://forms.cloud.microsoft/r/7BCqMcZi1R";

// Shown every time "Apply gradient" succeeds (EditorTab.tsx) - the beta's
// main feedback-collection channel, per explicit direction. Copy is a
// grammar/spelling cleanup of the original request, not a rewrite: "Thanks
// for using the Beta version!" / a subtitle explaining why feedback matters
// right now / a link to the real survey.
export function BetaFeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <p className="text-mobile-header-h1 font-display text-text-black">Thanks for using the Beta version!</p>
      <p className="text-mobile-text-md-regular font-sans text-text-secondary">
        Your feedback is very valuable to us and will help us improve your experience once we launch the app. Feel
        free to share your thoughts in this survey.
      </p>
      <a
        href={SURVEY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-mobile-text-md-medium font-sans text-text-color-accent hover:underline"
      >
        Take the survey
      </a>
    </Modal>
  );
}
