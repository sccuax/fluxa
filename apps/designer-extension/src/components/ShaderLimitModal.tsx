import { ProPresetModal } from "./ProPresetModal";
import { useBillingStatus } from "../hooks/useBillingStatus";

// Shown instead of applying when a Free account already uses its 3 shaders
// (editor shaders + gallery presets share the pool). Same layout as the
// Pro-preset modal, with the "limit" copy.
export function ShaderLimitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { upgrading, startUpgrade } = useBillingStatus();
  return <ProPresetModal open={open} onClose={onClose} onUpgrade={startUpgrade} upgrading={upgrading} variant="limit" />;
}
