import { useEffect, useState, type RefObject } from "react";
import { computeAdaptivePixelDensity } from "@fluxa/gradient-core";

// See gradient-core's adaptivePixelDensity.ts for why this exists: ShaderGradientCanvas's
// `pixelDensity` is a fixed dpr multiplier applied to the canvas's own CSS size, so the
// same preset renders far more physical pixels on a large/high-resolution viewport than a
// small one. Measures `containerRef`'s real rendered size (ResizeObserver, so it tracks the
// panel resizing or the published page's own responsive layout) and shrinks
// `configuredPixelDensity` to keep total rendered pixels bounded.
export function useAdaptivePixelDensity(
  containerRef: RefObject<HTMLElement | null>,
  configuredPixelDensity: number,
): number {
  const [effectiveDensity, setEffectiveDensity] = useState(configuredPixelDensity);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setEffectiveDensity(computeAdaptivePixelDensity(configuredPixelDensity, width, height));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef, configuredPixelDensity]);

  return effectiveDensity;
}
