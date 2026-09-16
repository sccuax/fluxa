import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdminToken } from "../middleware/requireAdminToken";

// Read-only reporting for apps/preset-admin's own "Analytics" tab - proxies
// the 5 canned SQL queries (originally handed to the user as plain curl
// commands) through this Worker instead of Fluxa Studio calling Cloudflare's
// Analytics Engine SQL API directly. This is the whole point of this file:
// that API needs a Cloudflare Account API token scoped to "Account
// Analytics Read", and that token must never reach the browser - unlike
// ADMIN_API_TOKEN (already shipped in Fluxa Studio's own client bundle,
// accepted only because Cloudflare Access gates the entire site), this one
// is a real Cloudflare account credential with account-wide analytics read
// access, not something scoped to just this app's own data. Gated by the
// same shared x-admin-token as galleryPresetRoutes/adminPresenceRoutes -
// the only caller is apps/preset-admin.
export const adminAnalyticsRoutes = new Hono<AppEnv>();

adminAnalyticsRoutes.use(requireAdminToken);

// One row from Analytics Engine's SQL API - keys are whatever the query's
// own `AS` aliases name them, values are always strings/numbers (never
// nested), so a loose index signature is accurate here without needing a
// per-query type.
type AnalyticsRow = Record<string, string | number>;

async function runAnalyticsQuery(env: AppEnv["Bindings"], sql: string): Promise<AnalyticsRow[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_API_TOKEN}` },
      body: sql,
    },
  );
  if (!res.ok) {
    // Surfaces the real Cloudflare error (e.g. a bad/missing token, or the
    // dataset not existing yet) rather than a generic 500 - this route is
    // only ever hit by an admin actively looking at a dashboard, so a
    // detailed error is more useful here than it would be on a public route.
    throw new Error(`Analytics Engine query failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: AnalyticsRow[] };
  return body.data ?? [];
}

// Every extension event name this app's own trackEvent() calls actually
// use (apps/designer-extension - grepped for every `trackEvent(` call site
// to build this list, not guessed). Kept here, not derived from the query
// results, specifically so "Top events" always shows all 18 rows with a
// real 0 for whichever haven't fired yet - per explicit direction, seeing
// "this event doesn't appear" should never be confused with "this event
// isn't being tracked at all." Deliberately excludes glassLiquid/
// ruidoEvolutivo's grainMode/ambientGradient controls - those only exist in
// GlassLiquidControlPanel.tsx, used exclusively by this same app
// (preset-admin), and per explicit direction Fluxa Studio's own usage is
// never tracked.
const KNOWN_EXTENSION_EVENTS = [
  "sign_in_completed",
  "sign_up_completed",
  "switch_tab",
  "apply_gradient",
  "open_color_picker",
  "use_eyedropper",
  "search_presets",
  "open_preset_filter_modal",
  "filter_presets",
  "apply_preset",
  "open_manage_profile",
  "click_upgrade_to_pro",
  "open_plan_billing_modal",
  "open_support_modal",
  "click_email_support",
  "click_report_bug",
  "click_request_feature",
  "select_service",
];

