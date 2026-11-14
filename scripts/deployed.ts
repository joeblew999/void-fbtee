// `vp run test:deployed`: the quick live check (e2e/deployed/live.test.ts) against the site the last
// `vp run deploy` deployed, at the URL Void reported (saved in .vitest/production-url by
// scripts/deploy.ts). CI's deploy job runs the two one after the other, as you would on your own
// machine.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let url: string;
try {
  url = readFileSync(join(import.meta.dirname, "../.vitest/production-url"), "utf8").trim();
} catch {
  console.error("test:deployed: no deploy yet: run `vp run deploy` first");
  process.exit(1);
}
console.log(`test:deployed: testing ${url}\n`);
// The quick check only: the full browser tests run on the preview (`vp run test:preview`).
const tests = spawn("vp", ["test", "run", "--project", "deployed"], {
  stdio: "inherit",
  env: { ...process.env, E2E_URL: url },
});
tests.on("close", (code) => process.exit(code ?? 1));
