import type { GradientConfig } from "@fluxa/gradient-core";
import { getWebflowDesigner } from "./webflowDesigner";
import { buildGradientEmbedCode } from "./gradientEmbedScript";
import { resolveLabel } from "../hooks/useSelectedElement";

// Elements the gradient can be applied to - anything with both Children (so we can
// prepend the HtmlEmbed) and Styles (so we can give it/its target a positioning
// context). EditorTab's selection isn't restricted to SupportedElementsGuide's
// Div/Section/Link list (that guide is informational only), so this has to be
// checked for real rather than assumed - AnyElement is a big discriminated union
// and some members (e.g. UnknownElement) don't even have these keys, hence the
// `"children" in element` guard before touching the flag (see useSelectedElement.ts
// for the same pattern).
type GradientTarget = Extract<AnyElement, {children: true; styles: true}>;

export function canApplyGradient(
  element: AnyElement | null
): element is GradientTarget {
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
// being registered as a real combo class of that chain. A target with no
// existing classes just gets a plain global HOST_STYLE_NAME style (as
// before); a target that already has one needs the host style
// created/looked-up as an actual combo class parented to the deepest
// existing style, via getStyleByName's own path form (an array of names from
// root to leaf) so the same physical combo class is reused across repeated
// "Apply gradient" clicks on the same target instead of creating a duplicate
// every time.
async function getOrCreateHostStyle(
  webflowApi: WebflowApi,
  existingStyles: Style[]
): Promise<Style> {
  const parent = existingStyles[existingStyles.length - 1];
  if (!parent) return getOrCreateStyle(webflowApi, HOST_STYLE_NAME);

  const path = [...existingStyles.map((style) => style.name), HOST_STYLE_NAME];
  const existing = await webflowApi.getStyleByName(path);
  return existing ?? webflowApi.createStyle(HOST_STYLE_NAME, {parent});
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
  target: GradientTarget
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
  target: GradientTarget
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
  target: GradientTarget,
  config: GradientConfig
): Promise<void> {
  const webflowApi = getWebflowDesigner();
  const rootId = `fluxa-gradient-${crypto.randomUUID().slice(0, 8)}`;
  const code = buildGradientEmbedCode(config, rootId);

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
  element: GradientTarget;
  label: string;
}

// Scans the current page (webflow.getAllElements() - the Designer API's own
// doc comment confirms this is page/component-scoped, not site-wide) for
// every element with a live Fluxa gradient embed applied - i.e. every
// GradientTarget-eligible element whose *first* child is an HtmlEmbed
// carrying MARKER_ATTRIBUTE (the same idempotent-re-apply marker
// findExistingGradientEmbed above already checks, just from the other
// direction). There's no parent/reverse-lookup in the Designer API for
// regular elements (checked its own typings - only asset/page folders and
// Style expose a getParent()), so this has to walk every eligible element on
// the page and check its own first child, rather than walking down from a
// single root once.
export async function findAppliedGradients(): Promise<AppliedGradient[]> {
  const webflowApi = getWebflowDesigner();
  const allElements = await webflowApi.getAllElements();
  const results: AppliedGradient[] = [];

  for (const element of allElements) {
    if (!canApplyGradient(element)) continue;
    const children = await element.getChildren();
    const first = children[0];
    if (!first || first.type !== "HtmlEmbed") continue;
    const marker = await first.getAttributeValue(MARKER_ATTRIBUTE);
    if (marker !== MARKER_VALUE) continue;

    results.push({ element, label: (await resolveLabel(element)) ?? "Unnamed element" });
  }

  return results;
}
