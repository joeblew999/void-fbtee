// Every page in Chromium and WebKit, apart from `vp test run`: `vp run test:browsers`, run when
// pages change (not in CI). The same setup as the e2e project in the
// root vite.config.ts: one build and production preview, or the deployed site with E2E_URL.
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    name: "browsers",
    root: import.meta.dirname,
    include: ["*.test.ts"],
    globalSetup: ["../setup.ts"],
    pool: "forks",
    testTimeout: 0,
    hookTimeout: 0,
    fileParallelism: false,
  },
});
