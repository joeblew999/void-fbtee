// The quick check of a deployed site (live.test.ts), which CI runs after every push (e2e/deployed.ts).
// The same setup as the e2e project in the root vite.config.ts: the deployed site with E2E_URL, or
// one build and production preview without it.
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    name: "deployed",
    root: import.meta.dirname,
    include: ["*.test.ts"],
    globalSetup: ["../setup.ts"],
    pool: "forks",
    testTimeout: 0,
    hookTimeout: 0,
  },
});
