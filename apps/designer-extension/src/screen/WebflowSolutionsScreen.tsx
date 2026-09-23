import { useEffect, useId, useRef, useState } from "react";
import { gsap } from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

gsap.registerPlugin(MorphSVGPlugin);
import { useExtensionSize } from "../hooks/useExtensionSize";
import { DashboardHeader } from "../components/DashboardHeader";
import { DashboardNav, type NavTab } from "../components/DashboardNav";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { RangeSlider } from "../components/RangeSlider";
import { Dropdown } from "../components/Dropdown";
import { Icon } from "../components/Icon";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { useSelectedElement } from "../hooks/useSelectedElement";
import {
  isCollectionList,
  canMarkElement,
  getCollectionId,
  getMultiImageFields,
  markGallerySlugElement,
  markGalleryTargetElement,
  fetchGalleryConfigs,
  createGalleryConfig,
  updateGalleryConfigSettings,
  deleteGalleryConfig,
  verifySiteAccess,
  DEFAULT_GALLERY_SETTINGS,
  type MultiImageField,
  type CmsGalleryConfig,
  type CmsGallerySettings,
} from "../services/cmsGallery";
import { canApplyPreset } from "../services/applyGradient";
import { applyCmsGalleryRuntime } from "../services/applyCmsGalleryEmbed";
import { ApiRequestError } from "../services/apiClient";
import { linkCurrentInstallation } from "../services/linkInstallation";
import { ManageGalleryImagesScreen } from "./ManageGalleryImagesScreen";
import { CmsVisibilityScreen } from "./CmsVisibilityScreen";
import { useCmsImagesFeature, CmsImagesContent, CmsImagesFooter } from "./CmsImagesScreen";
import { useBlogStagingFeature, BlogToStagingContent, BlogToStagingFooter } from "./BlogToStagingScreen";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { UnmaskReveal } from "../components/UnmaskReveal";
import { NavigatorMarkGuide } from "../components/NavigatorMarkGuide";
import { WizardStepIndicator } from "../components/WizardStepIndicator";
import { PillDropdown } from "../components/PillDropdown";

// One Arrows/Dots/Autoplay row: label + the exact same on/off switch
// CookiesModal.tsx's toggles use (ToggleSwitch.tsx - already extracted to
// its own file specifically so this screen could reuse it, per explicit
// direction, rather than a second differently-styled switch for the same
// kind of control). A full-width divider line under every row, not a
// bordered card - matches the reference (copy-paste/Screet 202692211.png)
// exactly. Replaces the earlier SegmentedRow-as-boolean version.
function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border-border py-3">
      <span className="font-sans text-mobile-text-md-medium text-text-black">{label}</span>
      <ToggleSwitch checked={value} onChange={onChange} />
    </div>
  );
}

