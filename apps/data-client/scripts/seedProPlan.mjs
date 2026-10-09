// One-off local script: seeds/updates the single "pro" row in the `plans`
// table. Not a permanent admin route (see the billing plan's own reasoning:
// this row is touched rarely - once now, maybe once more for the test->live
// Lemon Squeezy variant swap - a whole new authenticated route in the
// deployed Worker would be more surface area than that's worth).
//
// Plain .mjs (no TypeScript/build step) run directly with `node`, same
// reasoning as auth-cli.config.ts's own "CLI needs something plain Node can
// load" - and raw SQL via neon's tagged template rather than importing
// db/app-schema.ts's Drizzle table objects, since those are TypeScript and
// this script isn't compiled.
//
// Seeds BOTH Pro rows ("pro" = monthly $5, "pro_yearly" = yearly $48, 20% off),
// each tagged with its Lemon Squeezy variant id (the webhook resolves the plan
// by that id).
//
// Usage (from apps/data-client):
//   node scripts/seedProPlan.mjs <monthly-variant-id> <yearly-variant-id>
// or set LEMONSQUEEZY_VARIANT_MONTHLY / LEMONSQUEEZY_VARIANT_YEARLY in .dev.vars
// and omit the args.
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".dev.vars" });

const monthlyVariantId = process.argv[2] ?? process.env.LEMONSQUEEZY_VARIANT_MONTHLY;
const yearlyVariantId = process.argv[3] ?? process.env.LEMONSQUEEZY_VARIANT_YEARLY;
if (!monthlyVariantId || !yearlyVariantId || monthlyVariantId.startsWith("REPLACE_WITH") || yearlyVariantId.startsWith("REPLACE_WITH")) {
  console.error(
    "Usage: node scripts/seedProPlan.mjs <monthly-variant-id> <yearly-variant-id>\n" +
      "(or set LEMONSQUEEZY_VARIANT_MONTHLY / LEMONSQUEEZY_VARIANT_YEARLY in .dev.vars first)",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set - check .dev.vars.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const plans = [
  { code: "pro", name: "Pro", priceCents: 500, interval: "month", variantId: monthlyVariantId },
  { code: "pro_yearly", name: "Pro (yearly)", priceCents: 4800, interval: "year", variantId: yearlyVariantId },
];

for (const plan of plans) {
  const [row] = await sql`
    INSERT INTO plans (id, code, name, description, price_cents, currency, billing_interval, provider_price_id, active)
    VALUES (${randomUUID()}, ${plan.code}, ${plan.name}, 'Unlimited shaders, Pro presets, and all Webflow Solutions.', ${plan.priceCents}, 'usd', ${plan.interval}, ${plan.variantId}, true)
    ON CONFLICT (code) DO UPDATE SET
      provider_price_id = EXCLUDED.provider_price_id,
      price_cents = EXCLUDED.price_cents,
      billing_interval = EXCLUDED.billing_interval,
      updated_at = now()
    RETURNING id, code, name, price_cents, currency, billing_interval, provider_price_id, active;
  `;
  console.log("Seeded plan:", row);
}
