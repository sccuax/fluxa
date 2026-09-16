import { useEffect, useRef } from "react";

// Hand-rolled inline SVG bar chart - no charting library added for this,
// same reasoning the designer-extension's own RangeSlider/ColorPicker are
// hand-built rather than pulling in a dependency for something this small
// (react-colorful was tried there once and removed entirely once it turned
// out not to fit - see that app's own CLAUDE.md). Used by AnalyticsPanel.tsx
// for the daily/weekly event-volume charts.
//
// Plain numeric SVG user units throughout (not a mix of percentages and
// px) - viewBox width scales with the bar count so a 30-bar daily chart is
// wider than an 8-bar weekly one, wrapped in a horizontally-scrolling
// container rather than squeezed to fit, so bars/labels never get
// illegibly thin.
const SLOT_WIDTH = 32;
const BAR_FILL = "#e23f8c";
// Left-side percentage scale (0/20/40/60/80/100, per explicit direction) -
// its own fixed-width, non-scrolling SVG next to the scrolling bars one, so
// the axis stays visible/readable regardless of horizontal scroll position
// (including the auto-scroll-to-latest behavior below, which would
// otherwise carry the axis off-screen to the left along with the older
// bars if it lived inside the same scrolling element).
const AXIS_WIDTH = 28;
const PERCENT_TICKS = [0, 20, 40, 60, 80, 100];

// Per-bar delta vs. the immediately preceding bar - per explicit direction
// ("quiero saber si hubo más actividad que el período anterior"), bar
// HEIGHT stays the real count (that's the actual metric a bar chart exists
// to show - collapsing it to a pure percentage would throw away real
// volume information, e.g. two bars both showing "+10%" would look
// identical whether the real jump was 1->1.1 or 100->110). The percentage
// is added as its own small annotation instead, so both questions ("how
// much" and "more or less than before") are answered by the same bar
// without either one hiding the other.
function formatDelta(curr: number, prev: number | undefined): { label: string; colorClass: string } | null {
  if (prev === undefined) return null; // no prior bucket in the returned data at all
  if (prev === 0 && curr === 0) return { label: "—", colorClass: "text-text-secondary" };
  if (prev === 0) return { label: "New", colorClass: "text-green-600" };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return { label: "0%", colorClass: "text-text-secondary" };
  return { label: `${pct > 0 ? "+" : ""}${pct}%`, colorClass: pct > 0 ? "text-green-600" : "text-red-600" };
}

export function BarChart({
  data,
  height = 150,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
}) {
  const width = Math.max(1, data.length) * SLOT_WIDTH;
  const max = Math.max(1, ...data.map((d) => d.value));
  // Bottom 24 units hold the axis line + two label rows (date, then the
  // delta annotation below it) - the bars themselves only ever occupy the
  // space above that, with a further 12-unit top margin for the value
  // readout above the tallest bar.
  const axisY = height - 24;
  const chartHeight = axisY - 12;

  // Data is always oldest-first (adminAnalytics.ts's own ordering), so the
  // most recent - and usually most relevant - bars sit at the right edge.
  // A chart wider than its container opens scrolled to the LEFT by
  // default, which for 30 mostly-empty older days would show nothing but
  // zeros until the admin manually scrolls - auto-scroll to the end on
  // mount so today's data is what's actually visible first.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [width]);

  return (
    <div className="flex">
      {/* Fixed, non-scrolling percentage axis - each bar's real height is
          already (value / max) of the chart's own vertical space, so this
          scale doubles as "what % of the tallest bar is this one," for
          the same at-a-glance visual comparison a real percentage axis
          gives on any chart. */}
      <svg width={AXIS_WIDTH} height={height} className="block shrink-0">
        {PERCENT_TICKS.map((pct) => {
          const y = axisY - (pct / 100) * chartHeight;
          return (
            <text
              key={pct}
              x={AXIS_WIDTH - 4}
              y={y + 3}
              textAnchor="end"
              fontSize="7"
              fill="currentColor"
              className="text-text-secondary"
            >
              {pct}%
            </text>
          );
        })}
      </svg>
      <div ref={scrollRef} className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block">
          {/* Horizontal reference lines at the same 0/20/40/60/80/100
              levels as the fixed axis to its left - scroll together with
              the bars (unlike the axis labels) so a gridline always lines
              up with whichever bars are currently in view. */}
          {PERCENT_TICKS.map((pct) => {
            const y = axisY - (pct / 100) * chartHeight;
            return (
              <line
                key={pct}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2,2"
                className="text-border-border"
              />
            );
          })}
          {data.map((d, i) => {
            // A real value still gets a visible sliver (min 2 units) even
            // when tiny relative to the chart's own max - a bar that's
            // genuinely present but rounds to 0px tall reads as "no data",
            // indistinguishable from an actual 0.
            const barHeight = d.value === 0 ? 0 : Math.max(2, (d.value / max) * chartHeight);
            const x = i * SLOT_WIDTH;
            const delta = formatDelta(d.value, data[i - 1]?.value);
            return (
              <g key={d.label}>
                {d.value > 0 && (
                  <text
                    x={x + SLOT_WIDTH / 2}
                    y={axisY - barHeight - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="currentColor"
                    className="text-text-secondary"
                  >
                    {d.value}
                  </text>
                )}
                <rect
                  x={x + SLOT_WIDTH * 0.2}
                  y={axisY - barHeight}
                  width={SLOT_WIDTH * 0.6}
                  height={barHeight}
                  rx="2"
                  fill={BAR_FILL}
                />
                <line
                  x1={x}
                  y1={axisY}
                  x2={x + SLOT_WIDTH}
                  y2={axisY}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-border-border"
                />
                <text
                  x={x + SLOT_WIDTH / 2}
                  y={height - 13}
                  textAnchor="middle"
                  fontSize="8"
                  fill="currentColor"
                  className="text-text-secondary"
                >
                  {d.label}
                </text>
                {/* vs. the previous bar (the day/week right before this
                    one) - see formatDelta's own comment for what each
                    label means. */}
                {delta && (
                  <text
                    x={x + SLOT_WIDTH / 2}
                    y={height - 3}
                    textAnchor="middle"
                    fontSize="7"
                    fill="currentColor"
                    className={delta.colorClass}
                  >
                    {delta.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
