import { useEffect, useRef, useState } from "react";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { Icon } from "../components/Icon";
import { Dropdown } from "../components/Dropdown";
import { ExpandableItemRow } from "../components/ExpandableItemRow";
import { PillDropdown } from "../components/PillDropdown";
import { UnmaskReveal } from "../components/UnmaskReveal";
import { WizardStepIndicator } from "../components/WizardStepIndicator";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import { NavigatorMarkGuide } from "../components/NavigatorMarkGuide";
import { getWebflowDesigner } from "../services/webflowDesigner";
import { resolveLabel } from "../hooks/useSelectedElement";
import { fetchSiteCollections, type CmsSiteCollection } from "../services/cmsGallery";
import {
  isImageElement,
  markImageTarget,
  applyImageToElement,
  findImageReuseTarget,
  fetchCollectionImageItems,
  fetchImageReuses,
  createImageReuse,
  updateImageReuse,
  deleteImageReuse,
  CMS_IMAGE_TARGET_ATTRIBUTE,
  type CmsImageItem,
  type CmsImageFieldValue,
  type CmsImageReuseConfig,
} from "../services/cmsImages";
import { ApiRequestError } from "../services/apiClient";

// "CMS images" (Webflow Solutions feature #3) - a NEW, standalone screen
// (kept in its own file rather than growing WebflowSolutionsScreen.tsx's
// own multi-image wizard any further), reusing that wizard's own visual
// language (UnmaskReveal's center animation, WizardStepIndicator's step
// dots, the file/send morph icon, ExpandableItemRow's post-list chrome)
// wherever the two features genuinely share a mechanic, per explicit
// direction. See routes/cmsImages.ts / services/cmsImages.ts for why this
// one has NO published-site runtime at all - ImageElement.setAsset() sets
// a real native image binding directly, no HTML Embed or backend needed at
// apply time.
//
// WebflowSolutionsScreen.tsx's own layout puts a tab's SCROLLABLE content
// and its FIXED FOOTER in two separate sibling slots (so the footer stays
// pinned above DashboardNav instead of scrolling away with the content) -
// exactly the same reason that screen's own multi-image wizard keeps all
// its state at that top level rather than in a child component. This file
// mirrors that shape with a hook instead of inlining everything into
// WebflowSolutionsScreen.tsx: `useCmsImagesFeature` owns all the state, and
// `CmsImagesContent`/`CmsImagesFooter` are two dumb views over it, rendered
// from WebflowSolutionsScreen.tsx's own two existing slots.
type ImageWizardStep = "collection" | "source" | "image" | "target";

const IMAGE_WIZARD_STEPS: ImageWizardStep[] = ["collection", "source", "image", "target"];

const STEP_DESCRIPTIONS: Record<ImageWizardStep, string> = {
  collection: "Click Detect to load every collection in your CMS - no Collection List needed.",
  source: "Pick the collection that has the image you want to reuse.",
  image: "Select a post, then pick which image to reuse.",
  target: "Select the Image element that should show it, then click Mark.",
};

const PAGE_SIZE = 24;

interface PickedImage {
  itemSlug: string;
  itemName: string;
  fieldSlug: string;
  fileId: string;
  url: string;
  alt: string | null;
}

