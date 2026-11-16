// Vitest global setup for the dev-server suite (the `dev` project in the root vite.config.ts): the
// stage where Void gives an app its dev hooks (voidzero-dev/void TESTING.md: a dev-mode suite beside
// the full preview one). Its email inbox, its queue and cron triggers (`/__void/queue`,
// `/__void/scheduled`), and Workers AI through the Cloudflare sign-in (guide/ai.md), all on the dev
// server (`vp run dev`).
//
// The developer's own dev server if it's running (port 5173, apps/example/vite.config.ts), as is,
// with its database: the tests delete what they post. Else it starts one, as the developer would
// (`vp run dev`), ready once it prints its own address, and stops it at the end. Not at the same time
// as the preview suite: they share the local database (guide/database/d1.md), which it resets.
//
// Run by name (`vp run test:dev`). In a plain `vp test run`, which selects every project, the dev
// suite skips itself and says how to run it, as Void's live suite does without its credentials: the
// preview suite's setup refuses to run beside a dev server.
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TestProject } from "vite-plus/test/node";
import { DEV_PORT, devServerRunning, EXAMPLE, root, untilListening } from "../preview/setup";

const DEV = `http://localhost:${DEV_PORT}`;

/** `vp run dev`, ready once the example's server prints its own address (Void's startServer rule). */
async function startDev(): Promise<ChildProcess> {
  const child = spawn("vp", ["run", "dev"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  await untilListening(
    child,
    new RegExp(String.raw`Local:\s+http://localhost:${DEV_PORT}(?!\d)`),
    "vp run dev",
  );
  return child;
}

export default async function setup(project: TestProject) {
  const named = project.vitest.config.project;
  if (!named.includes("dev")) {
    project.provide("devSkip" as never, "run it with `vp run test:dev`" as never);
    return;
  }
  project.provide("devSkip" as never, "" as never);
  const ours = (await devServerRunning()) ? undefined : await startDev();
  // The token Void's dev hooks ask for (guide/email/sending.md; guide/queues.md; guide/jobs.md),
  // written by the dev server when it starts.
  const token = readFileSync(join(EXAMPLE, ".void/dev-trigger-token"), "utf8").trim();
  project.provide("prod" as never, DEV as never);
  project.provide("devToken" as never, token as never);
  return () => {
    // Only a server this setup started: the developer's own keeps running.
    if (ours?.pid) process.kill(-ours.pid, "SIGTERM");
  };
}
