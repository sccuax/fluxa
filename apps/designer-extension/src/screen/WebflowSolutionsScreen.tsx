import { useEffect, useRef, useState } from "react";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { PanelHeader } from "../components/PanelHeader";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { SegmentedRow } from "../components/SegmentedRow";
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

// A boolean toggle rendered as a SegmentedRow with two options - same
// pattern GlassLiquidControlPanel.tsx/RuidoEvolutivoControlPanel.tsx already
// duplicate locally for their own config panels (never extracted to a
// shared component there), followed here rather than introducing a
// differently-styled switch for what's conceptually the same kind of
// control.
function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-sans text-mobile-text-sm-regular text-text-secondary">{label}</span>
      <SegmentedRow<"on" | "off">
        options={[{ label: "Off", value: "off" }, { label: "On", value: "on" }]}
        value={value ? "on" : "off"}
        onChange={(next) => onChange(next === "on")}
        className="max-w-[120px]"
      />
    </div>
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
    <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-mobile-text-sm-regular text-text-secondary">
            Autoplay speed - {(settings.autoplayIntervalMs / 1000).toFixed(1)}s
          </span>
          <RangeSlider
            min={1000}
            max={15000}
            step={500}
            value={settings.autoplayIntervalMs}
            onChange={(autoplayIntervalMs) => onChange({ ...settings, autoplayIntervalMs })}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-mobile-text-sm-regular text-text-secondary">Image fit</span>
        <SegmentedRow<"cover" | "contain">
          options={[{ label: "Cover", value: "cover" }, { label: "Contain", value: "contain" }]}
          value={settings.objectFit}
          onChange={(objectFit) => onChange({ ...settings, objectFit })}
          className="max-w-[160px]"
        />
      </div>
      {/* Size, position, overflow, border-radius, background, etc. are
          deliberately not here - the runtime script mounts INSIDE the
          marked target div, never replacing or resizing it (see
          cmsGalleryEmbedScript.ts's own top comment), so every one of those
          stays exclusively stylable from the Designer's own Style panel on
          that element - a second control here would just be a second,
          possibly conflicting, source of truth for the same property. */}
      <p className="font-sans text-mobile-text-xsm-regular text-text-secondary">
        Size, position, overflow, border and background all come from the target element&apos;s own
        styling in the Designer - style it there like any other element.
      </p>
    </div>
  );
}

const WEBFLOW_SOLUTIONS_SIZE = { width: 320, height: 620 };

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

// Matches Webflow's own Settings-panel field list (light surface, the same
// multiImage glyph Webflow itself uses, hover/selected tint) rather than
// this app's own plain ButtonSecondary list, per explicit direction -
// checked against Webflow's Trademark Usage Policy and developer design
// guidelines first (see Icon.tsx's own "multiImage" comment): matching
// Webflow's native in-app look is explicitly sanctioned for a Designer
// Extension, not restricted - only their actual name/logo/wordmark is.
// Rest = bg #CABEF4, border #8967FF, text/svg #8967FF (same as border) -
// revised from an earlier pass that had rest text/bg too close in
// lightness to read (#EDDEFF on #DBD5EF). Hover inverts: bg becomes the
// former text/border color (#8967FF), text/svg becomes #EDDEFF - a real
// dark-on-light -> light-on-dark swap this time, not two similar pastels.
// `text-[...]` alone drives the icon's own color too via currentColor
// (Icon's `multiImage` fill), same as every other icon call site in this
// app - no separate icon color class needed. Shared by both the trigger
// button and every dropdown row, per explicit direction that the trigger
// should carry these colors too, not just the opened list.
const FIELD_PICKER_COLORS =
  "border-[#8967FF] bg-[#CABEF4] text-[#8967FF] hover:bg-[#8967FF] hover:text-[#EDDEFF]";

// Exported for sandbox/registry.tsx's own Components-group demo - this
// wizard step is gated behind a real Designer's `siteId` (see this file's
// mount effect above), so previewing the dropdown itself standalone is the
// only way to see it render/hover-test outside the actual Designer.
export function FieldDropdown({ fields, onSelect, disabled }: {
  fields: MultiImageField[];
  onSelect: (slug: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-4 border px-3 py-2 text-left font-sans text-mobile-text-sm-regular transition-colors disabled:opacity-50 ${FIELD_PICKER_COLORS}`}
      >
        <span className="flex items-center gap-2">
          <Icon name="multiImage" className="shrink-0" />
          Select a multi-image field
        </span>
        <Icon name="chevronDown" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Dropdown open={open} onCloseRequest={() => setOpen(false)} triggerRef={triggerRef} offsetPx={0} variant="light">
        {fields.map((field) => (
          <button
            key={field.slug}
            type="button"
            onClick={() => {
              setOpen(false);
              onSelect(field.slug);
            }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-4 border px-2.5 py-1.5 text-left font-sans text-mobile-text-sm-regular transition-colors ${FIELD_PICKER_COLORS}`}
          >
            <Icon name="multiImage" className="shrink-0" />
            {field.displayName}
          </button>
        ))}
      </Dropdown>
    </div>
  );
}

