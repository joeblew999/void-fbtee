// `vp run test:production`: the preview suite (e2e/preview/) against the live site, at the URL Void
// reported on the last `vp run deploy` (saved in .vitest/production-url by scripts/deploy.ts). The
// tests that post or book skip themselves there (onLiveSite() in e2e/helpers.ts): on the live site
// they would call Workers AI and send real email.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let url: string;
try {
  url = readFileSync(join(import.meta.dirname, "../.vitest/production-url"), "utf8").trim();
} catch {
  console.error("test:production: no deploy yet: run `vp run deploy` first");
  process.exit(1);
}
console.log(`test:production: testing ${url}\n`);
const tests = spawn("vp", ["test", "run", "--project", "preview"], {
  stdio: "inherit",
  env: { ...process.env, E2E_URL: url },
});
tests.on("close", (c) => process.exit(c ?? 1));
