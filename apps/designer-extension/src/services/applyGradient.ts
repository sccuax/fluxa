import type { GradientConfig } from "@fluxa/gradient-core";
import { getWebflowDesigner } from "./webflowDesigner";
import { buildGradientEmbedCode } from "./gradientEmbedScript";
import { resolveLabel } from "../hooks/useSelectedElement";

// Elements a preset embed (gradient OR glass-liquid, see applyGlassLiquid.ts)
// can be applied to - anything with both Children (so we can prepend the
// HtmlEmbed) and Styles (so we can give it/its target a positioning
// context). Nothing here is actually gradient-specific - EditorTab's
// selection isn't restricted to SupportedElementsGuide's Div/Section/Link
// list (that guide is informational only), so this has to be checked for
// real rather than assumed - AnyElement is a big discriminated union and
// some members (e.g. UnknownElement) don't even have these keys, hence the
// `"children" in element` guard before touching the flag (see
// useSelectedElement.ts for the same pattern). Named `canApplyPreset`, not
// `canApplyGradient` (its original name) - a second preset kind
// (glassLiquid) now uses this exact same check.
export type PresetTarget = Extract<AnyElement, {children: true; styles: true}>;

export function canApplyPreset(
  element: AnyElement | null
): element is PresetTarget {
  if (!element) return false;
  return (
    "children" in element &&
    element.children === true &&
    "styles" in element &&
    element.styles === true
  );
}

const MARKER_ATTRIBUTE = "data-fluxa-gradient";
const MARKER_VALUE = "true";
const HOST_STYLE_NAME = "fluxa-gradient-host";
const EMBED_STYLE_NAME = "fluxa-gradient-embed";

// Every preset kind's own idempotent-re-apply marker attribute (see
// applyGlassLiquid.ts/applyRuidoEvolutivo.ts for their own MARKER_ATTRIBUTE
// constants) - kept in one shared place so removeOtherFluxaEmbeds below can
// recognize an embed created by ANY kind, not just its own.
export const FLUXA_EMBED_MARKER_ATTRIBUTES = [
  MARKER_ATTRIBUTE,
  "data-fluxa-glass-liquid",
  "data-fluxa-ruido-evolutivo",
] as const;

// REAL BUG, FIXED: each kind's own applyXToElement only ever recognized ITS
// OWN marker attribute when deciding whether to reuse or create an embed -
// switching from one preset kind to another on the SAME target left the
// previous kind's embed sitting there untouched while a second one was
// created alongside it (never replaced), so the shader visibly "didn't
// update" (the old one was often still what rendered, or the two competed).
// Called by every applyXToElement before its own find-or-create step, so
// only one Fluxa shader embed ever lives on a given target at a time.
export async function removeOtherFluxaEmbeds(
  target: PresetTarget,
  ownMarkerAttribute: string
): Promise<void> {
  const children = await target.getChildren();
  for (const child of children) {
    if (child.type !== "HtmlEmbed") continue;
    for (const attribute of FLUXA_EMBED_MARKER_ATTRIBUTES) {
      if (attribute === ownMarkerAttribute) continue;
      const marker = await child.getAttributeValue(attribute);
      if (marker === MARKER_VALUE) {
        await child.remove();
        break;
      }
    }
  }
}

async function getOrCreateStyle(
  webflowApi: WebflowApi,
  name: string
): Promise<Style> {
  const existing = await webflowApi.getStyleByName(name);
  return existing ?? webflowApi.createStyle(name);
}

// Webflow models "another class on this element" as a strict combo chain -
// setStyles's own runtime error ("styleIds must form a single path from a
// root style through its combo classes") fires the moment a plain standalone
// global style is appended after an element's existing class(es) without
// being registered as a real combo class of that chain, so a target that
// already has a class needs the host style created as an actual combo class
// (parented to its deepest existing style).
//
// REAL BUG (twice), FIXED: this originally looked up the existing host style
// by a path-scoped `getStyleByName([...existingStyles, HOST_STYLE_NAME])`
// before falling back to `createStyle`, reusing one FIXED global name
// (HOST_STYLE_NAME) regardless of target. That path-scoped lookup often
// missed a combo already created under a *different* section's own base
// class and fell through to `createStyle(HOST_STYLE_NAME, ...)` again -
// Webflow style names are globally unique, so this failed with "Cannot have
// duplicate style names". The first fix tried was to look the SAME fixed
// name up flat and reuse whatever Style object it found regardless of
// parent - that traded one error for another: a combo class is a genuinely
// FIXED (parent, child) pair in Webflow - `setStyles([...existingStyles,
// hostStyle])` throws "styleIds must form a single path from a root style
// through its combo classes" the moment hostStyle's own registered parent
// isn't the array's immediately preceding style (i.e. reusing a combo
// created for section A's base class doesn't chain onto section B's
// different base class).
//
// Real fix: a combo class can't be shared as "the same child" across
// different parents at all - it has to be a genuinely separate Style object
// per distinct parent. Scoping the host style's NAME to its parent's own
// name gives each distinct base class its own dedicated, globally-unique
// combo object (no name collision), which is always trivially a valid
// combo of the exact style it was created under (no chain-validation
// error) - while still reusing the very same object across multiple
// different elements that happen to share that same base class, and across
// repeated re-applies to the same target.
async function getOrCreateHostStyle(
  webflowApi: WebflowApi,
  existingStyles: Style[]
): Promise<Style> {
  const parent = existingStyles[existingStyles.length - 1];
  if (!parent) return getOrCreateStyle(webflowApi, HOST_STYLE_NAME);

  const scopedName = `${parent.name}-${HOST_STYLE_NAME}`;
  const existing = await webflowApi.getStyleByName(scopedName);
  return existing ?? webflowApi.createStyle(scopedName, {parent});
}

