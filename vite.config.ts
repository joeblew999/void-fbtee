// Root Vite+ config: the repo's tasks, and format, lint, type-check and test settings.
// Built-in commands: `vp check` (format, lint, types) and `vp test run` (every test project).
import { fileURLToPath } from "node:url";
import fbtee from "@nkzw/eslint-plugin-fbtee";
import { defineConfig } from "vite-plus";
import { voidRules } from "./lint/void-rules";

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
      // The package rebuilding on save, and the example's dev server, together. The package is
      // built once first: otherwise the example can load its old dist/ before the watch's first
      // rebuild lands, and translate with code from before the change (it did, 2026-11-17:
      // plans/translation-rework.md, "Found").
      // (Not dependsOn: under `vp run -r --parallel` it ran the build again, alongside, and the
      // example found dist/ empty.)
      dev: {
        command: ["vp run void-fbtee#build", "vp run -r --parallel dev"],
        cache: false,
      },
      // Chromium and WebKit (Safari's engine) for the browser tests (once per machine).
      "install:browser": {
        command: "playwright install --with-deps chromium webkit",
        cache: false,
      },
      // Chromium alone: what the live check after a deploy uses (e2e/deployed/), as CI's deploy
      // job installs it.
      "install:chromium": {
        command: "playwright install --with-deps chromium",
        cache: false,
      },
      // The tests, one task per stage (Void's TESTING.md: run only the part you need). Where each
      // stage's email, AI, queues, crons and page cache come from, and what each suite checks: the
      // README's "Testing".
      // Unit: the package's (packages/void-fbtee/test/unit/), the lint rules' (lint/rules.test.ts)
      // and the example's (beside its code).
      "test:unit": {
        command: "vp test run --project unit --project lint && vp run void-fbtee-example#test",
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
      // The live site's database reads as visitors elsewhere get them: its /api/database asked
      // from Globalping's probes in each place (default Thailand and Virginia), scripts/database-from.ts.
      "database:from": { command: "vpx scripts/database-from.ts", cache: false },
      // The preview suite against the live site, at the URL Void reported on the last deploy
      // (scripts/production.ts), less the tests that post or book: on the live site those would
      // call Workers AI and send real email (Void: live tests are opt-in and send nothing).
      "test:production": { command: "vpx scripts/production.ts", cache: false },
      // void-fbtee installed into fresh `void init` apps, as a user's app installs it.
      "test:fresh": { command: "vpx e2e/fresh/check.ts", cache: false },
      // Vite+'s, Void's and void-fbtee's setup commands, run again: fails if any changes a file.
      "check:tools": { command: "vpx scripts/check-tools.ts", cache: false },
      // In a Claude cloud session: the dev server (vp run dev) on a public https address through
      // Tailscale Funnel, so any browser can open it without deploying (scripts/tailscale.ts). On a
      // Mac, open http://localhost:5173 instead.
      "tailscale:login": { command: "vpx scripts/tailscale.ts login", cache: false },
      "tailscale:logout": { command: "vpx scripts/tailscale.ts logout", cache: false },
      // How the machine translations fared in Claude's reviews, by language and translator
      // (scripts/translations-reviews.ts, plans/translation-rework.md step 7).
      "translations:reviews": { command: "vpx scripts/translations-reviews.ts", cache: false },
      // The example's tasks (apps/example/vite.config.ts), runnable from the root.
      login: { command: "vp run void-fbtee-example#login", cache: false },
      status: { command: "vp run void-fbtee-example#status", cache: false },
      logs: { command: "vp run void-fbtee-example#logs", cache: false },
      rollback: { command: "vp run void-fbtee-example#rollback", cache: false },
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
    // Void's own settings (lint/void-rules.ts names the commit): its default category off and
    // every rule listed, its plugins and environments, and its vite-plus plugin.
    categories: { correctness: "off" },
    env: { browser: true, builtin: true, es2024: true, node: true },
    plugins: ["typescript", "import", "react", "unicorn", "vitest", "node", "jsdoc", "oxc"],
    // Void's vite-plus plugin; then what `void-fbtee init` asks a workspace's root config for:
    // fbtee's lint rules.
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      "@nkzw/eslint-plugin-fbtee",
    ],
    options: { typeAware: true, typeCheck: true },
    rules: {
      // Void's own list, whole (lint/void-rules.ts). This repo's rules come after it.
      ...voidRules,
      // `fbt` / `fbs` are used through <fbt> JSX, which fbtee's compiler rewrites into calls.
      // Void's setting (lint/void-rules.ts), with fbtee's names added: `fbt` / `fbs` are used
      // through <fbt> JSX, which fbtee's compiler rewrites into calls.
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^(_|fbt$|fbs$)" }],
      // fbtee's own set, as its README shows: strict, which also finds text nobody wrapped for
      // translation. Left as they are: names (the site's, products', APIs') and JSX spacing and
      // punctuation, which no language translates.
      ...fbtee.configs.strict.rules,
      "@nkzw/fbtee/no-untranslated-strings": [
        "error",
        { ignoredWords: [" ", ".", "…", "$", "void-fbtee", "GitHub", "Intl", "Temporal"] },
      ],
      // Void's `db` may read a D1 replica that hasn't caught up (plans/reliable-work.md): the app
      // reads through its own primaryDb() (apps/example/src/db.ts), which starts on the main copy,
      // and hands it to the package (src/content.ts).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "void/db",
              importNames: ["db"],
              message:
                "use the app's primaryDb() (src/db.ts): Void's db may read a replica that hasn't caught up (plans/reliable-work.md).",
            },
          ],
        },
      ],
      // This repo's own, on top of Void's (plans/checked-everywhere.md): every type comes from a real
      // source (Void's generated types, the Drizzle schema, or a check on data as it arrives), never
      // from code saying so. TypeScript allows each of these even when strict, and Void's list
      // doesn't forbid them. A value read at run time goes through a check (a type guard) instead.
      // No casts (`as const` is fine): a cast makes TypeScript believe what it can't check.
      "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      // No value used as `any` (from JSON.parse, require(), a loosely typed library): `any` turns
      // checking off for everything it touches.
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-unsafe-argument": "error",
      // No `!`: "this is never empty", unchecked. Lookups are "maybe nothing" too
      // (noUncheckedIndexedAccess in each tsconfig), so the check is written where it's needed.
      "typescript/no-non-null-assertion": "error",
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
  // as Void's do. The example's own unit tests run from inside it (`vp run void-fbtee-example#test`): Void
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
      // The lint rules themselves, proven in every folder (lint/rules.test.ts): with the unit tests.
      { test: { name: "lint", include: ["lint/*.test.ts"] } },
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
