// The Multi-image CMS gallery's real published-site logic, served from this
// Worker (routes/publicCmsGallery.ts, GET /runtime.js) since 2026-09-23. The
// site's own HtmlEmbed (designer-extension services/cmsGalleryEmbedScript.ts)
// is just a <script src> loader pointing here - same reasoning as
// lib/blogStagingRuntime.ts: code baked into the embed only changes when the
// customer re-installs AND publishes, so a fix to this logic used to be
// stuck until they did (a real case: a staging-only bug wiped a whole
// section on plugin-proof.webflow.io and needed both steps to clear). Now a
// Worker deploy reaches every site within the route's cache window.
//
// Moved verbatim from the old inline embed (see that file's history for the
// full per-behaviour notes): one pass over every GALLERY_TARGET_ATTR element
// on the page, each resolved to its Collection Item's slug via the
// SLUG_ATTR-marked element in the same ".w-dyn-item", images fetched from
// routes/publicCmsGallery.ts, a hand-rolled carousel mounted INSIDE the target
// (never replacing/resizing it - its size/position stay the Designer's).
// Attribute names and DEFAULT_SETTINGS are kept in sync by hand with
// designer-extension services/cmsGallery.ts and schema/cmsGallery.ts here.
export function buildCmsGalleryRuntime(publicBaseUrl: string): string {
  return `
(function () {
  var API_BASE = ${JSON.stringify(publicBaseUrl)};
  var SLUG_ATTR = "data-fluxa-gallery-slug";
  var TARGET_ATTR = "data-fluxa-gallery-target";
  var CONFIG_ATTR = "data-fluxa-gallery-config";

  // Defaults mirror cmsGallerySettingsSchema (apps/data-client's
  // schema/cmsGallery.ts) - kept in sync by hand, same as
  // gradientEmbedScript.ts's own adaptivePixelDensity formula, since this
  // plain classic script can't import the workspace package.
  var DEFAULT_SETTINGS = {
    showArrows: true,
    showDots: true,
    autoplay: true,
    autoplayIntervalMs: 5000,
    objectFit: "cover",
  };

  // Mounts directly INTO 'target' - never sets target.style.position/width/
  // height/overflow anywhere in here (see this file's own top comment).
  // Every style set below belongs to a child element this script itself
  // creates (the img, the arrow buttons, the dots row), never to 'target'.
  // Setup problems (no Slug-marked element, a slug that matches no item, a
  // gallery deleted in Fluxa) used to leave the target silently empty with
  // no hint why - a real support case, 2026-09-23. They're spelled out
  // in-page on Webflow's own staging domain only (the customer's preview);
  // a live custom domain only gets a console warning, never debug copy
  // shown to real visitors. Same *.webflow.io check as data-client's
  // blogStaging.ts enforcement script.
  var IS_STAGING = /\\.webflow\\.io$/.test(location.hostname);

  function showNotice(target, text) {
    while (target.firstChild) target.removeChild(target.firstChild);
    target.style.display = "flex";
    target.style.alignItems = "center";
    target.style.justifyContent = "center";
    target.style.color = "#999";
    target.style.fontSize = "12px";
    target.style.textAlign = "center";
    target.style.padding = "8px";
    target.textContent = text;
  }

  // showNotice clears the target, so the in-page notice is only ever shown
  // in a target that holds no real page content - a real bug (2026-09-23):
  // a whole section carrying a stale target mark (outside any Collection
  // Item) got wiped on staging, Collection Lists and all.
  function reportSetupProblem(target, text) {
    console.warn("Fluxa CMS gallery: " + text);
    if (IS_STAGING && !target.querySelector(".w-dyn-list, .w-dyn-item, [data-fluxa-cms-gallery-runtime]")) {
      showNotice(target, "Fluxa: " + text);
    }
  }

  function buildCarousel(target, images, settings) {
    while (target.firstChild) target.removeChild(target.firstChild);

    if (!images.length) {
      showNotice(target, "Fluxa: no images found for this item");
      return;
    }

    var index = 0;
    var dots = [];
    var img = document.createElement("img");
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = settings.objectFit;
    img.style.display = "block";
    img.src = images[0].url;
    img.alt = images[0].alt || "";
    target.appendChild(img);

    function show(i) {
      index = (i + images.length) % images.length;
      img.src = images[index].url;
      img.alt = images[index].alt || "";
      for (var d = 0; d < dots.length; d++) {
        dots[d].style.opacity = d === index ? "1" : "0.5";
      }
    }

    if (images.length > 1) {
      if (settings.showArrows) {
        var prev = document.createElement("button");
        prev.type = "button";
        prev.textContent = "\\u2039";
        prev.setAttribute("aria-label", "Previous image");
        prev.style.cssText =
          "position:absolute;top:50%;left:10px;transform:translateY(-50%);" +
          "width:28px;height:28px;border-radius:50%;border:none;" +
          "background:rgba(0,0,0,0.5);color:#fff;cursor:pointer;font-size:16px;line-height:1;padding:0;";
        prev.onclick = function () { show(index - 1); };
        target.appendChild(prev);

        var next = document.createElement("button");
        next.type = "button";
        next.textContent = "\\u203a";
        next.setAttribute("aria-label", "Next image");
        next.style.cssText =
          "position:absolute;top:50%;right:10px;transform:translateY(-50%);" +
          "width:28px;height:28px;border-radius:50%;border:none;" +
          "background:rgba(0,0,0,0.5);color:#fff;cursor:pointer;font-size:16px;line-height:1;padding:0;";
        next.onclick = function () { show(index + 1); };
        target.appendChild(next);
      }

      if (settings.showDots) {
        var dotsRow = document.createElement("div");
        dotsRow.style.cssText =
          "position:absolute;bottom:8px;left:0;right:0;display:flex;justify-content:center;gap:6px;";
        for (var i = 0; i < images.length; i++) {
          var dot = document.createElement("span");
          dot.style.cssText = "width:6px;height:6px;border-radius:50%;background:#fff;opacity:0.5;";
          dotsRow.appendChild(dot);
          dots.push(dot);
        }
        target.appendChild(dotsRow);
        dots[0].style.opacity = "1";
      }

      if (settings.autoplay) {
        setInterval(function () { show(index + 1); }, settings.autoplayIntervalMs);
      }
    }
  }

  function mount(target) {
    var configId = target.getAttribute(CONFIG_ATTR);
    var item = target.closest(".w-dyn-item");
    var slugEl = item ? item.querySelector("[" + SLUG_ATTR + "]") : null;
    var slug = slugEl ? slugEl.textContent.trim() : "";
    if (!configId) return;
    // A gallery target only works inside a Collection Item - one outside
    // any (e.g. a section marked by mistake) is left completely untouched.
    if (!item) {
      console.warn(
        "Fluxa CMS gallery: an element outside any Collection Item is marked as a gallery target and was ignored. Remove its mark in Fluxa.",
      );
      return;
    }
    if (!slugEl) {
      reportSetupProblem(
        target,
        "no element in this Collection Item is marked as the Slug. Run the Slug step in Fluxa, then publish again.",
      );
      return;
    }
    if (!slug) {
      reportSetupProblem(target, "the element marked as the Slug is empty. Bind its text to the Slug field.");
      return;
    }

    fetch(API_BASE + "/api/public/cms-gallery/" + encodeURIComponent(configId) + "/" + encodeURIComponent(slug))
      .then(function (res) {
        if (res.ok) return res.json();
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (body.error === "item_not_found") {
            reportSetupProblem(
              target,
              'no CMS item has the slug "' + slug + '". Make sure the marked element is bound to the Slug field, not the Name.',
            );
            return null;
          }
          if (body.error === "not_found") {
            reportSetupProblem(target, "this gallery no longer exists in Fluxa. Set it up again or remove this element's mark.");
            return null;
          }
          return { images: [], hidden: false };
        });
      })
      .then(function (data) {
        if (!data) {
          // A setup problem already reported above. On a live domain the
          // target keeps the same "no images found" placeholder it always
          // showed for a failed request.
          if (!IS_STAGING) buildCarousel(target, [], DEFAULT_SETTINGS);
          return;
        }
        // "Hide this post's gallery entirely" (the Manage Images picker)
        // means the WHOLE rendered Collection Item - title and all, not
        // just an empty gallery placeholder sitting next to a still-visible
        // title. Distinct from data.images being empty because the item
        // genuinely has no images, which still falls through to
        // buildCarousel's own "no images found" placeholder below.
        if (data.hidden) {
          if (item) item.style.display = "none";
          return;
        }

        var settings = {};
        for (var key in DEFAULT_SETTINGS) settings[key] = DEFAULT_SETTINGS[key];
        if (data.settings) {
          for (var key2 in data.settings) settings[key2] = data.settings[key2];
        }
        buildCarousel(target, data.images || [], settings);
      })
      .catch(function (err) {
        console.error("Fluxa CMS gallery: failed to load images", err);
      });
  }

  function mountAll() {
    document.querySelectorAll("[" + TARGET_ATTR + "]").forEach(mount);
  }

  // The embed's own host element (applyCmsGalleryEmbed.ts's prepend target)
  // can sit earlier in the page's DOM order than the Collection List itself
  // - a real, confirmed bug: a plain classic script runs synchronously the
  // instant the parser reaches it, so querySelectorAll found zero
  // TARGET_ATTR elements (the Collection List's own markup hadn't been
  // parsed yet) and silently did nothing, every time, with no error and no
  // fetch ever firing. Deferring to DOMContentLoaded when the document is
  // still loading (and running immediately otherwise, e.g. if this embed
  // ever ends up after the list) fixes it regardless of where the embed
  // happens to sit.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
`;
}
