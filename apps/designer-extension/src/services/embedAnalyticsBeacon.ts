// Shared by gradientEmbedScript.ts/glassLiquidEmbedScript.ts/
// ruidoEvolutivoEmbedScript.ts's own build*EmbedCode() functions - unlike
// the rest of each embed's payload (which is deliberately duplicated
// per-kind rather than shared, since each shader's own runtime differs),
// this one snippet is IDENTICAL across all three except `kind`, so it's a
// real shared codegen helper rather than three copies of the same URL that
// could silently drift out of sync. This file itself never ships to a
// published site - it's plain TypeScript that runs inside the extension at
// "Apply" time to build the STRING that does.
//
// Each caller's `includeAnalytics` param (read from cookiePreferences.ts's
// `publishedSiteAnalytics` at the moment "Apply" is clicked) decides
// whether this snippet is present in the generated code AT ALL, not just
// whether it fires - the resulting embed runs standalone on a real
// visitor's browser, on a completely different origin from the extension,
// so it has no way to check that preference itself at runtime even if it
// wanted to.
//
// sendBeacon (not fetch) is deliberate: it fires-and-forgets with no way
// to read a response, which means its default text/plain body never
// triggers a CORS preflight the way an application/json fetch would - this
// runs on an arbitrary customer domain apps/data-client's CORS allowlist
// was never meant to (and doesn't need to) include. Falls back to a
// keepalive fetch only if sendBeacon itself isn't available (very old
// browsers).
export function buildAnalyticsBeaconSnippet(kind: "shaderGradient" | "glassLiquid" | "ruidoEvolutivo"): string {
  return `  try {
    var analyticsPayload = JSON.stringify({ kind: "${kind}" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("https://fluxa-data-client.jojanmartinez533.workers.dev/api/public/analytics/embed-view", analyticsPayload);
    } else {
      fetch("https://fluxa-data-client.jojanmartinez533.workers.dev/api/public/analytics/embed-view", { method: "POST", body: analyticsPayload, keepalive: true });
    }
  } catch (e) {}
`;
}
