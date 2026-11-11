// `vp run test:production`: every browser test against production (the deployed site), at the URL Void reported on the
// last `vp run deploy` (saved in .vitest/production-url by e2e/deploy.ts).
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
const tests = spawn("vp", ["test", "run", "e2e"], {
  stdio: "inherit",
  env: { ...process.env, E2E_URL: url },
});
tests.on("close", (c) => process.exit(c ?? 1));
