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
    },
    format: ["esm"],
    dts: true,
    deps: { neverBundle: [/^virtual:void-fbtee\//] },
  },
});
