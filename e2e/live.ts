// `vp run test:live`: every browser test against the deployed site, at the URL Void reported on the
// last `vp run deploy` (saved in .e2e-work/live-url by e2e/deploy.ts).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let url: string;
try {
  url = readFileSync(join(import.meta.dirname, "../.e2e-work/live-url"), "utf8").trim();
} catch {
  console.error("test:live: no deploy yet: run `vp run deploy` first");
  process.exit(1);
}
console.log(`test:live: testing ${url}\n`);
const tests = spawn("vp", ["test", "run", "e2e"], {
  stdio: "inherit",
  env: { ...process.env, E2E_URL: url },
});
tests.on("close", (c) => process.exit(c ?? 1));
