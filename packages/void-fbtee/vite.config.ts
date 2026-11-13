// Builds the package with `vp pack` (tsdown). Virtual modules are made by the plugin at the app's build time.
import { connect } from "node:net";
import { defineConfig } from "vite-plus";

// The example's dev server (`vp run dev`): apps/example/vite.config.ts, server.port. It runs its
// own `vp pack --watch --no-clean` and loads dist/ as it goes.
const DEV_PORT = 5173;
const devServerRunning = () =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host: "localhost", port: DEV_PORT });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

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
      head: "src/head.ts",
      server: "src/server.ts",
      routes: "src/routes.ts",
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
    // A full build empties dist/ first (tsdown's clean, right after this hook), and the dev
    // server loads the package from there: its pages fail until it reloads. So a full build stops
    // while the dev server runs; its own watcher keeps dist/ current anyway.
    hooks: {
      async "build:prepare"(ctx) {
        if (!ctx.options.watch && (await devServerRunning()))
          throw new Error(
            `the dev server is running (port ${DEV_PORT}), and it loads the package from dist/, ` +
              "which a full build empties: its watcher already keeps dist/ current; stop vp run dev to build",
          );
      },
    },
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
