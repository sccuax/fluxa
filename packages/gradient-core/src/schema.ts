import { z } from "zod";

// Mirrors a subset of @shadergradient/react's <ShaderGradient> props so the
// same config object can flow: control panel -> live canvas -> saved preset.
// Verify field names against the installed @shadergradient/react types
// before relying on this for production - the upstream API can change.
export const gradientTypeSchema = z.enum(["plane", "sphere", "waterPlane"]);
export const shaderTypeSchema = z.enum(["defaults", "positionVaryingColor"]);
export const lightTypeSchema = z.enum(["env", "3d"]);
export const environmentPresetSchema = z.enum(["city", "dawn", "lobby"]);
export const toggleSchema = z.enum(["on", "off"]);

export const gradientConfigSchema = z.object({
  type: gradientTypeSchema.default("waterPlane"),
  shader: shaderTypeSchema.default("defaults"),

  color1: z.string().default("#ff5005"),
  color2: z.string().default("#dbba95"),
  color3: z.string().default("#d0bce1"),

  wireframe: z.boolean().default(false),
  animate: toggleSchema.default("on"),
  grain: toggleSchema.default("off"),

  uSpeed: z.number().min(0).max(1).default(0.3),
  uStrength: z.number().min(0).max(10).default(1.5),
  uDensity: z.number().min(0).max(4).default(1.3),
  uFrequency: z.number().min(0).max(10).default(5.5),
  uAmplitude: z.number().min(0).max(5).default(0),

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
});

export type GradientConfig = z.infer<typeof gradientConfigSchema>;

export const DEFAULT_GRADIENT_CONFIG: GradientConfig =
  gradientConfigSchema.parse({});

export const gradientPresetSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string().min(1).max(80),
  config: gradientConfigSchema,
  createdAt: z.string(),
});

export type GradientPreset = z.infer<typeof gradientPresetSchema>;
