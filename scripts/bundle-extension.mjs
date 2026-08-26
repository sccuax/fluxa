// Runs the full sequence needed to produce a fresh, upload-ready bundle.zip:
// design-tokens rebuild, typecheck, a clean designer-extension build (avoids the
// stale-asset-hash bug from a non-clean build), then `webflow extension bundle`.
// Each step must succeed before the next runs - execSync throws (and stops the
// script) on any non-zero exit code.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = join(repoRoot, "apps", "designer-extension");

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: repoRoot, stdio: "inherit" });
}

run("pnpm --filter @fluxa/design-tokens build");
run("pnpm --filter @fluxa/designer-extension typecheck");

console.log("\n> clean apps/designer-extension/dist and node_modules/.vite");
rmSync(join(extensionDir, "dist"), { recursive: true, force: true });
rmSync(join(extensionDir, "node_modules", ".vite"), { recursive: true, force: true });

run("pnpm --filter @fluxa/designer-extension build");
run("pnpm exec webflow extension bundle");

console.log("\nbundle.zip is ready at the repo root - upload it via Workspace settings > Apps & Integrations > Develop > Publish extension version.");
