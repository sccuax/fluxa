// Scroll-reveal without a JS animation library: one IntersectionObserver
// toggles a class, CSS (styles/global.css `[data-reveal]`) does the animating.
// Zero-cost for pages that use no [data-reveal] elements, and with
// prefers-reduced-motion the CSS shows everything immediately.
//
// Usage in markup:  <div data-reveal>  or  <div data-reveal data-reveal-delay="120">

const VISIBLE_CLASS = "is-revealed";

export function initReveal(root: ParentNode = document): () => void {
  const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (targets.length === 0 || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add(VISIBLE_CLASS));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const delay = el.dataset.revealDelay;
        if (delay) el.style.transitionDelay = `${Number(delay)}ms`;
        el.classList.add(VISIBLE_CLASS);
        observer.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
  );

  targets.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}
