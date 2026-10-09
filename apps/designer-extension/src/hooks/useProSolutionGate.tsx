import { useCallback, useState } from "react";
import { ProPresetModal } from "../components/ProPresetModal";
import { useBillingStatus } from "./useBillingStatus";

// Webflow Solutions are Pro-only. Each solution's final step calls
// `ensurePro()` first: true -> carry on, false -> the Pro modal is now showing
// and the action must be aborted. Re-checks the server once when the cached
// status isn't Pro, so a Pro user isn't blocked by a not-yet-loaded status
// and a just-upgraded user gets through without reopening the panel.
export function useProSolutionGate() {
  const { status, refresh, upgrading, startUpgrade } = useBillingStatus();
  const [open, setOpen] = useState(false);

  const ensurePro = useCallback(async () => {
    if (status?.plan === "pro") return true;
    if ((await refresh())?.plan === "pro") return true;
    setOpen(true);
    return false;
  }, [status, refresh]);

  const modal = (
    <ProPresetModal
      open={open}
      onClose={() => setOpen(false)}
      onUpgrade={startUpgrade}
      upgrading={upgrading}
      variant="solution"
    />
  );

  return { ensurePro, modal };
}
