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
// Usage (from apps/data-client):
//   node scripts/seedProPlan.mjs <lemonsqueezy-variant-id>
// or set a real LEMONSQUEEZY_VARIANT_ID in .dev.vars first and omit the arg.
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".dev.vars" });

const variantId = process.argv[2] ?? process.env.LEMONSQUEEZY_VARIANT_ID;
if (!variantId || variantId.startsWith("REPLACE_WITH")) {
  console.error(
    "Usage: node scripts/seedProPlan.mjs <lemonsqueezy-variant-id>\n" +
      "(or set a real LEMONSQUEEZY_VARIANT_ID in .dev.vars first)",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set - check .dev.vars.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const id = randomUUID();

const [row] = await sql`
  INSERT INTO plans (id, code, name, description, price_cents, currency, billing_interval, provider_price_id, active)
  VALUES (${id}, 'pro', 'Pro', 'Unlimited shaders, Pro presets, and all Webflow Solutions.', 500, 'usd', 'month', ${variantId}, true)
  ON CONFLICT (code) DO UPDATE SET
    provider_price_id = EXCLUDED.provider_price_id,
    price_cents = EXCLUDED.price_cents,
    updated_at = now()
  RETURNING id, code, name, price_cents, currency, billing_interval, provider_price_id, active;
`;

console.log("Seeded plan:", row);
