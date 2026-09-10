import { z } from "zod";

// Mirrors a subset of @shadergradient/react's <ShaderGradient> props so the
// same config object can flow: control panel -> live canvas -> saved preset.
// Verify field names against the installed @shadergradient/react types
// before relying on this for production - the upstream API can change.
export const gradientTypeSchema = z.enum(["plane", "sphere", "waterPlane"]);
// "positionVaryingColor" (this schema's previous value) doesn't exist in the
// installed package at all - verified directly against its own compiled
// export list (dist/shaders/index.mjs), which only ever exports four names:
// defaults, cosmic, glass, positionMix. Passing the old, invalid value
// crashed the real render with "Cannot read properties of undefined
// (reading 'waterPlane')" - the library's internal shader-variant lookup
// returned undefined for an unrecognized name, then a second lookup by
// `type` on that undefined blew up. Confirmed a real bug this way, not
// guessed from memory. "glass" is a real, valid variant in the library but
// is deliberately excluded from this app's own schema - dropped per explicit
// product direction after being tried in the UI (only Default/Cosmic/
// Position mix are offered).
export const shaderTypeSchema = z.enum(["defaults", "cosmic", "positionMix"]);
export const lightTypeSchema = z.enum(["env", "3d"]);
export const environmentPresetSchema = z.enum(["city", "dawn", "lobby"]);
export const toggleSchema = z.enum(["on", "off"]);
export const colorCountSchema = z.enum(["2", "3"]);

export const gradientConfigSchema = z.object({
  type: gradientTypeSchema.default("waterPlane"),
  shader: shaderTypeSchema.default("defaults"),

  color1: z.string().default("#ff5005"),
  color2: z.string().default("#dbba95"),
  color3: z.string().default("#d0bce1"),

  // Not a <ShaderGradient> prop at all - @shadergradient/react's own shader
  // (see CLAUDE.md "core engine" note) has exactly 3 color uniforms hardcoded
  // into its compiled GLSL, there's no way to actually add or remove a color
  // slot without a hand-authored shader (a deliberately deferred, separate
  // effort - see CLAUDE.md's "FUTURE" section). This is the interim,
  // non-destructive middle ground: "2" means the app *feeds* color2 into the
  // color3 uniform at render time (via getEffectiveGradientColors below) so
  // the gradient visually blends only 2 colors, while color3's own stored
  // value is left untouched - switching back to "3" instantly restores
  // whatever color3 was set to before, no re-entry needed.
  colorCount: colorCountSchema.default("3"),

  // Purely UI/data right now - NOT wired to the live render. ShaderGradient's
  // shader has no prop for weighting how much of the gradient each color
  // occupies (same "can't be reached by adding schema fields alone"
  // constraint documented on colorCount above and in CLAUDE.md's "FUTURE"
  // section on a self-authored linear/radial/conic shader) - that's the only
  // thing that could ever make this affect the real WebGL canvas. Kept here
  // so the value round-trips through presets once that shader exists.
  color1Percent: z.number().min(0).max(100).default(34),
  color2Percent: z.number().min(0).max(100).default(33),
  color3Percent: z.number().min(0).max(100).default(33),

  // Same "purely UI/data, not wired to the live render" situation as
  // colorNPercent above, for the same reason: color1-3 are plain opaque hex
  // strings, and ShaderGradient's shader has no per-color alpha uniform to
  // feed even if this app stored one - there's no way to make a color
  // partially transparent in the real WebGL render without the same
  // self-authored-shader effort deferred in CLAUDE.md. Kept here so the
  // value round-trips through presets once that exists.
  color1Opacity: z.number().min(0).max(100).default(100),
  color2Opacity: z.number().min(0).max(100).default(100),
  color3Opacity: z.number().min(0).max(100).default(100),

  wireframe: z.boolean().default(false),
  animate: toggleSchema.default("on"),
  grain: toggleSchema.default("off"),

  uSpeed: z.number().min(0).max(1).default(0.3),
  uStrength: z.number().min(0).max(10).default(1.5),
  uDensity: z.number().min(0).max(4).default(1.3),
  uFrequency: z.number().min(0).max(10).default(5.5),
  uAmplitude: z.number().min(0).max(5).default(0),

  // Bounds the animation's time loop to [rangeStart, rangeEnd] instead of
  // running unbounded - "enabled"/"disabled" (not a bare boolean) and the
  // 0/40 defaults match @shadergradient/react's own real preset defaults.
  range: z.enum(["enabled", "disabled"]).default("disabled"),
  rangeStart: z.number().min(0).default(0),
  rangeEnd: z.number().min(0).default(40),

  positionX: z.number().default(0),
  positionY: z.number().default(0),
  positionZ: z.number().default(0),
  rotationX: z.number().default(0),
  rotationY: z.number().default(0),
  rotationZ: z.number().default(0),

  cAzimuthAngle: z.number().default(180),
  cPolarAngle: z.number().default(80),
  cDistance: z.number().min(1).default(4),
  cameraZoom: z.number().min(0.1).default(1),

  lightType: lightTypeSchema.default("3d"),
  brightness: z.number().min(0).max(3).default(1.5),
  envPreset: environmentPresetSchema.default("city"),
  reflection: z.number().min(0).max(1).default(0.1),

  // Not a <ShaderGradient> mesh prop like the rest of this schema - it's a
  // <ShaderGradientCanvas> prop (canvas resolution multiplier, like devicePixelRatio).
  // Kept in the same flat config anyway since GradientCanvas.tsx/gradientEmbedScript.ts
  // already thread one single config object through both layers.
  pixelDensity: z.number().min(0.5).max(3).default(1),

  // Also a <ShaderGradientCanvas> prop, not a <ShaderGradient> mesh prop - same
  // threading as pixelDensity above. Min/max/default (10/180/45) match
  // @shadergradient/react's own reference Framer controls (canvas.fov), verified
  // against the installed package's compiled FramerControls chunk.
  fov: z.number().min(10).max(180).default(45),
});

