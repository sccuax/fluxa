// "Blog to staging" v2 runtime - the real logic behind the tiny loader
// routes/blogStaging.ts registers as the site's Custom Code (see
// buildBlogStagingLoaderSource there). Served from this Worker
// (routes/publicBlogStaging.ts, GET /:siteId/v2/runtime.js) instead of living
// inside the registered script itself, so changing this logic never needs
// another Webflow publish - Webflow only ships registered Custom Code on a
// real, whole-site publish (there's no partial publish), so the loader is
// installed once and everything here updates with a plain Worker deploy.
//
// On a live (non-*.webflow.io) domain, a post marked "staging only":
// - its own detail page (/collection/slug) is replaced with "Page not found";
// - every rendered Collection Item for it, on any page, is hidden - matched
//   by the Multi-image gallery's own Slug mark if present, else by the
//   item's link to its own detail page (Webflow renders no slug on an item
//   otherwise). An item with neither can't be identified and stays visible.
// The staging-only slug list is fetched fresh (no-store) on every page load,
// so a toggle in the extension shows up on the next reload, no publish.
// Known limitation: slugs are site-wide here (a rendered list item doesn't
// expose its collection), so a staging-only slug also hides a same-slug item
// from a different collection.
export function buildBlogStagingRuntime(publicBaseUrl: string, siteId: string): string {
  return `(function () {
  if (/\\.webflow\\.io$/.test(location.hostname)) return;
  var SLUGS_URL = ${JSON.stringify(`${publicBaseUrl}/api/public/blog-staging/${siteId}/v2/slugs`)};
  var HIDDEN_ATTR = "data-fluxa-staging-hidden";

  function segments(path) {
    return path.split("/").filter(Boolean);
  }

  // Only a 2+ segment path (/collection/slug) can be a CMS template page -
  // keeps a static page that happens to share a slug's name (/about) safe.
  function detailSlug(path) {
    var parts = segments(path);
    return parts.length >= 2 ? parts[parts.length - 1] : null;
  }

  function itemSlug(item, set) {
    var mark = item.querySelector("[data-fluxa-gallery-slug]");
    var marked = mark ? mark.textContent.trim() : "";
    if (marked && set[marked]) return marked;
    var links = item.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var url;
      try { url = new URL(links[i].getAttribute("href"), location.href); } catch (e) { continue; }
      if (url.hostname !== location.hostname) continue;
      var slug = detailSlug(url.pathname);
      if (slug && set[slug]) return slug;
    }
    return null;
  }

  function run(slugs) {
    var set = {};
    for (var i = 0; i < slugs.length; i++) set[slugs[i]] = true;

    var current = detailSlug(location.pathname);
    if (current && set[current]) {
      document.title = "Page not found";
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:20px;color:#333">Page not found</div>';
      return;
    }

    function scan() {
      var items = document.querySelectorAll(".w-dyn-item:not([" + HIDDEN_ATTR + "])");
      for (var j = 0; j < items.length; j++) {
        if (itemSlug(items[j], set)) {
          items[j].style.display = "none";
          items[j].setAttribute(HIDDEN_ATTR, "true");
        }
      }
    }

    scan();
    // Catches items rendered after load (pagination / "load more" scripts).
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; scan(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    fetch(SLUGS_URL, { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.slugs && data.slugs.length) run(data.slugs);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
`;
}