// The embed fills the target via `position: absolute; inset: 0`, which resolves
// against the nearest *positioned* ancestor - not necessarily the target itself.
// Force the target into a positioning context via a shared, dedicated utility
// class rather than touching the target's own style(s) directly: those may be
// shared classes used elsewhere on the site, and mutating `position` on them
// would silently reposition every other element using that class. Skipped
// entirely if the target (or any of its existing classes) is already
// non-statically positioned, since it's then already a valid positioning
// context and adding another one is unnecessary.
async function ensurePositioningContext(
  webflowApi: WebflowApi,
  target: PresetTarget
): Promise<void> {
  const existingStyles = ((await target.getStyles()) ?? []).filter(
    (style): style is Style => style !== null
  );
  const positionsAndZIndexes = await Promise.all(
    existingStyles.map(async (style) => ({
      position: await style.getProperty("position"),
      zIndex: await style.getProperty("z-index"),
    }))
  );
  // Both a non-static `position` AND a set `z-index` are required for the
  // target to already establish its own stacking context (see the comment
  // below) - `position: relative` with no `z-index` looks positioned but
  // still lets the embed's `z-index: -1` escape upward, same bug as having
  // no positioning at all.
  const alreadyPositioned = positionsAndZIndexes.some(
    ({position, zIndex}) => position && position !== "static" && zIndex
  );
  if (alreadyPositioned) return;

  const hostStyle = await getOrCreateHostStyle(webflowApi, existingStyles);
  // `z-index` (not just `position: relative`) is required to make the target
  // itself establish a stacking context - without it, the embed's
  // `z-index: -1` doesn't stay contained "behind this element's own content"
  // as intended, it escapes to the nearest ancestor that *does* establish one
  // (often much higher up the tree, e.g. body), which typically paints an
  // opaque background in front of it - the gradient renders, just invisibly
  // behind the whole page. Confirmed as the real cause of the embed injecting
  // successfully but never appearing on the published/preview page.
  await hostStyle.setProperties({position: "relative", "z-index": "0"});
  await target.setStyles([...existingStyles, hostStyle]);
}

async function findExistingGradientEmbed(
  target: PresetTarget
): Promise<HtmlEmbedElement | null> {
  const children = await target.getChildren();
  for (const child of children) {
    if (child.type !== "HtmlEmbed") continue;
    const marker = await child.getAttributeValue(MARKER_ATTRIBUTE);
    if (marker === MARKER_VALUE) return child;
  }
  return null;
}

// Injects the live gradient into `target` as a background HtmlEmbed - see
// CLAUDE.md "Applying the gradient to the published site" for the full design.
// Re-running this on the same target updates the existing embed's code in place
// rather than stacking a second one (ControlPanel edits live, so re-clicking
// Apply after a tweak is an expected flow, not an edge case).
export async function applyGradientToElement(
  target: PresetTarget,
  config: GradientConfig
): Promise<void> {
  const webflowApi = getWebflowDesigner();
  const rootId = `fluxa-gradient-${crypto.randomUUID().slice(0, 8)}`;
  const code = buildGradientEmbedCode(config, rootId);

  await removeOtherFluxaEmbeds(target, MARKER_ATTRIBUTE);
  const existing = await findExistingGradientEmbed(target);
  const embed = existing ?? (await target.prepend(webflowApi.elementPresets.HtmlEmbed));

  await embed.setSettings({code});
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

export interface AppliedGradient {
  element: PresetTarget;
  label: string;
}

// Scans the current page (webflow.getAllElements() - the Designer API's own
// doc comment confirms this is page/component-scoped, not site-wide) for
// every element with a live Fluxa shader embed applied - i.e. every
// PresetTarget-eligible element with an HtmlEmbed child carrying ANY of the
// three kinds' marker attributes (FLUXA_EMBED_MARKER_ATTRIBUTES:
// shaderGradient / glassLiquid / ruidoEvolutivo). There's no parent/reverse-
// lookup in the Designer API for regular elements (checked its own typings -
// only asset/page folders and Style expose a getParent()), so this has to
// walk every eligible element on the page and check its own children, rather
// than walking down from a single root once.
//
// REAL BUG, FIXED: this used to check only MARKER_ATTRIBUTE (the
// shaderGradient marker), so a glassLiquid or ruidoEvolutivo shader applied
// to a section never showed up in the header dropdown - it was written when
// shaderGradient was the only kind and never widened when the other two were
// added (unlike removeOtherFluxaEmbeds / the apply flow, which were). Also
// only checked children[0]; now scans every HtmlEmbed child, matching
// findExistingGradientEmbed's own loop. (The Designer API's own limitation
// that getAllElements() can't see inside a component instance unless you're
// editing that component is separate and not fixable here.)
export async function findAppliedGradients(): Promise<AppliedGradient[]> {
  const webflowApi = getWebflowDesigner();
  const allElements = await webflowApi.getAllElements();
  const results: AppliedGradient[] = [];

  for (const element of allElements) {
    if (!canApplyPreset(element)) continue;
    const children = await element.getChildren();

    let hasEmbed = false;
    for (const child of children) {
      if (child.type !== "HtmlEmbed") continue;
      for (const attribute of FLUXA_EMBED_MARKER_ATTRIBUTES) {
        if ((await child.getAttributeValue(attribute)) === MARKER_VALUE) {
          hasEmbed = true;
          break;
        }
      }
      if (hasEmbed) break;
    }
    if (!hasEmbed) continue;

    results.push({ element, label: (await resolveLabel(element)) ?? "Unnamed element" });
  }

  return results;
}
