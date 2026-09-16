import { useEffect, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import { ButtonPrimary } from "../components/ButtonPrimary";
import { ButtonSecondary } from "../components/ButtonSecondary";
import { Icon } from "../components/Icon";
import { ToggleSwitch } from "../components/ToggleSwitch";
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
// unsaved - drives the per-item Save button's disabled state, since saving
// happens per item, not as one bulk submit for the whole picker.
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
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

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

  async function handleSave(item: GalleryPickerItem) {
    const draft = drafts[item.slug];
    if (!draft) return;
    setSavingSlug(item.slug);
    setError(null);
    try {
      const hiddenImageIds = Array.from(draft.hiddenImageIds);
      await saveGalleryItemOverride(siteId, config.id, item.slug, { hidden: draft.hidden, hiddenImageIds });
      setItems((prev) =>
        prev.map((it) => (it.slug === item.slug ? { ...it, hidden: draft.hidden, hiddenImageIds } : it)),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save this post.");
    } finally {
      setSavingSlug(null);
    }
  }

  const hasMore = total !== null && offset < total;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PanelHeader title="Manage images" onClose={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background-white px-5 pb-6 pt-4">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search loaded posts..."
          className="w-full rounded-4 border border-border-border bg-background-white px-3 py-2 font-sans text-mobile-text-sm-regular text-text-black outline-none focus:border-accent-500"
        />

        {error && <p className="font-sans text-mobile-text-sm-regular text-error-500">{error}</p>}

        {items.length === 0 && loading && (
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">Loading posts...</p>
        )}
        {items.length === 0 && !loading && !error && (
          <p className="font-sans text-mobile-text-sm-regular text-text-secondary">No posts found.</p>
        )}

        {filtered.map((item) => {
          const draft = drafts[item.slug] ?? draftFrom(item);
          const dirty = !draftsEqual(draft, draftFrom(item));
          const expanded = expandedSlug === item.slug;
          return (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-4 border border-border-border bg-background-white-2 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => setExpandedSlug(expanded ? null : item.slug)}
                className="flex items-center justify-between gap-2 text-left"
              >
                <span className="min-w-0 truncate font-sans text-mobile-text-sm-regular text-text-black">
                  {item.name}
                  {draft.hidden && " (hidden)"}
                </span>
                <span className="flex shrink-0 items-center gap-2 font-sans text-mobile-text-sm-regular text-text-secondary">
                  {item.images.length} image{item.images.length === 1 ? "" : "s"}
                  <Icon
                    name="chevronDown"
                    className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {expanded && (
                <div className="flex flex-col gap-3 border-t border-border-border pt-2">
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

                  <ButtonPrimary onClick={() => handleSave(item)} disabled={!dirty || savingSlug === item.slug}>
                    {savingSlug === item.slug ? "Saving..." : "Save"}
                  </ButtonPrimary>
                </div>
              )}
            </div>
          );
        })}

        {hasMore && (
          <ButtonSecondary onClick={() => loadPage(offset)} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </ButtonSecondary>
        )}
      </div>
    </div>
  );
}