// The "Image fit" pills - a bespoke, fully-rounded pair per the reference
// design, NOT SegmentedRow (that shared component's own rounded-[4px] pills
// are the established look for ControlPanel/GlassLiquidControlPanel/etc.
// elsewhere in this app - changing its rounding globally to match this one
// screen's different reference would move every other call site too).
// Colors reuse SegmentedRow's own established active/inactive convention
// (border-accent-500/50 + bg-accent-50 + text-accent-500 when selected) so
// it still reads as the same design system, just a different corner radius.
function ImageFitPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 font-sans text-mobile-text-sm-medium transition-colors ${
        active
          ? "border-accent-500/50 bg-accent-50 text-accent-500"
          : "border-border-border bg-background-white text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

// Shared by the wizard's own "settings" step and the inline editor on an
// already-configured gallery below - one form, two call sites, rather than
// two copies that could drift.
function GallerySettingsForm({ settings, onChange }: {
  settings: CmsGallerySettings;
  onChange: (next: CmsGallerySettings) => void;
}) {
  return (
    <div className="flex flex-col">
      <ToggleField
        label="Arrows"
        value={settings.showArrows}
        onChange={(showArrows) => onChange({ ...settings, showArrows })}
      />
      <ToggleField
        label="Dots"
        value={settings.showDots}
        onChange={(showDots) => onChange({ ...settings, showDots })}
      />
      <ToggleField
        label="Autoplay"
        value={settings.autoplay}
        onChange={(autoplay) => onChange({ ...settings, autoplay })}
      />
      {settings.autoplay && (
        <div className="flex flex-col gap-2 py-3">
          <span className="font-sans text-mobile-text-md-medium text-text-black">Autoplay speed</span>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <RangeSlider
                min={1000}
                max={15000}
                step={500}
                value={settings.autoplayIntervalMs}
                onChange={(autoplayIntervalMs) => onChange({ ...settings, autoplayIntervalMs })}
              />
            </div>
            <span className="shrink-0 font-sans text-mobile-text-sm-regular text-text-secondary">
              {(settings.autoplayIntervalMs / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 py-3">
        <span className="font-sans text-mobile-text-md-medium text-text-black">Image fit</span>
        <div className="flex gap-2">
          <ImageFitPill
            label="Cover"
            active={settings.objectFit === "cover"}
            onClick={() => onChange({ ...settings, objectFit: "cover" })}
          />
          <ImageFitPill
            label="Contain"
            active={settings.objectFit === "contain"}
            onClick={() => onChange({ ...settings, objectFit: "contain" })}
          />
        </div>
      </div>
      {/* Size, position, overflow, border-radius, background, etc. are
          deliberately not here - the runtime script mounts INSIDE the
          marked target div, never replacing or resizing it (see
          cmsGalleryEmbedScript.ts's own top comment), so every one of those
          stays exclusively stylable from the Designer's own Style panel on
          that element - a second control here would just be a second,
          possibly conflicting, source of truth for the same property. */}
      <div className="flex items-start gap-3 rounded-4 bg-background-white-2 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-4 bg-background-white">
          <Icon name="lightbulb" className="h-4 w-4 text-text-secondary" />
        </span>
        <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
          Size, position, overflow, border and background all come from the target element&apos;s own
          styling in the Designer - style it there like any other element.
        </p>
      </div>
    </div>
  );
}

// The step-6 file/code icon's own path (copy-paste/paso-6.png, SVG source
// copy-paste/paste.txt - a real Figma asset), kept as a named constant so
// GradientFileIcon can morph away from it AND back to it (a failed install
// un-morphs, see handleInstallRuntime's own comment).
const FILE_ICON_PATH =
  "M60.6667 1.50002H13.3333C10.1949 1.50002 7.18508 2.74674 4.9659 4.96592C2.74672 7.1851 1.5 10.195 1.5 13.3334V108C1.5 111.138 2.74672 114.148 4.9659 116.367C7.18508 118.587 10.1949 119.833 13.3333 119.833H84.3333C87.4717 119.833 90.4816 118.587 92.7008 116.367C94.9199 114.148 96.1667 111.138 96.1667 108V37M60.6667 1.50002C62.5396 1.49698 64.3947 1.8645 66.125 2.5814C67.8553 3.2983 69.4267 4.35043 70.7487 5.67719L91.9777 26.9062C93.308 28.2286 94.3631 29.8015 95.0821 31.534C95.8011 33.2665 96.1697 35.1243 96.1667 37M60.6667 1.50002V31.0834C60.6667 32.6525 61.29 34.1575 62.3996 35.2671C63.5092 36.3767 65.0141 37 66.5833 37L96.1667 37M37 63.625L25.1667 78.4167L37 93.2084M60.6667 63.625L72.5 78.4167L60.6667 93.2084";

// A "send" glyph (paper plane + its own fold crease as a second subpath),
// hand-drawn to roughly this same 98x122 canvas/stroke weight - no Figma
// asset was supplied for this one, so this is a placeholder shape built to
// morph cleanly from FILE_ICON_PATH above; swap the coordinates here for a
// real exported path if/when one is provided, nothing else about the
// morph wiring needs to change.
const SEND_ICON_PATH = "M14 61L88 12L52 108L38 74ZM38 74L88 12";

// The step-6 "Install gallery script" illustration. A standalone
// component, not an Icon.tsx map entry: it needs its own unique
// <linearGradient> id via useId() (two of these could otherwise render at
// once and collide), and Icon.tsx's own entries are plain functions
// invoked directly inside Icon's render rather than mounted as real JSX
// elements - a hook inside one of those would violate the rules of hooks
// the moment `name` ever changed between renders. HueThumb/OpacityThumb
// (ColorPicker.tsx/ColorSwatchPicker.tsx) already set this same "own
// standalone component for a per-instance gradient id" precedent.
//
// `morph` drives a real GSAP MorphSVGPlugin tween of the path's own `d`
// attribute (file icon <-> send icon) rather than a cross-fade/swap
// between two separate `<path>`s, per explicit direction ("una animación
// de morphism... usando GSAP"). The tween writes directly to the DOM via
// `pathRef` every tick - `d` is only ever set once from React
// (FILE_ICON_PATH, the rest state), so nothing here fights GSAP's own
// mutation of it, same "ref + direct DOM write" precedent this app's own
// drag-driven controls (RangeSlider, ColorPicker) already use for a
// smooth, no-re-render animation.
//
// Exported for sandbox/registry.tsx's own Components-group demo - this
// wizard step only ever renders behind a real Designer's live wizard state
// (siteId, a detected Collection List, ...), so a standalone toggle demo is
// the only way to preview/tune the morph itself outside the actual
// Designer. Also reused directly by CmsImagesScreen.tsx's own step 4 (same
// "file -> send" morph, same reasoning) rather than a second copy.
export function GradientFileIcon({ className, morph }: { className?: string; morph: boolean }) {
  const gradientId = useId();
  const pathRef = useRef<SVGPathElement>(null);
  // Tracks which shape the path is CURRENTLY morphed to, independent of
  // React's own unchanging `d` prop - lets the effect below tell "morph
  // forward" and "morph back" apart, and skip a redundant tween if `morph`
  // flips twice before the first one would even finish.
  const morphedToSendRef = useRef(false);

  useEffect(() => {
    if (!pathRef.current) return;
    if (morph && !morphedToSendRef.current) {
      morphedToSendRef.current = true;
      gsap.to(pathRef.current, { duration: 0.7, ease: "power2.inOut", morphSVG: SEND_ICON_PATH });
    } else if (!morph && morphedToSendRef.current) {
      morphedToSendRef.current = false;
      gsap.to(pathRef.current, { duration: 0.5, ease: "power2.inOut", morphSVG: FILE_ICON_PATH });
    }
  }, [morph]);

  return (
    <svg width="98" height="122" viewBox="0 0 98 122" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        ref={pathRef}
        d={FILE_ICON_PATH}
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="-22.1665" y1="1.1665" x2="77.4379" y2="133.964" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6FF5F1" />
          <stop offset="0.2548" stopColor="#3B9CD6" />
          <stop offset="0.5" stopColor="#0955E5" />
          <stop offset="0.75" stopColor="#8E54C5" />
          <stop offset="1" stopColor="#E23F8C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// The 6 wizard steps, in order - WizardStep's own declared union already
// matches this exact order 1:1, so this is just that same set made
// iterable for the step-circle indicator below.
const WIZARD_STEP_ORDER: WizardStep[] = ["collection", "field", "settings", "slug", "target", "host"];

// The descriptive copy per step, now WITHOUT its own leading "N." - the
// number lives in the circle now instead (per explicit direction), and the
// token changed from text-mobile-text-sm-regular to text-mobile-header-h2
// (General Sans, weight 500) to read as a real step heading rather than
// body copy. `target`'s own second paragraph (the Position/Relative
// caveat) is unrelated copy, not part of this map - it still renders as
// its own smaller paragraph, unchanged.
const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  collection: "Select your Collection List element in the Designer, then click Detect.",
  field: "Pick which multi-image field to show.",
  settings: "Customize how the gallery looks, then continue.",
  slug: "Inside one item, select the text element bound to the item's Slug field, then click Mark.",
  target: "In the same item, select the element that should display the gallery, then click Mark.",
  host: "Select any element OUTSIDE the Collection List (e.g. the section wrapping it), then click Install. Webflow doesn't allow the gallery script inside the Collection List itself.",
};

const WEBFLOW_SOLUTIONS_SIZE = { width: 320, height: 620 };

// Visual-only redesign, per explicit direction not to touch any of this
// screen's own wizard/gallery logic yet - just reuses DashboardNav's shell
// (now generic, see that file's own comment) with this screen's own three
// tabs/icons (copy-paste reference: Screenshot 20269-17 212211.png). Only
// "multiImage" has any real content behind it right now (the existing
// wizard/configured-galleries UI, unchanged) - the other two are visual
// placeholders with nothing built yet, matching the reference design's own
// scope (it only shows the Multi-image tab's content).
type WebflowSolutionsTab = "multiImage" | "cmsImages" | "blogStaging";

const WEBFLOW_SOLUTIONS_TABS: NavTab<WebflowSolutionsTab>[] = [
  { tab: "multiImage", icon: "tabMultiImage", label: "Multi-image" },
  { tab: "cmsImages", icon: "tabCmsImages", label: "CMS images" },
  { tab: "blogStaging", icon: "tabBlogStaging", label: "Blog to staging" },
];

// First real "Webflow Solutions" feature: multi-image CMS fields inside a
// Collection List (Webflow has no native way to bind one - see
// apps/data-client's routes/cmsGallery.ts for the full research trail). This
// screen is the setup wizard: pick a Collection List + multi-image field via
// the real Designer API (no backend round trip needed for that part - see
// services/cmsGallery.ts), register it with the backend, mark two elements
// inside the Collection List's own item template with plain HTML
// attributes, then inject the one shared runtime embed
// (applyCmsGalleryEmbed.ts) that actually reads those markers on every
// rendered row and renders the real gallery. Webflow's own Settings panel
// will never show either marked element as "connected" to a CMS field
// (there's no native way to represent a multi-image binding at all, on any
// element type) - that's expected, not a bug; the gallery renders via this
// runtime script instead, checked directly against the real Preview/
// published output rather than the Designer's own binding UI.
//
// The final "host" step exists because of a REAL, CONFIRMED Designer
// restriction: a Code Embed cannot be placed directly inside a Collection
// List Wrapper ("Code Embed can not be placed in a Collection List
// Wrapper") - tried first, hit that exact error. Placing one outside the
// Collection List (any regular section/div, same as a manual embed) works
// fine, so the runtime embed's host is a separate element the user picks,
// not the Collection List itself.
type WizardStep = "collection" | "field" | "settings" | "slug" | "target" | "host";

// The multi-image field step's own picker is now the generic
// PillDropdown.tsx (extracted once CmsImagesScreen.tsx needed the identical
// control for picking a collection instead) - see that file's own comment
// for the full styling rationale, unchanged here.

export function WebflowSolutionsScreen({ onSwitchToShaders }: { onSwitchToShaders: () => void }) {
  useExtensionSize(WEBFLOW_SOLUTIONS_SIZE);

  const [activeTab, setActiveTab] = useState<WebflowSolutionsTab>("multiImage");

  const { element: selected } = useSelectedElement();

  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);

  // "CMS images" tab's own state (CmsImagesScreen.tsx) - lifted to this
  // level (not owned by a child component) for the same reason this
  // screen's own multi-image wizard state already lives here: its content
  // and its fixed footer button are two separate sibling slots below (so
  // the footer stays pinned above DashboardNav instead of scrolling away),
  // both needing the same state.
  const cmsImages = useCmsImagesFeature(siteId, selected);

  // "Blog to staging" tab's own state (BlogToStagingScreen.tsx) - same
  // lifted-hook reasoning as cmsImages above.
  const blogStaging = useBlogStagingFeature(siteId);

  const [configs, setConfigs] = useState<CmsGalleryConfig[] | null>(null);
  const [configsError, setConfigsError] = useState<string | null>(null);
  // Diagnostic-only, surfaced alongside configsError - see verifyThisSite's
  // own comment below for why this exists.
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("collection");
  const [busy, setBusy] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [multiImageFields, setMultiImageFields] = useState<MultiImageField[]>([]);
  const [activeConfig, setActiveConfig] = useState<CmsGalleryConfig | null>(null);
  const [wizardSettings, setWizardSettings] = useState<CmsGallerySettings>(DEFAULT_GALLERY_SETTINGS);

  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editingSettings, setEditingSettings] = useState<CmsGallerySettings>(DEFAULT_GALLERY_SETTINGS);
  const [editingBusy, setEditingBusy] = useState(false);
  const [editingError, setEditingError] = useState<string | null>(null);

  const [managingConfig, setManagingConfig] = useState<CmsGalleryConfig | null>(null);

  // "Handle CMS visibility" row below - its own full-screen picker
  // (CmsVisibilityScreen.tsx), same "replace this screen's content
  // entirely" pattern managingConfig above already uses for "Manage
  // images", just with no per-config selection of its own to carry.
  const [showCmsVisibility, setShowCmsVisibility] = useState(false);

  // The dropdown's "Delete" row no longer deletes directly - it opens
  // ConfirmDeleteModal first, per explicit spec, so a misclick can't
  // silently remove a gallery with no way back.
  const [deletingConfig, setDeletingConfig] = useState<CmsGalleryConfig | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Drives GradientFileIcon's own GSAP MorphSVG animation (step "host") -
  // true the instant a real Install click starts, so the file/code icon
  // morphs into a "send" icon right away rather than waiting for the
  // network call to resolve. Reset back to false on a failed install (so
  // the icon un-morphs, ready to retry) - a successful install closes the
  // whole wizard via resetWizard() anyway, which also resets this.
  const [installMorphed, setInstallMorphed] = useState(false);

  // Visual-only, for the new per-row "⋮" menu (copy-paste reference:
  // Screenshot 20269-17 212211.png) - replaces the row's own always-visible
  // Manage/Customize/Remove text links with the same three actions behind a
  // menu instead, wired to the exact same handlers/state below (openConfigEditor,
  // setManagingConfig, handleDeleteConfig) - no new logic, just a different
  // trigger for it. One ref per row (keyed by config.id) since Dropdown needs
  // a real element ref, not just a boolean.
  const [openMenuConfigId, setOpenMenuConfigId] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    // getWebflowDesigner() itself throws SYNCHRONOUSLY when `webflow` isn't
    // real (outside the actual Designer - e.g. sandbox/registry.tsx's own
    // component gallery, a plain Vite tab with no Designer bridge script),
    // not a rejected promise - a bare `.catch()` never gets attached in
    // time to catch it, so it escaped as an uncaught error and crashed this
    // screen instead of landing in the same siteError state the .catch()
    // below already handles for every other Designer API failure. Wrapping
    // the call itself in try/catch routes both failure shapes to the same
    // place.
    try {
      getWebflowDesigner()
        .getSiteInfo()
        .then((info) => setSiteId(info.siteId))
        .catch((error) => setSiteError(error instanceof Error ? error.message : String(error)));
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  async function loadConfigs(forSiteId: string) {
    try {
      setConfigsError(null);
      setConfigs(await fetchGalleryConfigs(forSiteId));
    } catch (error) {
      setConfigsError(
        error instanceof ApiRequestError ? error.message : "Failed to load configured galleries.",
      );
    }
  }

  // Proves this session's own Designer is genuinely looking at `siteId`
  // right now (data-client's routes/cmsGallery.ts, POST /:siteId/verify) -
  // every other cms-gallery call 403s with "not_verified" until this has
  // run at least once, since 2026-09-16's re-tightening (see that route's
  // own comment for the full reasoning: a siteId alone isn't proof of real
  // access, only Webflow's own idToken is). Runs once per siteId, not per
  // request - the Webflow round trip this makes is real (~400-700ms
  // observed), worth paying once per Designer session, not once per click.
  // Silently does nothing when `webflow` isn't available (sandbox/plain-
  // browser dev modes), same as linkCurrentInstallation's own precedent -
  // loadConfigs below still runs either way and surfaces whatever the
  // backend actually says (including a real "not_verified"/"forbidden" with
  // a real human-readable message now - apiClient.ts's own ApiRequestError
  // fix, same day).
  async function verifyThisSite(forSiteId: string) {
    try {
      const idToken = await getWebflowDesigner().getIdToken();
      await verifySiteAccess(forSiteId, idToken);
      setVerifyError(null);
    } catch (error) {
      // Real bug, found 2026-09-16: this used to be a bare `catch {}` - a
      // real failure here (getIdToken() itself rejecting, or
      // verifySiteAccess() 403ing on site_mismatch/webflow_api_error) left
      // ZERO trace anywhere, client or server, while loadConfigs() below
      // still ran and surfaced the backend's own generic "not_verified"
      // message - completely indistinguishable from "verify never even
      // attempted" vs "verify attempted and was rejected for a real
      // reason". A second site collaborator hit exactly this with no way to
      // self-diagnose. Only surface it inside a real Designer (`webflow`
      // defined) - the sandbox/plain-browser dev case throws here on every
      // mount by design (no Designer connection at all) and isn't a bug.
      if (typeof webflow !== "undefined") {
        const detail = error instanceof Error ? error.message : String(error);
        console.error("verifyThisSite failed", error);
        setVerifyError(detail);
      }
    }
  }

  // Real bug, fixed 2026-09-15: App.tsx's own linkCurrentInstallation() call
  // is fire-and-forget, with no ordering guarantee against this screen's own
  // mount-time data load. Awaiting it here first - safe and cheap to call
  // again, a no-op once already linked (see its own comment) - guarantees
  // this screen's own first load always happens after it, regardless of
  // whatever order App.tsx's independent call resolves in. Same reasoning
  // now applies to verifyThisSite above, chained right after.
  useEffect(() => {
    if (!siteId) return;
    // Plain sequential awaits, not chained .finally() calls - easier to see
    // at a glance that each step really does wait for the previous one,
    // deliberately after this exact area's own recent history of subtle
    // ordering bugs.
    (async () => {
      await linkCurrentInstallation(); // never throws - always resolves, see its own comment
      await verifyThisSite(siteId);
      await loadConfigs(siteId);
    })();
  }, [siteId]);

  function resetWizard() {
    setWizardOpen(false);
    setStep("collection");
    setWizardError(null);
    setCollectionId(null);
    setMultiImageFields([]);
    setActiveConfig(null);
    setWizardSettings(DEFAULT_GALLERY_SETTINGS);
    setInstallMorphed(false);
  }

  async function handleDetectCollection() {
    if (!isCollectionList(selected)) {
      setWizardError("Select your Collection List element in the Designer first.");
      return;
    }
    setBusy(true);
    setWizardError(null);
    try {
      const id = await getCollectionId(selected);
      if (!id) {
        setWizardError("This Collection List isn't connected to a CMS collection yet.");
        return;
      }
      const fields = await getMultiImageFields(selected);
      if (fields.length === 0) {
        setWizardError("This collection has no multi-image fields.");
        return;
      }
      setCollectionId(id);
      setMultiImageFields(fields);
      setStep("field");
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "Failed to read the Collection List.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickField(fieldSlug: string) {
    if (!siteId || !collectionId) return;
    setBusy(true);
    setWizardError(null);
    try {
      const config = await createGalleryConfig(siteId, { collectionId, fieldSlug });
      setActiveConfig(config);
      setWizardSettings({
        showArrows: config.showArrows,
        showDots: config.showDots,
        autoplay: config.autoplay,
        autoplayIntervalMs: config.autoplayIntervalMs,
        objectFit: config.objectFit,
      });
      setStep("settings");
    } catch (error) {
      setWizardError(
        error instanceof ApiRequestError ? error.message : "Failed to save this gallery config.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings() {
    if (!siteId || !activeConfig) return;
    setBusy(true);
    setWizardError(null);
    try {
      const config = await updateGalleryConfigSettings(siteId, activeConfig.id, wizardSettings);
      setActiveConfig(config);
      setStep("slug");
    } catch (error) {
      setWizardError(
        error instanceof ApiRequestError ? error.message : "Failed to save these settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkSlug() {
    if (!canMarkElement(selected)) {
      setWizardError("Select the text element bound to this item's Slug field first.");
      return;
    }
    setBusy(true);
    setWizardError(null);
    try {
      await markGallerySlugElement(selected);
      getWebflowDesigner().notify({ type: "Success", message: "Slug element marked." });
      setStep("target");
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "Failed to mark the element.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkTarget() {
    if (!canMarkElement(selected) || !activeConfig) {
      setWizardError("Select the element that should display the gallery first.");
      return;
    }
    setBusy(true);
    setWizardError(null);
    try {
      await markGalleryTargetElement(selected, activeConfig.id);
      getWebflowDesigner().notify({ type: "Success", message: "Target element marked." });
      setStep("host");
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "Failed to mark the element.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInstallRuntime() {
    if (!canApplyPreset(selected)) {
      setWizardError("Select an element OUTSIDE the Collection List to host the gallery script.");
      return;
    }
    setBusy(true);
    setWizardError(null);
    // Morph the file/code icon into a "send" icon (GradientFileIcon's own
    // GSAP MorphSVG animation) the instant a real install starts, not once
    // it resolves - it plays out while the request is in flight rather
    // than after the fact.
    setInstallMorphed(true);
    try {
      // The one piece that actually makes the gallery render for real -
      // without this, the marked target just sits there unchanged (which is
      // exactly the "only one blank image" symptom this was built to fix).
      // Idempotent: re-running the wizard updates this same shared embed
      // rather than stacking a second one, even on a different host.
      await applyCmsGalleryRuntime(selected);
      getWebflowDesigner().notify({ type: "Success", message: "Gallery configured!" });
      if (siteId) await loadConfigs(siteId);
      resetWizard();
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "Failed to install the gallery script.");
      // Un-morph back to the file icon so a retry gets the same "click ->
      // send" animation again, instead of starting already morphed.
      setInstallMorphed(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfig(id: string) {
    if (!siteId) return;
    setDeleteBusy(true);
    try {
      await deleteGalleryConfig(siteId, id);
      await loadConfigs(siteId);
      setDeletingConfig(null);
    } catch (error) {
      getWebflowDesigner().notify({
        type: "Error",
        message: error instanceof ApiRequestError ? error.message : "Failed to remove this gallery.",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  function openConfigEditor(config: CmsGalleryConfig) {
    setEditingConfigId(config.id);
    setEditingError(null);
    setEditingSettings({
      showArrows: config.showArrows,
      showDots: config.showDots,
      autoplay: config.autoplay,
      autoplayIntervalMs: config.autoplayIntervalMs,
      objectFit: config.objectFit,
    });
  }

  async function handleSaveEditingSettings() {
    if (!siteId || !editingConfigId) return;
    setEditingBusy(true);
    setEditingError(null);
    try {
      await updateGalleryConfigSettings(siteId, editingConfigId, editingSettings);
      await loadConfigs(siteId);
      setEditingConfigId(null);
    } catch (error) {
      setEditingError(
        error instanceof ApiRequestError ? error.message : "Failed to save these settings.",
      );
    } finally {
      setEditingBusy(false);
    }
  }

  if (managingConfig && siteId) {
    return (
      <ManageGalleryImagesScreen
        siteId={siteId}
        config={managingConfig}
        onBack={() => setManagingConfig(null)}
      />
    );
  }

  if (showCmsVisibility && siteId) {
    return <CmsVisibilityScreen siteId={siteId} onBack={() => setShowCmsVisibility(false)} />;
  }

  return (
    // h-screen (100vh), not h-full (100%) - real bug, confirmed by
    // measuring the DOM directly (sandbox iframe 540px tall, this screen's
    // own content only reaching 372px under h-full, same class of bug
    // ServicesScreen.tsx had: 100% needs a definite-height ancestor chain,
    // which the sandbox's own iframe document doesn't provide, so h-full
    // silently collapses to this screen's own content height instead of
    // the real panel height. 100vh reads the iframe's own viewport height
    // directly regardless of that chain - see every other real screen in
    // this app (DashboardScreen.tsx, SignInScreen.tsx, etc.), all of which
    // already use h-screen for the same reason.
    <div className="flex h-screen min-h-0 w-full flex-col">
      {/* Same service-switcher header as DashboardScreen's own - lets the
          user jump straight back to shaders from here, replacing the old
          PanelHeader "X" (which only ever went back to the neutral
          ServicesScreen picker, per that screen's own now-outdated "no
          back destination" comment - this dropdown is a real one now). */}
      <DashboardHeader
        activeService="webflowSolutions"
        onSelectShaders={onSwitchToShaders}
        onSelectWebflowSolutions={() => {}}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-background-white px-5 py-8">
        {activeTab === "blogStaging" && <BlogToStagingContent feature={blogStaging} />}
        {activeTab === "cmsImages" && <CmsImagesContent feature={cmsImages} />}
        {activeTab === "multiImage" && (
        <>
        {/* Hidden while the wizard is open, per explicit direction - the
            wizard gets its own "Create gallery" heading + step indicator
            in its place below, so this screen's own intro title/row would
            just be redundant clutter above it. */}
        {!wizardOpen && (
          <>
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-mobile-display-d1 text-text-black">
                Multi-image CMS gallery
              </h2>
              <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
                Show a multi-image CMS field inside a Collection List - something Webflow can't bind
                natively.
              </p>
            </div>

            {/* Opens CmsVisibilityScreen.tsx - a real screen now, no longer
                the "affordance for a not-yet-built feature" placeholder
                HeaderAppMenu's own Preferences row still is. */}
            <button
              type="button"
              onClick={() => setShowCmsVisibility(true)}
              disabled={!siteId}
              className="flex items-center justify-between gap-2 border-b border-border-border pb-3 pt-1 text-left disabled:opacity-50"
            >
              <span className="font-sans text-mobile-header-h1 text-text-black">Handle CMS visibility</span>
              <Icon name="chevronRight" className="shrink-0 text-text-secondary" />
            </button>
          </>
        )}

        {siteError && (
          <p className="font-sans text-mobile-text-sm-regular text-error-500">{siteError}</p>
        )}

        {!wizardOpen && (
          <>
            <div className="flex flex-col gap-4">
              <h3 className="font-sans text-mobile-header-h1 text-text-black">
                Your galleries ({configs?.length ?? 0})
              </h3>
              {configsError && (
                <p className="font-sans text-mobile-text-sm-regular text-error-500">{configsError}</p>
              )}
              {configsError && verifyError && (
                <p className="font-sans text-mobile-text-sm-regular text-error-500">
                  Verification detail: {verifyError}
                </p>
              )}
              {configs === null && !configsError && (
                <p className="font-sans text-mobile-text-sm-regular text-text-secondary">Loading...</p>
              )}
              {configs?.length === 0 && (
                <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
                  No galleries configured yet.
                </p>
              )}
              {configs?.map((config) => (
                <div
                  key={config.id}
                  // Real bug, fixed: nothing in the row itself used to
                  // toggle `openMenuConfigId` - only the tiny 24px "..."
                  // button did, so clicking anywhere else on the card (what
                  // reads as "selecting the gallery") did nothing at all,
                  // no purple highlight. The wrapper below stops this from
                  // double-toggling when the click actually originates from
                  // the "..." button or the dropdown itself.
                  onClick={() => {
                    if (!config.isOwner) return;
                    setOpenMenuConfigId((current) => (current === config.id ? null : config.id));
                  }}
                  className={`flex flex-col gap-2 rounded-4 border p-3 ${
                    config.isOwner ? "cursor-pointer" : ""
                  } ${
                    openMenuConfigId === config.id
                      ? "border border-[#644cbdcb] bg-[#CABEF4] text-[#8967FF]"
                      : "border-border-border bg-background-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* gap-1 = 4px, per explicit spec, between the field
                        name and the image-total line below it. */}
                    <div className="flex min-w-0 flex-col gap-1">
                      <span
                        className={`min-w-0 truncate font-sans text-mobile-header-h1 ${
                          openMenuConfigId === config.id ? "text-[#8967FF]" : "text-text-black"
                        }`}
                      >
                        {config.fieldSlug}
                        {!config.isOwner && " (locked)"}
                      </span>
                      {/* text-mobile-text-sm-regular, text-secondary at
                          rest, #8967FF at 80% opacity while this row's menu
                          is open - per explicit spec. null imageCount means
                          the server-side aggregation itself failed (a real
                          Webflow API error), shown as "-" rather than
                          hiding the line or blocking the rest of the row. */}
                      <span
                        className={`font-sans text-mobile-text-sm-regular ${
                          openMenuConfigId === config.id ? "text-[#8967FF]/80" : "text-text-secondary"
                        }`}
                      >
                        {config.imageCount === null ? "-" : config.imageCount} images
                      </span>
                    </div>
                    <div
                      className="relative shrink-0"
                      // Stops a click on the "..." button or inside the
                      // dropdown from also bubbling up to the row's own
                      // onClick above - without this, closing the menu from
                      // a dropdown action (setOpenMenuConfigId(null)) would
                      // immediately get reopened by the row's own toggle
                      // handler seeing the same click.
                      onClick={(event) => event.stopPropagation()}
                      title={
                        config.isOwner
                          ? undefined
                          : "Only the Fluxa account that created this gallery can edit it."
                      }
                    >
                      <button
                        ref={(el) => {
                          menuButtonRefs.current[config.id] = el;
                        }}
                        type="button"
                        disabled={!config.isOwner}
                        onClick={() => setOpenMenuConfigId((current) => (current === config.id ? null : config.id))}
                        aria-label="Gallery actions"
                        className="disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon name="threeDots" className="rotate-90 text-text-secondary" />
                      </button>
                      <Dropdown
                        open={openMenuConfigId === config.id}
                        onCloseRequest={() => setOpenMenuConfigId(null)}
                        triggerRef={{ current: menuButtonRefs.current[config.id] ?? null }}
                        offsetPx={0}
                        scrollable={false}
                        rounded="all"
                      >
                        {/* Real bug, fixed: these three rows had static
                            colors (text-text-white / text-text-color-accent)
                            that never changed on interaction - nothing
                            "resaltaba" when actually selecting one. Same
                            hover-to-accent convention HeaderAppMenu.tsx's own
                            About/Preferences/Cookies rows use
                            (text-text-secondary rest, text-text-color-accent
                            hover) - each icon already picks up the same
                            color via currentColor with no extra class
                            needed, since it's the button's own text color. */}
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuConfigId(null);
                            setManagingConfig(config);
                          }}
                          className="flex items-center gap-2 whitespace-nowrap rounded-4 px-2 py-1.5 text-left font-sans text-mobile-text-md-regular text-text-secondary transition-colors hover:text-text-color-accent"
                        >
                          <Icon name="editor" className="shrink-0" />
                          Manage
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuConfigId(null);
                            editingConfigId === config.id ? setEditingConfigId(null) : openConfigEditor(config);
                          }}
                          className="flex items-center gap-2 whitespace-nowrap rounded-4 px-2 py-1.5 text-left font-sans text-mobile-text-md-regular text-text-secondary transition-colors hover:text-text-color-accent"
                        >
                          <Icon name="edit" className="shrink-0" />
                          {editingConfigId === config.id ? "Close" : "Customize"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuConfigId(null);
                            setDeletingConfig(config);
                          }}
                          className="flex items-center gap-2 whitespace-nowrap rounded-4 px-2 py-1.5 text-left font-sans text-mobile-text-md-regular text-text-secondary transition-colors hover:text-text-color-accent"
                        >
                          <Icon name="delete" className="shrink-0" />
                          Delete
                        </button>
                      </Dropdown>
                    </div>
                  </div>
                  {editingConfigId === config.id && (
                    <div
                      className="flex flex-col gap-3 border-t border-border-border pt-3"
                      // Real bug, fixed: this whole card is inside the
                      // row's own onClick (toggles openMenuConfigId, see
                      // above) - without this, clicking any toggle/slider/
                      // pill in here bubbled up and reopened the "..."
                      // Manage/Customize/Delete menu right on top of the
                      // settings form the user was actively using.
                      onClick={(event) => event.stopPropagation()}
                    >
                      {editingError && (
                        <p className="font-sans text-mobile-text-sm-regular text-error-500">{editingError}</p>
                      )}
                      <GallerySettingsForm settings={editingSettings} onChange={setEditingSettings} />
                      <ButtonPrimary onClick={handleSaveEditingSettings} disabled={editingBusy}>
                        Save
                      </ButtonPrimary>
                    </div>
                  )}
                </div>
              ))}
            </div>

          </>
        )}

        {/* The wizard's own header - replaces the plain numbered-paragraph
            steps with "Create gallery" + a real 6-dot progress indicator,
            per explicit direction (copy-paste/Screenshot 2026-09-18
            161008.png). Buttons still live in the fixed footer below, not
            in here - see that footer's own comment. */}
        {wizardOpen && (
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-mobile-header-h1 text-text-black">Create gallery</h2>
            <WizardStepIndicator steps={WIZARD_STEP_ORDER} currentStep={step} />

            {wizardError && (
              <p className="font-sans text-mobile-text-sm-regular text-error-500">{wizardError}</p>
            )}

            <p className="font-sans text-mobile-header-h2 text-text-black">{STEP_DESCRIPTIONS[step]}</p>

            {/* target's own extra caveat - real copy, not part of
                STEP_DESCRIPTIONS (that map is exactly the one line per step
                the reference calls "el texto descriptivo"; this is
                supplementary detail specific to this one step). */}
            {step === "target" && (
              <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
                This element's size and position stay fully yours to style in the Designer - the
                gallery mounts inside it, it's never replaced or resized. One thing it does need
                from you: set its own <strong>Position</strong> to something other than Static
                (Relative works) in the Style panel, so the arrows/dots overlay it correctly.
              </p>
            )}

            {/* The one shared "box" every step renders its own content
                into, per explicit direction. collection gets the random-
                wander unmask reveal (UnmaskReveal.tsx) - its own
                `absolute inset-0` layer, so this branch is `relative`
                instead of flex-centered, and stays mounted (running its
                rAF loop) only while this step is showing; advancing past
                it unmounts it, which is what actually stops the
                animation. slug and target both get the same fake-Navigator
                "mark this element" guide (NavigatorMarkGuide.tsx, its own
                looping GSAP timeline) - one component, a `variant` prop
                picks which row the cursor lands on ("Text Block" for slug,
                "Div Block" for target) - top-aligned like field/settings,
                not centered, since it's a real self-contained panel filling
                the box's own width. field/settings get real interactive
                content instead, top-aligned in normal flow like everywhere
                else in this app. host gets the install illustration,
                centered, over a soft pink halo matching
                copy-paste/paso-6.png's own background: a genuine radial
                glow (an ellipse, not a circle - matches this box's own
                wide-not-tall aspect ratio better than a circle would)
                centered on the container's bottom edge, fading to the
                plain gray backing by the vertical middle. A flat linear
                fade was tried first and explicitly rejected - it read as a
                band, not a halo/glow. */}
            <div
              className={`min-h-[200px] rounded-4 p-4 ${
                step === "field" || step === "settings" || step === "slug" || step === "target"
                  ? "bg-background-white-2"
                  : step === "collection"
                    ? "relative overflow-hidden bg-background-white-2"
                    : "flex items-center justify-center bg-background-white-2"
              }`}
              style={
                step === "host"
                  ? {
                      background:
                        "radial-gradient(ellipse 100% 65% at 50% 110%, rgb(226 63 140 / 32%) 0%, rgb(226 63 140 / 12%) 50%, transparent 75%), var(--background-background-white-2, #D7DAE2)",
                    }
                  : undefined
              }
            >
              {step === "collection" && <UnmaskReveal />}
              {step === "field" && (
                <PillDropdown
                  options={multiImageFields.map((field) => ({ key: field.slug, displayName: field.displayName }))}
                  onSelect={handlePickField}
                  disabled={busy}
                  placeholder="Select a multi-image field"
                  icon="multiImage"
                />
              )}
              {step === "settings" && (
                <GallerySettingsForm settings={wizardSettings} onChange={setWizardSettings} />
              )}
              {step === "slug" && <NavigatorMarkGuide variant="slug" />}
              {step === "target" && <NavigatorMarkGuide variant="target" />}
              {step === "host" && <GradientFileIcon className="h-24 w-auto" morph={installMorphed} />}
            </div>
          </div>
        )}
        </>
        )}
      </div>
      {/* Fixed footer, pinned below the scrolling area with a border-top
          line above it - same structure as EditorTab.tsx's own "Apply
          gradient" footer (shrink-0, border-t, px-5/py-3 there is that
          file's px-[20px]/py-[12px]), per explicit direction that every
          primary action in this screen should look and behave the same
          way. Swaps between "Add gallery" and the current wizard step's own
          button + Cancel, mirroring EditorTab's own Accept/Apply-gradient
          swap in the same footer slot. "cmsImages"/"blogStaging" each get
          their own equivalent footer (CmsImagesFooter/BlogToStagingFooter)
          rendered in this same slot. */}
      {activeTab === "cmsImages" && <CmsImagesFooter feature={cmsImages} />}
      {activeTab === "blogStaging" && <BlogToStagingFooter feature={blogStaging} />}
      {activeTab === "multiImage" && (
        <div className="w-full shrink-0 border-t border-border-border px-5 py-3 bg-background-white">
          {!wizardOpen ? (
            <ButtonPrimary
              onClick={() => setWizardOpen(true)}
              disabled={!siteId}
              icon={
                // Not Icon.tsx's own "add" - that one's stroke is a
                // hardcoded dark hex (fine for ControlPanel.tsx's own light
                // "Add color" button, invisible against this button's own
                // gradient), so this is a local currentColor version per
                // ButtonPrimary's own icon-prop convention.
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 3V9M3 6H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              Add gallery
            </ButtonPrimary>
          ) : (
            <div className="flex flex-col gap-2">
              {step === "collection" && (
                <ButtonPrimary onClick={handleDetectCollection} disabled={busy} icon={<Icon name="magnifyingGlass" />}>
                  Detect Collection List
                </ButtonPrimary>
              )}
              {step === "settings" && (
                <ButtonPrimary onClick={handleSaveSettings} disabled={busy}>
                  Continue
                </ButtonPrimary>
              )}
              {step === "slug" && (
                <ButtonPrimary onClick={handleMarkSlug} disabled={busy}>
                  Mark as slug source
                </ButtonPrimary>
              )}
              {step === "target" && (
                <ButtonPrimary onClick={handleMarkTarget} disabled={busy}>
                  Mark as gallery target
                </ButtonPrimary>
              )}
              {step === "host" && (
                <ButtonPrimary onClick={handleInstallRuntime} disabled={busy}>
                  Install gallery script
                </ButtonPrimary>
              )}
              {/* "field" has no primary button of its own - picking a field
                  from the PillDropdown (up in the scrolling area) advances
                  the step directly, so only Cancel shows here for it. */}
              <ButtonSecondary onClick={resetWizard} disabled={busy}>
                Cancel
              </ButtonSecondary>
            </div>
          )}
        </div>
      )}
      <DashboardNav tabs={WEBFLOW_SOLUTIONS_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <ConfirmDeleteModal
        open={deletingConfig !== null}
        onCancel={() => setDeletingConfig(null)}
        onConfirm={() => {
          if (deletingConfig) handleDeleteConfig(deletingConfig.id);
        }}
        isDeleting={deleteBusy}
        title="Delete gallery?"
        description="The gallery will be permanently removed from your account."
      />
    </div>
  );
}