export type GradientConfig = z.infer<typeof gradientConfigSchema>;

export const DEFAULT_GRADIENT_CONFIG: GradientConfig =
  gradientConfigSchema.parse({});

// Resolves what to actually feed <ShaderGradient>'s color1/2/3 props (or the
// embed script's equivalent) for the current colorCount - see colorCount's
// own comment above for why this collapse-not-delete approach exists.
// Both GradientCanvas.tsx (live preview) and gradientEmbedScript.ts
// (published embed) call this rather than each re-implementing the same
// two-line rule, so a future 3rd colorCount option or a real N-color shader
// (see CLAUDE.md's deferred plan) only needs to change here once.
export function getEffectiveGradientColors(
  config: GradientConfig
): Pick<GradientConfig, "color1" | "color2" | "color3"> {
  return {
    color1: config.color1,
    color2: config.color2,
    color3: config.colorCount === "2" ? config.color2 : config.color3,
  };
}

// A structurally different preset "kind" from everything above - a
// cursor-interactive fluted-glass shader with a persistent liquid trail
// (raw hand-authored Three.js ShaderMaterial, NOT @shadergradient/react).
// Ported from sandbox/src/experiments/ShaderGlassExperiment.tsx (built and
// tuned there first) as the second half of the `kind` discriminator on
// galleryPresetSchema below - see that schema's own comment for why a
// discriminated union, not a second flat schema, was chosen. Field
// min/max/defaults copied verbatim from that sandbox file's own
// DEFAULT_*/useState bounds; step values aren't part of the schema (Zod has
// no `.step()` - only `.multipleOf()`, and these steps only ever matter for
// the client-side <SliderField>, not for validating a stored config), so
// they're carried forward as literals in GlassLiquidControlPanel.tsx's own
// JSX instead.
export const glassLiquidConfigSchema = z.object({
  // --- Trail ---
  cursorRadius: z.number().min(0.02).max(0.4).default(0.18),
  glowStrength: z.number().min(0).max(1).default(1),
  ceiling: z.number().min(1).max(4).default(4.0),
  floorPerSecond: z.number().min(0).max(0.24).default(0),
  fadeDuration: z.number().min(0.3).max(4).default(1.5),
  velocityDecay: z.number().min(0.0005).max(0.5).default(0.086),

  // --- Glass ---
  refraction: z.number().min(0).max(0.4).default(0.14),
  flutesAngle: z.number().min(-90).max(90).default(-35),
  flutesFrequency: z.number().min(2).max(20).default(5.5),
  scrollSpeed: z.number().min(0).max(0.5).default(0.12),
  wobbleAmount: z.number().min(0).max(0.2).default(0.05),
  fluteVariation: z.number().min(0).max(1).default(0),
  highlightStrength: z.number().min(0).max(1).default(0.55),
  // Fakes rounded 3D depth on the flutes with pure analytic shading in the
  // display fragment shader - no geometry, no lights, no extra passes
  // (~5 ALU ops, guarded so it's ~free at 0): a per-ridge lit-flank/
  // shaded-flank split (zero-mean, overall brightness unchanged) plus a soft
  // contact-shadow in the valley between ridges. Only touches the glass
  // surface - the refracted trail and edge line are untouched. 0 = the
  // original flat look (unchanged for every existing preset); 1 = strongest.
  flutesDepth: z.number().min(0).max(1).default(0),
  // Where the flutesDepth relief actually shows, along the flute axis:
  //  - "full": everywhere (uniform).
  //  - "zones": concentrated at the two ends of the flute axis + the centre
  //    (at 45deg that's the two opposite corners plus the middle) -
  //    abs(cos()) of the along-flute coordinate.
  //  - "random": soft organic patches from one slowly-drifting snoise call.
  // Masked-out regions render exactly as flutesDepth 0 (flat). Costs 0-1
  // extra snoise; only evaluated when flutesDepth > 0.
  flutesDepthMask: z.enum(["full", "zones", "random"]).default("full"),
  // Surface texture - a halftone dot-screen on the glass surface + refracted
  // trail only (never the seam/edge lines). BOTH non-off modes are halftones
  // (per-channel RGB grids, R=1x/G=3x/B=2x rotations, screen-space so neither
  // crawls); they differ only in how the dots are drawn:
  //  - "grain": THE PRODUCTION dots (glass-liquid-runtime v6, byte-for-byte)
  //    - regular grid, half-step dot radius so dots stay a crisp visible
  //    lattice, device-px grid. **Default** - a preset with a `grainStrength`
  //    but no `grainMode` field (everything published so far) renders exactly
  //    as v6 did.
  //  - "noise": the closer-to-shaderGradient variant - full-step dot radius
  //    so bright dots merge toward solid, scatter=1 per-cell jitter, a 2x2
  //    supersample, and a CSS-px grid so `grainScale` reads the same at any
  //    display density.
  //  - "off": neither.
  // Both take `grainStrength` (blend toward the dots) and `grainScale` (the
  // dot-cell size). Compiled per-mode via the renderer's ShaderMaterial
  // `defines` (recompile on mode change, not a per-frame branch) so the
  // unused mode's GLSL is dead-code-eliminated and "off" costs nothing.
  grainMode: z.enum(["off", "grain", "noise"]).default("grain"),
  // Blend toward the dot screen (1 = the dots fully replace the surface
  // colour, matching the real HalftonePass which has no intensity control).
  // Same field/range/default as when this drove the single pre-grainMode
  // halftone - a nonzero value on an old preset still means the same thing.
  grainStrength: z.number().min(0).max(1).default(0.05),
  // Dot-cell size. For "grain" it's device px (production v6 semantics); for
  // "noise" it's CSS px - set it to ~2 there to match shaderGradient's own
  // `radius`. Range/default are the production (v6) values.
  grainScale: z.number().min(2).max(12).default(4),

  // --- Edge line ---
  edgeStrength: z.number().min(0).max(2).default(0.9),
  edgeWidth: z.number().min(0.2).max(4).default(1.0),
  edgeTrailMod: z.number().min(0).max(1).default(0),

  // --- Toggles ---
  confine: z.boolean().default(true),
  seamScroll: z.boolean().default(false),
  seamWobble: z.boolean().default(false),
  edgeAA: z.boolean().default(true),
  isolateLines: z.boolean().default(false),
  // A slow-moving colour gradient that fills the whole surface, refracted
  // through the flutes like the trail - so the glass reads as coloured and
  // alive even when nobody is moving the cursor. Fully independent of the
  // cursor/trail (a separate analytic layer in the display shader, sitting
  // BEHIND the trail), compiled in via a ShaderMaterial #define only when
  // this is on so it costs nothing off. ambientColor1/2 are its two gradient
  // colours; ambientStrength keeps it a subtle wash by default. Default off
  // - unchanged for every existing preset.
  ambientGradient: z.boolean().default(false),
  ambientColor1: z.string().default("#4073f2"),
  ambientColor2: z.string().default("#8c26d9"),
  ambientStrength: z.number().min(0).max(1).default(0.35),

  // --- Colors ---
  glowColor1: z.string().default("#4073f2"),
  glowColor2: z.string().default("#8c26d9"),
  highlightColor: z.string().default("#cce6ff"),
  glowColor: z.string().default("#ff1a80"),
  edgeColor: z.string().default("#767676"),
  baseColor: z.string().default("#050508"),
  // Per-colour opacity for the shared ColorSwatchPicker modal (0-100).
  // **Wired to the render** (unlike shaderGradient's colorNOpacity, whose
  // compiled shader has no alpha): mount.ts premultiplies each colour by
  // opacity/100 before it goes into a uniform. This shader is additive/blend
  // everywhere a colour lands, so a dimmed colour reads as "contributes
  // less" i.e. more transparent. `?? 100` in mount.ts guards a preset saved
  // before these fields.
  glowColor1Opacity: z.number().min(0).max(100).default(100),
  glowColor2Opacity: z.number().min(0).max(100).default(100),
  highlightColorOpacity: z.number().min(0).max(100).default(100),
  glowColorOpacity: z.number().min(0).max(100).default(100),
  edgeColorOpacity: z.number().min(0).max(100).default(100),
  baseColorOpacity: z.number().min(0).max(100).default(100),
  ambientColor1Opacity: z.number().min(0).max(100).default(100),
  ambientColor2Opacity: z.number().min(0).max(100).default(100),
});

