// Builds the package with `vp pack` (tsdown). Virtual modules are made by the plugin at the app's build time.
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      vite: "src/vite.ts",
      middleware: "src/middleware.ts",
      react: "src/react.tsx",
      locales: "src/locales.ts",
      client: "src/client.ts",
      cli: "src/cli.ts",
      lint: "src/lint.ts",
    },
    format: ["esm"],
    dts: true,
    deps: { neverBundle: [/^virtual:void-fbtee\//] },
  },
  // `vp test`: the package's own tests, on test/fixture (a tiny app; each test works on a copy),
  // and init's on apps `void init` makes (test/void-init.ts).
  test: { include: ["test/**/*.test.ts"], globalSetup: ["test/void-init.ts"] },
});
