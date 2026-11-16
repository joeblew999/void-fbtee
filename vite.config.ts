// Root Vite+ config: the repo's tasks, and format, lint, type-check and test settings.
// Built-in commands: `vp check` (format, lint, types) and `vp test run` (every test project).
import { fileURLToPath } from "node:url";
import fbtee from "@nkzw/eslint-plugin-fbtee";
import { defineConfig } from "vite-plus";

/**
 * A browser-test project: e2e/<name>/*.test.ts, with e2e/<setup>/setup.ts starting what it tests,
 * run `order`-th, in its own processes. Its files one after another unless said otherwise: they
 * share one server and its database.
 */
const e2e = (name: string, order: number, { setup = name, oneFileAtATime = true } = {}) => ({
  test: {
    name,
    include: [`e2e/${name}/*.test.ts`],
    globalSetup: [`e2e/${setup}/setup.ts`],
    pool: "forks" as const,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    ...(oneFileAtATime && { fileParallelism: false }),
    sequence: { groupOrder: order },
  },
});

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
      "install:browser": {
        command: "playwright install --with-deps chromium webkit",
        cache: false,
      },
      // The tests, one task per stage (Void's TESTING.md: run only the part you need). Where each
      // stage's email, AI, queues, crons and page cache come from, and what each suite checks: the
      // README's "Testing".
      // Unit: the package's (packages/void-fbtee/test/unit/) and the example's (beside its code).
      "test:unit": {
        command: "vp test run --project unit && vp run example#test",
        cache: false,
      },
      // The production build in the local preview: the full browser contract (e2e/preview/).
      "test:preview": { command: "vp test run --project preview", cache: false },
      // The dev server: Void's email inbox, queue and cron triggers, and Workers AI (e2e/dev/).
      // Yours if `vp run dev` is running, else it starts one. Not at the same time as test:preview:
      // they share the local database.
      "test:dev": { command: "vp test run --project dev", cache: false },
      // Every page in every language, in Chromium, WebKit (Safari's engine) and WebKit as today's
      // iPhones have it (no built-in Temporal), on the preview (e2e/browsers/). Run it when pages
      // change; not in CI.
      "test:browsers": { command: "vp test run --project browsers", cache: false },
      // The quick live check (e2e/deployed/live.test.ts) against what the last `vp run deploy`
      // deployed (scripts/deployed.ts). CI's deploy job runs it after deploying.
      "test:deployed": { command: "vpx scripts/deployed.ts", cache: false },
      // The preview suite against the live site, at the URL Void reported on the last deploy
      // (scripts/production.ts), less the tests that post or book: on the live site those would
      // call Workers AI and send real email (Void: live tests are opt-in and send nothing).
      "test:production": { command: "vpx scripts/production.ts", cache: false },
      // void-fbtee installed into fresh `void init` apps, as a user's app installs it.
      "test:fresh": { command: "vpx e2e/fresh/check.ts", cache: false },
      // Vite+'s, Void's and void-fbtee's setup commands, run again: fails if any changes a file.
      "check:tools": { command: "node scripts/check-tools.mjs", cache: false },
      // In a Claude cloud session: the dev server (vp run dev) on a public https address through
      // Tailscale Funnel, so any browser can open it without deploying (scripts/tailscale.ts). On a
      // Mac, open http://localhost:5173 instead.
      "tailscale:login": { command: "vpx scripts/tailscale.ts login", cache: false },
      "tailscale:logout": { command: "vpx scripts/tailscale.ts logout", cache: false },
      // The example's tasks (apps/example/vite.config.ts), runnable from the root.
      login: { command: "vp run example#login", cache: false },
      status: { command: "vp run example#status", cache: false },
      logs: { command: "vp run example#logs", cache: false },
      rollback: { command: "vp run example#rollback", cache: false },
      // The example's deploy, saving the URL Void reports for test:production (scripts/deploy.ts).
      deploy: { command: "vpx scripts/deploy.ts", cache: false },
      "deploy:atomic": { command: "vpx scripts/deploy.ts --atomic", cache: false },
      // This branch as a Cloudflare Worker Preview beside production: the preview build (scripts/preview.ts),
      // then Cloudflare's cf uploads it (it needs cf's own login).
      "build:preview": { command: "vpx scripts/preview.ts", cache: false },
      "deploy:preview": {
        command:
          "vp run build:preview && cd apps/example && npx cf previews deploy --prebuilt --mode production",
        cache: false,
      },
    },
  },
  lint: {
    // e2e/fresh/app/ and thai/: pages copied into the fresh apps, linted and type-checked there.
    ignorePatterns: ["e2e/fresh/app/**", "e2e/fresh/thai/**"],
    plugins: ["typescript", "react"],
    // What `void-fbtee init` asks a workspace's root config for: fbtee's lint rules.
    jsPlugins: ["@nkzw/eslint-plugin-fbtee"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      // `fbt` / `fbs` are used through <fbt> JSX, which fbtee's compiler rewrites into calls.
      "no-unused-vars": ["warn", { varsIgnorePattern: "^(fbt|fbs)$" }],
      // fbtee's own set, as its README shows: strict, which also finds text nobody wrapped for
      // translation. Left as they are: names (the site's, products', APIs') and JSX spacing and
      // punctuation, which no language translates.
      ...fbtee.configs.strict.rules,
      "@nkzw/fbtee/no-untranslated-strings": [
        "error",
        { ignoredWords: [" ", ".", "…", "$", "void-fbtee", "GitHub", "Intl", "Temporal"] },
      ],
    },
  },
  fmt: {
    // Written by tools, not by hand: fbtee (catalogs), drizzle (migrations), Void, Vite+ and
    // void-fbtee (AGENTS.md).
    ignorePatterns: ["**/i18n/translations/**", "**/db/migrations/**", "**/AGENTS.md"],
  },
  // The tests, by stage (Void's TESTING.md and its own vite.config.ts): `unit`, the package's
  // (packages/void-fbtee/vite.config.ts); `preview` and `browsers` on the production build in the
  // local preview (e2e/preview/setup.ts); `dev` on the dev server (e2e/dev/setup.ts); `deployed` on
  // the live site (e2e/deployed/setup.ts). The browser tests drive Playwright's library from Vitest,
  // as Void's do. The example's own unit tests run from inside it (`vp run example#test`): Void
  // finds an app from where it runs. A plain `vp test run` selects every project; `dev` and
  // `deployed` then skip themselves and say which task runs them.
  test: {
    // Every run's report, where Vitest 5 puts it: .vitest/index.html (open in a browser) and
    // .vitest/json/output.json. Git ignores .vitest/.
    reporters: ["default", "html", "json"],
    // Output only for what failed, as Void's own config.
    silent: "passed-only",
    // One project per stage, as Void's own vite.config.ts names them by kind. Unit tests keep
    // Vitest's own time limits; the others build, start servers and drive browsers, so they get
    // Void's 120 seconds per test and per hook: a step that never happens fails within two minutes
    // and names itself, where with no limit CI once hung for over an hour (2026-11-13).
    projects: [
      "packages/void-fbtee",
      {
        // The app's own `@/` (apps/example/tsconfig.json), for tests that import its code to compute
        // what a page should show (e2e/preview/islands.test.ts: src/docs/fmt.ts).
        resolve: { alias: { "@/": fileURLToPath(new URL("apps/example/src/", import.meta.url)) } },
        ...e2e("preview", 2),
      },
      e2e("browsers", 3, { setup: "preview" }),
      e2e("dev", 4),
      e2e("deployed", 5, { oneFileAtATime: false }),
    ],
  },
});
