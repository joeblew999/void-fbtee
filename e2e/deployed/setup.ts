// Vitest global setup for the quick live check (the `deployed` project in the root vite.config.ts):
// the site to check is E2E_URL, which scripts/deployed.ts sets to what the last `vp run deploy`
// deployed. Without it (a plain `vp test run`), the check skips itself, as Void's own live suite does
// without its credentials (voidzero-dev/void TESTING.md).
import type { TestProject } from "vite-plus/test/node";

export default function setup(project: TestProject) {
  project.provide("prod" as never, (process.env.E2E_URL ?? "") as never);
}
