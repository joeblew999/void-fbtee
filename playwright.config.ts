// End-to-end tests of the example app, against `vp dev` and against a production build
// (`vp build` + `vp preview`, local workerd). Run with `pnpm run e2e`.
import { defineConfig } from "@playwright/test";
import { appProjects } from "./e2e/projects";

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".e2e-work/test-results",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: { browserName: "chromium" },
  ...appProjects({
    name: "example",
    dir: "apps/example",
    cli: "pnpm exec vp",
    prepare: "pnpm exec vp run void-fbtee#build",
    devPort: 5273,
    prodPort: 4273,
  }),
});
