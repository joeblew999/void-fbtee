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
      // Every browser test against the deployed site, at the URL Void reported on the last deploy
      // (e2e/live.ts). Deploying and testing are separate: `vp run deploy`, then this.
      "test:live": { command: "vpx e2e/live.ts", cache: false },
      "test:fresh": { command: "vpx e2e/fresh/check.ts", cache: false },
      // Vite+'s, Void's and void-fbtee's setup commands, run again: fails if any changes a file.
      "check:tools": { command: "node e2e/check-tools.mjs", cache: false },
      // Move the project to the global vp's version (`vp upgrade` first): the catalog's pins and
      // the Vite+ section of AGENTS.md. Then vp check, vp test run.
      "upgrade:vite-plus": {
        command: "vp migrate --agent agents --no-editor --no-hooks --no-interactive",
        cache: false,
      },
      // The example's tasks (apps/example/vite.config.ts), runnable from the root.
      login: { command: "vp run example#login", cache: false },
      // The example's deploy, saving the URL Void reports for test:live (e2e/deploy.ts).
      deploy: { command: "vpx e2e/deploy.ts", cache: false },
      "deploy:atomic": { command: "vp run example#deploy:atomic", cache: false },
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
    projects: [
      "packages/void-fbtee",
      {
        test: {
          name: "e2e",
          include: ["e2e/*.test.ts"],
          globalSetup: ["e2e/setup.ts"],
          pool: "forks",
          // Real servers and browsers, locally or over the internet: voidzero-dev/void gives its
          // integration tests the same (its vite.config.ts, the parallel-integration project).
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