export function useCmsImagesFeature(siteId: string | null, selected: AnyElement | null) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<ImageWizardStep>("collection");
  const [busy, setBusy] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CmsSiteCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const [items, setItems] = useState<CmsImageItem[]>([]);
  const [itemsOffset, setItemsOffset] = useState(0);
  const [itemsTotal, setItemsTotal] = useState<number | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);

  // Non-null only while "Manage" (re-picking a different image for an
  // ALREADY-marked target) is active - skips straight to the item/image
  // picker, scoped to that reuse's own collection, and finishes by
  // re-locating the existing target instead of running the mark step.
  const [editingReuseId, setEditingReuseId] = useState<string | null>(null);

  const [reuses, setReuses] = useState<CmsImageReuseConfig[] | null>(null);
  const [reusesError, setReusesError] = useState<string | null>(null);
  // Live-resolved label for each reuse's own target element, same
  // "scan the current page, resolveLabel what's found" convention
  // AppliedGradientsMenu already uses - undefined while resolving,
  // null once resolved but not found (a different page), a real
  // string once found. Falls back to the reuse's own fieldSlug in
  // the UI for both the undefined/null cases (see CmsImagesContent).
  const [targetLabels, setTargetLabels] = useState<Record<string, string | null>>({});

  const [openMenuConfigId, setOpenMenuConfigId] = useState<string | null>(null);
  const [deletingReuseId, setDeletingReuseId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function loadReuses() {
    if (!siteId) return;
    try {
      setReusesError(null);
      const rows = await fetchImageReuses(siteId);
      setReuses(rows);
      // Resolved in parallel, each independently - one slow/failed lookup
      // shouldn't hold up the others.
      rows.forEach(async (row) => {
        try {
          const target = await findImageReuseTarget(row.id);
          const label = target ? await resolveLabel(target) : null;
          setTargetLabels((prev) => ({ ...prev, [row.id]: label }));
        } catch {
          setTargetLabels((prev) => ({ ...prev, [row.id]: null }));
        }
      });
    } catch (err) {
      setReusesError(err instanceof ApiRequestError ? err.message : "Failed to load your reused images.");
    }
  }

  useEffect(() => {
    loadReuses();
    // Reloads if the site changes (shouldn't happen mid-session in
    // practice, but matches every other list in this app keying its own
    // load effect on siteId).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  function resetWizard() {
    setWizardOpen(false);
    setStep("collection");
    setWizardError(null);
    setCollections([]);
    setSelectedCollectionId(null);
    setItems([]);
    setItemsOffset(0);
    setItemsTotal(null);
    setExpandedSlug(null);
    setPickedImage(null);
    setEditingReuseId(null);
  }

  function openCreateWizard() {
    resetWizard();
    setWizardOpen(true);
  }

  async function loadItemsPage(collectionId: string, nextOffset: number) {
    if (!siteId) return;
    setItemsLoading(true);
    setWizardError(null);
    try {
      const page = await fetchCollectionImageItems(siteId, collectionId, { limit: PAGE_SIZE, offset: nextOffset });
      setItems((prev) => (nextOffset === 0 ? page.items : [...prev, ...page.items]));
      setItemsOffset(nextOffset + page.items.length);
      setItemsTotal(page.pagination.total);
    } catch (err) {
      setWizardError(err instanceof ApiRequestError ? err.message : "Failed to load posts.");
    } finally {
      setItemsLoading(false);
    }
  }

  function openManageWizard(reuse: CmsImageReuseConfig) {
    resetWizard();
    setEditingReuseId(reuse.id);
    setSelectedCollectionId(reuse.collectionId);
    setStep("image");
    setWizardOpen(true);
    loadItemsPage(reuse.collectionId, 0);
  }

  // Real bug, fixed: this originally reused the multi-image wizard's own
  // "select a Collection List, then Detect" mechanic verbatim - but THIS
  // feature's entire premise is reuse "en cualquier parte del proyecto sin
  // necesidad de instalar una collection list", so gating it behind
  // selecting one was a direct contradiction of the feature it was
  // supposed to power, not just a copy nit. Fetches every collection in
  // the SITE directly (fetchSiteCollections, the real Webflow Data API,
  // routes/cmsGallery.ts's own GET /:siteId/collections - built earlier,
  // originally unused) - nothing needs to be selected in the Designer at
  // all for this step.
  async function handleDetectCollections() {
    if (!siteId) return;
    setBusy(true);
    setWizardError(null);
    try {
      const sources = await fetchSiteCollections(siteId);
      setCollections(sources);
      setStep("source");
    } catch (err) {
      setWizardError(err instanceof ApiRequestError ? err.message : "Failed to load your collections.");
    } finally {
      setBusy(false);
    }
  }

  function handlePickCollection(collectionId: string) {
    setSelectedCollectionId(collectionId);
    setStep("image");
    loadItemsPage(collectionId, 0);
  }

  async function handlePickImage(item: CmsImageItem, image: CmsImageFieldValue) {
    if (image.fileId === null) {
      setWizardError("This image can't be reused - it has no underlying asset file.");
      return;
    }
    const picked: PickedImage = {
      itemSlug: item.slug,
      itemName: item.name,
      fieldSlug: image.fieldSlug,
      fileId: image.fileId,
      url: image.url,
      alt: image.alt,
    };

    if (editingReuseId) {
      await handleReapply(editingReuseId, picked);
      return;
    }

    setPickedImage(picked);
    setStep("target");
  }

  // "Manage" flow's own finish - the target is already marked (this reuse's
  // own id is already the value of its marker attribute), so this skips
  // the mark step entirely: re-locate it on the current page, re-apply the
  // NEW image directly, then update the bookkeeping row to match.
  async function handleReapply(reuseId: string, picked: PickedImage) {
    setBusy(true);
    setWizardError(null);
    try {
      const target = await findImageReuseTarget(reuseId);
      if (!target) {
        setWizardError(
          "Couldn't find this reuse's target element on the current page - open the page it's on and try again.",
        );
        return;
      }
      await applyImageToElement(target, picked.fileId, picked.url);
      await updateImageReuse(siteId!, reuseId, {
        itemSlug: picked.itemSlug,
        itemName: picked.itemName,
        fieldSlug: picked.fieldSlug,
        assetId: picked.fileId,
      });
      getWebflowDesigner().notify({ type: "Success", message: "Image updated!" });
      resetWizard();
      await loadReuses();
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : "Failed to update this image.");
    } finally {
      setBusy(false);
    }
  }

  // The CREATE flow's own finish - marks the target, applies the picked
  // image (the real, native, no-custom-code binding), then records it.
  async function handleMarkAndApply() {
    if (!isImageElement(selected) || !pickedImage || !selectedCollectionId || !siteId) {
      setWizardError("Select an Image element in the Designer first.");
      return;
    }
    setBusy(true);
    setWizardError(null);
    try {
      await applyImageToElement(selected, pickedImage.fileId, pickedImage.url);
      const reuse = await createImageReuse(siteId, {
        collectionId: selectedCollectionId,
        itemSlug: pickedImage.itemSlug,
        itemName: pickedImage.itemName,
        fieldSlug: pickedImage.fieldSlug,
        assetId: pickedImage.fileId,
      });
      await markImageTarget(selected, reuse.id);
      getWebflowDesigner().notify({ type: "Success", message: "Image applied!" });
      resetWizard();
      await loadReuses();
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : "Failed to apply this image.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteReuse(id: string) {
    if (!siteId) return;
    setDeleteBusy(true);
    try {
      // Best-effort - a target on a different page just won't have its
      // marker cleared, harmless (nothing reads it once the row is gone).
      try {
        const target = await findImageReuseTarget(id);
        if (target) await target.setAttribute(CMS_IMAGE_TARGET_ATTRIBUTE, "");
      } catch {
        // Ignored - see comment above.
      }
      await deleteImageReuse(siteId, id);
      setDeletingReuseId(null);
      await loadReuses();
    } catch (err) {
      getWebflowDesigner().notify({
        type: "Error",
        message: err instanceof ApiRequestError ? err.message : "Failed to remove this reuse.",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  return {
    siteId,
    wizardOpen,
    step,
    busy,
    wizardError,
    collections,
    selectedCollectionId,
    items,
    itemsOffset,
    itemsTotal,
    itemsLoading,
    expandedSlug,
    setExpandedSlug,
    pickedImage,
    editingReuseId,
    reuses,
    reusesError,
    targetLabels,
    openMenuConfigId,
    setOpenMenuConfigId,
    deletingReuseId,
    setDeletingReuseId,
    deleteBusy,
    openCreateWizard,
    openManageWizard,
    resetWizard,
    handleDetectCollections,
    handlePickCollection,
    handlePickImage,
    handleMarkAndApply,
    handleDeleteReuse,
    loadItemsPage,
  };
}

export type CmsImagesFeature = ReturnType<typeof useCmsImagesFeature>;

// The tiny "+" glyph ButtonPrimary's icon prop expects - same local
// currentColor precedent WebflowSolutionsScreen.tsx's own "Add gallery"
// button already documents (Icon.tsx's own "add" is a hardcoded dark
// stroke, invisible against this button's gradient).
function PlusGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3V9M3 6H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CmsImagesContent({ feature }: { feature: CmsImagesFeature }) {
  // One real button ref per row, same pattern WebflowSolutionsScreen.tsx's
  // own gallery-card "..." menu uses - Dropdown needs a real element ref
  // (to exclude the trigger from its own outside-click-closes check), not
  // just a boolean.
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const {
    wizardOpen,
    step,
    busy,
    wizardError,
    collections,
    items,
    itemsLoading,
    expandedSlug,
    setExpandedSlug,
    editingReuseId,
    reuses,
    reusesError,
    targetLabels,
    openMenuConfigId,
    setOpenMenuConfigId,
    setDeletingReuseId,
    openManageWizard,
    handlePickCollection,
    handlePickImage,
  } = feature;

  return (
    <>
      {!wizardOpen && (
        <>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-mobile-display-d1 text-text-black">CMS images</h2>
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
              Webflow keeps CMS images locked to Image elements. Reuse any image already in your CMS on
              any element you want.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-sans text-mobile-header-h1 text-text-black">
              Reused images ({reuses?.length ?? 0})
            </h3>
            {reusesError && <p className="font-sans text-mobile-text-sm-regular text-error-500">{reusesError}</p>}
            {reuses === null && !reusesError && (
              <p className="font-sans text-mobile-text-sm-regular text-text-secondary">Loading...</p>
            )}
            {reuses?.length === 0 && (
              <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
                No reused images yet.
              </p>
            )}
            {reuses?.map((reuse) => (
              <div
                key={reuse.id}
                onClick={() => {
                  if (!reuse.isOwner) return;
                  setOpenMenuConfigId((current) => (current === reuse.id ? null : reuse.id));
                }}
                className={`flex flex-col gap-2 rounded-4 border border-[#644cbdcb] bg-[#CABEF4] p-3 ${
                  reuse.isOwner ? "cursor-pointer" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="min-w-0 truncate font-sans text-mobile-header-h1 text-[#8967FF]">
                      {targetLabels[reuse.id] ?? reuse.fieldSlug}
                      {!reuse.isOwner && " (locked)"}
                    </span>
                    <span className="truncate font-sans text-mobile-text-sm-regular text-[#8967FF]/80">
                      {reuse.itemName}
                    </span>
                  </div>
                  <div
                    className="relative shrink-0"
                    onClick={(event) => event.stopPropagation()}
                    title={reuse.isOwner ? undefined : "Only the Fluxa account that created this can manage it."}
                  >
                    <button
                      ref={(el) => {
                        menuButtonRefs.current[reuse.id] = el;
                      }}
                      type="button"
                      disabled={!reuse.isOwner}
                      onClick={() => setOpenMenuConfigId((current) => (current === reuse.id ? null : reuse.id))}
                      aria-label="Reuse actions"
                      className="disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name="threeDots" className="rotate-90 text-[#8967FF]" />
                    </button>
                    <Dropdown
                      open={openMenuConfigId === reuse.id}
                      onCloseRequest={() => setOpenMenuConfigId(null)}
                      triggerRef={{ current: menuButtonRefs.current[reuse.id] ?? null }}
                      offsetPx={0}
                      scrollable={false}
                      rounded="all"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuConfigId(null);
                          openManageWizard(reuse);
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
                          setDeletingReuseId(reuse.id);
                        }}
                        className="flex items-center gap-2 whitespace-nowrap rounded-4 px-2 py-1.5 text-left font-sans text-mobile-text-md-regular text-text-secondary transition-colors hover:text-text-color-accent"
                      >
                        <Icon name="delete" className="shrink-0" />
                        Delete
                      </button>
                    </Dropdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {wizardOpen && (
        <div className="flex flex-col gap-4">
          {editingReuseId ? (
            <h2 className="font-display text-mobile-header-h1 text-text-black">Replace image</h2>
          ) : (
            <>
              <h2 className="font-display text-mobile-header-h1 text-text-black">Reuse image</h2>
              <WizardStepIndicator steps={IMAGE_WIZARD_STEPS} currentStep={step} />
            </>
          )}

          {wizardError && <p className="font-sans text-mobile-text-sm-regular text-error-500">{wizardError}</p>}

          {!editingReuseId && (
            <p className="font-sans text-mobile-header-h2 text-text-black">{STEP_DESCRIPTIONS[step]}</p>
          )}

          <div
            className={`min-h-[200px] rounded-4 p-4 ${
              step === "source" || step === "image" || step === "target"
                ? "bg-background-white-2"
                : "relative overflow-hidden bg-background-white-2"
            }`}
          >
            {step === "collection" && <UnmaskReveal />}
            {step === "source" && (
              <PillDropdown
                options={collections.map((collection) => ({ key: collection.id, displayName: collection.displayName }))}
                onSelect={handlePickCollection}
                disabled={busy}
                placeholder="Select a collection"
                icon="collection"
              />
            )}
            {step === "image" && (
              <div className="flex flex-col gap-2">
                {items.length === 0 && itemsLoading && (
                  <p className="font-sans text-mobile-text-sm-regular text-text-secondary">Loading posts...</p>
                )}
                {items.length === 0 && !itemsLoading && (
                  <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
                    No image fields found in this collection.
                  </p>
                )}
                {items.map((item) => {
                  const expanded = expandedSlug === item.slug;
                  return (
                    <ExpandableItemRow
                      key={item.id}
                      title={item.name}
                      meta={`${item.images.length} image${item.images.length === 1 ? "" : "s"}`}
                      expanded={expanded}
                      onToggle={() => setExpandedSlug(expanded ? null : item.slug)}
                    >
                      {item.images.length === 0 ? (
                        <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
                          This post has no images set.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {item.images.map((image, index) => (
                            <button
                              key={image.fileId ?? `${item.slug}-${index}`}
                              type="button"
                              disabled={image.fileId === null}
                              title={image.fileId === null ? "Can't be reused" : image.fieldSlug}
                              onClick={() => handlePickImage(item, image)}
                              className="relative aspect-square overflow-hidden rounded-4 border border-border-border disabled:opacity-50"
                            >
                              <img
                                src={image.url}
                                alt={image.alt ?? ""}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </ExpandableItemRow>
                  );
                })}
              </div>
            )}
            {step === "target" && <NavigatorMarkGuide variant="image" />}
          </div>
        </div>
      )}
    </>
  );
}

export function CmsImagesFooter({ feature }: { feature: CmsImagesFeature }) {
  const { wizardOpen, step, busy, siteId, itemsOffset, itemsTotal, itemsLoading, editingReuseId } = feature;
  const {
    openCreateWizard,
    resetWizard,
    handleDetectCollections,
    handleMarkAndApply,
    loadItemsPage,
    selectedCollectionId,
    deletingReuseId,
    setDeletingReuseId,
    deleteBusy,
    handleDeleteReuse,
  } = feature;

  const hasMoreItems = itemsTotal !== null && itemsOffset < itemsTotal;

  return (
    <>
      <div className="w-full shrink-0 border-t border-border-border bg-background-white px-5 py-3">
        {!wizardOpen ? (
          <ButtonPrimary onClick={openCreateWizard} disabled={!siteId} icon={<PlusGlyph />}>
            Reuse image
          </ButtonPrimary>
        ) : (
          <div className="flex flex-col gap-2">
            {editingReuseId ? (
              hasMoreItems && (
                <ButtonSecondary
                  onClick={() => selectedCollectionId && loadItemsPage(selectedCollectionId, itemsOffset)}
                  disabled={itemsLoading}
                >
                  {itemsLoading ? "Loading..." : "Load more"}
                </ButtonSecondary>
              )
            ) : (
              <>
                {step === "collection" && (
                  <ButtonPrimary onClick={handleDetectCollections} disabled={busy} icon={<Icon name="magnifyingGlass" />}>
                    Detect collections
                  </ButtonPrimary>
                )}
                {step === "image" && hasMoreItems && (
                  <ButtonSecondary
                    onClick={() => selectedCollectionId && loadItemsPage(selectedCollectionId, itemsOffset)}
                    disabled={itemsLoading}
                  >
                    {itemsLoading ? "Loading..." : "Load more"}
                  </ButtonSecondary>
                )}
                {step === "target" && (
                  <ButtonPrimary onClick={handleMarkAndApply} disabled={busy}>
                    Mark as image target
                  </ButtonPrimary>
                )}
              </>
            )}
            <ButtonSecondary onClick={resetWizard} disabled={busy}>
              Cancel
            </ButtonSecondary>
          </div>
        )}
      </div>
      <ConfirmDeleteModal
        open={deletingReuseId !== null}
        onCancel={() => setDeletingReuseId(null)}
        onConfirm={() => {
          if (deletingReuseId) handleDeleteReuse(deletingReuseId);
        }}
        isDeleting={deleteBusy}
        title="Remove this reuse?"
        description="This only removes it from your list - the image already applied to that element stays as-is."
      />
    </>
  );
}
