import { apiFetch } from "./apiClient";

export type BillingPlan = "free" | "pro";

export interface BillingStatus {
  plan: BillingPlan;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  customerPortalUrl: string | null;
}

export function fetchBillingStatus(): Promise<BillingStatus> {
  return apiFetch<BillingStatus>("/api/billing/status");
}

export function createCheckoutSession(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/api/billing/checkout", { method: "POST" });
}