// Schema reference (routes/analytics.ts's own writeDataPoint calls):
//   extension events: blobs = ["extension", event, detail]
//   embed impressions: blobs = ["embed-view", kind]
//
// COUNT() below is deliberately argument-less, not COUNT(*) - also
// confirmed via a real 422 from the live API ("COUNT() function must have
// 0 arguments: 1"), same as the toStartOfDay() note above. This dialect
// treats `*` as a real argument, unlike standard SQL where COUNT(*) is
// idiomatic.
adminAnalyticsRoutes.get("/", async (c) => {
  if (!c.env.CLOUDFLARE_ANALYTICS_API_TOKEN) {
    return c.json(
      { error: "not_configured", message: "CLOUDFLARE_ANALYTICS_API_TOKEN secret is not set." },
      503,
    );
  }

  const [topEvents, signInMethods, topPresets, embedViews, dailyTrendRaw] = await Promise.all([
    runAnalyticsQuery(
      c.env,
      `SELECT blob2 AS event, COUNT() AS total FROM fluxa_events WHERE blob1='extension' AND timestamp >= NOW() - INTERVAL '7' DAY GROUP BY blob2 ORDER BY total DESC`,
    ),
    runAnalyticsQuery(
      c.env,
      `SELECT blob3 AS method, COUNT() AS total FROM fluxa_events WHERE blob1='extension' AND blob2='sign_in_completed' GROUP BY blob3`,
    ),
    runAnalyticsQuery(
      c.env,
      `SELECT blob3 AS presetId, COUNT() AS total FROM fluxa_events WHERE blob1='extension' AND blob2='apply_preset' GROUP BY blob3 ORDER BY total DESC LIMIT 10`,
    ),
    runAnalyticsQuery(
      c.env,
      `SELECT blob2 AS kind, COUNT() AS total FROM fluxa_events WHERE blob1='embed-view' AND timestamp >= NOW() - INTERVAL '30' DAY GROUP BY blob2`,
    ),
    runAnalyticsQuery(
      // DATE_TRUNC (from the general Analytics Engine SQL API docs/skill
      // reference) turned out not to actually be a real function in this
      // dialect - confirmed via a real 422 from the live API ("unknown
      // function call: DATE_TRUNC") before this was caught, not assumed
      // from docs alone. toStartOfDay() is the real, ClickHouse-style
      // equivalent (Cloudflare's own date/time functions reference).
      //
      // 56 days (8 weeks) of DAILY granularity, not a separate weekly
      // query - weeklyTrend below is aggregated from this same series in
      // plain JS instead of asking Cloudflare for toStartOfWeek() buckets.
      // That was tried first and deliberately dropped: ClickHouse's
      // toStartOfWeek() week-start convention (Sunday vs. Monday, which
      // mode is actually the default here) isn't documented anywhere this
      // was checked, and zero-filling missing weeks would require
      // independently reconstructing the exact same bucket boundaries
      // Cloudflare used - if that guess is wrong, every week silently
      // shows as 0 instead of erroring, which is a much worse failure mode
      // than not having the feature at all. Rolling 7-day windows anchored
      // to "now" (computed below) can't have this problem since nothing
      // needs to match an opaque server-side convention.
      c.env,
      `SELECT toStartOfDay(timestamp) AS day, COUNT() AS total FROM fluxa_events WHERE timestamp >= NOW() - INTERVAL '56' DAY GROUP BY day ORDER BY day`,
    ),
  ]);

  // dailyTrendRaw only ever returns rows for days that actually have
  // events - a quiet day is simply absent, not a 0 row. For a real bar
  // chart that reads as a gap on the axis rather than a visible
  // zero-height bar, and it would silently corrupt the weekly rollup below
  // (a missing day just wouldn't be summed at all instead of contributing
  // 0). Day-boundary math (unlike the week-boundary math this file
  // deliberately avoids above) is safe to reconstruct independently: a
  // day is exactly 86400000ms regardless of calendar convention, so
  // epoch-aligned UTC-midnight boundaries always match toStartOfDay()'s
  // own output with no ambiguity.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const countByDay = new Map(dailyTrendRaw.map((row) => [new Date(String(row.day)).getTime(), Number(row.total)]));
  const todayStartMs = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  const dailyBuckets: Array<{ date: string; total: number }> = [];
  for (let i = 55; i >= 0; i--) {
    const dayStartMs = todayStartMs - i * DAY_MS;
    dailyBuckets.push({ date: new Date(dayStartMs).toISOString(), total: countByDay.get(dayStartMs) ?? 0 });
  }

  // Daily chart: last 30 of the 56 zero-filled days.
  const dailyTrend = dailyBuckets.slice(-30);

  // Weekly chart: the same 56 days re-chunked into 8 rolling 7-day windows
  // (oldest first), each labeled by its own first day - "this week" is
  // always the last entry, "last week" the second-to-last, matching
  // AnalyticsPanel.tsx's own week-over-week comparison card.
  const weeklyTrend: Array<{ date: string; total: number }> = [];
  for (let week = 0; week < 8; week++) {
    const weekDays = dailyBuckets.slice(week * 7, week * 7 + 7);
    weeklyTrend.push({ date: weekDays[0].date, total: weekDays.reduce((sum, day) => sum + day.total, 0) });
  }

  // Merge the query's own results (only ever rows with count > 0) against
  // the full known-event list - every one of the 18 always appears, real
  // ones sorted to the top, untriggered ones (0) below, ties broken
  // alphabetically so the list doesn't reshuffle between refreshes.
  const countByEvent = new Map(topEvents.map((row) => [String(row.event), Number(row.total)]));
  const topEventsWithZeros = KNOWN_EXTENSION_EVENTS.map((event) => ({
    event,
    total: countByEvent.get(event) ?? 0,
  })).sort((a, b) => b.total - a.total || a.event.localeCompare(b.event));

  return c.json({ topEvents: topEventsWithZeros, signInMethods, topPresets, embedViews, dailyTrend, weeklyTrend });
});
