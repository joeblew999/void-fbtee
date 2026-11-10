// The same specs against void-fbtee as a user gets it: fresh `void init` apps on Vite+ (pnpm)
// and on plain Vite (npm), with void-fbtee installed from its tarball, and a fresh `git clone`
// of this repo. Slow (it installs from the registry), so it runs on its own:
// `pnpm run e2e:fresh`. See e2e/fresh/prepare.mjs.
import { defineConfig } from "@playwright/test";
import { appProjects } from "./e2e/projects";

const apps = [
  appProjects({
    name: "fresh-vite-plus",
    dir: ".e2e-work/fresh-vite-plus",
    cli: "pnpm exec vp",
    prepare: "node e2e/fresh/prepare.mjs vite-plus",
    devPort: 5274,
    prodPort: 4274,
  }),
  appProjects({
    name: "fresh-vite",
    dir: ".e2e-work/fresh-vite",
    cli: "npm exec -- vite",
    prepare: "node e2e/fresh/prepare.mjs vite",
    devPort: 5275,
    prodPort: 4275,
  }),
  appProjects({
    name: "fresh-clone",
    dir: ".e2e-work/clone/apps/example",
    cli: "pnpm exec vp",
    prepare: "node e2e/fresh/prepare.mjs clone",
    devPort: 5276,
    prodPort: 4276,
  }),
];

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".e2e-work/test-results-fresh",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: { browserName: "chromium" },
  projects: apps.flatMap((a) => a.projects ?? []),
  webServer: apps.flatMap((a) => a.webServer ?? []),
});