export type GlassLiquidConfig = z.infer<typeof glassLiquidConfigSchema>;

export const DEFAULT_GLASS_LIQUID_CONFIG: GlassLiquidConfig =
  glassLiquidConfigSchema.parse({});

// A third structurally-distinct preset "kind" (see galleryPresetSchema's
// `kind` discriminator below), alongside "shaderGradient" and "glassLiquid".
// A real 3D liquid gradient surface (PerspectiveCamera + a vertex-displaced
// subdivided plane) whose color is three independently-drifting "wave
// fronts" that collide and mix, sampled through a domain-warped fBm field -
// a raw hand-authored Three.js ShaderMaterial (packages/ruido-evolutivo-renderer),
// NOT @shadergradient/react. Ported from sandbox/src/experiments/
// RuidoEvolutivo.tsx, where the look was built and tuned first; every field
// here was a hardcoded constant in that file (see @fluxa/ruido-evolutivo-renderer's
// shaders.ts), so the DEFAULT_* values below reproduce that original look
// exactly. Field min/max are enforced here; slider step values live in
// RuidoEvolutivoControlPanel.tsx's JSX (Zod has no `.step()`).
export const RUIDO_EVOLUTIVO_MAX_COLORS = 5;

export const ruidoEvolutivoConfigSchema = z.object({
  // --- Colors ---
  // 2..5 hex stops, one per "wave front" (unlike shaderGradient's hard cap
  // of 3 - this is a self-authored shader so the count is only bounded by
  // per-pixel cost, see RUIDO_EVOLUTIVO_MAX_COLORS). The first three default
  // to the sandbox file's original color1/2/3; fronts 4-5 reuse the
  // sandbox's exact per-front direction/frequency/speed for indices 0-2 and
  // hand-picked values beyond, so a 3-colour config renders identically to
  // before this became an array.
  colors: z
    .array(z.string())
    .min(2)
    .max(RUIDO_EVOLUTIVO_MAX_COLORS)
    .default(["#2EE550", "#6f93e0", "#CA0DCD"]),
  // Per-stop opacity (0-100) for the shared ColorSwatchPicker modal, one
  // entry per `colors` entry (a missing/short tail is treated as 100). The
  // control panel keeps this array's length in step with `colors` on
  // add/remove. **Wired to the render**: the shader's `uColorAlpha[i]`
  // scales that front's blend WEIGHT, so a low-opacity colour's influence
  // drops and the result shifts toward the other colours (not toward
  // black). All 100 = identical to before this existed.
  colorsOpacity: z.array(z.number().min(0).max(100)).default([]),
  // Post-blend saturation multiplier (1 = untouched). Blending many fronts'
  // colours by weighted average pulls the result toward a desaturated
  // centroid; nudge this up to keep 4-5 colour configs vivid. At 1 (the
  // default) the render is bit-identical to no saturation step.
  saturation: z.number().min(0.5).max(1.6).default(1),

  // --- Surface (vertex displacement / fBm) ---
  frequency: z.number().min(0.1).max(3).default(0.5),
  relief: z.number().min(0).max(1).default(0.28),
  // fBm octave count. The renderer's GLSL loop is bounded at a compile-time
  // MAX of 6; this is the runtime-variable count via an `if (i >= n) break`.
  detail: z.number().min(1).max(6).default(5),
  roughness: z.number().min(0.3).max(0.7).default(0.5),
  lacunarity: z.number().min(1.5).max(3).default(2),
  wireframe: z.boolean().default(false),
  // Subdivisions per side of the displaced plane. Doubles as the wireframe
  // grid density (more subdivisions => tighter grid / smaller cells). The
  // sandbox file's fixed MESH_SEGMENTS was 128. Also the surface's polygon
  // resolution when wireframe is off, so very low values give a faceted
  // liquid surface.
  gridDensity: z.number().min(8).max(256).default(128),

  // --- Motion ---
  speed: z.number().min(0).max(3).default(1),
  // How much faster fine detail evolves than the big shapes: 0 => all
  // octaves evolve at the same rate, 1 => finest octave ~2x faster. The
  // sandbox file's fixed `float(i) * 0.05` per-octave rate is reproduced at
  // 0.5.
  evolution: z.number().min(0).max(1).default(0.5),
  animate: toggleSchema.default("on"),

  // --- Color flow (fragment: domain warp + one wave front per colour) ---
  warp: z.number().min(0).max(2).default(1),
  warpScale: z.number().min(0.2).max(2).default(0.8),
  waveScale: z.number().min(0.3).max(3).default(1),
  // Turbulence bent into each wave front's crest so it isn't a straight
  // sine line (the sandbox file's fixed `turb * 0.6`).
  distortion: z.number().min(0).max(1.5).default(0.6),
  // Sharpen exponent applied to each front before blending - higher = more
  // crisp color bands, lower = washed toward a flat average (the sandbox
  // file's fixed `pow(wave, 1.6)`).
  contrast: z.number().min(1).max(4).default(1.6),
  // Lerp between hard-picking the strongest front's color (0) and the
  // smooth weighted average of all three (1). The sandbox file did a pure
  // weighted average, so the default is 1.
  colorMix: z.number().min(0).max(1).default(1),
  // Rotates every wave-front direction (degrees).
  flowAngle: z.number().min(0).max(360).default(0),
  // How far the later fronts fan out from the first: 0 => all parallel, 1 =>
  // the sandbox file's original spread (for the first three fronts).
  flowSpread: z.number().min(0).max(1).default(1),

  // --- Texture ---
  // Independent high-frequency fBm brightness modulation (the sandbox
  // file's fixed `fineDetail * 0.08`).
  shimmer: z.number().min(0).max(0.3).default(0.08),
  // Halftone "grain" - blend intensity toward a rotated CMY dot-screen
  // reconstruction of the image, the same visual @shadergradient/react's
  // own `grain` prop produces (there it's a THREE.HalftonePass post-process
  // with per-channel rotations PI/12, 2*PI/12, 3*PI/12; here it's an
  // in-shader single-pass approximation). Off by default.
  grain: z.number().min(0).max(1).default(0),
  // Halftone dot-cell size in device pixels - larger = coarser dots.
  grainScale: z.number().min(2).max(12).default(4),

  // --- Lighting (shading off the real displaced-surface normal) ---
  lightAngle: z.number().min(0).max(360).default(130),
  lightStrength: z.number().min(0).max(0.6).default(0.18),

  // --- Camera ---
  zoom: z.number().min(0.35).max(2.2).default(1),
  // The gentle automatic camera drift (the sandbox file always had it on).
  orbit: z.boolean().default(true),
});