export function WebflowSolutionsScreen({ onBack }: { onBack: () => void }) {
  useExtensionSize(WEBFLOW_SOLUTIONS_SIZE);

  const { element: selected } = useSelectedElement();

  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
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
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfig(id: string) {
    if (!siteId) return;
    try {
      await deleteGalleryConfig(siteId, id);
      await loadConfigs(siteId);
    } catch (error) {
      getWebflowDesigner().notify({
        type: "Error",
        message: error instanceof ApiRequestError ? error.message : "Failed to remove this gallery.",
      });
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PanelHeader title="Webflow solutions" onClose={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-background-white px-5 pb-6 pt-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-mobile-header-h1 text-text-black">
            Multi-image CMS gallery
          </h2>
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
            Show a multi-image CMS field inside a Collection List - something Webflow can't bind
            natively.
          </p>
        </div>

        {siteError && (
          <p className="font-sans text-mobile-text-sm-regular text-error-500">{siteError}</p>
        )}

        {!wizardOpen && (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="font-sans text-mobile-text-sm-medium text-text-black">
                Configured galleries
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
                  className="flex flex-col gap-2 rounded-4 border border-border-border bg-background-white-2 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-sans text-mobile-text-sm-regular text-text-black">
                      {config.fieldSlug}
                      {!config.isOwner && " (locked)"}
                    </span>
                    <div
                      className="flex shrink-0 items-center gap-3"
                      title={
                        config.isOwner
                          ? undefined
                          : "Only the Fluxa account that created this gallery can edit it."
                      }
                    >
                      <button
                        type="button"
                        disabled={!config.isOwner}
                        onClick={() => setManagingConfig(config)}
                        className="font-sans text-mobile-text-sm-regular text-text-color-accent disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-50"
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        disabled={!config.isOwner}
                        onClick={() =>
                          editingConfigId === config.id ? setEditingConfigId(null) : openConfigEditor(config)
                        }
                        className="font-sans text-mobile-text-sm-regular text-text-color-accent disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-50"
                      >
                        {editingConfigId === config.id ? "Close" : "Customize"}
                      </button>
                      <button
                        type="button"
                        disabled={!config.isOwner}
                        onClick={() => handleDeleteConfig(config.id)}
                        className="font-sans text-mobile-text-sm-regular text-error-800 disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {editingConfigId === config.id && (
                    <div className="flex flex-col gap-3 border-t border-border-border pt-3">
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

            <ButtonPrimary onClick={() => setWizardOpen(true)} disabled={!siteId}>
              Add a gallery
            </ButtonPrimary>
          </>
        )}

        {wizardOpen && (
          <div className="flex flex-col gap-3 rounded-4 border border-border-border bg-background-white-2 p-4">
            {wizardError && (
              <p className="font-sans text-mobile-text-sm-regular text-error-500">{wizardError}</p>
            )}

            {step === "collection" && (
              <>
                <p className="font-sans text-mobile-text-sm-regular text-text-black">
                  1. Select your Collection List element in the Designer, then click Detect.
                </p>
                <ButtonPrimary onClick={handleDetectCollection} disabled={busy}>
                  Detect Collection List
                </ButtonPrimary>
              </>
            )}

            {step === "field" && (
              <>
                <p className="font-sans text-mobile-text-sm-regular text-text-black">
                  2. Pick which multi-image field to show.
                </p>
                <FieldDropdown fields={multiImageFields} onSelect={handlePickField} disabled={busy} />
              </>
            )}

            {step === "settings" && (
              <>
                <p className="font-sans text-mobile-text-sm-regular text-text-black">
                  3. Customize how the gallery looks, then continue.
                </p>
                <GallerySettingsForm settings={wizardSettings} onChange={setWizardSettings} />
                <ButtonPrimary onClick={handleSaveSettings} disabled={busy}>
                  Continue
                </ButtonPrimary>
              </>
            )}

            {step === "slug" && (
              <>
                <p className="font-sans text-mobile-text-sm-regular text-text-black">
                  4. Inside one item, select the text element bound to the item's Slug field, then
                  click Mark.
                </p>
                <ButtonPrimary onClick={handleMarkSlug} disabled={busy}>
                  Mark as slug source
                </ButtonPrimary>
              </>
            )}

            {step === "target" && (
              <>
                <p className="font-sans text-mobile-text-sm-regular text-text-black">
                  5. In the same item, select the element that should display the gallery, then
                  click Mark.
                </p>
                <p className="font-sans text-mobile-text-xsm-regular text-text-secondary">
                  This element's size and position stay fully yours to style in the Designer - the
                  gallery mounts inside it, it's never replaced or resized. One thing it does need
                  from you: set its own <strong>Position</strong> to something other than Static
                  (Relative works) in the Style panel, so the arrows/dots overlay it correctly.
                </p>
                <ButtonPrimary onClick={handleMarkTarget} disabled={busy}>
                  Mark as gallery target
                </ButtonPrimary>
              </>
            )}

            {step === "host" && (
              <>
                <p className="font-sans text-mobile-text-sm-regular text-text-black">
                  6. Select any element OUTSIDE the Collection List (e.g. the section wrapping it),
                  then click Install. Webflow doesn't allow the gallery script inside the Collection
                  List itself.
                </p>
                <ButtonPrimary onClick={handleInstallRuntime} disabled={busy}>
                  Install gallery script
                </ButtonPrimary>
              </>
            )}

            <ButtonSecondary onClick={resetWizard} disabled={busy}>
              Cancel
            </ButtonSecondary>
          </div>
        )}
      </div>
    </div>
  );
}
