import { DATA_CLIENT_URL } from "./apiClient";
import { GALLERY_SLUG_ATTRIBUTE, GALLERY_TARGET_ATTRIBUTE, GALLERY_CONFIG_ATTRIBUTE } from "./cmsGallery";

// A leading HTML comment marker so applyCmsGalleryEmbed.ts can recognize an
// embed it created earlier - same pattern as gradientEmbedScript.ts's own
// GRADIENT_EMBED_MARKER.
export const CMS_GALLERY_EMBED_MARKER = "<!-- fluxa-cms-gallery -->";

// Runs once per page load, not once per rendered Collection Item - a single
// shared embed (see applyCmsGalleryEmbed.ts, one per Collection List) whose
// script finds EVERY element marked GALLERY_TARGET_ATTRIBUTE anywhere on the
// page, resolves each one's own rendered item identity from the
// GALLERY_SLUG_ATTRIBUTE-marked element inside the same ".w-dyn-item"
// (Webflow's own standard Collection Item wrapper class - already present
// on every rendered item with zero extra setup), fetches that item's real
// images from apps/data-client's public, unauthenticated
// routes/publicCmsGallery.ts, and mounts a small hand-rolled carousel
// *inside* the target. Plain classic script, no dependency of any kind -
// there's no shader/WebGL runtime to load here, unlike
// glassLiquidEmbedScript.ts's own self-hosted-bundle pattern.
//
// Real bug, fixed 2026-09-15: this used to `target.replaceWith(wrap)` a
// brand-new div that forced its own position/width/height/overflow - so
// even though `wrap.className` copied the target's own class over, those
// four properties (set as this new element's own inline style) always won
// over whatever that class's CSS declared, and any *later* edit to the
// class in the Designer had nothing left to apply to (the original element
// was gone). Per explicit direction, those four are exclusively the
// Designer's to control: the target itself is never replaced or resized
// now, only mounted into (mount()'s own `while (target.firstChild) ...`
// below) - this script only ever sets styles on the *children it creates*
// (the img's own sizing, the arrow/dot buttons' own position:absolute for
// their own overlay placement), never on the target element itself. One
// real, documented precondition remains because of that last point: the
// target needs its own Position set to something other than the CSS
// default (Static) in the Designer's Style panel, or the arrow/dot buttons
// won't anchor to it - WebflowSolutionsScreen.tsx's own wizard step now
// says so explicitly rather than this script forcing it.
export function buildCmsGalleryEmbedCode(): string {
  return `${CMS_GALLERY_EMBED_MARKER}
<script>
(function () {
  var API_BASE = ${JSON.stringify(DATA_CLIENT_URL)};
  var SLUG_ATTR = ${JSON.stringify(GALLERY_SLUG_ATTRIBUTE)};
  var TARGET_ATTR = ${JSON.stringify(GALLERY_TARGET_ATTRIBUTE)};
  var CONFIG_ATTR = ${JSON.stringify(GALLERY_CONFIG_ATTRIBUTE)};

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
  function buildCarousel(target, images, settings) {
    while (target.firstChild) target.removeChild(target.firstChild);

    if (!images.length) {
      target.style.display = "flex";
      target.style.alignItems = "center";
      target.style.justifyContent = "center";
      target.style.color = "#999";
      target.style.fontSize = "12px";
      target.style.textAlign = "center";
      target.style.padding = "8px";
      target.textContent = "Fluxa: no images found for this item";
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
    if (!configId || !slug) return;

    fetch(API_BASE + "/api/public/cms-gallery/" + encodeURIComponent(configId) + "/" + encodeURIComponent(slug))
      .then(function (res) { return res.ok ? res.json() : { images: [], hidden: false }; })
      .then(function (data) {
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
</script>`;
}
