import { readFileSync } from "node:fs";
import StyleDictionary from "style-dictionary";
import { register, expandTypesMap } from "@tokens-studio/sd-transforms";

register(StyleDictionary);

// Token Studio authors lineHeight either as a percentage ("130%", meant as a
// unitless CSS ratio) or as a bare number (200, meant as literal px) - the
// resolved value alone can't tell those apart, so read the source scale to
// know which one each entry is.
const primitiveSource = JSON.parse(
  readFileSync(new URL("./tokens/Primitive/Mode 1.json", import.meta.url)),
);
const lineHeightUnit = {};
for (const [key, token] of Object.entries(primitiveSource.lineHeights ?? {})) {
  lineHeightUnit[key] = typeof token.$value === "string" && token.$value.trim().endsWith("%")
    ? "ratio"
    : "px";
}

const TYPOGRAPHY_FIELDS = new Set([
  "fontFamily",
  "fontWeight",
  "lineHeight",
  "fontSize",
  "letterSpacing",
  "paragraphSpacing",
  "paragraphIndent",
  "textCase",
  "textDecoration",
]);

// Slugify one path segment into a Tailwind-safe key fragment.
function slug(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Turn a token's path into nested-object keys, dropping a segment when it's
// just repeating (as a prefix of) its parent - e.g. Background > "Background White"
// becomes background.white instead of background["background-white"].
function pathToKeys(path) {
  const keys = [];
  let prevSlug = "";
  for (const segment of path) {
    const s = slug(segment);
    const key = prevSlug && s.startsWith(`${prevSlug}-`) ? s.slice(prevSlug.length + 1) : s;
    keys.push(key || s);
    prevSlug = s;
  }
  return keys;
}

function setNested(obj, keys, value) {
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cur[k] !== "object" || cur[k] === null || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

// Radius tokens are named e.g. "Border 4px" - pull the number straight out
// instead of slugifying the whole label.
function radiusKey(name) {
  const match = String(name).match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : slug(name);
}

function resolveLineHeight(token) {
  if (!token) return undefined;
  const ref = token.original?.$value;
  const match = typeof ref === "string" && ref.match(/^\{lineHeights\.(.+)\}$/);
  const unit = match ? lineHeightUnit[match[1]] : undefined;
  return unit === "px" && typeof token.$value === "number" ? `${token.$value}px` : String(token.$value);
}

// Radius tokens are $type "number" (a bare 4/8/16/...) - give them a px unit
// so they're valid CSS on their own (e.g. `border-radius: var(--border-4px)`).
StyleDictionary.registerTransform({
  name: "value/px-number",
  type: "value",
  filter: (token) => token.$type === "number",
  transform: (token) => `${token.$value}px`,
});

StyleDictionary.registerFormat({
  name: "tailwind/theme",
  format: ({ dictionary }) => {
    const colors = {};
    const backgroundImage = {};
    const boxShadow = {};
    const borderRadius = {};
    const fontSize = {};
    const fontFamily = {};

    const typographyGroups = new Map();
    const otherTokens = [];
    for (const token of dictionary.allTokens) {
      const last = token.path[token.path.length - 1];
      if (token.path.length > 1 && TYPOGRAPHY_FIELDS.has(last)) {
        const parentPath = token.path.slice(0, -1);
        const key = parentPath.join(" / ");
        if (!typographyGroups.has(key)) typographyGroups.set(key, { parentPath, fields: {} });
        typographyGroups.get(key).fields[last] = token;
      } else {
        otherTokens.push(token);
      }
    }

    for (const token of otherTokens) {
      const type = token.$type;
      const path = token.path;
      const value = token.$value;

      if (type === "color") {
        const isGradient = typeof value === "string" && /^(linear|radial|conic)-gradient\(/.test(value);
        if (isGradient) {
          setNested(backgroundImage, pathToKeys(path), value);
        } else {
          const keys = pathToKeys(path[0]?.toLowerCase() === "colors" ? path.slice(1) : path);
          setNested(colors, keys, value);
        }
        continue;
      }

      if (type === "shadow") {
        const keys = pathToKeys(path[0]?.toLowerCase() === "shadows" ? path.slice(1) : path);
        setNested(boxShadow, keys, value);
        continue;
      }

      if (type === "number" && path.length === 1) {
        borderRadius[radiusKey(path[0])] = `${value}px`;
        continue;
      }

      if (token.original?.$extensions?.["com.figma.scopes"]?.includes("FONT_FAMILY")) {
        fontFamily[slug(path[path.length - 1])] = [String(value).replace(/^'(.*)'$/, "$1")];
      }
    }

    for (const { parentPath, fields } of typographyGroups.values()) {
      // Tailwind's fontSize plugin (unlike colors/spacing) reads flat keys only -
      // it does not recursively flatten nested objects into class names.
      const key = pathToKeys(parentPath).join("-");
      fontSize[key] = [
        fields.fontSize?.$value,
        {
          lineHeight: resolveLineHeight(fields.lineHeight),
          letterSpacing: fields.letterSpacing?.$value,
          fontWeight: String(fields.fontWeight?.$value ?? "400"),
        },
      ];
    }

    const theme = { colors, backgroundImage, boxShadow, borderRadius, fontSize, fontFamily };
    return `// Auto-generated by @fluxa/design-tokens - do not edit by hand.\n// Run "pnpm --filter @fluxa/design-tokens build" to regenerate.\nmodule.exports = ${JSON.stringify(theme, null, 2)};\n`;
  },
});

export default {
  source: [
    "tokens/Primitive/*.json",
    "tokens/Color Palette/*.json",
    "tokens/Typographi/*.json",
    "tokens/Radius/*.json",
  ],
  preprocessors: ["tokens-studio"],
  expand: {
    typesMap: { typography: expandTypesMap.typography },
    include: ["typography"],
  },
  platforms: {
    css: {
      transformGroup: "tokens-studio",
      transforms: ["name/kebab", "value/px-number"],
      buildPath: "dist/",
      files: [
        {
          destination: "variables.css",
          format: "css/variables",
          options: { outputReferences: false },
        },
      ],
    },
    tailwind: {
      transformGroup: "tokens-studio",
      buildPath: "dist/",
      files: [
        {
          destination: "tailwind-theme.cjs",
          format: "tailwind/theme",
        },
      ],
    },
  },
};
