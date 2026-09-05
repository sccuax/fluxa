// Turns the live GradientCanvas preview into a small, compressed WebP blob
// ready to upload - see apps/data-client's routes/galleryPresets.ts
// (POST /:id/thumbnail) for where it goes and why WebP specifically.
//
// Two techniques combined:
//  - Reading a live WebGL canvas's actual pixels by drawImage-ing it onto a
//    fresh offscreen 2D canvas (apps/designer-extension's Svg3DPreview.tsx
//    documents the general shape of this pattern: never call
//    canvas.getContext() a second time on a canvas three.js already owns -
//    that throws "Canvas has an existing context of a different type" -
//    drawImage reads the live buffer instead). A real, initially-missed
//    gotcha specific to *this* call site, not present in Svg3DPreview's own
//    use of the technique: WebGL's default preserveDrawingBuffer:false lets
//    the browser clear the buffer immediately after each frame is
//    composited, and this capture is triggered by an async button click -
//    not guaranteed to land in the same tick as a render the way
//    Svg3DPreview's synchronous, continuously-re-triggered measurement did.
//    Without preserveDrawingBuffer:true on the source canvas, this
//    drawImage call could read an already-cleared (blank) buffer - fixed by
//    App.tsx passing <GradientCanvas preserveDrawingBuffer />, see that
//    prop's own comment on GradientCanvas.tsx for why it's opt-in rather
//    than the shared component's default.
//  - The 9-argument drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh) form
//    crops AND resizes in the same call - used here to center-crop the
//    live canvas (whatever aspect ratio its container happens to be) down
//    to THUMBNAIL_WIDTH/HEIGHT's fixed 2:1 aspect ratio without stretching
//    the gradient, the same "object-fit: cover" behavior CSS background-size
//    would give an <img>.
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 160;
const THUMBNAIL_QUALITY = 0.8;

export async function captureThumbnail(container: HTMLElement): Promise<Blob | null> {
  const canvas = container.querySelector("canvas");
  if (!canvas) return null;

  const targetAspect = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;
  const sourceAspect = canvas.width / canvas.height;

  let sx = 0;
  let sy = 0;
  let sw = canvas.width;
  let sh = canvas.height;
  if (sourceAspect > targetAspect) {
    // Source wider than the target - crop the left/right edges.
    sw = canvas.height * targetAspect;
    sx = (canvas.width - sw) / 2;
  } else {
    // Source taller than the target - crop the top/bottom edges.
    sh = canvas.width / targetAspect;
    sy = (canvas.height - sh) / 2;
  }

  const offscreen = document.createElement("canvas");
  offscreen.width = THUMBNAIL_WIDTH;
  offscreen.height = THUMBNAIL_HEIGHT;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  return new Promise((resolve) => {
    offscreen.toBlob((blob) => resolve(blob), "image/webp", THUMBNAIL_QUALITY);
  });
}
