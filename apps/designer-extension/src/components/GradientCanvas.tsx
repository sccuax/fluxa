import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { useGradientStore } from "../store/gradientStore";

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
export function GradientCanvas() {
  const config = useGradientStore((state) => state.config);

  return (
    <ShaderGradientCanvas
      className="h-full w-full"
      pointerEvents="none"
      lazyLoad={false}
      pixelDensity={config.pixelDensity}
    >
      <ShaderGradient {...config} />
    </ShaderGradientCanvas>
  );
}
