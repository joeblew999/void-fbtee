// The formats page tests (formats.test.ts), apart from `vp test run`: `vp run test:formats` locally,
// and in CI against the deployed site (e2e/deployed.ts). The same setup as the e2e project in the
// root vite.config.ts: one build and production preview, or the deployed site with E2E_URL.
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    name: "formats",
    root: import.meta.dirname,
    include: ["*.test.ts"],
    globalSetup: ["../setup.ts"],
    pool: "forks",
    testTimeout: 0,
    hookTimeout: 0,
    fileParallelism: false,
  },
});
