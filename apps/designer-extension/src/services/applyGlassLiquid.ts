import type { GlassLiquidConfig } from "@fluxa/gradient-core";
import { getWebflowDesigner } from "./webflowDesigner";
import { buildGlassLiquidEmbedCode } from "./glassLiquidEmbedScript";
import type { PresetTarget } from "./applyGradient";

// Mirrors applyGradient.ts's own applyGradientToElement/marker/positioning-
// context logic exactly, for the glassLiquid preset kind - see that file
// for the detailed rationale behind each step (positioning context,
// combo-class styles, idempotent re-apply). Deliberately its OWN marker
// attribute and style names, not applyGradient.ts's - a glass-liquid embed
// must never be mistaken for a gradient one by either kind's own
// idempotency check.
const MARKER_ATTRIBUTE = "data-fluxa-glass-liquid";
const MARKER_VALUE = "true";
const HOST_STYLE_NAME = "fluxa-glass-liquid-host";
const EMBED_STYLE_NAME = "fluxa-glass-liquid-embed";

async function getOrCreateStyle(webflowApi: WebflowApi, name: string): Promise<Style> {
  const existing = await webflowApi.getStyleByName(name);
  return existing ?? webflowApi.createStyle(name);
}

// Same combo-class reasoning as applyGradient.ts's own getOrCreateHostStyle
// - Webflow requires another class on an element to form a strict combo
// chain, so a target with existing classes needs the host style
// created/looked-up as a real combo class parented to its deepest existing
// style, reusing the same physical class across repeated apply clicks.
async function getOrCreateHostStyle(webflowApi: WebflowApi, existingStyles: Style[]): Promise<Style> {
  const parent = existingStyles[existingStyles.length - 1];
  if (!parent) return getOrCreateStyle(webflowApi, HOST_STYLE_NAME);

  const path = [...existingStyles.map((style) => style.name), HOST_STYLE_NAME];
  const existing = await webflowApi.getStyleByName(path);
  return existing ?? webflowApi.createStyle(HOST_STYLE_NAME, { parent });
}

// Same reasoning as applyGradient.ts's own ensurePositioningContext - the
// embed fills the target via `position: absolute; inset: 0`, which
// resolves against the nearest positioned ancestor. Skipped entirely if the
// target already establishes its own stacking context (non-static position
// AND a set z-index).
async function ensurePositioningContext(webflowApi: WebflowApi, target: PresetTarget): Promise<void> {
  const existingStyles = ((await target.getStyles()) ?? []).filter((style): style is Style => style !== null);
  const positionsAndZIndexes = await Promise.all(
    existingStyles.map(async (style) => ({
      position: await style.getProperty("position"),
      zIndex: await style.getProperty("z-index"),
    })),
  );
  const alreadyPositioned = positionsAndZIndexes.some(
    ({ position, zIndex }) => position && position !== "static" && zIndex,
  );
  if (alreadyPositioned) return;

  const hostStyle = await getOrCreateHostStyle(webflowApi, existingStyles);
  await hostStyle.setProperties({ position: "relative", "z-index": "0" });
  await target.setStyles([...existingStyles, hostStyle]);
}

async function findExistingGlassLiquidEmbed(target: PresetTarget): Promise<HtmlEmbedElement | null> {
  const children = await target.getChildren();
  for (const child of children) {
    if (child.type !== "HtmlEmbed") continue;
    const marker = await child.getAttributeValue(MARKER_ATTRIBUTE);
    if (marker === MARKER_VALUE) return child;
  }
  return null;
}

// Injects the live glassLiquid shader into `target` as a background
// HtmlEmbed. Re-running this on the same target updates the existing
// embed's code in place rather than stacking a second one - same
// idempotent-re-apply behavior as applyGradientToElement.
export async function applyGlassLiquidToElement(target: PresetTarget, config: GlassLiquidConfig): Promise<void> {
  const webflowApi = getWebflowDesigner();
  const rootId = `fluxa-glass-liquid-${crypto.randomUUID().slice(0, 8)}`;
  const code = buildGlassLiquidEmbedCode(config, rootId);

  const existing = await findExistingGlassLiquidEmbed(target);
  const embed = existing ?? (await target.prepend(webflowApi.elementPresets.HtmlEmbed));

  await embed.setSettings({ code });
  if (!existing) {
    await embed.setAttribute(MARKER_ATTRIBUTE, MARKER_VALUE);
  }

  const embedStyle = await getOrCreateStyle(webflowApi, EMBED_STYLE_NAME);
  await embedStyle.setProperties({
    position: "absolute",
    inset: "0",
    "z-index": "-1",
    "pointer-events": "none",
  });
  await embed.setStyles([embedStyle]);

  await ensurePositioningContext(webflowApi, target);
}
