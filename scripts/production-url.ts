// The URL the last `vp run deploy` deployed to: Void prints it in its summary box and keeps no
// record of it, so scripts/deploy.ts saves it here, and the tasks that test the live site read it.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const PRODUCTION_URL = join(import.meta.dirname, "../.vitest/production-url");

/** Runs one test project (e2e/<project>/) against the last deploy's URL, then exits with its code. */
export function testLastDeploy(task: string, project: string): void {
  let url: string;
  try {
    url = readFileSync(PRODUCTION_URL, "utf8").trim();
  } catch {
    console.error(`${task}: no deploy yet: run \`vp run deploy\` first`);
    process.exit(1);
  }
  console.log(`${task}: testing ${url}\n`);
  const tests = spawn("vp", ["test", "run", "--project", project], {
    stdio: "inherit",
    env: { ...process.env, E2E_URL: url },
  });
  tests.on("close", (code) => process.exit(code ?? 1));
}
