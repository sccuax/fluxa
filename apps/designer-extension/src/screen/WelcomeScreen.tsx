import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { SplitText } from "gsap/SplitText";
import { useExtensionSize } from "../hooks/useExtensionSize";
import { Svg3DPreview } from "../components/Svg3DPreview";

gsap.registerPlugin(DrawSVGPlugin, SplitText);

export function WelcomeScreen() {
  useExtensionSize("comfortable");

  const wordmarkRef = useRef<SVGSVGElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const dotsRef = useRef<HTMLSpanElement>(null);

  // useLayoutEffect (not useEffect) so the hidden starting state (opacity 0,
  // undrawn stroke, split chars) is applied before the browser ever paints -
  // otherwise the logo flashes at full opacity for a frame before GSAP hides it.
  useLayoutEffect(() => {
    const wordmarkPaths = wordmarkRef.current?.querySelectorAll("path") ?? null;
    const dots = dotsRef.current?.querySelectorAll(".dot") ?? null;
    const taglineSplit = new SplitText(taglineRef.current, { type: "chars" });
    const statusSplit = new SplitText(statusRef.current, { type: "chars" });

    if (dots?.length) gsap.set(dots, { opacity: 0 });

    if (wordmarkPaths?.length) {
      // The wordmark paths only have a `fill`, no `stroke` - and drawSVG animates
      // stroke-dasharray/dashoffset, which has zero visual effect on fill alone.
      // So: temporarily give them a stroke to draw, then reveal the fill once drawn.
      gsap.set(wordmarkPaths, {
        drawSVG: "0%",
        fillOpacity: 0,
        stroke: "#F2F0EC",
        strokeWidth: 0.6,
      });
    }

    // Total timeline matches the loading bar's 3s fill (see tailwind.config.js "fill-bar"):
    // logo pop-in (own animation, see Svg3DPreview) + wordmark draw (0 - 0.9s) ->
    // tagline whip reveal (0.9 - 2.0s) -> status typewriter (2.0 - 3.0s)
    const tl = gsap.timeline();

    if (wordmarkPaths?.length) {
      tl.to(wordmarkPaths, { drawSVG: "100%", duration: 0.55, ease: "power2.inOut" }, 0.1).to(
        wordmarkPaths,
        { fillOpacity: 1, strokeOpacity: 0, duration: 0.25, ease: "power1.out" },
        0.55,
      );
    }

    tl.fromTo(
      taglineSplit.chars,
      {
        opacity: 0,
        // A single lashing sweep, not an oscillation: leading letters start far
        // out (offset + rotated) and the offset tapers to ~0 by the last letter,
        // like a whip's crack traveling down the line and dissipating.
        x: (i, _target, targets) => -64 * (1 - i / Math.max(targets.length - 1, 1)),
        y: (i, _target, targets) => -14 * (1 - i / Math.max(targets.length - 1, 1)),
        rotation: (i, _target, targets) => -16 * (1 - i / Math.max(targets.length - 1, 1)),
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.6,
        stagger: { amount: 0.55 },
        ease: "elastic.out(1, 0.6)",
      },
      0.9,
    );

    tl.fromTo(
      statusSplit.chars,
      { opacity: 0 },
      { opacity: 1, duration: 0.02, stagger: { amount: 0.98 }, ease: "none" },
      2.0,
    );

    if (dots?.length) {
      tl.to(dots, { opacity: 1, duration: 0.15, ease: "power1.out" }, 2.85);
    }

    // Once the 3s intro finishes, loop the three dots forever like a wave:
    // each dot bounces up then down, the next starts partway through the
    // previous one's cycle - a constant stagger with a matching period keeps
    // the phase offset (and so the "wave") stable across every repeat.
    tl.eventCallback("onComplete", () => {
      if (!dots?.length) return;
      gsap.to(dots, {
        y: -4,
        duration: 0.3,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.15 },
      });
    });

    return () => {
      tl.kill();
      if (dots?.length) gsap.killTweensOf(dots);
      taglineSplit.revert();
      statusSplit.revert();
    };
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <div
        className="flex h-[460px] w-[320px] flex-col items-center justify-center gap-[3.313rem] bg-cover bg-center px-6 text-center text-neutral-100"
        style={{ backgroundImage: "url(/images/welcome-bg.jpg)" }}
      >
        <div className="flex flex-col items-center justify-center gap-[0.25rem]">
          <div className="w-[68px]">
            <Svg3DPreview objectSize={68} />
          </div>
          <svg ref={wordmarkRef} xmlns="http://www.w3.org/2000/svg" width="67" height="20" viewBox="0 0 67 20" fill="none">
            <path d="M3.45193 4.35213V9.47116H12.0457V12.3459H3.45193V19.4358H0V1.37109H13.1394V4.35213H3.45193Z" fill="#F2F0EC" />
            <path d="M15.6836 19.4356V0H19.0786V19.4356H15.6836Z" fill="#F2F0EC" />
            <path d="M27.5651 19.7928C25.9246 19.7928 24.6866 19.2308 23.855 18.1105C23.0233 16.9864 22.6094 15.2852 22.6094 13.0067V5.12305H26.0841V12.6231C26.0841 14.0662 26.3043 15.1409 26.7411 15.8548C27.1778 16.5649 27.8537 16.9219 28.7651 16.9219C29.293 16.9219 29.7601 16.789 30.1626 16.5231C30.5651 16.2573 30.9107 15.8852 31.2031 15.3991C31.4955 14.9168 31.7272 14.3548 31.9019 13.7168C32.0765 13.0788 32.1791 12.3763 32.2171 11.6092V5.12305H35.6652V19.4396H32.8171L32.8702 14.9244H32.3765C32.1373 16.075 31.8069 17.0054 31.3778 17.7156C30.9487 18.4257 30.4246 18.9535 29.8056 19.2877C29.1866 19.6257 28.4385 19.7928 27.5613 19.7928H27.5651Z" fill="#F2F0EC" />
            <path d="M37.9629 19.4358L42.7515 12.2927L37.9629 5.12305H41.9579L44.806 10.6522H45.2427L48.0908 5.12305H52.0858L47.2971 12.2927L52.1428 19.4358H48.1744L45.2465 13.8801H44.8098L41.992 19.4358H37.9667H37.9629Z" fill="#F2F0EC" />
            <path d="M66.3916 17.5063C66.3461 16.8418 66.3081 16.1772 66.2815 15.5089C66.2549 14.8443 66.2397 14.1987 66.2397 13.5797V10.8987C66.2397 9.47463 66.0309 8.3126 65.6094 7.40879C65.1916 6.50499 64.5499 5.84043 63.6954 5.41131C62.8372 4.98219 61.7435 4.76953 60.4106 4.76953C59.5334 4.76953 58.7321 4.86067 58.003 5.04295C57.2738 5.22523 56.6245 5.51004 56.0586 5.88979C55.4928 6.27334 55.0181 6.73284 54.6346 7.27208C54.251 7.81133 53.9586 8.44551 53.7574 9.17463L56.8485 10.1316C56.9776 9.49362 57.2131 8.97716 57.5625 8.58602C57.908 8.19488 58.3258 7.90627 58.808 7.72399C59.2903 7.54171 59.7992 7.45057 60.327 7.45057C61.2043 7.45057 61.8384 7.65563 62.2296 8.06576C62.6207 8.47589 62.8182 8.96577 62.8182 9.5316C62.8182 9.91514 62.7271 10.2038 62.5448 10.3936C62.3625 10.5835 62.0739 10.7278 61.6827 10.8189C61.2916 10.9101 60.7827 11.0012 60.1637 11.0924C59.0321 11.2557 58.0485 11.4531 57.2055 11.681C56.3662 11.9088 55.6637 12.1936 55.0979 12.5278C54.532 12.8658 54.1067 13.2987 53.8257 13.8304C53.5409 14.3582 53.4004 14.9962 53.4004 15.7481C53.4004 16.6405 53.5789 17.3886 53.9358 17.9924C54.2928 18.5962 54.7789 19.0481 55.4017 19.3481C56.0207 19.6481 56.7232 19.8 57.5093 19.8C58.4017 19.8 59.1916 19.6291 59.8789 19.295C60.5625 18.957 61.1435 18.5013 61.6182 17.9279C62.0929 17.3544 62.4574 16.7203 62.7119 16.0253H63.1524C63.1866 16.6291 63.2321 17.2215 63.2891 17.8063C63.3422 18.3912 63.4068 18.938 63.4828 19.4469H66.5739C66.5018 18.8279 66.441 18.1823 66.3954 17.5177L66.3916 17.5063ZM62.1081 15.5354C61.7967 15.9076 61.4587 16.2266 61.0941 16.481C60.7296 16.7355 60.3574 16.9291 59.9853 17.0582C59.6093 17.1874 59.2409 17.2519 58.8764 17.2519C58.2536 17.2519 57.7447 17.0772 57.3422 16.7317C56.9397 16.3861 56.7384 15.9 56.7384 15.281C56.7384 14.7873 56.8561 14.4 57.0954 14.119C57.3346 13.838 57.6536 13.6177 58.0523 13.462C58.4549 13.3063 58.9068 13.181 59.408 13.0785C59.9093 12.9797 60.4106 12.8924 60.9118 12.8202C61.4131 12.7481 61.8916 12.638 62.3473 12.4936C62.5258 12.4367 62.6967 12.3683 62.8524 12.2962L62.8941 14.2177C62.6739 14.7304 62.4119 15.1709 62.1005 15.5468L62.1081 15.5354Z" fill="#F2F0EC" />
          </svg>
        </div>

        <div className="flex w-[11.4375rem] flex-col items-center gap-6">
          <p ref={taglineRef} className="text-text-sm-regular font-sans text-text-white">
            Let's make something move.
          </p>
          <div className="flex w-full flex-col items-start gap-3 self-stretch">
            <div className="relative h-1 w-full overflow-hidden rounded-4 bg-neutral-800">
              <div
                className="absolute inset-y-0 left-0 h-1 w-0 animate-fill-bar rounded-4"
                style={{
                  background:
                    "linear-gradient(83deg, rgba(111, 245, 241, 0.80) -81.2%, rgba(59, 156, 214, 0.80) -37.05%, rgba(9, 85, 229, 0.80) 5.44%, rgba(142, 84, 197, 0.80) 48.76%, rgba(226, 63, 140, 0.80) 92.09%)",
                  boxShadow:
                    "0 0 250px 0 #AC4098, 0 0 144.72px 0 #AC4098, 0 0 84.42px 0 #AC4098, 0 0 42.21px 0 #AC4098, 0 0 12.06px 0 #AC4098, 0 0 6.03px 0 #AC4098",
                }}
              />
            </div>

            <p className="text-mobile-text-md-regular font-sans text-text-secondary">
              <span ref={statusRef}>Getting everything ready</span>
              <span ref={dotsRef} className="inline-flex gap-[1px]">
                <span className="dot inline-block">.</span>
                <span className="dot inline-block">.</span>
                <span className="dot inline-block">.</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