export type RuidoEvolutivoConfig = z.infer<typeof ruidoEvolutivoConfigSchema>;

export const DEFAULT_RUIDO_EVOLUTIVO_CONFIG: RuidoEvolutivoConfig =
  ruidoEvolutivoConfigSchema.parse({});

// Pads a 2..5-length `colors` array out to exactly RUIDO_EVOLUTIVO_MAX_COLORS
// entries (repeating the last colour) so the renderer can always fill a
// fixed-size `uniform vec3 uColors[MAX]` GLSL array - the shader's own
// `uColorCount` uniform is what actually stops the blend loop early, so the
// padding entries are never read. Used by RuidoEvolutivoCanvas.tsx (live
// preview) and the self-hosted runtime.
export function padRuidoColors(colors: string[]): string[] {
  const last = colors[colors.length - 1] ?? "#000000";
  return Array.from(
    { length: RUIDO_EVOLUTIVO_MAX_COLORS },
    (_, i) => colors[i] ?? last,
  );
}

export const gradientPresetSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string().min(1).max(80),
  config: gradientConfigSchema,
  createdAt: z.string(),
});

export type GradientPreset = z.infer<typeof gradientPresetSchema>;

// A *different* preset concept from GradientPreset above - that one is "a
// Fluxa user's own saved config for one of their sites" (owned by siteId).
// This is Fluxa's own curated template gallery: no site ownership, but a
// license tier and a publish flag an admin controls (see
// apps/data-client's galleryPresets table and apps/preset-admin, the small
// internal tool admins use to build these visually by reusing the same
// ControlPanel/GradientCanvas components the Designer Extension itself
// uses). Shared here (not just in apps/data-client) so apps/preset-admin
// can validate/type against the identical shape without either app
// guessing the other's field names.
export const galleryPresetLicenseSchema = z.enum(["free", "pro"]);

