// GSAP is loaded lazily and only by components that need timelines
// (pinned/scrubbed sequences). Simple reveals use lib/motion/reveal.ts instead
// and never pull GSAP into the bundle.

type GsapModule = typeof import("gsap");
type ScrollTriggerModule = typeof import("gsap/ScrollTrigger");

let loading: Promise<{ gsap: GsapModule["gsap"]; ScrollTrigger: ScrollTriggerModule["ScrollTrigger"] }> | null =
  null;

// SplitText (free since GSAP 3.13) is only needed by the hero copy reveal, so it stays out of loadGsap().
let splitLoading: Promise<(typeof import("gsap/SplitText"))["SplitText"]> | null = null;

export function loadSplitText() {
  splitLoading ??= (async () => {
    const [{ gsap }, { SplitText }] = await Promise.all([import("gsap"), import("gsap/SplitText")]);
    gsap.registerPlugin(SplitText);
    return SplitText;
  })();
  return splitLoading;
}

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
