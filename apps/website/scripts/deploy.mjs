// Deploys the static site to Cloudflare Pages.
//   node scripts/deploy.mjs staging      -> project fluxa-website-staging (noindex)
//   node scripts/deploy.mjs production   -> project fluxa-website
//   node scripts/deploy.mjs both         -> staging first, then production
// Each target is built separately because PUBLIC_SITE_URL (canonical + sitemap) is baked into the build.
// Override the public URLs with STAGING_URL / PRODUCTION_URL (e.g. once the custom domains exist).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, "..");
const dist = resolve(site, "dist");
const dataClient = resolve(site, "../data-client");

const targets = {
  staging: {
    project: "fluxa-website-staging",
    url: process.env.STAGING_URL ?? "https://fluxa-website-staging.pages.dev",
    noindex: true,
  },
  production: {
    project: "fluxa-website",
    url: process.env.PRODUCTION_URL ?? "https://fluxa-website.pages.dev",
    noindex: false,
  },
};

const arg = process.argv[2];
const names = arg === "both" ? ["staging", "production"] : arg in targets ? [arg] : null;
if (!names) {
  console.error("Usage: node scripts/deploy.mjs <staging|production|both>");
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

for (const name of names) {
  const t = targets[name];
  console.log(`\n=== ${name}: build (${t.url}) ===`);
  run("pnpm", ["build"], { cwd: site, env: { ...process.env, PUBLIC_SITE_URL: t.url } });
  if (t.noindex) writeFileSync(resolve(dist, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  console.log(`\n=== ${name}: deploy to ${t.project} ===`);
  // Always the project's production branch (main): each target is its own Pages project.
  run("pnpm", ["--dir", dataClient, "exec", "wrangler", "pages", "deploy", dist, "--project-name", t.project, "--branch", "main", "--commit-dirty=true"]);
}
