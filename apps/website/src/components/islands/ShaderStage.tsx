import { useEffect, useRef, useState } from "react";
import { detectCapabilities, type RenderTier } from "@/lib/gpu/capabilities";
import type { StageHandle } from "@/lib/gpu/types";

interface Props {
  className?: string;
}

// Picks the best render tier at runtime and degrades in order:
//   webgpu (compute particle field) -> webgl (product ruido renderer) -> poster.
// The poster is plain CSS in the parent, so "none" costs nothing and the page
// never depends on this island to look finished. Hydrated with client:visible,
// so no GPU code is even downloaded until the hero is on screen.
export default function ShaderStage({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let handle: StageHandle | null = null;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    const start = async (tier: RenderTier): Promise<void> => {
      if (tier === "webgpu") {
        try {
          const { mountWebgpuField } = await import("@/lib/gpu/tiers/webgpu-field");
          const mounted = await mountWebgpuField(canvas, {
            // Lost device (driver reset, GPU switch): fall back rather than go blank.
            onLost: () => {
              if (!cancelled) void start("webgl");
            },
          });
          if (cancelled) return mounted.dispose();
          handle = mounted;
          return;
        } catch (error) {
          console.warn("[website] WebGPU tier failed, falling back to WebGL:", error);
          return start("webgl");
        }
      }
      if (tier === "webgl") {
        const { mountWebglStage } = await import("@/lib/gpu/tiers/webgl");
        if (cancelled) return;
        handle?.dispose();
        handle = mountWebglStage(canvas);
      }
    };

    void (async () => {
      const capabilities = await detectCapabilities();
      if (cancelled || capabilities.tier === "none") return;
      await start(capabilities.tier);
      if (cancelled || !handle) return;
      setReady(true);

      // Off-screen shaders cost zero GPU time (same policy as the product embeds).
      observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) handle?.resume();
        else handle?.pause();
      });
      observer.observe(canvas);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      handle?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ opacity: ready ? 1 : 0, transition: "opacity 0.8s ease-out" }}
    />
  );
}
