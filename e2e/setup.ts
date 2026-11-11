// Vitest global setup for the browser tests (the e2e project in the root vite.config.ts), as in
// voidzero-dev/void's integration tests (test/integration-helpers.ts): build the package and the
// example once, start the example's production preview on a free port
// on 127.0.0.1 (so a server left by a stopped run can't block this one), and stop it at the end.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
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

/**
 * Start a server and wait until it's ready: --strictPort makes a taken port fail rather than move,
 * and only this server's own "Local: http://…:<port>" line counts, not any answer on the port (as
 * voidzero-dev/void's startServer, test/integration-helpers.ts).
 */
async function start(args: string[], port: number, url: string): Promise<ChildProcess> {
  const child = spawn(
    "vp",
    [...args, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: EXAMPLE,
      stdio: ["ignore", "pipe", "inherit"],
      detached: true,
    },
  );
  const listening = new RegExp(
    String.raw`(?:Local:?|Listening on)\s+https?://[^\s/]+:${port}(?!\d)`,
  );
  // Ready when it prints its URL; failed if it exits first. No time limit.
  await new Promise<void>((resolve, reject) => {
    let output = "";
    child.stdout!.on("data", (chunk: Buffer) => {
      output += chunk;
      if (listening.test(stripVTControlCharacters(output))) resolve();
    });
    child.once("exit", (code) =>
      reject(new Error(`${args.join(" ")} exited with ${code}:\n${output}`)),
    );
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${args.join(" ")}: ${url} answered ${res.status}`);
  return child;
}

export default async function setup(project: TestProject) {
  // `vp run test:production` (e2e/production.ts): the tests against production (the deployed site), no local build or servers.
  if (process.env.E2E_URL) {
    project.provide("prod" as never, process.env.E2E_URL as never);
    return;
  }
  // A fresh local database with every migration, the sample events' one included.
  run(["exec", "void", "db", "reset", "--yes"], EXAMPLE);
  // The example's build, and before it void-fbtee's (Vite+'s transitive run: -t).
  run(["run", "-t", "example#build"], root);
  const port = await freePort();
  const prod = `http://127.0.0.1:${port}`;
  const servers = [await start(["preview"], port, `${prod}/${SOURCE}`)];
  project.provide("prod" as never, prod as never);
  return () => {
    // Each server runs in its own process group (detached): stop vp and what it started.
    for (const s of servers) if (s.pid) process.kill(-s.pid, "SIGTERM");
  };
}
