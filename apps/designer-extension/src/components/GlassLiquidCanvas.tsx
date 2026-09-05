import { useEffect, useRef } from "react";
import { mountGlassLiquid, type GlassLiquidHandle } from "@fluxa/glass-liquid-renderer";
import { useGlassLiquidStore } from "../store/glassLiquidStore";

// The "glassLiquid" gallery preset kind's live renderer - a thin React
// wrapper around packages/glass-liquid-renderer's mountGlassLiquid(), which
// owns the actual Three.js scene/render-loop (shared verbatim with
// apps/glass-liquid-runtime, the self-hosted published-site bundle - see
// that package's own header comment for why this was extracted out of what
// used to be this file's own ~450-line mount effect in Phase 1).
//
// preserveDrawingBuffer - same contract/reasoning as GradientCanvas.tsx's
// own prop: unset here for the real Designer Extension (a small compositing
// cost not worth paying for nothing), apps/preset-admin passes true so its
// thumbnail-capture button can reliably read the canvas's actual pixels.
export function GlassLiquidCanvas({ preserveDrawingBuffer }: { preserveDrawingBuffer?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GlassLiquidHandle | null>(null);
  const config = useGlassLiquidStore((state) => state.config);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Seeded once from the store's CURRENT config at mount time (not the
    // reactive `config` above, which this effect's own empty deps array
    // never re-reads) - this is what correctly picks up an already-loaded
    // preset's values on first mount, e.g. apps/preset-admin's
    // loadForEditing() having already called setConfig(...) before this
    // component mounts fresh.
    const handle = mountGlassLiquid(canvas, useGlassLiquidStore.getState().config, { preserveDrawingBuffer });
    handleRef.current = handle;

    return () => {
      handleRef.current = null;
      handle.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pushes live config changes into the already-running scene - the mount
  // effect above only runs once (empty deps, since it owns a whole
  // imperative Three.js scene/render loop), so store updates have to reach
  // it through the handle ref instead of a prop/re-render.
  useEffect(() => {
    handleRef.current?.setConfig(config);
  }, [config]);

  return <canvas ref={canvasRef} className="h-full w-full block bg-black" />;
}
