"use client";

import { useEffect, useState, useCallback } from "react";
import { props } from "@webflow/data-types";
import { declareComponent } from "@webflow/react";

// Renders a Webflow multi-image CMS field inside a Collection List - the
// thing Webflow can't bind natively to anything (confirmed: no prop type
// for it, no way to bind a multi-image field to a plain element either).
// A real Code Component instead of a Custom Code embed, per explicit
// direction: it renders natively in the Designer/Preview/published site
// (shows the Component icon, no "Enable custom code" toggle needed), the
// same way the original manual proof-of-concept (Jona Lab's
// ThreeDCardSlider) did - this is the Fluxa-owned, automated version of
// that same approach.
//
// `itemSlug` is a plain Text prop, bound per-row to the collection's own
// Slug field via Webflow's native "connect to CMS field" UI (the purple
// dot) - completely standard authoring, no code, and it's what makes this
// automatically correct for every real item Webflow renders from the
// Collection List, unlike the original POC's itemId (typed by hand once,
// so it only ever showed one hardcoded item). `configId` is the one thing
// this component can't get from the CMS - it identifies which Fluxa gallery
// config (collection + multi-image field, see the Designer Extension's
// Webflow Solutions panel) to resolve against, and is the same static value
// for every instance of this component under one Collection List.
const API_BASE = "https://fluxa-data-client.jojanmartinez533.workers.dev";

interface GalleryImage {
  url: string;
  alt: string | null;
}

function useGalleryImages(configId: string, itemSlug: string) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configId || !itemSlug) {
      setLoading(false);
      setImages([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/public/cms-gallery/${encodeURIComponent(configId)}/${encodeURIComponent(itemSlug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then((data: { images?: GalleryImage[] }) => {
        if (cancelled) return;
        setImages(data.images ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load images.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configId, itemSlug]);

  return { images, loading, error };
}

const arrowStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,0.5)",
  color: "#fff",
  cursor: "pointer",
  fontSize: "16px",
  lineHeight: 1,
  padding: 0,
};

const FluxaGallery = ({ configId, itemSlug }: { configId: string; itemSlug: string }) => {
  const { images, loading, error } = useGalleryImages(configId?.trim() ?? "", itemSlug?.trim() ?? "");
  const [index, setIndex] = useState(0);

  const next = useCallback(() => {
    setIndex((i) => (images.length ? (i + 1) % images.length : 0));
  }, [images.length]);
  const prev = useCallback(() => {
    setIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));
  }, [images.length]);

  useEffect(() => setIndex(0), [configId, itemSlug]);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
  }, [images.length, next]);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: "200px",
    overflow: "hidden",
    borderRadius: "8px",
    background: "#1f2937",
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "12px" }}>
        Loading gallery...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: "12px", textAlign: "center", padding: "8px" }}>
        Fluxa gallery error: {error}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "12px", textAlign: "center", padding: "8px" }}>
        No images for this item.
      </div>
    );
  }

  const current = images[index];

  return (
    <div style={containerStyle}>
      <img
        src={current.url}
        alt={current.alt ?? ""}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {images.length > 1 && (
        <>
          <button type="button" onClick={prev} aria-label="Previous image" style={{ ...arrowStyle, left: "10px" }}>
            &#8249;
          </button>
          <button type="button" onClick={next} aria-label="Next image" style={{ ...arrowStyle, right: "10px" }}>
            &#8250;
          </button>
          <div style={{ position: "absolute", bottom: "8px", left: 0, right: 0, display: "flex", justifyContent: "center", gap: "6px" }}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to image ${i + 1}`}
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: i === index ? "#fff" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default declareComponent(FluxaGallery, {
  name: "Fluxa Gallery",
  description: "Shows a multi-image CMS field inside a Collection List item.",
  group: "Fluxa",
  props: {
    itemSlug: props.Text({ name: "Item slug", defaultValue: "" }),
    configId: props.Text({ name: "Fluxa config ID", defaultValue: "" }),
  },
});
