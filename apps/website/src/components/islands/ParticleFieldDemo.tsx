import { useEffect, useRef, useState } from "react";
import { detectCapabilities } from "@/lib/gpu/capabilities";
import type { StageHandle } from "@/lib/gpu/types";

type Status = "checking" | "running" | "unsupported" | "error";

// Standalone demo of @fluxa/webgpu-particle-field (no fallback tier on purpose:
// the point of the page is to show the WebGPU-only effect).
export default function ParticleFieldDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: StageHandle | null = null;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    void (async () => {
      const capabilities = await detectCapabilities();
      if (cancelled) return;
      if (capabilities.tier !== "webgpu") {
        setStatus("unsupported");
        return;
      }
      try {
        const { mountWebgpuField } = await import("@fluxa/webgpu-particle-field");
        const mounted = await mountWebgpuField(canvas, { onLost: () => setStatus("error") });
        if (cancelled) return mounted.dispose();
        handle = mounted;
        setStatus("running");
        observer = new IntersectionObserver(([entry]) => {
          if (entry?.isIntersecting) handle?.resume();
          else handle?.pause();
        });
        observer.observe(canvas);
      } catch (error) {
        console.warn("[website] particle field failed:", error);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      handle?.dispose();
    };
  }, []);

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-16 border border-text-white/10 bg-background-dark">
      <canvas ref={canvasRef} aria-label="WebGPU particle flow field" className="h-full w-full" />
      {status !== "running" && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-text-md-regular text-text-white/60">
          {status === "checking" && "Checking WebGPU support…"}
          {status === "unsupported" &&
            "This effect needs WebGPU, which this browser or device does not provide. Try recent Chrome or Edge."}
          {status === "error" && "The GPU device was lost or failed to start. Reload the page to retry."}
        </p>
      )}
    </div>
  );
}
