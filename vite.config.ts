// Root Vite+ config: format, lint and type-check settings for the whole repo.
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    // e2e/fresh/<toolchain>/: what `void init` wrote, kept as it wrote it (no node_modules there).
    ignorePatterns: ["e2e/fresh/vite-plus/**", "e2e/fresh/vite/**"],
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
    // Written by tools, not by hand: fbtee (catalogs), drizzle (migrations), void init (AGENTS.md
    // and the fresh-install apps in e2e/fresh/).
    ignorePatterns: [
      "**/i18n/translations/**",
      "**/db/migrations/**",
      "**/AGENTS.md",
      "e2e/fresh/vite-plus/**",
      "e2e/fresh/vite/**",
    ],
  },
  // `vp test run`: the package's unit tests, and the browser tests on the example (e2e/), which
  // Vitest runs with Playwright's library, as voidzero-dev/void does. e2e/setup.ts builds once
  // and starts the production preview and the dev server.
  test: {
    projects: [
      "packages/void-fbtee",
      {
        test: {
          name: "e2e",
          include: ["e2e/*.test.ts"],
          globalSetup: ["e2e/setup.ts"],
          pool: "forks",
          // Browser tests wait on page loads and dev reloads; Vitest's 5 s default is for unit
          // tests (void's integration project sets its own too).
          testTimeout: 60_000,
        },
      },
    ],
  },
});
