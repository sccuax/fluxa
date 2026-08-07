// Decorative header banner - gradient blob artwork from Figma, clipped to
// this exact 320x86 box. The source SVG's own viewBox already matches these
// dimensions, so the browser's default SVG viewport clipping reproduces
// Figma's vector mask without needing a separate clip-path here.
export function AuthHeaderBanner() {
  return (
    <div className="absolute left-0 top-0 h-[86px] w-[320px] overflow-hidden">
      <img src="/images/signin-header-bg.svg" alt="" className="h-full w-full" />
    </div>
  );
}
