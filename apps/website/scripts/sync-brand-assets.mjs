// Copies brand fonts from the Designer Extension into public/fonts so the
// website reuses the exact same .woff2 files instead of a committed duplicate.
// public/fonts is gitignored and regenerated on every dev/build.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../designer-extension/public/fonts");
const target = resolve(here, "../public/fonts");

if (!existsSync(source)) {
  console.error(`[sync-brand-assets] source not found: ${source}`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, {
  recursive: true,
  filter: (path) => !path.endsWith(".gitkeep"),
});

console.log(`[sync-brand-assets] fonts synced (${readdirSync(target).join(", ")})`);
