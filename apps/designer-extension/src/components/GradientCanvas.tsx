import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { useGradientStore } from "../store/gradientStore";

// Prop names are spread straight from GradientConfig (packages/gradient-core)
// which mirrors ShaderGradient's own props. Verify against the installed
// @shadergradient/react types if the upstream API has moved on.
export function GradientCanvas() {
  const config = useGradientStore((state) => state.config);

  return (
    <ShaderGradientCanvas className="h-full w-full" pointerEvents="none">
      <ShaderGradient {...config} />
    </ShaderGradientCanvas>
  );
}
