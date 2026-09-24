import { useState } from "react";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { Icon } from "../components/Icon";
import { ExpandableItemRow } from "../components/ExpandableItemRow";
import { PillDropdown } from "../components/PillDropdown";
import { SearchInput } from "../components/SearchInput";
import { UnmaskReveal } from "../components/UnmaskReveal";
import { WizardStepIndicator } from "../components/WizardStepIndicator";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { fetchSiteCollections, type CmsSiteCollection } from "../services/cmsGallery";
import {
  fetchBlogStagingItems,
  saveItemStaging,
  saveAllItemsStaging,
  saveItemPublishState,
  fetchBlogStagingScriptStatus,
  type BlogStagingItem,
} from "../services/blogStaging";
import { ApiRequestError } from "../services/apiClient";

// "Blog to staging" (Webflow Solutions feature #4) - a NEW screen, same
// hook + two-presentational-views shape as CmsImagesScreen.tsx (see that
// file's own top comment for why: WebflowSolutionsScreen.tsx's shared
// scrollable-content/fixed-footer slots need the same state in both
// places). Two real, DIFFERENT mechanisms live behind its two per-post
// toggles - see services/blogStaging.ts's own top comment:
// - "Preview in staging" is Fluxa's own enforcement (a site-wide script,
//   installed lazily on first use - see routes/blogStaging.ts).
// - "Publish your draft post" is a direct, real Webflow CMS API call.
//
// Only 2 real wizard steps (collection, posts) - per explicit direction,
// this collapses CmsImagesScreen's own separate "detect" then "pick"
// steps into ONE step here (the box swaps from the detect animation to the
// picker dropdown in place, without advancing the step dots) - the real
// step-2 advance only happens once a collection is actually picked.
type BlogStagingStep = "collection" | "posts";
const BLOG_STAGING_STEPS: BlogStagingStep[] = ["collection", "posts"];

const PAGE_SIZE = 24;

