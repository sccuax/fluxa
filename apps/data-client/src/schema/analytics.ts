import { z } from "zod";

// Designer Extension usage events (routes/analytics.ts's authenticated-
// optional /track route) - a short enum-like free string rather than a real
// z.enum, since new event names get added over time as new UI is
// instrumented and this schema shouldn't need a code change for each one
// (the Analytics Engine side has no schema to keep in sync with either -
// see that file's own comment).
export const trackEventSchema = z.object({
  event: z.string().min(1).max(64),
  // Free-form second dimension - a preset id for "apply_preset", a tab name
  // for "switch_tab", absent for events with no extra context. Not a
  // site/element identifier (this app has no such concept for the
  // extension's own usage events) - see analytics.ts's (designer-extension)
  // own trackEvent() comment for why it's deliberately not called siteId.
  detail: z.string().max(64).optional(),
});

// Published-site embed impressions (routes/analytics.ts's public
// /embed-view route) - kind IS a real enum, matching gradient-core's own
// galleryPresetKindEnum values exactly, since this is always one of the
// three actually-shipped embed scripts, never an arbitrary string.
export const embedViewSchema = z.object({
  kind: z.enum(["shaderGradient", "glassLiquid", "ruidoEvolutivo"]),
});
