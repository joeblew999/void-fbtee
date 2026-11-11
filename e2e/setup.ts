// Vitest global setup for the browser tests (the e2e project in the root vite.config.ts), as in
// voidzero-dev/void's integration tests (test/integration-helpers.ts): build the package and the
// example once, start the example's production preview and its dev server, each on a free port
// on 127.0.0.1 (so a server left by a stopped run can't block this one), and stop both at the end.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import { join } from "node:path";
import type { TestProject } from "vite-plus/test/node";
import { SOURCE } from "./locales";

const root = join(import.meta.dirname, "..");
export const EXAMPLE = join(root, "apps/example");

/** A port nothing is using now (Void's getFreePort). */
async function freePort(): Promise<number> {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  server.close();
  await once(server, "close");
  return port;
}

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
  // A fresh local database with every migration, the sample events' one included.
  run(["exec", "void", "db", "reset", "--yes"], EXAMPLE);
  // The example's build, and before it void-fbtee's (Vite+'s transitive run: -t).
  run(["run", "-t", "example#build"], root);
  const [prodPort, devPort] = [await freePort(), await freePort()];
  const prod = `http://127.0.0.1:${prodPort}`;
  const dev = `http://127.0.0.1:${devPort}`;
  const servers = [
    await start(
      ["preview", "--host", "127.0.0.1", "--port", String(prodPort)],
      `${prod}/${SOURCE}`,
    ),
    await start(["dev", "--host", "127.0.0.1", "--port", String(devPort)], `${dev}/${SOURCE}`),
  ];
  project.provide("prod" as never, prod as never);
  project.provide("dev" as never, dev as never);
  return () => {
    // Each server runs in its own process group (detached): stop vp and what it started.
    for (const s of servers) if (s.pid) process.kill(-s.pid, "SIGTERM");
  };
}
