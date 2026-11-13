// `vp run tailscale:login` and `vp run tailscale:logout`: the example's dev server (`vp run dev`, on
// http://localhost:5173) on a public https address through Tailscale Funnel, so a Claude cloud session's
// dev server can be opened in any browser without deploying. Only for Claude cloud sessions (Linux);
// on a Mac, open http://localhost:5173.
//
// Tailscale itself comes from Tailscale's own Linux download (pkgs.tailscale.com), pinned below, into
// .tailscale/bin/ (git-ignored). Its tailscaled runs as this repo's own, in userspace (no root, no
// network device), with its socket, state and log in .tailscale/. It finds the session's HTTPS_PROXY
// by itself. Signing in is Tailscale's browser link, printed here; this waits for it.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, rmSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

// Tailscale's version: newer ones are listed at https://pkgs.tailscale.com/stable/ (checked 2026-11-12).
const VERSION = "1.104.5";
// The example's dev server: apps/example/vite.config.ts, server.port.
const PORT = 5173;

const dir = join(import.meta.dirname, "../.tailscale");
const bin = join(dir, "bin");
const socket = join(dir, "tailscaled.sock");
const name = `void-fbtee-${hostname()
  .split(".")[0]
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-")}`.slice(0, 63);

const tailscale = (...args: string[]) =>
  spawnSync(join(bin, "tailscale"), ["--socket", socket, ...args], { encoding: "utf8" });

/** Tailscale's own view of this machine, or null when its tailscaled isn't running. */
function status() {
  try {
    return JSON.parse(tailscale("status", "--json").stdout);
  } catch {
    return null;
  }
}

/** Tailscale's Linux download, unpacked into .tailscale/bin/, unless it's already there. */
function download() {
  if (tailscale("version").stdout?.startsWith(`${VERSION}\n`)) return;
  const arch = { x64: "amd64", arm64: "arm64" }[process.arch as string];
  if (!arch) throw new Error(`No Tailscale download for ${process.arch}`);
  const url = `https://pkgs.tailscale.com/stable/tailscale_${VERSION}_${arch}.tgz`;
  console.log(`Downloading Tailscale ${VERSION}: ${url}`);
  rmSync(bin, { recursive: true, force: true });
  mkdirSync(bin, { recursive: true });
  // curl, not fetch: curl goes through the session's HTTPS_PROXY.
  execFileSync("sh", ["-c", `curl -fsSL "${url}" | tar xz -C "${bin}" --strip-components=1`], {
    stdio: "inherit",
  });
}

/** This repo's tailscaled, started if it isn't running. */
async function daemon() {
  if (status()) return;
  mkdirSync(join(dir, "state"), { recursive: true });
  const log = openSync(join(dir, "tailscaled.log"), "a");
  spawn(
    join(bin, "tailscaled"),
    ["--tun=userspace-networking", "--socket", socket, "--statedir", join(dir, "state")],
    { detached: true, stdio: ["ignore", log, log] },
  ).unref();
  for (let i = 0; i < 30 && !status(); i++) await new Promise((done) => setTimeout(done, 500));
  if (!status()) throw new Error(`tailscaled didn't start: see ${join(dir, "tailscaled.log")}`);
}

async function login() {
  download();
  await daemon();
  if (status()?.BackendState !== "Running") {
    console.log(`Sign ${name} in to Tailscale: open the link below; this waits for it.`);
    execFileSync(join(bin, "tailscale"), ["--socket", socket, "up", "--hostname", name], {
      stdio: "inherit",
    });
  }
  // Funnel: the public https address on 443, to the dev server. The first time, Tailscale may print a
  // link to allow Funnel on your tailnet; this waits for it.
  execFileSync(
    join(bin, "tailscale"),
    ["--socket", socket, "funnel", "--bg", "--https=443", `http://localhost:${PORT}`],
    { stdio: "inherit" },
  );
  const host = status()?.Self?.DNSName?.replace(/\.$/, "");
  if (!host) throw new Error("Tailscale gave this machine no name");
  console.log(`\nThe dev server (vp run dev) is on the internet at https://${host}`);
}

function logout() {
  if (status()) {
    tailscale("funnel", "reset");
    tailscale("logout");
    spawnSync("pkill", ["-f", `tailscaled.*${socket}`]);
  }
  // The download stays in .tailscale/bin/ for next time.
  rmSync(join(dir, "state"), { recursive: true, force: true });
  rmSync(socket, { force: true });
  console.log(
    `Off Tailscale. ${name} stays in your machines list, signed out, until you remove it at https://login.tailscale.com/admin/machines`,
  );
}

if (process.platform !== "linux") {
  console.log(`Only for Claude cloud sessions (Linux). Here, open http://localhost:${PORT}`);
} else if (process.argv[2] === "login") {
  await login();
} else if (process.argv[2] === "logout") {
  logout();
} else {
  throw new Error("Usage: vpx scripts/tailscale.ts login|logout");
}
