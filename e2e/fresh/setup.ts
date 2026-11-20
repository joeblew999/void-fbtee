// Vitest global setup for the fresh-app tests (the `fresh` project in the root vite.config.ts,
// e2e/fresh/fresh.ts): the package packed once, as npm would publish it (pnpm pack, which writes the
// catalog's versions in), for every app to install: the package as it is in this checkout, committed or not.
//
// Run by name (`vp run test:fresh`, or one app: `vp run test:fresh e2e/fresh/vite-npm.test.ts`). In a plain
// `vp test run`, which selects every project, the fresh tests skip themselves and say how to run
// them: they take many minutes.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TestProject } from "vite-plus/test/node";

const root = resolve(import.meta.dirname, "../..");
// Where fresh.ts makes the apps (git ignores .vitest/).
const work = join(root, ".vitest");

export default function setup(project: TestProject) {
  if (!project.vitest.config.project.includes("fresh")) {
    project.provide("freshSkip", "run it with `vp run test:fresh`");
    return;
  }
  const packDir = join(work, "fresh-pack");
  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });
  execFileSync("pnpm", ["pack", "--pack-destination", packDir], {
    cwd: join(root, "packages/void-fbtee"),
    stdio: ["ignore", 2, 2],
  });
  const file = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  if (!file) {
    throw new Error("pnpm pack made no tarball");
  }
  project.provide("freshSkip", "");
  project.provide("freshTarball", join(packDir, file));
}
