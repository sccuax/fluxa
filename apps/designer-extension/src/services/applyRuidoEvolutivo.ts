import type { RuidoEvolutivoConfig } from "@fluxa/gradient-core";
import { getWebflowDesigner } from "./webflowDesigner";
import { buildRuidoEvolutivoEmbedCode } from "./ruidoEvolutivoEmbedScript";
import { removeOtherFluxaEmbeds, type PresetTarget } from "./applyGradient";

// Mirrors applyGlassLiquid.ts's own applyGlassLiquidToElement/marker/
// positioning-context logic exactly (which itself mirrors applyGradient.ts -
// see that file for the detailed rationale behind each step: positioning
// context, combo-class styles, idempotent re-apply). Deliberately its OWN
// marker attribute and style names, not glassLiquid's or shaderGradient's -
// a ruidoEvolutivo embed must never be mistaken for either other kind's by
// any of the three kinds' own idempotency checks.
const MARKER_ATTRIBUTE = "data-fluxa-ruido-evolutivo";
const MARKER_VALUE = "true";
const HOST_STYLE_NAME = "fluxa-ruido-evolutivo-host";
const EMBED_STYLE_NAME = "fluxa-ruido-evolutivo-embed";

async function getOrCreateStyle(webflowApi: WebflowApi, name: string): Promise<Style> {
  const existing = await webflowApi.getStyleByName(name);
  return existing ?? webflowApi.createStyle(name);
}

// Same combo-class reasoning as applyGradient.ts's own getOrCreateHostStyle
// - see that file's own comment for the full history (two real bugs: a
// path-scoped lookup that missed an existing combo and collided on
// "duplicate style names", then a flat-name reuse that instead threw
// "styleIds must form a single path..." across different base classes).
// Fix: scope the host style's name to its own parent, so each distinct base
// class gets its own dedicated, globally-unique, always-valid combo object.
async function getOrCreateHostStyle(webflowApi: WebflowApi, existingStyles: Style[]): Promise<Style> {
  const parent = existingStyles[existingStyles.length - 1];
  if (!parent) return getOrCreateStyle(webflowApi, HOST_STYLE_NAME);

  const scopedName = `${parent.name}-${HOST_STYLE_NAME}`;
  const existing = await webflowApi.getStyleByName(scopedName);
  return existing ?? webflowApi.createStyle(scopedName, { parent });
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

async function findExistingRuidoEvolutivoEmbed(target: PresetTarget): Promise<HtmlEmbedElement | null> {
  const children = await target.getChildren();
  for (const child of children) {
    if (child.type !== "HtmlEmbed") continue;
    const marker = await child.getAttributeValue(MARKER_ATTRIBUTE);
    if (marker === MARKER_VALUE) return child;
  }
  return null;
}

// Injects the live ruidoEvolutivo shader into `target` as a background
// HtmlEmbed. Re-running this on the same target updates the existing
// embed's code in place rather than stacking a second one - same
// idempotent-re-apply behavior as applyGradientToElement/applyGlassLiquidToElement.
export async function applyRuidoEvolutivoToElement(target: PresetTarget, config: RuidoEvolutivoConfig): Promise<void> {
  const webflowApi = getWebflowDesigner();
  const rootId = `fluxa-ruido-evolutivo-${crypto.randomUUID().slice(0, 8)}`;
  const code = buildRuidoEvolutivoEmbedCode(config, rootId);

  await removeOtherFluxaEmbeds(target, MARKER_ATTRIBUTE);
  const existing = await findExistingRuidoEvolutivoEmbed(target);
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
