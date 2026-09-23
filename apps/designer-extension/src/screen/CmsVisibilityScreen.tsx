import { useEffect, useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { ExpandableItemRow } from "../components/ExpandableItemRow";
import { SearchInput } from "../components/SearchInput";
import { useExtensionSize } from "../hooks/useExtensionSize";
import {
  discoverPageCollections,
  fetchCollectionVisibilityItems,
  saveCollectionItemVisibility,
  fetchCmsVisibilitySettings,
  saveCmsVisibilitySettings,
  type CmsCollectionSummary,
  type CmsVisibilityItem,
} from "../services/cmsGallery";
import { ApiRequestError } from "../services/apiClient";

const CMS_VISIBILITY_SIZE = { width: 320, height: 660 };
// Mirrors ManageGalleryImagesScreen.tsx's own PAGE_SIZE - a picker UI, not
// the request itself, which can still go up to the backend's real cap (100)
// if this were ever raised.
const PAGE_SIZE = 24;

// One collection's own loaded-so-far state - every discovered collection
// gets its own independent page/offset/error, same shape
// ManageGalleryImagesScreen.tsx tracks for its single config, just keyed by
// collectionId here since this screen manages several at once.
interface CollectionState {
  items: CmsVisibilityItem[];
  offset: number;
  total: number | null;
  loading: boolean;
  error: string | null;
}

function emptyCollectionState(): CollectionState {
  return { items: [], offset: 0, total: null, loading: false, error: null };
}

// "Handle CMS visibility" - the general-purpose sibling of "Manage images"
// (ManageGalleryImagesScreen.tsx): instead of one already-configured
// gallery's own Collection items, this discovers EVERY Collection List
// placed on the current Designer page (discoverPageCollections, zero
// backend round trip - same Designer-API discovery convention the wizard's
// own "collection" step already uses) and lists each one's real posts, with
// nothing more than a per-post "hide/show" toggle - no per-image controls,
// since this isn't scoped to any one multi-image field. Reuses
// ExpandableItemRow (the same accordion chrome "Manage images" uses) so the
// two screens read as one consistent pattern rather than two different
// takes on "a list of posts with something to toggle."
export function CmsVisibilityScreen({ siteId, onBack }: { siteId: string; onBack: () => void }) {
  useExtensionSize(CMS_VISIBILITY_SIZE);

  const [collections, setCollections] = useState<CmsCollectionSummary[] | null>(null);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [byCollection, setByCollection] = useState<Record<string, CollectionState>>({});
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Which item is mid-save right now (a plain slug is enough - two
  // collections could theoretically share an item slug, but only one row
  // can ever be mid-toggle at a time from a single click).
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The "Hide all posts?" master switch, above the search bar - see
  // data-client's db/app-schema.ts cmsSiteVisibilitySettings comment for
  // the override semantics. `null` while its own initial fetch is still in
  // flight so the switch doesn't flash "off" before the real value loads.
  const [hideAllPosts, setHideAllPosts] = useState<boolean | null>(null);
  const [hideAllBusy, setHideAllBusy] = useState(false);

  async function loadCollectionPage(collectionId: string, nextOffset: number) {
    setByCollection((prev) => ({
      ...prev,
      [collectionId]: { ...(prev[collectionId] ?? emptyCollectionState()), loading: true, error: null },
    }));
    try {
      const page = await fetchCollectionVisibilityItems(siteId, collectionId, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setByCollection((prev) => {
        const current = prev[collectionId] ?? emptyCollectionState();
        return {
          ...prev,
          [collectionId]: {
            items: nextOffset === 0 ? page.items : [...current.items, ...page.items],
            offset: nextOffset + page.items.length,
            total: page.pagination.total,
            loading: false,
            error: null,
          },
        };
      });
    } catch (err) {
      setByCollection((prev) => ({
        ...prev,
        [collectionId]: {
          ...(prev[collectionId] ?? emptyCollectionState()),
          loading: false,
          error: err instanceof ApiRequestError ? err.message : "Failed to load posts.",
        },
      }));
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const found = await discoverPageCollections();
        setCollections(found);
        // Eagerly loads every discovered collection's first page in
        // parallel, rather than lazily on expand - a page realistically has
        // a handful of Collection Lists, not hundreds, and eager loading is
        // what lets the search box below actually search across every
        // collection from the first keystroke instead of only the ones the
        // user happened to open already (the real limitation
        // ManageGalleryImagesScreen.tsx's own search still has, scoped to
        // one collection there so it never mattered as much).
        await Promise.all(found.map((c) => loadCollectionPage(c.collectionId, 0)));
      } catch (err) {
        setCollectionsError(
          err instanceof Error ? err.message : "Failed to read Collection Lists from this page.",
        );
      }
    })();
    // Independent of the collection discovery above - a real backend call,
    // not Designer-API discovery, so its own failure shouldn't block the
    // rest of this screen from rendering. Defaults to "off" on failure
    // (fails open to per-post settings, not a silent site-wide hide).
    (async () => {
      try {
        const settings = await fetchCmsVisibilitySettings(siteId);
        setHideAllPosts(settings.hideAllPosts);
      } catch {
        setHideAllPosts(false);
      }
    })();
    // Loads exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const query = search.trim().toLowerCase();

  // One filtered view per collection, plus whether that collection has any
  // match at all - a collection with zero matches under the current search
  // is dropped from the render entirely rather than showing an empty
  // section header with nothing under it.
  const visibleCollections = useMemo(() => {
    if (!collections) return [];
    return collections
      .map((collection) => {
        const state = byCollection[collection.collectionId] ?? emptyCollectionState();
        const items = query
          ? state.items.filter(
              (item) => item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query),
            )
          : state.items;
        return { collection, state, items };
      })
      .filter(({ items, state }) => items.length > 0 || (!query && (state.loading || state.error !== null)));
  }, [collections, byCollection, query]);

  async function handleToggleVisibility(collectionId: string, item: CmsVisibilityItem, hidden: boolean) {
    setSavingSlug(item.slug);
    setSaveError(null);
    try {
      await saveCollectionItemVisibility(siteId, collectionId, item.slug, hidden);
      setByCollection((prev) => {
        const current = prev[collectionId];
        if (!current) return prev;
        return {
          ...prev,
          [collectionId]: {
            ...current,
            items: current.items.map((it) => (it.slug === item.slug ? { ...it, hidden } : it)),
          },
        };
      });
    } catch (err) {
      setSaveError(err instanceof ApiRequestError ? err.message : "Failed to save this post's visibility.");
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleToggleHideAll(next: boolean) {
    const previous = hideAllPosts;
    setHideAllPosts(next); // optimistic - reverted below on a real failure
    setHideAllBusy(true);
    setSaveError(null);
    try {
      await saveCmsVisibilitySettings(siteId, next);
    } catch (err) {
      setHideAllPosts(previous);
      setSaveError(err instanceof ApiRequestError ? err.message : "Failed to save this setting.");
    } finally {
      setHideAllBusy(false);
    }
  }

  return (
    // h-screen (100vh), not h-full (100%) - same real bug documented in
    // ManageGalleryImagesScreen.tsx's own comment (and hit repeatedly
    // elsewhere in this app): h-full needs a definite-height ancestor
    // chain, which isn't guaranteed for a screen reached via a plain early
    // return like this one.
    <div className="flex h-screen min-h-0 w-full flex-col">
      <PanelHeader title="Handle CMS visibility" onClose={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background-white px-5 pb-6 pt-4">
        {/* Master switch - see handleToggleHideAll's own comment for the
            override semantics. Rendered once its initial fetch resolves
            (null while loading) so the switch never flashes "off" before
            the real saved value is known. */}
        {hideAllPosts !== null && (
          <div className="flex flex-col gap-1 border-b border-border-border pb-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-mobile-header-h1 text-text-black">Hide all posts?</span>
              <ToggleSwitch checked={hideAllPosts} disabled={hideAllBusy} onChange={handleToggleHideAll} />
            </div>
            <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
              Override individual post settings
            </p>
          </div>
        )}

        {/* Same search input ManageGalleryImagesScreen.tsx uses
            (SearchInput.tsx, extracted from that screen's own original
            one-off input) - reused verbatim, per explicit direction. */}
        <div className="border-b border-border-border pb-3">
          <SearchInput value={search} onChange={setSearch} />
        </div>

        {collectionsError && (
          <p className="font-sans text-mobile-text-sm-regular text-error-500">{collectionsError}</p>
        )}
        {saveError && <p className="font-sans text-mobile-text-sm-regular text-error-500">{saveError}</p>}

        {collections === null && !collectionsError && (
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
            Reading Collection Lists from this page...
          </p>
        )}
        {collections !== null && collections.length === 0 && !collectionsError && (
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
            No Collection Lists found on this page.
          </p>
        )}
        {collections !== null && collections.length > 0 && visibleCollections.length === 0 && (
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">
            No posts match &quot;{search.trim()}&quot;.
          </p>
        )}

        {visibleCollections.map(({ collection, state, items }) => {
          const hasMore = state.total !== null && state.offset < state.total;
          return (
            <div key={collection.collectionId} className="flex flex-col gap-2">
              <h3 className="font-sans text-mobile-header-h1 text-text-black">{collection.displayName}</h3>

              {state.error && (
                <p className="font-sans text-mobile-text-sm-regular text-error-500">{state.error}</p>
              )}
              {items.length === 0 && state.loading && (
                <p className="font-sans text-mobile-text-sm-regular text-text-secondary">Loading posts...</p>
              )}
              {items.length === 0 && !state.loading && !state.error && !query && (
                <p className="font-sans text-mobile-text-sm-regular text-text-secondary">No posts found.</p>
              )}

              {items.map((item) => {
                const expanded = expandedSlug === item.slug;
                // The "Hide all posts?" master switch overrides every
                // individual post's own setting while it's on (see
                // handleToggleHideAll's own comment) - reflecting that here
                // as a purely DERIVED value (never written back into
                // `item.hidden` itself) is what makes every post's own row
                // color and toggle "update based on the hide-all toggle",
                // per explicit direction, with nothing to re-sync by hand:
                // flip hideAllPosts back off and every row/toggle
                // immediately reads its own real stored value again.
                const effectiveHidden = hideAllPosts === true ? true : item.hidden;
                return (
                  <ExpandableItemRow
                    key={item.id}
                    title={
                      <>
                        {item.name}
                        {effectiveHidden && " (hidden)"}
                      </>
                    }
                    expanded={expanded}
                    onToggle={() => setExpandedSlug(expanded ? null : item.slug)}
                    // Inverted per explicit direction, same convention
                    // ManageGalleryImagesScreen.tsx now uses: a VISIBLE post
                    // gets the soft `#CABEF4`/50 accent, a hidden one falls
                    // back to the plain neutral background.
                    highlighted={!effectiveHidden}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-mobile-text-sm-regular text-text-black">
                        Hide this post
                      </span>
                      <ToggleSwitch
                        checked={effectiveHidden}
                        // Also disabled while the master switch is on -
                        // every post reads as hidden regardless of its own
                        // individual value then, so letting this be clicked
                        // would just be confusing (it would show unchecked
                        // for a moment with no real effect, since the
                        // master still overrides it).
                        disabled={savingSlug === item.slug || hideAllPosts === true}
                        onChange={(hidden) => handleToggleVisibility(collection.collectionId, item, hidden)}
                      />
                    </div>
                  </ExpandableItemRow>
                );
              })}

              {!query && hasMore && (
                <ButtonSecondary
                  onClick={() => loadCollectionPage(collection.collectionId, state.offset)}
                  disabled={state.loading}
                >
                  {state.loading ? "Loading..." : "Load more"}
                </ButtonSecondary>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
