import type { BillingStatus } from "./billing";
import type { ShaderUsage } from "./shaderUsage";

// Last plan data seen this session. PlanCard / PlanBillingModal remount on every
// visit to the Account tab; starting from this instead of "unknown" is what
// keeps a Pro account from flashing "Free plan" while the fetch is in flight.
// Always revalidated in the background - this is only the first paint.
//
// Must be cleared on sign-out / account deletion, or the next account to sign
// in inside the same iframe would briefly see the previous one's plan.
export const planCache: { billing: BillingStatus | null; usage: ShaderUsage | null } = {
  billing: null,
  usage: null,
};

export function clearPlanCache() {
  planCache.billing = null;
  planCache.usage = null;
}
