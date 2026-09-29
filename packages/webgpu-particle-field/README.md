# @fluxa/webgpu-particle-field (experimental)

A WebGPU compute particle flow field: 60,000 particles simulated entirely on the GPU and drawn as
instanced soft quads. Built for the marketing site's hero (2026-09-28). **Not part of the product
yet** - archived here so it can be reused, and intended to become a shader kind in Fluxa Studio later.

```ts
import { mountWebgpuField } from "@fluxa/webgpu-particle-field";

const handle = await mountWebgpuField(canvas, { onLost: () => fallBack() });
handle.pause(); handle.resume(); handle.dispose();
```

- Framework-agnostic, zero runtime dependencies (TS source, no build step - same as the renderers).
- **Throws** if there is no adapter/context. Feature-detect first (the website does this in
  `apps/website/src/lib/gpu/capabilities.ts`: `navigator.gpu` existing is not enough, it must
  return an adapter) and keep a fallback. It is *not* usable on WebGL-only browsers.
- `pause()/resume()/dispose()` match the product renderers, so an `IntersectionObserver` can stop
  off-screen instances (zero GPU cost).
- Pointer repulsion is tracked on `window` and bounds-checked against the canvas, because the canvas
  sits behind page content (same trap as glassLiquid's cursor tracker).

## How it works

1. `initial` particles (`pos`, `vel`, 16 bytes each) are uploaded once to one buffer with
   `STORAGE | VERTEX` usage. Nothing is ever read back to the CPU.
2. Each frame a **compute pass** (`@workgroup_size(64)`) advances every particle: a flow-field force
   (`flow(pos, time)`), optional pointer repulsion, velocity easing (`1 - exp(-dt*2.5)`, frame-rate
   independent), and a hashed respawn when a particle leaves `[-1.05, 1.05]`.
3. A **render pass** draws the *same buffer* as an instance-stepped vertex buffer (6 vertices per
   particle from `vertex_index`, no vertex buffer for the quad). Additive blending, transparent
   canvas (`alphaMode: "premultiplied"`), colour mixes brand pink `#e23f8c` -> cyan `#6ff5f1` by speed.
4. `dt` is clamped to 1/20 s so a background tab / hitch never teleports the field. `resume()`
   resets the clock for the same reason. Canvas DPR is capped at 1.5.

The vertex buffer trick matters: reading a storage buffer in the vertex stage can be unavailable
(some limits/compat modes), so the buffer is bound as a vertex buffer instead.

## Tuning knobs (constants at the top of `src/mount.ts` / inside the WGSL)

| Knob | Where | Effect |
|---|---|---|
| `PARTICLE_COUNT` (60,000) | top | density and GPU cost |
| force multiplier `0.22` | `main()` in compute | flow speed |
| `size = 0.0035` | vertex | dot size (clip-space, aspect-corrected) |
| alpha `0.25 + 0.5*speed` | fragment | brightness; it is additive, so overlap saturates fast |
| pointer radius `0.35`, gain `2.4` | compute | mouse repulsion |
| `slow`/`fast` colours | fragment | palette |

## Looks that were tried (so nobody redoes the experiment blind)

The **current look is the original**: crisp round dots, bright, particles converging onto thin
bright filaments. The flow is an angle field (`sin/cos` sum -> angle -> unit vector), which is *not*
divergence-free, so particles pile up on curves. That contrast is the intended look.

- **Curl of an analytic potential** (divergence-free): uniform density, no filaments. Read as flat
  static noise - rejected.
- **Velocity-aligned streaks + lower alpha**: showed the flow, but looked **blurry** next to the
  crisp dots - rejected by the owner ("se ve borroso, la original estaba perfecta").
- **Unverified caveat**: the original look was judged over the full hero with the text scrim on top.
  On its own it is very bright; put a scrim behind any text (the hero uses a left-heavy gradient).

## Known limitations / ideas for Fluxa Studio

- Not yet verified in an *animating* real tab by the author: the automation tab used to check it had
  `visibilityState: hidden` (no `requestAnimationFrame`), so frames were driven by `setTimeout`.
  Check real-time performance and the `IntersectionObserver` pause on a real machine before shipping.
- Hardcoded constants. To become a Studio kind it needs a Zod config in `gradient-core`
  (count, speed, size, colours, flow type, pointer), a `mount(canvas, config) -> { setConfig, ... }`
  shape, and a self-hosted runtime bundle like `apps/glass-liquid-runtime`. WebGPU is unavailable on
  many published-site visitors, so a Studio kind **must** define its WebGL/poster fallback.
- No `setConfig` yet; changing a value means re-mounting.
