import { useRef } from "react";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { getEffectiveGradientColors } from "@fluxa/gradient-core";
import { useGradientStore } from "../store/gradientStore";
import { useAdaptivePixelDensity } from "../hooks/useAdaptivePixelDensity";

// Prop names are spread straight from GradientConfig (packages/gradient-core)
// which mirrors ShaderGradient's own props. Verify against the installed
// @shadergradient/react types if the upstream API has moved on.
//
// lazyLoad={false}: ShaderGradientCanvas defaults to lazyLoad=true, gating
// the actual @react-three/fiber <Canvas> behind an IntersectionObserver
// (only mounts once the wrapper is >=10% in view) - inside the Designer
// Extension's iframe (and in a nested-iframe browser test) that observer
// never reports "in view", so the real <canvas> element silently never
// gets created (no console error - it's working as designed, just for an
// assumption that doesn't hold here). This component is already only
// mounted when it should be visible (EditorTab's selection-state swap), so
// the internal lazy-loading is redundant here anyway.
export function GradientCanvas({ preserveDrawingBuffer }: { preserveDrawingBuffer?: boolean } = {}) {
  const config = useGradientStore((state) => state.config);
  const containerRef = useRef<HTMLDivElement>(null);
  const effectivePixelDensity = useAdaptivePixelDensity(containerRef, config.pixelDensity);

  return (
    <div ref={containerRef} className="h-full w-full">
      <ShaderGradientCanvas
        className="h-full w-full"
        pointerEvents="none"
        lazyLoad={false}
        pixelDensity={effectivePixelDensity}
        fov={config.fov}
        // Left unset here (undefined) for the real Designer Extension - the
        // customer-facing live preview never needs its buffer read back, and
        // preserveDrawingBuffer:true has a real (if small) compositing cost
        // not worth paying for nothing. apps/preset-admin passes true: its
        // "Capture thumbnail" button reads this canvas's actual pixels via
        // drawImage on an arbitrary, async-triggered click - with the
        // WebGL default (preserveDrawingBuffer: false), the browser is free
        // to clear the buffer the instant after compositing each frame, so a
        // read that doesn't land in the same tick as a render can catch it
        // empty (confirmed real, not theoretical - captureThumbnail.ts's own
        // comment). true keeps the last rendered frame's pixels around so a
        // capture triggered at any moment reads real content instead of a
        // coin-flip blank frame.
        preserveDrawingBuffer={preserveDrawingBuffer}
        // Threaded straight through to three.js's WebGLRenderer as its own
        // `powerPreference` gl option (confirmed by reading the installed
        // package's own compiled source, chunk-CPUZJ7YV.mjs - not guessed).
        // Left unset before, this context fell back to three.js/the browser's
        // own "default" choice of which GPU to use - on a hybrid-graphics
        // laptop (integrated + discrete), that can land this WebGL context on
        // the integrated GPU while it's simultaneously competing with the
        // real Webflow Designer's own canvas for compositor time in the same
        // tab, which is exactly the ~28-30fps (near-exactly half of 60fps -
        // a throttling/contention signature, not raw overload) measured with
        // Chrome's own FPS meter only when this panel floats over the real
        // Designer - the same GradientCanvas measured a clean ~60fps mounted
        // alone in the sandbox, with no other canvas competing for GPU time.
        // "high-performance" explicitly requests the faster/discrete GPU for
        // this context instead of leaving that choice ambiguous.
        powerPreference="high-performance"
      >
        {/* colorCount is app-level only (see gradient-core's schema.ts) - the
            override spread must come after {...config} so a "2 colors"
            selection actually collapses color3 into color2 here too, not just
            in the published embed. */}
        <ShaderGradient {...config} {...getEffectiveGradientColors(config)} />
      </ShaderGradientCanvas>
    </div>
  );
}
