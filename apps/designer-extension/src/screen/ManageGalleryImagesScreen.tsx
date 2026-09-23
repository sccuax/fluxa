import { useEffect, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { Icon } from "../components/Icon";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { ExpandableItemRow } from "../components/ExpandableItemRow";
import { SearchInput } from "../components/SearchInput";
import { useExtensionSize } from "../hooks/useExtensionSize";
import {
  fetchGalleryItems,
  saveGalleryItemOverride,
  type CmsGalleryConfig,
  type GalleryPickerItem,
} from "../services/cmsGallery";
import { ApiRequestError } from "../services/apiClient";

const MANAGE_IMAGES_SIZE = { width: 320, height: 660 };
// Mirrors data-client's own listItemsQuerySchema max (100) but a smaller
// page keeps a single "Load more" click's thumbnail grid rendering cheap -
// this is a picker UI, not the paginated request itself, which can still
// go up to 100 if this were ever raised.
const PAGE_SIZE = 24;

// One item's locally-edited override state, diffed against the server's
// own last-known value (draftFrom(item)) to know whether there's anything
// unsaved - drives the single bottom "Save changes" button's disabled
// state (see handleSaveAll below - saving is one bulk submit for every
// dirty item at once now, not a Save button per item).
interface ItemDraft {
  hidden: boolean;
  hiddenImageIds: Set<string>;
}

function draftFrom(item: GalleryPickerItem): ItemDraft {
  return { hidden: item.hidden, hiddenImageIds: new Set(item.hiddenImageIds) };
}

function draftsEqual(a: ItemDraft, b: ItemDraft): boolean {
  if (a.hidden !== b.hidden) return false;
  if (a.hiddenImageIds.size !== b.hiddenImageIds.size) return false;
  for (const id of a.hiddenImageIds) {
    if (!b.hiddenImageIds.has(id)) return false;
  }
  return true;
}

// The "which images/posts actually show in the carousel" picker - one page
// of the config's real Collection items at a time (fetchGalleryItems mirrors
// Webflow's own limit/offset pagination rather than aggregating a whole
// collection server-side, see routes/cmsGallery.ts's own comment), each
// expandable to a thumbnail grid where individual images toggle hidden, plus
// a per-item "hide this post entirely" switch. Search filters only the
// pages already loaded (client-side substring match) - Webflow's own List
// Items API only supports an exact-name filter, not substring, so a real
// search-as-you-type isn't possible without loading further pages first.
//
// One bottom "Save changes" button commits every dirty item at once
// (handleSaveAll) - per explicit direction/reference screenshot
// (copy-paste/Screenshot 2026-09-21 183903.png), replacing an earlier
// per-item Save button inside each row's own expanded panel. A single
// fixed footer (same pattern as WebflowSolutionsScreen.tsx's own wizard
// footer / EditorTab.tsx's "Apply gradient") is both more scalable (works
// the same whether one or fifty items are dirty at once) and reads as one
// deliberate save action rather than N small ones scattered through a
// scrolling list.
export function ManageGalleryImagesScreen({ siteId, config, onBack }: {
  siteId: string;
  config: CmsGalleryConfig;
  onBack: () => void;
}) {
  useExtensionSize(MANAGE_IMAGES_SIZE);

  const [items, setItems] = useState<GalleryPickerItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  async function loadPage(nextOffset: number) {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchGalleryItems(siteId, config.id, { limit: PAGE_SIZE, offset: nextOffset });
      setItems((prev) => (nextOffset === 0 ? page.items : [...prev, ...page.items]));
      setDrafts((prev) => {
        const next = { ...prev };
        for (const item of page.items) next[item.slug] = draftFrom(item);
        return next;
      });
      setOffset(nextOffset + page.items.length);
      setTotal(page.pagination.total);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage(0);
    // Loads exactly once on mount - `loadPage` closes over state setters
    // only, not over anything that should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? items.filter(
        (item) => item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query),
      )
    : items;

  function updateDraft(slug: string, updater: (draft: ItemDraft) => ItemDraft) {
    setDrafts((prev) => {
      const current = prev[slug];
      if (!current) return prev;
      return { ...prev, [slug]: updater(current) };
    });
  }

  // Saves one item's draft and folds the result back into `items` on
  // success - returns whether it succeeded rather than throwing, so
  // handleSaveAll below can run every dirty item in parallel and still
  // report one clean aggregate outcome instead of an unhandled rejection
  // from whichever one happens to fail first.
  async function saveOne(item: GalleryPickerItem): Promise<boolean> {
    const draft = drafts[item.slug];
    if (!draft) return true;
    try {
      const hiddenImageIds = Array.from(draft.hiddenImageIds);
      await saveGalleryItemOverride(siteId, config.id, item.slug, { hidden: draft.hidden, hiddenImageIds });
      setItems((prev) =>
        prev.map((it) => (it.slug === item.slug ? { ...it, hidden: draft.hidden, hiddenImageIds } : it)),
      );
      return true;
    } catch {
      return false;
    }
  }

  const dirtyItems = items.filter((item) => !draftsEqual(drafts[item.slug] ?? draftFrom(item), draftFrom(item)));

  async function handleSaveAll() {
    if (dirtyItems.length === 0) return;
    setSavingAll(true);
    setError(null);
    try {
      const results = await Promise.all(dirtyItems.map(saveOne));
      const failedCount = results.filter((ok) => !ok).length;
      if (failedCount > 0) {
        setError(
          `Failed to save ${failedCount} post${failedCount === 1 ? "" : "s"} - check your connection and try again.`,
        );
      }
    } finally {
      setSavingAll(false);
    }
  }

  const hasMore = total !== null && offset < total;

  return (
    // h-screen (100vh), not h-full (100%) - same real bug this app has hit
    // repeatedly elsewhere (ServicesScreen.tsx, DashboardScreen.tsx,
    // SignInScreen.tsx, ...): h-full needs a definite-height ancestor chain
    // all the way up, which isn't guaranteed for a screen reached via a
    // plain early return like this one - it silently collapsed to this
    // screen's own CONTENT height instead of the real panel height, which
    // is exactly why the bottom "Save changes" footer below wasn't staying
    // anchored to the panel's true bottom edge. h-screen reads the iframe's
    // own viewport height directly regardless of that chain.
    <div className="flex h-screen min-h-0 w-full flex-col">
      <PanelHeader title="Manage images" onClose={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background-white px-5 pb-6 pt-4">
        <SearchInput value={search} onChange={setSearch} />

        {error && <p className="font-sans text-mobile-text-sm-regular text-error-500">{error}</p>}

        {items.length === 0 && loading && (
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">Loading posts...</p>
        )}
        {items.length === 0 && !loading && !error && (
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">No posts found.</p>
        )}

        {filtered.map((item) => {
          const draft = drafts[item.slug] ?? draftFrom(item);
          const expanded = expandedSlug === item.slug;
          // Flags a post's own row the moment it (or any one of its images)
          // is hidden - reads off the live draft, not the last-saved
          // `item`, so toggling inside the expanded panel below updates
          // this immediately rather than only after a Save.
          const hasHiddenContent = draft.hidden || draft.hiddenImageIds.size > 0;
          return (
            <ExpandableItemRow
              key={item.id}
              title={
                <>
                  {item.name}
                  {draft.hidden && " (hidden)"}
                </>
              }
              meta={`${item.images.length} image${item.images.length === 1 ? "" : "s"}`}
              expanded={expanded}
              onToggle={() => setExpandedSlug(expanded ? null : item.slug)}
              // Inverted per explicit direction: a VISIBLE post is the one
              // that reads as "active" (the soft `#CABEF4`/50 this app uses
              // for an active/highlighted row elsewhere -
              // WebflowSolutionsScreen.tsx's own gallery-card menu-open
              // state), while a hidden one falls back to the plain neutral
              // background - the opposite of this row's own original
              // "flag what's hidden" convention.
              highlighted={!hasHiddenContent}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-mobile-text-sm-regular text-text-black">
                  Hide this post&apos;s gallery entirely
                </span>
                <ToggleSwitch
                  checked={draft.hidden}
                  onChange={(hidden) => updateDraft(item.slug, (d) => ({ ...d, hidden }))}
                />
              </div>

              {!draft.hidden && item.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {item.images.map((image, index) => {
                    const key = image.fileId ?? `${item.slug}-${index}`;
                    const isHidden = image.fileId !== null && draft.hiddenImageIds.has(image.fileId);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={image.fileId === null}
                        title={image.fileId === null ? "Can't be hidden individually" : undefined}
                        onClick={() =>
                          updateDraft(item.slug, (d) => {
                            if (image.fileId === null) return d;
                            const next = new Set(d.hiddenImageIds);
                            if (next.has(image.fileId)) next.delete(image.fileId);
                            else next.add(image.fileId);
                            return { ...d, hiddenImageIds: next };
                          })
                        }
                        className="relative aspect-square overflow-hidden rounded-4 border border-border-border disabled:opacity-50"
                      >
                        <img src={image.url} alt={image.alt ?? ""} className="h-full w-full object-cover" />
                        {isHidden && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <Icon name="eyeOff" className="text-text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ExpandableItemRow>
          );
        })}

        {hasMore && (
          <ButtonSecondary onClick={() => loadPage(offset)} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </ButtonSecondary>
        )}
      </div>

      {/* One fixed footer for the whole picker, same shrink-0/border-t
          pattern as WebflowSolutionsScreen.tsx's own wizard footer /
          EditorTab.tsx's "Apply gradient" - replaces the old per-item Save
          button that used to live inside each row's own expanded panel
          (see handleSaveAll's own comment for why). Disabled whenever
          there's nothing dirty across ANY loaded item, not just the
          currently search-filtered ones - search is a display filter here,
          not a save scope. */}
      <div className="w-full shrink-0 border-t border-border-border bg-background-white px-5 py-3">
        <ButtonPrimary onClick={handleSaveAll} disabled={dirtyItems.length === 0 || savingAll}>
          {savingAll ? "Saving..." : "Save changes"}
        </ButtonPrimary>
      </div>
    </div>
  );
}