export function useBlogStagingFeature(siteId: string | null) {
  const [step, setStep] = useState<BlogStagingStep>("collection");
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CmsSiteCollection[] | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const [items, setItems] = useState<BlogStagingItem[]>([]);
  const [itemsOffset, setItemsOffset] = useState(0);
  const [itemsTotal, setItemsTotal] = useState<number | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [allStagingBusy, setAllStagingBusy] = useState(false);

  // In-panel "Remember to publish your domains" message (replaced a one-off
  // Designer toast, which rendered outside this panel and was easy to miss).
  // Shown only while the backend says the site's staging script was
  // installed/updated after its last publish - toggles themselves never
  // need a publish (the live script reads their state on every page load).
  // Re-checked on entering the posts step and after every staging save; a
  // failed check just hides the message rather than surfacing an error.
  const [publishNeeded, setPublishNeeded] = useState(false);
  async function refreshScriptStatus() {
    if (!siteId) return;
    try {
      const status = await fetchBlogStagingScriptStatus(siteId);
      setPublishNeeded(status.publishNeeded);
    } catch {
      setPublishNeeded(false);
    }
  }

  async function handleDetectCollections() {
    if (!siteId) return;
    setBusy(true);
    setStepError(null);
    try {
      const found = await fetchSiteCollections(siteId);
      setCollections(found);
    } catch (err) {
      setStepError(err instanceof ApiRequestError ? err.message : "Failed to load your collections.");
    } finally {
      setBusy(false);
    }
  }

  async function loadItemsPage(collectionId: string, nextOffset: number) {
    if (!siteId) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const page = await fetchBlogStagingItems(siteId, collectionId, { limit: PAGE_SIZE, offset: nextOffset });
      setItems((prev) => (nextOffset === 0 ? page.items : [...prev, ...page.items]));
      setItemsOffset(nextOffset + page.items.length);
      setItemsTotal(page.pagination.total);
    } catch (err) {
      setItemsError(err instanceof ApiRequestError ? err.message : "Failed to load posts.");
    } finally {
      setItemsLoading(false);
    }
  }

  function handlePickCollection(collectionId: string) {
    setSelectedCollectionId(collectionId);
    setStep("posts");
    setItems([]);
    setItemsOffset(0);
    setItemsTotal(null);
    loadItemsPage(collectionId, 0);
    refreshScriptStatus();
  }

  function changeCollection() {
    setStep("collection");
    setSelectedCollectionId(null);
    setItems([]);
    setItemsOffset(0);
    setItemsTotal(null);
    setExpandedSlug(null);
    setSearch("");
  }

  async function handleToggleStaging(item: BlogStagingItem, stagingOnly: boolean) {
    if (!siteId || !selectedCollectionId) return;
    setSavingSlug(item.slug);
    setItemsError(null);
    try {
      await saveItemStaging(siteId, selectedCollectionId, item.slug, stagingOnly);
      setItems((prev) => prev.map((it) => (it.slug === item.slug ? { ...it, stagingOnly } : it)));
      refreshScriptStatus();
    } catch (err) {
      setItemsError(err instanceof ApiRequestError ? err.message : "Failed to save this post.");
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleTogglePublish(item: BlogStagingItem, publish: boolean) {
    if (!siteId || !selectedCollectionId) return;
    setSavingSlug(item.slug);
    setItemsError(null);
    try {
      const result = await saveItemPublishState(siteId, selectedCollectionId, item.id, publish);
      // A publish ships the item's current content, so any pending edits
      // are live now too.
      setItems((prev) =>
        prev.map((it) =>
          it.slug === item.slug
            ? { ...it, isDraft: result.isDraft, hasUnpublishedChanges: publish ? false : it.hasUnpublishedChanges }
            : it,
        ),
      );
    } catch (err) {
      setItemsError(err instanceof ApiRequestError ? err.message : "Failed to publish this post.");
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleToggleAllStaging(stagingOnly: boolean) {
    if (!siteId || !selectedCollectionId || items.length === 0) return;
    setAllStagingBusy(true);
    setItemsError(null);
    try {
      const slugs = items.map((item) => item.slug);
      await saveAllItemsStaging(siteId, selectedCollectionId, stagingOnly, slugs);
      setItems((prev) => prev.map((it) => ({ ...it, stagingOnly })));
      refreshScriptStatus();
    } catch (err) {
      setItemsError(err instanceof ApiRequestError ? err.message : "Failed to save this setting.");
    } finally {
      setAllStagingBusy(false);
    }
  }

  const query = search.trim().toLowerCase();
  const filteredItems = query
    ? items.filter((item) => item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query))
    : items;
  const allStaging = items.length > 0 && items.every((item) => item.stagingOnly);
  const hasMoreItems = itemsTotal !== null && itemsOffset < itemsTotal;

  return {
    siteId,
    step,
    busy,
    stepError,
    collections,
    selectedCollectionId,
    items,
    filteredItems,
    itemsLoading,
    itemsError,
    expandedSlug,
    setExpandedSlug,
    search,
    setSearch,
    savingSlug,
    allStagingBusy,
    allStaging,
    publishNeeded,
    hasMoreItems,
    itemsOffset,
    handleDetectCollections,
    handlePickCollection,
    changeCollection,
    handleToggleStaging,
    handleTogglePublish,
    handleToggleAllStaging,
    loadItemsPage,
  };
}

export type BlogStagingFeature = ReturnType<typeof useBlogStagingFeature>;

export function BlogToStagingContent({ feature }: { feature: BlogStagingFeature }) {
  const {
    step,
    busy,
    stepError,
    collections,
    items,
    filteredItems,
    itemsLoading,
    itemsError,
    expandedSlug,
    setExpandedSlug,
    search,
    setSearch,
    savingSlug,
    allStagingBusy,
    allStaging,
    publishNeeded,
    handlePickCollection,
    handleToggleStaging,
    handleTogglePublish,
    handleToggleAllStaging,
  } = feature;

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-mobile-display-d1 text-text-black">Blog to staging</h2>
        <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
          Publish your blog posts and choose which ones show in Staging.
        </p>
      </div>

      {step === "collection" && (
        <div className="flex flex-col gap-4">
          {/* Stacked, full-width 2-step checklist (WizardStepIndicator's
              `renderLabel` layout - see that component's own top comment for
              why: the previous side-by-side layout's connecting line
              stretched to match the content box's height below, reading as
              "the two dots are way too far apart" - fixed per a supplied
              reference screenshot). Each step gets its own label, current
              step in black, the upcoming one dimmed. */}
          <WizardStepIndicator
            steps={BLOG_STAGING_STEPS}
            currentStep={step}
            orientation="vertical"
            renderLabel={(s) => (
              <p
                className={`font-sans text-mobile-header-h2 ${
                  s === step ? "text-text-black" : "text-text-secondary"
                }`}
              >
                {s === "collection"
                  ? collections === null
                    ? "Click Detect to load every collection in your CMS."
                    : "Pick the collection with the posts you want to manage."
                  : "Choose which posts stay in staging and which go live."}
              </p>
            )}
          />
          {stepError && <p className="font-sans text-mobile-text-sm-regular text-error-500">{stepError}</p>}
          <div className="relative min-h-[160px] overflow-hidden rounded-4 bg-background-white-2 p-4">
            {collections === null ? (
              <UnmaskReveal />
            ) : collections.length === 0 ? (
              <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
                No collections found in this site.
              </p>
            ) : (
              <PillDropdown
                options={collections.map((collection) => ({ key: collection.id, displayName: collection.displayName }))}
                onSelect={handlePickCollection}
                disabled={busy}
                placeholder="Select a collection"
                icon="collection"
              />
            )}
          </div>
        </div>
      )}

      {step === "posts" && (
        <>
          {publishNeeded && (
            <p className="rounded-4 border border-accent-500/50 bg-accent-50 px-3 py-2 font-sans text-mobile-text-sm-regular text-accent-500">
              Remember to publish your domains to see the applied changes.
            </p>
          )}

          {/* "All posts to staging?" master switch - a real bulk write
              across every currently-loaded item (see the hook's own
              handleToggleAllStaging comment for why this isn't a derived
              override the way CmsVisibilityScreen's own "Hide all posts?"
              is). Same pb-3/border-bottom block shape as that screen's own
              master switch. */}
          <div className="flex flex-col gap-1 border-b border-border-border pb-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-mobile-header-h1 text-text-black">All posts to staging?</span>
              <ToggleSwitch checked={allStaging} disabled={allStagingBusy || items.length === 0} onChange={handleToggleAllStaging} />
            </div>
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
              Override individual post settings
            </p>
          </div>

          <div className="border-b border-border-border pb-3">
            <SearchInput value={search} onChange={setSearch} />
          </div>

          {itemsError && <p className="font-sans text-mobile-text-sm-regular text-error-500">{itemsError}</p>}

          {items.length === 0 && itemsLoading && (
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">Loading posts...</p>
          )}
          {items.length === 0 && !itemsLoading && !itemsError && (
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">No posts found.</p>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
              No posts match &quot;{search.trim()}&quot;.
            </p>
          )}

          {filteredItems.map((item) => {
            const expanded = expandedSlug === item.slug;
            return (
              <ExpandableItemRow
                key={item.id}
                title={
                  <>
                    {item.name}
                    {item.isDraft && " (draft)"}
                    {item.hasUnpublishedChanges && " (unpublished changes)"}
                    {item.stagingOnly && " (staging only)"}
                  </>
                }
                expanded={expanded}
                onToggle={() => setExpandedSlug(expanded ? null : item.slug)}
                // Same inverted convention Manage/CmsVisibility use: the
                // NORMAL (fully live, not staging-restricted) state reads
                // as the "active" soft-purple row; a staging-only post
                // falls back to the plain neutral background.
                highlighted={!item.stagingOnly}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-mobile-text-sm-regular text-text-black">
                    Preview your post in staging without publishing it to your live site.
                  </span>
                  <ToggleSwitch
                    checked={item.stagingOnly}
                    disabled={savingSlug === item.slug}
                    onChange={(value) => handleToggleStaging(item, value)}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-mobile-text-sm-regular text-text-black">
                    Publish your draft post.
                  </span>
                  <ToggleSwitch
                    checked={!item.isDraft}
                    disabled={savingSlug === item.slug}
                    onChange={(value) => handleTogglePublish(item, value)}
                  />
                </div>
                {/* "Publish your draft post" only publishes at the moment
                    it's switched on - later edits sit unpublished until the
                    item is published again. This republishes just this item
                    (same publish-state call as the toggle), no site publish. */}
                {item.hasUnpublishedChanges && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-mobile-text-sm-regular text-text-black">
                      This post has changes that aren&apos;t live yet.
                    </span>
                    <ButtonSecondary
                      fullWidth={false}
                      disabled={savingSlug === item.slug}
                      onClick={() => handleTogglePublish(item, true)}
                    >
                      Publish changes
                    </ButtonSecondary>
                  </div>
                )}
              </ExpandableItemRow>
            );
          })}
        </>
      )}
    </>
  );
}

export function BlogToStagingFooter({ feature }: { feature: BlogStagingFeature }) {
  const { step, busy, siteId, collections, hasMoreItems, itemsOffset, itemsLoading, selectedCollectionId } = feature;
  const { handleDetectCollections, changeCollection, loadItemsPage } = feature;

  return (
    <div className="w-full shrink-0 border-t border-border-border bg-background-white px-5 py-3">
      {step === "collection" && collections === null && (
        <ButtonPrimary onClick={handleDetectCollections} disabled={!siteId || busy} icon={<Icon name="magnifyingGlass" />}>
          Detect collections
        </ButtonPrimary>
      )}
      {step === "posts" && (
        <div className="flex flex-col gap-2">
          {hasMoreItems && (
            <ButtonSecondary
              onClick={() => selectedCollectionId && loadItemsPage(selectedCollectionId, itemsOffset)}
              disabled={itemsLoading}
            >
              {itemsLoading ? "Loading..." : "Load more"}
            </ButtonSecondary>
          )}
          <ButtonSecondary onClick={changeCollection}>Change collection</ButtonSecondary>
        </div>
      )}
    </div>
  );
}
