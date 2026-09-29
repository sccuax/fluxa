// GSAP is loaded lazily and only by components that need timelines
// (pinned/scrubbed sequences). Simple reveals use lib/motion/reveal.ts instead
// and never pull GSAP into the bundle.

type GsapModule = typeof import("gsap");
type ScrollTriggerModule = typeof import("gsap/ScrollTrigger");

let loading: Promise<{ gsap: GsapModule["gsap"]; ScrollTrigger: ScrollTriggerModule["ScrollTrigger"] }> | null =
  null;

export function loadGsap() {
  loading ??= (async () => {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]);
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  })();
  return loading;
}
