import { apiFetch, ApiRequestError } from "./apiClient";
import { getWebflowDesigner } from "./webflowDesigner";
import type { PresetTarget } from "./applyGradient";

export type ShaderKind = "shaderGradient" | "glassLiquid" | "ruidoEvolutivo";

export interface ShaderUsage {
  plan: "free" | "pro";
  used: number;
  // null on Pro (unlimited).
  limit: number | null;
}

// Fired after anything changes the account's count so PlanCard (Account tab,
// Plan & billing modal) refreshes without being remounted.
const CHANGED_EVENT = "fluxa:shader-usage-changed";
export function onShaderUsageChanged(listener: () => void) {
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}
const notifyChanged = () => window.dispatchEvent(new Event(CHANGED_EVENT));

export function fetchShaderUsage(): Promise<ShaderUsage> {
  return apiFetch<ShaderUsage>("/api/shader-usage");
}

function elementKey(element: PresetTarget) {
  const id = element.id as { component: string; element: string };
  return `${id.component}:${id.element}`;
}

// Spends one of the Free plan's 3 lifetime shaders for `element` right BEFORE a shader is applied.
// Resolves true when the apply may proceed; false when the Free limit is hit
// (caller shows the upgrade prompt). Any other failure throws, so a backend
// outage surfaces as an error rather than silently skipping the limit.
export async function claimShaderSlot(element: PresetTarget, kind: ShaderKind): Promise<boolean> {
  const { siteId } = await getWebflowDesigner().getSiteInfo();
  try {
    await apiFetch<ShaderUsage>("/api/shader-usage/claim", {
      method: "POST",
      body: JSON.stringify({ siteId, elementId: elementKey(element), kind }),
    });
    return true;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 402) return false;
    throw error;
  } finally {
    notifyChanged();
  }
}
