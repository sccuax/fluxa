import { z } from "zod";

// Mirrors a subset of @shadergradient/react's <ShaderGradient> props so the
// same config object can flow: control panel -> live canvas -> saved preset.
// Verify field names against the installed @shadergradient/react types
// before relying on this for production - the upstream API can change.
export const gradientTypeSchema = z.enum(["plane", "sphere", "waterPlane"]);
// "positionVaryingColor" (this schema's previous value) doesn't exist in the
// installed package at all - verified directly against its own compiled
// export list (dist/shaders/index.mjs), which only ever exports these four
// names. Passing the old, invalid value crashed the real render with
// "Cannot read properties of undefined (reading 'waterPlane')" - the
// library's internal shader-variant lookup returned undefined for an
// unrecognized name, then a second lookup by `type` on that undefined blew
// up. Confirmed a real bug this way, not guessed from memory.
export const shaderTypeSchema = z.enum(["defaults", "cosmic", "glass", "positionMix"]);
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

  lightType: lightTypeSchema.default("env"),
  brightness: z.number().min(0).max(3).default(1),
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

export const gradientPresetSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string().min(1).max(80),
  config: gradientConfigSchema,
  createdAt: z.string(),
});

export type GradientPreset = z.infer<typeof gradientPresetSchema>;
