import type { Bindings } from "../types/env";

// TEMPORARY workaround for the Workers Free plan's Email Sending sandbox
// (see CLAUDE.md's "Cloudflare Email Service" section): while the account
// is on Free, env.EMAIL.send() only delivers to destination addresses that
// have gone through Cloudflare's own Email Routing verification - anything
// else fails silently from the end user's perspective. Rip this whole file
// out (and the call site in auth.ts's sendVerificationOTP) once the account
// is upgraded to Workers Paid, which lifts the sandbox entirely.
//
// Cloudflare's own verification email (sent when a destination address is
// created below) is NOT subject to that sandbox - it's a different delivery
// path than env.EMAIL.send() - which is what makes this workaround possible
// at all: we can reach an unverified inbox to ask it to verify itself, even
// though we can't yet reach it with the real OTP.

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

interface CloudflareDestinationAddress {
  email: string;
  verified: string | null;
}

interface CloudflareListResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: CloudflareDestinationAddress[];
}

interface CloudflareCreateResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

function cloudflareHeaders(env: Bindings) {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function isDestinationVerified(env: Bindings, email: string): Promise<boolean> {
  const res = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/routing/addresses?per_page=200`,
    { headers: cloudflareHeaders(env) },
  );
  const body = (await res.json()) as CloudflareListResponse;
  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudflare email routing addresses list failed: ${res.status} ${JSON.stringify(body.errors)}`,
    );
  }
  const match = body.result.find((addr) => addr.email.toLowerCase() === email.toLowerCase());
  return match?.verified != null;
}

async function requestDestinationVerification(env: Bindings, email: string): Promise<void> {
  const res = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/routing/addresses`,
    {
      method: "POST",
      headers: cloudflareHeaders(env),
      body: JSON.stringify({ email }),
    },
  );
  const body = (await res.json()) as CloudflareCreateResponse;
  // Code 100640 is Cloudflare's "destination address already exists" error -
  // fine here, it just means a previous attempt already triggered the
  // verification email and the user hasn't clicked it yet.
  const alreadyExists = body.errors?.some((e) => e.code === 100640);
  if (!res.ok || (!body.success && !alreadyExists)) {
    throw new Error(
      `Cloudflare email routing address create failed: ${res.status} ${JSON.stringify(body.errors)}`,
    );
  }
}

// Returns true if the OTP can be sent right now. If the address isn't
// verified yet, kicks off Cloudflare's own verification email instead
// (best-effort - failures here are logged, not thrown, so a Cloudflare API
// hiccup doesn't take down the password-reset request itself) and returns
// false so the caller skips the doomed env.EMAIL.send() attempt.
export async function ensureDestinationVerified(env: Bindings, email: string): Promise<boolean> {
  try {
    if (await isDestinationVerified(env, email)) {
      return true;
    }
  } catch (err) {
    console.error("emailRoutingGuard: verification check failed, skipping OTP send", err);
    return false;
  }

  try {
    await requestDestinationVerification(env, email);
    console.log(
      `emailRoutingGuard: ${email} isn't verified yet - sent a Cloudflare verification email instead of the OTP; ask the user to click it, then retry`,
    );
  } catch (err) {
    console.error("emailRoutingGuard: failed to request destination verification", err);
  }
  return false;
}
