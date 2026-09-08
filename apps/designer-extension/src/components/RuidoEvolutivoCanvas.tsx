import { useEffect, useRef } from "react";
import {
  mountRuidoEvolutivo,
  type RuidoEvolutivoHandle,
} from "@fluxa/ruido-evolutivo-renderer";
import { useRuidoEvolutivoStore } from "../store/ruidoEvolutivoStore";

// The "ruidoEvolutivo" gallery preset kind's live renderer - a thin React
// wrapper around packages/ruido-evolutivo-renderer's mountRuidoEvolutivo(),
// which owns the actual Three.js scene/render loop (the same one the
// self-hosted published-site bundle will use). Structurally identical to
// GlassLiquidCanvas.tsx - see that file's header for the preserveDrawingBuffer
// contract and why the mount effect runs once with an empty deps array.
export function RuidoEvolutivoCanvas({ preserveDrawingBuffer }: { preserveDrawingBuffer?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<RuidoEvolutivoHandle | null>(null);
  const config = useRuidoEvolutivoStore((state) => state.config);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Seeded from the store's CURRENT config at mount (not the reactive
    // `config` above) so an already-loaded preset's values are picked up on
    // first mount - e.g. apps/preset-admin's loadForEditing() having called
    // setConfig(...) before this component mounts.
    const handle = mountRuidoEvolutivo(canvas, useRuidoEvolutivoStore.getState().config, {
      preserveDrawingBuffer,
    });
    handleRef.current = handle;

    return () => {
      handleRef.current = null;
      handle.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setConfig(config);
  }, [config]);

  return <canvas ref={canvasRef} className="h-full w-full block bg-black" />;
}
