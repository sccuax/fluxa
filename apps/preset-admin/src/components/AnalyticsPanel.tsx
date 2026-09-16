import { useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "../services/apiClient";
import { BarChart } from "./BarChart";

// Mirrors apps/data-client's routes/adminAnalytics.ts response shape
// exactly - each array is one of the canned SQL queries/rollups run
// server-side against the fluxa_events Analytics Engine dataset.
// dailyTrend/weeklyTrend are both zero-filled server-side (every day/week
// in range appears, real ones and quiet ones alike) - see that route's own
// comment on why quiet buckets would otherwise just be absent rather than
// a real 0.
interface AnalyticsData {
  topEvents: Array<{ event: string; total: number }>;
  signInMethods: Array<{ method: string; total: number }>;
  topPresets: Array<{ presetId: string; total: number }>;
  embedViews: Array<{ kind: string; total: number }>;
  dailyTrend: Array<{ date: string; total: number }>;
  weeklyTrend: Array<{ date: string; total: number }>;
}

const dayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function formatDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

function Table({ columns, rows, emptyLabel }: { columns: [string, string]; rows: Array<[string, number]>; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="font-sans text-mobile-text-sm-regular text-text-secondary">{emptyLabel}</p>;
  }
  return (
    <table className="w-full border-collapse font-sans text-mobile-text-sm-regular">
      <thead>
        <tr className="border-b border-border-border text-left text-text-secondary">
          <th className="py-1.5 pr-4 font-normal">{columns[0]}</th>
          <th className="py-1.5 font-normal">{columns[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-border-border last:border-b-0">
            <td className="py-1.5 pr-4 text-text-black">{label}</td>
            <td className="py-1.5 text-text-black">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({
  title,
  caption,
  children,
  wide = false,
}: {
  title: string;
  // What the numbers/bars in this section actually count - per explicit
  // direction, a chart showing one combined total has to say what that
  // total actually is (which events, or "everything combined") somewhere
  // near it, not leave it implied by the section title alone.
  caption?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-4 border border-border-border p-4 ${wide ? "md:col-span-2" : ""}`}>
      <div className="flex flex-col gap-0.5">
        <h3 className="font-display text-mobile-header-h2 text-text-black">{title}</h3>
        {caption && <p className="font-sans text-mobile-text-sm-regular text-text-secondary">{caption}</p>}
      </div>
      {children}
    </div>
  );
}

// This week vs. the immediately preceding week - the last two entries of
// weeklyTrend (already oldest-first, so index 7 is "this week", 6 is "last
// week"). A rolling 7-days-ago-to-now window, not a calendar week - see
// adminAnalytics.ts's own comment for why that's a deliberate choice, not
// a simplification.
function WeekComparison({ weeklyTrend }: { weeklyTrend: AnalyticsData["weeklyTrend"] }) {
  if (weeklyTrend.length < 2) return null;
  const thisWeek = weeklyTrend[weeklyTrend.length - 1].total;
  const lastWeek = weeklyTrend[weeklyTrend.length - 2].total;
  const delta = thisWeek - lastWeek;
  const pct = lastWeek === 0 ? null : Math.round((delta / lastWeek) * 100);
  const deltaColor = delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-text-secondary";
  const deltaLabel = lastWeek === 0 ? (thisWeek > 0 ? "New activity" : "No change") : `${delta >= 0 ? "+" : ""}${pct}%`;

  return (
    <div className="flex items-end gap-6">
      <div className="flex flex-col gap-1">
        <span className="font-sans text-mobile-text-sm-regular text-text-secondary">This week</span>
        <span className="font-display text-mobile-header-h1 text-text-black">{thisWeek}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-sans text-mobile-text-sm-regular text-text-secondary">Last week</span>
        <span className="font-display text-mobile-header-h1 text-text-black">{lastWeek}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-sans text-mobile-text-sm-regular text-text-secondary">Change</span>
        <span className={`font-display text-mobile-header-h1 ${deltaColor}`}>{deltaLabel}</span>
      </div>
    </div>
  );
}

// Full sentence version of the same this-vs-previous comparison
// WeekComparison shows as bare numbers - a dedicated section per explicit
// direction, separate from (not a replacement for) the numeric stat row
// and the per-bar deltas already on the charts themselves. Shared between
// the weekly and daily sections below rather than two near-duplicate
// components, since the logic (and its edge cases: both zero, previous
// zero, exact tie) is identical either way - only the labels differ.
function formatComparisonSentence(currentLabel: string, previousLabel: string, current: number, previous: number): string {
  const previousLower = previousLabel.charAt(0).toLowerCase() + previousLabel.slice(1);
  if (previous === 0 && current === 0) {
    return `No activity in ${currentLabel.toLowerCase()} or ${previousLower}.`;
  }
  if (previous === 0) {
    return `${currentLabel} had ${current} event${current === 1 ? "" : "s"} - ${previousLower} had none, so this is entirely new activity.`;
  }
  const diff = current - previous;
  if (diff === 0) {
    return `${currentLabel} matched ${previousLower} exactly, at ${current} events.`;
  }
  const pct = Math.round((Math.abs(diff) / previous) * 100);
  return `${currentLabel} had ${current} events, ${diff > 0 ? "up" : "down"} ${pct}% from ${previousLower}'s ${previous}.`;
}

function PeriodComparisonSection({
  title,
  currentLabel,
  previousLabel,
  current,
  previous,
}: {
  title: string;
  currentLabel: string;
  previousLabel: string;
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  const color = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-text-secondary";
  return (
    <Section title={title} wide>
      <p className={`font-sans text-mobile-text-md-medium ${color}`}>
        {formatComparisonSentence(currentLabel, previousLabel, current, previous)}
      </p>
    </Section>
  );
}

// Read-only reporting tab, admin-only (this whole app already sits behind
// Cloudflare Access) - fetches once on mount from apps/data-client's own
// GET /api/admin/analytics, which is what actually queries Cloudflare's
// Analytics Engine SQL API server-side. The Cloudflare Account API token
// that requires never reaches this app's own bundle - only the existing
// x-admin-token (apiClient.ts) is needed here, same as every other route
// this app already calls.
export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<AnalyticsData>("/api/admin/analytics");
      setData(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-mobile-header-h1 text-text-black">Analytics</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-4 border border-border-border px-3 py-1.5 font-sans text-mobile-text-sm-regular text-text-black disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="font-sans text-mobile-text-sm-regular text-red-600">
          {error}
          {error.includes("not_configured") && " - set the CLOUDFLARE_ANALYTICS_API_TOKEN secret on fluxa-data-client."}
        </p>
      )}

      {loading && !data ? (
        <p className="font-sans text-mobile-text-md-regular text-text-secondary">Loading...</p>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Section
            title="Week over week"
            caption="Every tracked extension event added together (sign-ins, editor actions, preset applies, etc.) - see 'Top events' below for the breakdown by type. Each bar is labeled with its own change vs. the week right before it."
            wide
          >
            <WeekComparison weeklyTrend={data.weeklyTrend} />
            <BarChart data={data.weeklyTrend.map((w) => ({ label: formatDay(w.date), value: w.total }))} height={150} />
          </Section>

          <PeriodComparisonSection
            title="Week-over-week comparison"
            currentLabel="This week"
            previousLabel="Last week"
            current={data.weeklyTrend[data.weeklyTrend.length - 1]?.total ?? 0}
            previous={data.weeklyTrend[data.weeklyTrend.length - 2]?.total ?? 0}
          />

          <Section
            title="Daily event volume (last 30 days)"
            caption="Same combined total as above, one bar per day. Each bar also shows its change vs. the day right before it."
            wide
          >
            <BarChart data={data.dailyTrend.map((d) => ({ label: formatDay(d.date), value: d.total }))} height={150} />
          </Section>

          <PeriodComparisonSection
            title="Day-over-day comparison"
            currentLabel="Today"
            previousLabel="Yesterday"
            current={data.dailyTrend[data.dailyTrend.length - 1]?.total ?? 0}
            previous={data.dailyTrend[data.dailyTrend.length - 2]?.total ?? 0}
          />

          <Section title="Top events (last 7 days)">
            <Table
              columns={["Event", "Count"]}
              rows={data.topEvents.map((r) => [r.event, r.total])}
              emptyLabel="No events recorded yet."
            />
          </Section>

          <Section title="Sign-in method">
            <Table
              columns={["Method", "Count"]}
              rows={data.signInMethods.map((r) => [r.method, r.total])}
              emptyLabel="No sign-ins recorded yet."
            />
          </Section>

          <Section title="Top applied presets">
            <Table
              columns={["Preset ID", "Applications"]}
              rows={data.topPresets.map((r) => [r.presetId, r.total])}
              emptyLabel="No presets applied yet."
            />
          </Section>

          <Section title="Embed views by shader kind (last 30 days)">
            <Table
              columns={["Kind", "Views"]}
              rows={data.embedViews.map((r) => [r.kind, r.total])}
              emptyLabel="No published-site views recorded yet."
            />
          </Section>
        </div>
      ) : null}
    </div>
  );
}
