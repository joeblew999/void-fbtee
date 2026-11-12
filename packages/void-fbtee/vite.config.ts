// Builds the package with `vp pack` (tsdown). Virtual modules are made by the plugin at the app's build time.
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      plugin: "src/plugin.ts",
      middleware: "src/middleware.ts",
      react: "src/react.tsx",
      locales: "src/locales.ts",
      client: "src/client.ts",
      cli: "src/cli.ts",
      lint: "src/lint.ts",
    },
    format: ["esm"],
    dts: true,
    // Nothing from node_modules is bundled, code or types: a copy would differ from the app's
    // own (Hono's types once came in through the middleware's, as Void's defineMiddleware returns
    // Hono's type). onlyBundle makes any bundled package a build error.
    deps: { neverBundle: [/^virtual:void-fbtee\//], onlyBundle: [] },
    // Checks of the package as the people who install it get it, on every build: publint (the
    // package as npm would publish it), Are the Types Wrong? (its types resolve for every
    // consumer; ES modules only, so the esm-only profile), and dependencies declared but unused.
    // package.json's exports are written from the entries (as Vite+'s library template does),
    // so they can't drift from them, and checked by the two above.
    // The command (bin) is run, not imported, so it isn't an export.
    exports: { exclude: ["cli"] },
    publint: true,
    attw: { profile: "esm-only" },
    unused: true,
  },
  // `vp test`: the package's own tests, on test/fixture (a tiny app; each test works on a copy),
  // and init's on apps `void init` makes (test/void-init.ts).
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/void-init.ts"],
    // As the browser tests: one file after another, no time limits; run before them.
    fileParallelism: false,
    testTimeout: 0,
    hookTimeout: 0,
    sequence: { groupOrder: 1 },
  },
});
