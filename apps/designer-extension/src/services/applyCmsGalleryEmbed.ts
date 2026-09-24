import { getWebflowDesigner } from "./webflowDesigner";
import { buildCmsGalleryEmbedCode } from "./cmsGalleryEmbedScript";
import type { PresetTarget } from "./applyGradient";

const RUNTIME_MARKER_ATTRIBUTE = "data-fluxa-cms-gallery-runtime";
const MARKER_VALUE = "true";

async function findExistingRuntimeEmbed(host: PresetTarget): Promise<HtmlEmbedElement | null> {
  const children = await host.getChildren();
  for (const child of children) {
    if (child.type !== "HtmlEmbed") continue;
    if ((await child.getAttributeValue(RUNTIME_MARKER_ATTRIBUTE)) === MARKER_VALUE) return child;
  }
  return null;
}

// One shared, idempotent HtmlEmbed per Collection List - NOT one per row.
// cmsGalleryEmbedScript.ts's own script queries the whole page for every
// GALLERY_TARGET_ATTRIBUTE-marked element itself, so a single embed handles
// every row Webflow renders from this same list, regardless of where on the
// page that embed itself actually sits.
//
// REAL, CONFIRMED RESTRICTION: Webflow rejects a Code Embed placed directly
// inside a Collection List Wrapper ("Code Embed can not be placed in a
// Collection List Wrapper") - this was tried first (prepending into the
// DynamoWrapperElement itself) and failed with exactly that Designer error;
// manually adding an embed *outside* the Collection List works fine. So
// `host` here is deliberately any regular PresetTarget-eligible element the
// user picks OUTSIDE the Collection List (the same `children`/`styles`
// capability check applyGradient.ts's own embeds already rely on), not the
// Collection List element itself - see WebflowSolutionsScreen.tsx's own
// final wizard step. No positioning-context/host-style machinery is needed
// here either way, unlike applyGradient.ts's - this embed has no visual
// footprint of its own.
// Brings every existing gallery runtime embed on the CURRENT page up to the
// current embed code (the 2026-09-23 switch from the whole inline script to
// a <script src> loader, and any future loader change) without re-running
// the wizard. Page-scoped, same getAllElements() limitation the rest of this
// feature has. Returns how many embeds changed - the caller shows the
// "publish your domains" reminder when that's > 0, since an embed change
// only reaches a domain on publish.
export async function upgradeCmsGalleryRuntimeEmbeds(): Promise<number> {
  const code = buildCmsGalleryEmbedCode();
  const elements = await getWebflowDesigner().getAllElements();
  let updated = 0;
  for (const element of elements) {
    if (element.type !== "HtmlEmbed") continue;
    if ((await element.getAttributeValue(RUNTIME_MARKER_ATTRIBUTE)) !== MARKER_VALUE) continue;
    const settings = await element.getSettings();
    if (settings.code === code) continue;
    await element.setSettings({ code });
    updated += 1;
  }
  return updated;
}

export async function applyCmsGalleryRuntime(host: PresetTarget): Promise<void> {
  const webflowApi = getWebflowDesigner();
  const existing = await findExistingRuntimeEmbed(host);
  const embed = existing ?? (await host.prepend(webflowApi.elementPresets.HtmlEmbed));

  await embed.setSettings({ code: buildCmsGalleryEmbedCode() });
  if (!existing) {
    await embed.setAttribute(RUNTIME_MARKER_ATTRIBUTE, MARKER_VALUE);
  }
}