// Which shader tech a gallery preset's `config` actually renders with -
// "shaderGradient" (the only kind that ever existed before this field was
// added, hence the default below) or "glassLiquid" (the fluted-glass/
// liquid-trail shader, see glassLiquidConfigSchema above). A real
// discriminated union, not a second flat schema with a loose `config: any`,
// so every consumer (apps/preset-admin, the Designer Extension) gets a
// single `GalleryPreset` type that narrows `config`'s shape from `kind`
// alone, the same way a plain array of "all gallery presets" is typed and
// consumed today.
export const galleryPresetKindSchema = z.enum([
  "shaderGradient",
  "glassLiquid",
  "ruidoEvolutivo",
]);
export type GalleryPresetKind = z.infer<typeof galleryPresetKindSchema>;

const galleryPresetCommonFields = {
  id: z.string(),
  name: z.string().min(1).max(80),
  license: galleryPresetLicenseSchema,
  isPublished: z.boolean(),
  // Set via POST /api/gallery-presets/:id/thumbnail, not the general create/
  // update body below - null until an admin captures one (see that route's
  // own comment). designer-extension's PresetCard.tsx falls back to a
  // CSS-gradient approximation of `config`'s colors when this is null.
  thumbnailUrl: z.string().nullable(),
  createdAt: z.string(),
};

