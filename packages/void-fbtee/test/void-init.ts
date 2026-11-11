// Vitest global setup for init.test.ts: a Vite+ app and a plain-Vite app, made by `void init` (the
// Void version the workspace pins), as e2e/fresh/check.ts makes them. Once per run, into
// .vitest/void-init/<toolchain>/; each test copies one (see `app()` in init.test.ts).
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
export const VOID_INIT_DIR = join(root, ".vitest/void-init");
const VOID = join(import.meta.dirname, "../node_modules/.bin/void");

export default function setup() {
  for (const toolchain of ["vite-plus", "vite"]) {
    const dir = join(VOID_INIT_DIR, toolchain);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    execFileSync("git", ["init", "--quiet"], { cwd: dir });
    // `void init` picks pnpm for a new app when it finds a pnpm-workspace.yaml (else npm).
    if (toolchain === "vite")
      writeFileSync(
        join(dir, "pnpm-workspace.yaml"),
        "allowBuilds:\n  esbuild: true\n  workerd: true\n",
      );
    execFileSync(
      VOID,
      [
        "init",
        "--toolchain",
        toolchain,
        "--framework",
        "react",
        "--starter",
        "static",
        "--deploy",
        "none",
      ],
      { cwd: dir, stdio: ["ignore", "ignore", 2] },
    );
  }
}
