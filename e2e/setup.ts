// Vitest global setup for the browser tests (the e2e project in the root vite.config.ts), as in
// voidzero-dev/void's integration tests: build the package and the example once, start the
// example's production preview and its dev server, and stop both at the end.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import type { TestProject } from "vite-plus/test/node";

const root = join(import.meta.dirname, "..");
export const EXAMPLE = join(root, "apps/example");
const PORTS = { prod: 4273, dev: 5273 };

const run = (args: string[], cwd: string) => execFileSync("vp", args, { cwd, stdio: "inherit" });

/** Start a server and wait until it answers; --strictPort makes a taken port fail, not move. */
async function start(args: string[], url: string): Promise<ChildProcess> {
  const child = spawn("vp", [...args, "--strictPort"], {
    cwd: EXAMPLE,
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null) throw new Error(`${args.join(" ")} exited with ${child.exitCode}`);
    try {
      if ((await fetch(url)).ok) return child;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${args.join(" ")} didn't answer at ${url}`);
}

export default async function setup(project: TestProject) {
  // The sample events (apps/example/db/seed.ts), on a fresh local database: Void's seed.
  run(["exec", "void", "db", "seed", "--yes"], EXAMPLE);
  // The example's build, and before it void-fbtee's (Vite+'s transitive run: -t).
  run(["run", "-t", "example#build"], root);
  const prod = `http://localhost:${PORTS.prod}`;
  const dev = `http://localhost:${PORTS.dev}`;
  const servers = [
    await start(["preview", "--port", String(PORTS.prod)], `${prod}/en-US`),
    await start(["dev", "--port", String(PORTS.dev)], `${dev}/en-US`),
  ];
  project.provide("prod" as never, prod as never);
  project.provide("dev" as never, dev as never);
  return () => {
    // Each server runs in its own process group (detached): stop vp and what it started.
    for (const s of servers) if (s.pid) process.kill(-s.pid, "SIGTERM");
  };
}
