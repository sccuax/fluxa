import { useEffect, useState, type ReactNode } from "react";
import { PanelHeader } from "./PanelHeader";

// Extracted from ControlPanel.tsx once PresetFilterModal needed the exact
// same "fills the app's whole working area, slides up from behind the
// navbar" modal a second time - same reasoning Dropdown.tsx/Tooltip.tsx
// were already extracted for the first time something in this app needed
// reuse.

// DashboardHeader/DashboardNav aren't fixed-height in code (header has a
// max-h-[48px] cap, but nav's height is whatever its own padding+icon+label
// content computes to - no explicit height class to read off) - measuring
// both for real via getBoundingClientRect, instead of hardcoding a guessed
// nav height, is what makes FullViewModal's fixed positioning below actually
// robust: it stays correct even if nav's own content/spacing changes later,
// rather than silently drifting out of sync with a hardcoded number. Falls
// back to {top:48, bottom:0} when the ids aren't found at all (e.g. testing
// a modal in isolation in the sandbox's Components list, outside a real
// DashboardScreen) - a reasonable default for that context rather than a
// crash.
export function useChromeInsets() {
  const [insets, setInsets] = useState({ top: 48, bottom: 0 });

  useEffect(() => {
    const header = document.getElementById("dashboard-header");
    const nav = document.getElementById("dashboard-nav");
    setInsets({
      top: header ? header.getBoundingClientRect().height : 48,
      bottom: nav ? nav.getBoundingClientRect().height : 0,
    });
  }, []);

  return insets;
}

// A modal that fills the app's whole working area - everything between
// DashboardHeader and DashboardNav - without covering either, per explicit
// direction. `fixed` (not a React portal) matches this app's one existing
// plain modal (Modal.tsx, `fixed inset-0`) - there's no real benefit to a
// portal here, since the whole app is one small fixed-size panel/iframe, not
// a real page with distant DOM nodes to escape. Unlike Modal.tsx's
// `inset-0` though, this one insets `top`/`bottom` to useChromeInsets()'s
// measured values instead of covering the full panel.
//
// animate-modal-slide-up/animate-modal-slide-down (tailwind.config.js) fade
// + slide the whole modal between 24px below its final position and there -
// plain CSS @keyframes (same pattern as WelcomeScreen's animate-fill-bar).
// The caller's own open/mount state still fully mounts/unmounts this
// component, but the *close* button here doesn't call the real `onClose`
// (which would unmount instantly, cutting the animation off) - it flips a
// local `closing` flag to swap in the reverse animation first, then delays
// the real `onClose` by MODAL_ANIMATION_MS so the exit actually gets to play
// before the component disappears. That constant has to stay in sync with
// the animate-modal-slide-down duration in tailwind.config.js - there's no
// single source of truth linking a Tailwind animation's CSS duration to a JS
// timer, so both were set to the same 540ms deliberately and must be changed
// together.
const MODAL_ANIMATION_MS = 540;

export function FullViewModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { top, bottom } = useChromeInsets();
  const [closing, setClosing] = useState(false);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, MODAL_ANIMATION_MS);
  }

  return (
    // The outer div is a fixed-size clipping mask (exactly the
    // header-to-nav rect, overflow-hidden) - the inner div is what actually
    // carries the slide animation. Without this split, translateY(100%)
    // (a % transform is relative to the element's own height) moves the
    // *whole* header-to-nav box down by its own full height - since that box
    // already ends flush with the nav's top edge, sliding it down by its own
    // height lands its new top edge exactly at the nav's top edge too,
    // rendering the modal on top of the nav for most of the animation
    // instead of hidden below it. Clipping the outer box to that same rect
    // means anything the inner div slides past that boundary just gets cut
    // off there, so the modal appears to rise from behind/under the nav and
    // sink back below it, never actually covering it.
    <div className="fixed left-0 right-0 z-40 overflow-hidden" style={{ top, bottom }}>
      <div
        className={`flex h-full w-full flex-col bg-background-white ${
          closing ? "animate-modal-slide-down" : "animate-modal-slide-up"
        }`}
      >
        <PanelHeader title={title} onClose={handleClose} />
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
