// `vp run test:deployed`: every browser test against what Cloudflare deployed for this commit, so CI needs
// no Cloudflare login (the deployed site does its own Workers AI calls). Cloudflare's Workers Builds builds
// each push: main as production (`vp run deploy`), any other branch as a Worker Preview
// (`vp run build:preview`, then `cf previews deploy`). It reports each build on GitHub as the check
// "Workers Builds: <Worker>"; this waits for that check on the commit, then tests the site it deployed.
//
// The commit: GITHUB_SHA in GitHub Actions, else git's HEAD. GitHub's API is read with gh (in GitHub
// Actions, logged in by GH_TOKEN). The site: the check's details link names the
// Worker and, for a preview, the Preview (…/void-fbtee-example/production/previews/<preview>/builds/…);
// its workers.dev address needs the account's subdomain, CLOUDFLARE_WORKERS_SUBDOMAIN (Void's name
// for it, "gedw99").
import { execFileSync, spawn } from "node:child_process";

const sha =
  process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const origin = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
const repo = process.env.GITHUB_REPOSITORY ?? /github\.com[:/](.+?)(\.git)?$/.exec(origin)?.[1];
const subdomain = process.env.CLOUDFLARE_WORKERS_SUBDOMAIN?.replace(/\.workers\.dev$/, "");
if (!repo || !subdomain) {
  console.error(
    "test:deployed: needs the GitHub repository (git's origin) and CLOUDFLARE_WORKERS_SUBDOMAIN",
  );
  process.exit(1);
}

interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  details_url: string;
}

/** Cloudflare's check on the commit, once it exists (gh, logged in: GH_TOKEN in GitHub Actions). */
function check(): CheckRun | undefined {
  const out = execFileSync("gh", ["api", `repos/${repo}/commits/${sha}/check-runs`], {
    encoding: "utf8",
  });
  const { check_runs } = JSON.parse(out) as { check_runs: CheckRun[] };
  return check_runs.find((c) => c.name.startsWith("Workers Builds: "));
}

console.log(`test:deployed: waiting for Cloudflare's build of ${sha.slice(0, 7)}`);
let run = check();
while (!run || run.status !== "completed") {
  await new Promise((r) => setTimeout(r, 15_000));
  run = check();
}
if (run.conclusion !== "success") {
  console.error(`test:deployed: Cloudflare's build ${run.conclusion}: ${run.details_url}`);
  process.exit(1);
}

const [, worker, preview] =
  /\/services\/view\/([^/]+)\/production\/(?:previews\/([^/]+)\/)?builds\//.exec(run.details_url)!;
const url = `https://${preview ? `${preview}-` : ""}${worker}.${subdomain}.workers.dev`;
console.log(`test:deployed: testing ${url}\n`);
const tests = spawn("vp", ["test", "run", "e2e"], {
  stdio: "inherit",
  env: { ...process.env, E2E_URL: url },
});
tests.on("close", (c) => process.exit(c ?? 1));