export const galleryPresetSchema = z.discriminatedUnion("kind", [
  z.object({ ...galleryPresetCommonFields, kind: z.literal("shaderGradient"), config: gradientConfigSchema }),
  z.object({ ...galleryPresetCommonFields, kind: z.literal("glassLiquid"), config: glassLiquidConfigSchema }),
  z.object({ ...galleryPresetCommonFields, kind: z.literal("ruidoEvolutivo"), config: ruidoEvolutivoConfigSchema }),
]);

export type GalleryPreset = z.infer<typeof galleryPresetSchema>;

// Request-body shape for POST /api/gallery-presets (apps/data-client) - no
// id/createdAt/thumbnailUrl (server-assigned), isPublished optional
// (defaults to a draft so a half-finished gradient in apps/preset-admin is
// never accidentally live before an admin explicitly toggles it on).
const createGalleryPresetCommonFields = {
  name: z.string().min(1).max(80),
  license: galleryPresetLicenseSchema,
  isPublished: z.boolean().default(false),
};

const createShaderGradientGalleryPresetSchema = z.object({
  ...createGalleryPresetCommonFields,
  kind: z.literal("shaderGradient"),
  config: gradientConfigSchema,
});
const createGlassLiquidGalleryPresetSchema = z.object({
  ...createGalleryPresetCommonFields,
  kind: z.literal("glassLiquid"),
  config: glassLiquidConfigSchema,
});
const createRuidoEvolutivoGalleryPresetSchema = z.object({
  ...createGalleryPresetCommonFields,
  kind: z.literal("ruidoEvolutivo"),
  config: ruidoEvolutivoConfigSchema,
});

export const createGalleryPresetSchema = z.discriminatedUnion("kind", [
  createShaderGradientGalleryPresetSchema,
  createGlassLiquidGalleryPresetSchema,
  createRuidoEvolutivoGalleryPresetSchema,
]);

// Request-body shape for PATCH /api/gallery-presets/:id - every field
// optional (a caller may only be toggling `isPublished`, say) EXCEPT `kind`,
// which stays required even here: z.discriminatedUnion has no `.partial()`
// of its own (only a plain z.object does), so each branch is partial()'d
// individually first, then `kind` is re-fixed back to its own literal via
// .extend(), then the two partial branches are unioned - `kind` being
// present on every request is exactly what lets this union know which
// branch's (now-optional) `config` shape to check a request against.
export const updateGalleryPresetSchema = z.discriminatedUnion("kind", [
  createShaderGradientGalleryPresetSchema.partial().extend({ kind: z.literal("shaderGradient") }),
  createGlassLiquidGalleryPresetSchema.partial().extend({ kind: z.literal("glassLiquid") }),
  createRuidoEvolutivoGalleryPresetSchema.partial().extend({ kind: z.literal("ruidoEvolutivo") }),
]);
