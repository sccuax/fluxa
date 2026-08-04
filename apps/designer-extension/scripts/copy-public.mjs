// One-time copy of public/ into dist/, run before `vite build`/`vite build --watch`
// starts (see vite.config.ts's `copyPublicDir: false` for why: Vite's own
// per-build copy step was racing with `webflow extension serve` on Windows).
// Only copies once per script invocation, not per watch rebuild - if you add
// or change a file under public/ while `dev:extension` is running, restart it
// to pick the change up.
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const distDir = join(root, "dist");

if (existsSync(publicDir)) {
  cpSync(publicDir, distDir, { recursive: true, force: true });
}
