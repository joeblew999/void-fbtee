// Root Vite+ config: the repo's tasks, and format, lint, type-check and test settings.
// Built-in commands: `vp check` (format, lint, types) and `vp test run` (all tests). CI runs those two.
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  // `vp run <task>` from anywhere in the repo.
  run: {
    tasks: {
      // The package rebuilding on save, and the example's dev server, together.
      dev: { command: "vp run -r --parallel dev", cache: false },
      // Chromium for the browser tests (once per machine).
      "install:browser": { command: "playwright install --with-deps chromium", cache: false },
      // void-fbtee installed into fresh `void init` apps, as a user's app installs it.
      // Every browser test against production (the deployed site), at the URL Void reported on the last deploy
      // (e2e/production.ts). Deploying and testing are separate: `vp run deploy`, then this.
      "test:production": { command: "vpx e2e/production.ts", cache: false },
      // Every browser test against what Cloudflare's Workers Builds deployed for this commit: production
      // for main, the branch's Preview otherwise (e2e/deployed.ts). What CI runs: no Cloudflare login.
      "test:deployed": { command: "vpx e2e/deployed.ts", cache: false },
      "test:fresh": { command: "vpx e2e/fresh/check.ts", cache: false },
      // Vite+'s, Void's and void-fbtee's setup commands, run again: fails if any changes a file.
      "check:tools": { command: "node e2e/check-tools.mjs", cache: false },
      // Move the project to the global vp's version (`vp upgrade` first): the catalog's pins and
      // the Vite+ section of AGENTS.md. Then vp check, vp test run.
      "upgrade:vite-plus": {
        command: "vp migrate",
        cache: false,
      },
      // The example's tasks (apps/example/vite.config.ts), runnable from the root.
      login: { command: "vp run example#login", cache: false },
      status: { command: "vp run example#status", cache: false },
      logs: { command: "vp run example#logs", cache: false },
      rollback: { command: "vp run example#rollback", cache: false },
      // The example's deploy, saving the URL Void reports for test:production (e2e/deploy.ts).
      deploy: { command: "vpx e2e/deploy.ts", cache: false },
      "deploy:atomic": { command: "vpx e2e/deploy.ts --atomic", cache: false },
      // This branch as a Cloudflare Worker Preview beside production: the preview build (e2e/preview.ts),
      // then Cloudflare's cf uploads it. Workers Builds runs these two for every branch but main.
      "build:preview": { command: "vpx e2e/preview.ts", cache: false },
      "deploy:preview": {
        command:
          "vp run build:preview && cd apps/example && npx cf previews deploy --prebuilt --mode production",
        cache: false,
      },
    },
  },
  lint: {
    // e2e/fresh/app/: pages copied into the fresh apps, linted and type-checked there.
    ignorePatterns: ["e2e/fresh/app/**"],
    plugins: ["typescript", "react"],
    // What `void-fbtee init` asks a workspace's root config for: fbtee's rules and void-fbtee's own.
    jsPlugins: ["@nkzw/eslint-plugin-fbtee", "void-fbtee/lint"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      // `fbt` / `fbs` are used through <fbt> JSX, which fbtee's compiler rewrites into calls.
      "no-unused-vars": ["warn", { varsIgnorePattern: "^(fbt|fbs)$" }],
      "@nkzw/fbtee/no-empty-strings": "error",
      "@nkzw/fbtee/no-unhelpful-desc": "error",
      "void-fbtee/no-show-count-no": "error",
    },
  },
  fmt: {
    // Written by tools, not by hand: fbtee (catalogs), drizzle (migrations), Void, Vite+ and
    // void-fbtee (AGENTS.md).
    ignorePatterns: ["**/i18n/translations/**", "**/db/migrations/**", "**/AGENTS.md"],
  },
  // `vp test run`: the package's unit tests, and the browser tests on the example (e2e/), which
  // Vitest runs with Playwright's library, as voidzero-dev/void does. e2e/setup.ts builds once
  // and starts the production preview.
  test: {
    // Every run's report, where Vitest 5 puts it: .vitest/index.html (open in a browser) and
    // .vitest/json/output.json. Git ignores .vitest/.
    reporters: ["default", "html", "json"],
    projects: [
      "packages/void-fbtee",
      {
        test: {
          name: "e2e",
          include: ["e2e/*.test.ts"],
          globalSetup: ["e2e/setup.ts"],
          pool: "forks",
          // No time limits: each step waits for what it needs, then the next runs. A step that never
          // happens leaves the test unfinished, and its name says where.
          testTimeout: 0,
          hookTimeout: 0,
          // One file after another, in order, after the package's unit tests.
          fileParallelism: false,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
