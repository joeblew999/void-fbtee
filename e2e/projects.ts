// One app under test = two Playwright projects: its dev server and its production build.
// Playwright starts each server, waits for it, and stops it at the end (as in
// voidzero-dev/vibe-dashboard and cloudflare/vinext).
import type { PlaywrightTestConfig, Project } from "@playwright/test";

export interface App {
  /** Project name prefix, e.g. "example". */
  name: string;
  /** The app's folder, from the repo root. */
  dir: string;
  /** How to run the app's own Vite+ or Vite command, e.g. "pnpm exec vp" or "npx vite". */
  cli: string;
  /**
   * Run once before the app's servers start, from the repo root (build the package, set up a
   * fresh app). Playwright starts servers one after another, in order, so only the first runs it.
   */
  prepare: string;
  devPort: number;
  prodPort: number;
}

export interface AppMetadata {
  dir: string;
  mode: "dev" | "prod";
}

const SPECS = ["strings", "temporal", "navigation", "islands", "server", "concurrency"];

export function appProjects(app: App): Pick<PlaywrightTestConfig, "projects" | "webServer"> {
  const project = (mode: "dev" | "prod", port: number): Project => ({
    name: `${app.name}-${mode}`,
    testMatch: [...SPECS, mode === "prod" ? "build" : "dev-reload"].map((s) => `${s}.spec.ts`),
    use: { baseURL: `http://localhost:${port}` },
    metadata: { dir: app.dir, mode } satisfies AppMetadata,
  });
  const cd = `cd ${app.dir}`;
  return {
    projects: [project("dev", app.devPort), project("prod", app.prodPort)],
    webServer: [
      {
        command: `${app.prepare} && ${cd} && ${app.cli} dev --port ${app.devPort} --strictPort`,
        url: `http://localhost:${app.devPort}/en-US`,
        reuseExistingServer: false,
        timeout: 300_000,
        stdout: "ignore",
      },
      {
        command: `${cd} && ${app.cli} build && ${app.cli} preview --port ${app.prodPort} --strictPort`,
        url: `http://localhost:${app.prodPort}/en-US`,
        reuseExistingServer: false,
        timeout: 300_000,
        stdout: "ignore",
      },
    ],
  };
}
