import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../../designer-extension/src/components/Icon";

const DEFAULT_OFFSET_FROM_EDGE = 24;
// Keep at least this many pixels of the panel on-screen on any side, so a
// drag can never strand it somewhere unrecoverable off-viewport.
const MIN_VISIBLE_PX = 40;

// preset-admin-only chrome wrapping one of the shared ControlPanel variants
// (ControlPanel/GlassLiquidControlPanel/RuidoEvolutivoControlPanel, all from
// apps/designer-extension) in a draggable floating window - never modifies
// those shared components themselves, same as this app's own layout
// choices elsewhere. Lets the previewer's canvas render full-width instead
// of permanently losing a 320px sidebar to the control panel (see App.tsx).
//
// Drag handling mirrors ControlPanel.tsx's own ScrubHandle/OpacitySlider
// pattern exactly: onPointerDown captures the starting pointer position and
// the panel's current offset, window-level pointermove/pointerup (mounted
// once, reading a "latest" ref) update position, preventDefault on
// pointerdown dodges the native drag-select "not-allowed" cursor bug
// already documented there. No rAF-coalescing needed here, unlike those
// sliders - this only sets local component state, never a store write.
export function FloatingPanel({ children }: { children: ReactNode }) {
  // Hidden state is separate from drag position - the toggle button below
  // is always rendered (own fixed corner, never moves with the panel) so
  // there's always a way back once the panel's hidden, per the exact reason
  // this exists: checking the canvas's own framing (edges/aspect ratio)
  // completely unobstructed.
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState(() => ({
    x: Math.max(0, window.innerWidth - 320 - DEFAULT_OFFSET_FROM_EDGE),
    y: 96,
  }));

  const dragStateRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function clamp(x: number, y: number) {
      const rect = panelRef.current?.getBoundingClientRect();
      const width = rect?.width ?? 320;
      const height = rect?.height ?? 200;
      return {
        x: Math.min(Math.max(x, MIN_VISIBLE_PX - width), window.innerWidth - MIN_VISIBLE_PX),
        y: Math.min(Math.max(y, MIN_VISIBLE_PX - height), window.innerHeight - MIN_VISIBLE_PX),
      };
    }

    function handleMove(event: PointerEvent) {
      const state = dragStateRef.current;
      if (!state) return;
      const nextX = state.startPosX + (event.clientX - state.startX);
      const nextY = state.startPosY + (event.clientY - state.startY);
      setPosition(clamp(nextX, nextY));
    }
    function handleUp() {
      dragStateRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  return (
    <>
      {/* Fixed corner, independent of the draggable panel's own position -
          stays put (and stays visible) even while the panel itself is
          hidden, so there's always a way to bring it back. */}
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide controls" : "Show controls"}
        aria-pressed={visible}
        title={visible ? "Hide controls" : "Show controls"}
        className={`fixed right-6 top-6 z-50 flex h-9 w-9 items-center justify-center rounded-4 border shadow-lg ${
          visible
            ? "border-accent-500 bg-accent-50 text-accent-500"
            : "border-border-border bg-background-white text-text-secondary"
        }`}
      >
        <Icon name="filter" width={16} height={16} />
      </button>

      {visible && (
        <div
          ref={panelRef}
          className="fixed z-50 flex w-[320px] flex-col overflow-hidden rounded-4 border border-border-border bg-background-white shadow-lg"
          style={{ left: position.x, top: position.y }}
        >
          <div
            onPointerDown={(event) => {
              event.preventDefault();
              dragStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                startPosX: position.x,
                startPosY: position.y,
              };
            }}
            className="flex shrink-0 cursor-grab select-none touch-none items-center gap-2 border-b border-border-border bg-background-white-2 px-3 py-2 active:cursor-grabbing"
          >
            <span aria-hidden className="font-sans text-mobile-text-sm-regular text-text-secondary">⠿</span>
            <span className="font-sans text-mobile-text-sm-medium text-text-black">Controls</span>
          </div>
          <div className="h-[560px] overflow-hidden">{children}</div>
        </div>
      )}
    </>
  );
}
