// The production build (production projects only): what plan #1 decisions 2, 15 and 16 promise.
import { test, expect } from "@playwright/test";
import { readFileSync, globSync } from "node:fs";
import { join } from "node:path";
import type { AppMetadata } from "./projects";

const read = (f: string) => readFileSync(f, "utf8");

test("worker: one fbtee core, no native Temporal in app code, temporal flag on", () => {
  const { dir } = test.info().project.metadata as AppMetadata;
  const worker = globSync(join(dir, "dist/ssr/**/*.js"));
  expect(worker.length).toBeGreaterThan(0);
  // One copy of fbtee's per-request state (decision 2).
  expect(worker.filter((f) => read(f).includes("runWithFbtee")).length).toBe(1);
  // App code uses the polyfill's own code on the server (decision 16). Only the example's
  // comparison route reads the native global, on purpose.
  const nativeReads = worker.filter((f) => /globalThis\.Temporal\b/.test(read(f)));
  expect(nativeReads.every((f) => f.includes("temporal-native"))).toBe(true);
  // Cloudflare's temporal flag reaches the Worker config `void deploy` uploads (decision 15).
  const config = JSON.parse(
    read(join(dir, ".cloudflare/output/v0/workers/default/worker.config.json")),
  );
  expect(config.compatibilityFlags).toContain("temporal");
});
